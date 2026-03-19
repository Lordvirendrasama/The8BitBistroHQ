'use client';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { useAuth } from '@/firebase/auth/use-user';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import type { Shift, ShiftTask } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';
import { getActiveOrStartShift, updateTask } from '@/firebase/firestore/shifts';
import { StartOfDayTasks } from '@/components/staff/start-of-day-tasks';
import { GlobalTimerNotifications } from '@/components/notifications/global-timer-notifications';
import { collection, query, where, onSnapshot } from 'firebase/firestore';

export default function AppLayout({ children }: { children: React.Node }) {
  const { user, loading } = useAuth();
  const router = useRouter();
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
            if (user.username === 'Viren') {
                const hasPending = (shiftData.tasks || []).some(t => t.type === 'strategic' && !t.completed);
                setTasksVisible(hasPending);
            }
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
    if (!newCompletedStatus && (task.type === 'start-of-day' || task.type === 'strategic')) {
      setTasksVisible(true);
    }
    toast({ title: "Audit Updated" });
  };

  useEffect(() => {
    if (!loading && !user) router.push('/login');
  }, [user, loading, router]);

  if (loading || isLoadingShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-background font-body">
        <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-headline text-[10px] tracking-widest text-muted-foreground animate-pulse uppercase">Syncing Bistro OS...</p>
        </div>
      </div>
    );
  }

  const showTaskNotification = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'guest';

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader 
          activeShift={activeShift} 
          onTaskToggle={handleTaskToggle}
          tasksVisible={tasksVisible}
          setTasksVisible={setTasksVisible}
          uncompletedTaskCount={activeShift?.tasks.filter(t => !t.completed && (t.type === 'start-of-day' || t.type === 'strategic')).length || 0}
        />
        <main className="p-3 sm:p-6 lg:p-8 bg-background min-h-0 overflow-y-auto">
          <GlobalTimerNotifications />
          {showTaskNotification && activeShift && tasksVisible && (
            <StartOfDayTasks
              tasks={activeShift.tasks}
              onTaskToggle={handleTaskToggle}
              onMinimize={() => setTasksVisible(false)}
              employees={activeShift.employees}
            />
          )}
          <div className="max-w-full">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}