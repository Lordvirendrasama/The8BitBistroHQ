'use client';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { useAuth } from '@/firebase/auth/use-user';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Shift, ShiftTask } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { getActiveOrStartShift, updateTask } from '@/firebase/firestore/shifts';
import { StartOfDayTasks } from '@/components/staff/start-of-day-tasks';
import { GlobalTimerNotifications } from '@/components/notifications/global-timer-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { CustomerViewProvider } from '@/context/customer-view-context';
import { ShieldAlert } from 'lucide-react';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [tasksVisible, setTasksVisible] = useState(true);

  // Atomic Shift Initialization and Listener
  useEffect(() => {
    let isMounted = true;
    if (!user || !db || (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'guest')) {
        setIsLoadingShift(false);
        return;
    }

    // 1. Core Shift Logic: Atomic initialization
    getActiveOrStartShift(user).catch(err => {
        console.error("Initialization error:", err);
    });

    // 2. Atomic Listener: Listen ONLY for THIS user's active shift
    const q = query(
        collection(db, 'shifts'),
        where('staffId', '==', user.username),
        where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMounted) return;
        if (!snapshot.empty) {
            const shiftData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as Shift;
            setActiveShift(shiftData);
            // Removed auto-minimize logic so users can check multiple boxes without the UI disappearing
        } else {
            setActiveShift(null);
        }
        setIsLoadingShift(false);
    }, (error) => {
        console.error("Atomic Shift sync error:", error);
        if (isMounted) setIsLoadingShift(false);
    });

    return () => { isMounted = false; unsubscribe(); };
  }, [user, db]);

  const handleTaskToggle = async (task: ShiftTask, result?: 'yes' | 'no') => {
    if (!user || !activeShift) return;
    const newCompletedStatus = result ? true : !task.completed;
    await updateTask(activeShift.id, task.name, newCompletedStatus, user, result);
    if (!newCompletedStatus && (task.shiftType !== undefined || task.type === 'strategic')) {
      setTasksVisible(true);
    }
    toast({ title: "Audit Updated" });
  };

  // Determine path restrictions dynamically
  const hasAccess = useMemo(() => {
    if (loading || !user) return false;

    const isAdmin = user.role === 'admin';
    const isOwner = user.username === 'Viren';

    // 1. Owner-only routes
    const ownerOnlyPrefixes = ['/scan', '/owner-tasks', '/owner-dashboard', '/financials/loan', '/financials/rent', '/financials/burden-selector'];
    const isOwnerRoute = ownerOnlyPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
    if (isOwnerRoute && !isOwner) return false;

    // 2. Admin-only routes
    const adminOnlyPrefixes = ['/settings', '/users', '/analytics', '/attendance', '/leaves', '/staff'];
    const isAdminRoute = adminOnlyPrefixes.some(prefix => pathname === prefix || pathname.startsWith(prefix + '/'));
    if (isAdminRoute && !isAdmin) return false;

    // 3. Financials routes (except spending & stock)
    const isFinancialsRoute = pathname.startsWith('/financials') && !pathname.startsWith('/financials/spending');
    if (isFinancialsRoute && !isAdmin) return false;

    return true;
  }, [user, loading, pathname]);

  // Route security redirection and user check
  useEffect(() => {
    if (loading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    if (!hasAccess) {
      toast({
        title: "Access Restricted",
        description: "You do not have the required operator clearances to view this terminal.",
        variant: "destructive"
      });
      router.push('/dashboard');
    }
  }, [user, loading, hasAccess, router, toast]);

  if (loading || isLoadingShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-body">
        <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-headline text-sm tracking-normal text-muted-foreground animate-pulse uppercase">Syncing Bistro OS...</p>
        </div>
      </div>
    );
  }

  const showTaskNotification = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'guest';

  return (
    <CustomerViewProvider>
      <SidebarProvider>
        <AppSidebar />
        <SidebarInset>
          <AppHeader 
            activeShift={activeShift} 
            onTaskToggle={handleTaskToggle}
            tasksVisible={tasksVisible}
            setTasksVisible={setTasksVisible}
            uncompletedTaskCount={activeShift?.tasks.filter(t => !t.completed && (t.shiftType !== undefined || t.type === 'strategic')).length || 0}
          />
          <main className="p-3 sm:p-6 lg:p-8 bg-transparent min-h-0 overflow-y-auto">
            <GlobalTimerNotifications />
            {showTaskNotification && activeShift && tasksVisible && (
              <StartOfDayTasks
                tasks={activeShift.tasks}
                onTaskToggle={handleTaskToggle}
                onMinimize={() => setTasksVisible(false)}
                employees={activeShift.employees}
              />
            )}
            <div className="max-w-full">
              {hasAccess ? children : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center text-destructive">
                    <ShieldAlert className="h-6 w-6 animate-pulse" />
                  </div>
                  <h2 className="font-headline text-lg tracking-wider text-destructive uppercase">Access Restricted</h2>
                  <p className="text-sm text-muted-foreground max-w-sm uppercase font-bold tracking-tight">
                    You do not have the required operator clearances to view this terminal. Redirecting...
                  </p>
                </div>
              )}
            </div>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </CustomerViewProvider>
  );
}