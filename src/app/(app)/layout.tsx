
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
    // Guest now allowed to participate in shifts
    if (user && db && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest')) {
        setIsLoadingShift(true);
        getActiveOrStartShift(user).then(shift => {
            setActiveShift(shift);
            setIsLoadingShift(false);
        });
    } else {
        setActiveShift(null);
        setIsLoadingShift(false);
    }
  }, [user, db]);

  // All relevant tasks for the current shift
  const shiftTasks = useMemo(() => {
    return activeShift?.tasks || [];
  }, [activeShift]);

  // Count of uncompleted tasks for the header badge
  const uncompletedTaskCount = useMemo(() => {
    return shiftTasks.filter(task => !task.completed).length;
  }, [shiftTasks]);

  const handleTaskToggle = async (task: ShiftTask) => {
    if (!user || !activeShift) return;
    const newCompletedStatus = !task.completed;
    await updateTask(activeShift.id, task.name, newCompletedStatus, user);
    
    // If a task is being unchecked, force the notification to be visible
    if (!newCompletedStatus) {
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
      <div className="flex h-screen items-center justify-center">
        <div>Loading...</div>
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
