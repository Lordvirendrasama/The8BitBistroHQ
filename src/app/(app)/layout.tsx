
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


export default function AppLayout({ children }: { children: React.Node }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { db } = useFirebase();
  const { toast } = useToast();

  const [activeShift, setActiveShift] = useState<Shift | null>(null);
  const [isLoadingShift, setIsLoadingShift] = useState(true);
  const [tasksVisible, setTasksVisible] = useState(true);

  // Effect to get or create the daily shift
  useEffect(() => {
    let isMounted = true;

    async function initializeShift() {
        if (user && db && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest')) {
            setIsLoadingShift(true);
            try {
                const shift = await getActiveOrStartShift(user);
                if (isMounted) {
                    setActiveShift(shift);
                    // LOGIC: Auto-minimize tasks for Viren (Owner) account only
                    if (user.username === 'Viren') {
                        setTasksVisible(false);
                    }
                }
            } catch (error) {
                console.error("Critical: Failed to load shift data:", error);
                if (isMounted) {
                    toast({
                        variant: 'destructive',
                        title: "Sync Error",
                        description: "Could not retrieve daily shift. Check your connection."
                    });
                }
            } finally {
                if (isMounted) {
                    setIsLoadingShift(false);
                }
            }
        } else {
            if (isMounted) {
                setActiveShift(null);
                setIsLoadingShift(false);
            }
        }
    }

    initializeShift();

    return () => {
        isMounted = false;
    };
  }, [user, db, toast]);

  // All relevant tasks for the current shift
  const shiftTasks = useMemo(() => {
    return activeShift?.tasks || [];
  }, [activeShift]);

  // Count of uncompleted morning tasks for the header badge and notification visibility
  const uncompletedMorningTaskCount = useMemo(() => {
    return shiftTasks.filter(task => task.type === 'start-of-day' && !task.completed).length;
  }, [shiftTasks]);

  const handleTaskToggle = async (task: ShiftTask) => {
    if (!user || !activeShift) return;
    const newCompletedStatus = !task.completed;
    await updateTask(activeShift.id, task.name, newCompletedStatus, user);
    
    // If a morning task is being unchecked, force the notification to be visible
    if (!newCompletedStatus && task.type === 'start-of-day') {
      setTasksVisible(true);
    }

    // Manually update local state for immediate UI feedback
    setActiveShift(prev => {
        if (!prev) return null;
        const now = new Date().toISOString();
        const newTasks = (prev.tasks || []).map(t => 
          t.name === task.name 
            ? {
                ...t, 
                completed: newCompletedStatus, 
                completedAt: newCompletedStatus ? now : undefined,
                completedBy: newCompletedStatus ? { username: user.username, displayName: user.displayName } : undefined
              } 
            : t
        );
        return {...prev, tasks: newTasks};
    });

    toast({ 
      title: "Task Updated", 
      description: `"${task.name}" marked as ${newCompletedStatus ? 'complete' : 'incomplete'}.` 
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

  // Show task notification for admin, staff, and guests (who now act as staff)
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
          uncompletedTaskCount={uncompletedMorningTaskCount}
        />
        <main className="p-3 sm:p-6 lg:p-8 bg-background min-h-0 overflow-y-auto">
          <GlobalTimerNotifications />
          {showTaskNotification && uncompletedMorningTaskCount > 0 && tasksVisible && (
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
