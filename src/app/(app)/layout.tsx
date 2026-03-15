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
import { collection, query, where, limit, onSnapshot } from 'firebase/firestore';
import { getBusinessDate } from '@/lib/utils';


export default function AppLayout({ children }: { children: React.Node }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [tasksVisible, setTasksVisible] = useState(true);

  // Effect to ensure shift is initialized and then listen for changes in real-time
  useEffect(() => {
    let isMounted = true;

    if (!user || !db || (user.role !== 'staff' && user.role !== 'admin' && user.role !== 'guest')) {
        setIsLoadingShift(false);
        return;
    }

    // 1. Ensure shift is initialized (starts it if missing)
    getActiveOrStartShift(user).catch(err => {
        console.error("Initialization error:", err);
    });

    // 2. Set up real-time listener for the current business day's shift
    const businessToday = getBusinessDate();
    const q = query(
        collection(db, 'shifts'),
        where('date', '==', businessToday),
        limit(1)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!isMounted) return;
        
        if (!snapshot.empty) {
            const shiftDoc = snapshot.docs[0];
            const shiftData = { id: shiftDoc.id, ...shiftDoc.data() } as Shift;
            setActiveShift(shiftData);
            
            // Strategic Logic: Auto-minimize tasks for Viren unless pending
            if (user.username === 'Viren') {
                const hasPendingStrategic = (shiftData.tasks || []).some(t => t.type === 'strategic' && !t.completed);
                setTasksVisible(hasPendingStrategic);
            }
        } else {
            setActiveShift(null);
        }
        setIsLoadingShift(false);
    }, (error) => {
        console.error("Shift sync error:", error);
        if (isMounted) setIsLoadingShift(false);
    });

    return () => {
        isMounted = false;
        unsubscribe();
    };
  }, [user, db]);

  // All relevant tasks for the current shift
  const shiftTasks = useMemo(() => {
    return activeShift?.tasks || [];
  }, [activeShift]);

  // Count of uncompleted morning/strategic tasks for visibility
  const uncompletedTaskCount = useMemo(() => {
    const isOwner = user?.username === 'Viren';
    return shiftTasks.filter(task => {
        if (task.completed) return false;
        if (task.type === 'start-of-day' && (!task.ownerOnly || isOwner)) return true;
        if (task.type === 'strategic' && isOwner) return true;
        return false;
    }).length;
  }, [shiftTasks, user]);

  const handleTaskToggle = async (task: ShiftTask, result?: 'yes' | 'no') => {
    if (!user || !activeShift) return;
    const newCompletedStatus = result ? true : !task.completed;
    await updateTask(activeShift.id, task.name, newCompletedStatus, user, result);
    
    // If a morning task is being unchecked, force the notification to be visible
    if (!newCompletedStatus && (task.type === 'start-of-day' || task.type === 'strategic')) {
      setTasksVisible(true);
    }

    toast({ 
      title: "Audit Updated", 
      description: `"${task.name}" verified.` 
    });
  };


  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  if (loading || isLoadingShift) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
            <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="font-headline text-[10px] tracking-widest text-muted-foreground animate-pulse uppercase">Syncing Bistro OS...</p>
        </div>
      </div>
    );
  }

  // Show task notification for admin, staff, and guests
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
          uncompletedTaskCount={uncompletedTaskCount}
        />
        <main className="p-3 sm:p-6 lg:p-8 bg-background min-h-0 overflow-y-auto">
          <GlobalTimerNotifications />
          {showTaskNotification && uncompletedTaskCount > 0 && tasksVisible && (
            <StartOfDayTasks
              tasks={shiftTasks}
              onTaskToggle={handleTaskToggle}
              onMinimize={() => setTasksVisible(false)}
              employees={activeShift?.employees || []}
            />
          )}
          <div className="max-w-full">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
