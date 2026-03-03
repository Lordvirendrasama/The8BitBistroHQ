
'use client';
import type { ShiftTask } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ListChecks, Minus, Sun, Moon } from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';

interface StartOfDayTasksProps {
  tasks: ShiftTask[];
  onTaskToggle: (task: ShiftTask) => void;
  onMinimize: () => void;
  employees: { displayName: string }[];
}

export function StartOfDayTasks({ tasks, onTaskToggle, onMinimize, employees }: StartOfDayTasksProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  // Only show tasks that are NOT completed in the accountability log
  const sodTasks = useMemo(() => tasks.filter(t => t.type === 'start-of-day' && !t.completed), [tasks]);
  const eodTasks = useMemo(() => tasks.filter(t => t.type === 'end-of-day' && !t.completed), [tasks]);

  // If there are literally no pending tasks, the layout will handle hiding the component via layout.tsx
  if (sodTasks.length === 0 && eodTasks.length === 0) {
    return null;
  }

  const employeeNames = employees.map(e => e.displayName).join(', ');

  const TaskItem = ({ task }: { task: ShiftTask }) => (
    <div className="flex items-start space-x-3 group py-2 px-1">
      <Checkbox
        id={`global-card-${task.name}`}
        checked={task.completed}
        onCheckedChange={() => onTaskToggle(task)}
        className="mt-0.5 h-5 w-5"
      />
      <div className="flex-1 min-w-0">
        <Label
            htmlFor={`global-card-${task.name}`}
            className="text-sm font-bold transition-colors cursor-pointer block leading-tight hover:text-primary"
        >
            {task.name}
        </Label>
        {isAdmin && (
            <p className="text-[9px] text-destructive/80 font-bold uppercase mt-1 tracking-tighter">
                (Pending: {employeeNames})
            </p>
        )}
      </div>
    </div>
  );

  return (
    <Card className="fixed top-20 right-4 sm:right-8 z-50 w-[calc(100vw-32px)] sm:w-full sm:max-w-sm shadow-2xl animate-in fade-in-0 slide-in-from-right-8 border-2 border-primary/20 flex flex-col max-h-[60vh] sm:max-h-[75vh] overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 shrink-0 border-b bg-muted/10">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            Daily Shift Tasks
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-black tracking-widest text-primary/60">Pending Accountability</CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted" onClick={onMinimize}>
          <Minus className="h-4 w-4" />
          <span className="sr-only">Minimize</span>
        </Button>
      </CardHeader>
      
      <ScrollArea className="flex-1 min-h-0 w-full">
        <div className="p-4 space-y-6">
          {sodTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5 px-1 tracking-widest">
                <Sun className="h-3 w-3 text-amber-500" />
                Start of Day
              </h4>
              <div className="space-y-0.5 bg-muted/30 rounded-lg p-1.5 border border-dashed">
                {sodTasks.map((task) => (
                  <TaskItem key={task.name} task={task} />
                ))}
              </div>
            </div>
          )}

          {eodTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1.5 px-1 tracking-widest">
                <Moon className="h-3 w-3 text-primary" />
                Final Tasks
              </h4>
              <div className="space-y-0.5 bg-muted/30 rounded-lg p-1.5 border border-dashed">
                {eodTasks.map((task) => (
                  <TaskItem key={task.name} task={task} />
                ))}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
