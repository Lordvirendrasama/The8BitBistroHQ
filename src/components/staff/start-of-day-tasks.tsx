'use client';
import { useMemo } from 'react';
import type { ShiftTask, Shift } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { ListChecks, Minus, Sun, ShieldCheck, UserCheck, UserX, Clock, CheckCircle2, X } from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { cn, getBusinessDate } from '@/lib/utils';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface StartOfDayTasksProps {
  tasks: ShiftTask[];
  onTaskToggle: (task: ShiftTask, result?: 'yes' | 'no') => void;
  onMinimize: () => void;
  employees: { displayName: string, username: string }[];
}

export function StartOfDayTasks({ tasks, onTaskToggle, onMinimize, employees }: StartOfDayTasksProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  const isAdmin = user?.role === 'admin';
  const isOwner = user?.username === 'Viren';

  // Fetch today's shifts to show live status for verifications
  const shiftsQuery = useMemo(() => {
    if (!db || !isOwner) return null;
    return query(collection(db, 'shifts'), where('date', '==', getBusinessDate()));
  }, [db, isOwner]);

  const { data: todayShifts } = useCollection<Shift>(shiftsQuery);

  // Normal Start of Day Tasks (excluding ownerOnly if not owner)
  const sodTasks = useMemo(() => 
    tasks.filter(t => t.type === 'start-of-day' && !t.completed && (!t.ownerOnly || isOwner)), 
  [tasks, isOwner]);

  // Strategic Verification Tasks (specifically for Viren)
  const strategicTasks = useMemo(() => 
    tasks.filter(t => t.type === 'strategic' && (!t.ownerOnly || isOwner)),
  [tasks, isOwner]);

  if (sodTasks.length === 0 && strategicTasks.filter(t => !t.completed).length === 0) {
    return null;
  }

  const employeeNames = employees.map(e => e.displayName).join(', ');

  const getLiveStatus = (taskName: string) => {
    if (!isOwner || !todayShifts) return null;
    
    // Extract name from "Verify [Name] Presence"
    const targetName = taskName.split(' ')[1]; 
    const shift = todayShifts.find(s => 
        s.staffId === targetName || 
        s.employees?.some(e => e.username === targetName)
    );

    if (shift) {
        return {
            present: true,
            time: format(new Date(shift.startTime), 'p'),
            status: shift.endTime ? `Out: ${format(new Date(shift.endTime), 'p')}` : 'Currently On Duty'
        };
    }
    return { present: false, status: 'Not Logged In' };
  };

  const TaskItem = ({ task }: { task: ShiftTask }) => {
    const liveStatus = task.type === 'strategic' ? getLiveStatus(task.name) : null;
    const isStrategic = task.type === 'strategic';

    return (
        <div className="flex flex-col space-y-3 group py-3 px-2 border-b last:border-0 border-muted/20">
            <div className="flex items-start gap-3">
                {!isStrategic && (
                    <Checkbox
                        id={`global-card-${task.name}`}
                        checked={task.completed}
                        onCheckedChange={() => onTaskToggle(task)}
                        className="mt-0.5 h-5 w-5"
                    />
                )}
                <div className="flex-1 min-w-0">
                    <Label
                        htmlFor={!isStrategic ? `global-card-${task.name}` : undefined}
                        className={cn(
                            "text-sm font-bold transition-colors cursor-pointer block leading-tight hover:text-primary",
                            task.completed && !isStrategic && 'text-muted-foreground line-through opacity-50'
                        )}
                    >
                        {task.name}
                    </Label>
                    
                    {/* Live Verification Metadata for Owner */}
                    {liveStatus && (
                        <div className="mt-1.5 flex items-center gap-2">
                            {liveStatus.present ? (
                                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full border border-emerald-500/20 text-[9px] font-black uppercase">
                                    <UserCheck className="h-2.5 w-2.5" />
                                    LIVE: IN AT {liveStatus.time}
                                </div>
                            ) : (
                                <div className="flex items-center gap-1.5 bg-destructive/5 text-destructive px-2 py-0.5 rounded-full border border-destructive/20 text-[9px] font-black uppercase">
                                    <UserX className="h-2.5 w-2.5" />
                                    NO RECORD FOUND
                                </div>
                            )}
                        </div>
                    )}

                    {isAdmin && !isStrategic && !task.ownerOnly && (
                        <p className="text-[9px] text-destructive/80 font-bold uppercase mt-1 tracking-tighter">
                            (Pending: {employeeNames})
                        </p>
                    )}
                </div>
            </div>

            {isStrategic && !task.completed && (
                <div className="flex gap-2 animate-in fade-in slide-in-from-bottom-1 duration-200">
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest border-emerald-500/30 text-emerald-600 hover:bg-emerald-500 hover:text-white"
                        onClick={() => onTaskToggle(task, 'yes')}
                    >
                        YES
                    </Button>
                    <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 h-8 text-[10px] font-black uppercase tracking-widest border-destructive/30 text-destructive hover:bg-destructive hover:text-white"
                        onClick={() => onTaskToggle(task, 'no')}
                    >
                        NO
                    </Button>
                </div>
            )}

            {isStrategic && task.completed && (
                <div className="flex items-center justify-between bg-muted/20 rounded-lg p-2 border border-dashed animate-in fade-in duration-300">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className={cn("h-3.5 w-3.5", task.verificationResult === 'yes' ? "text-emerald-500" : "text-destructive")} />
                        <span className="text-[10px] font-black uppercase tracking-widest opacity-60">Verified:</span>
                        <Badge variant="outline" className={cn(
                            "text-[9px] font-black uppercase h-4 px-1.5",
                            task.verificationResult === 'yes' ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" : "bg-destructive/10 text-destructive border-destructive/20"
                        )}>
                            {task.verificationResult?.toUpperCase()}
                        </Badge>
                    </div>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-6 w-6 text-muted-foreground hover:text-primary rounded-full"
                        onClick={() => onTaskToggle(task)}
                    >
                        <X className="h-3 w-3" />
                    </Button>
                </div>
            )}
        </div>
    );
  };

  return (
    <Card className="fixed top-20 right-4 sm:right-8 z-50 w-[calc(100vw-32px)] sm:w-full sm:max-w-sm shadow-2xl animate-in fade-in-0 slide-in-from-right-8 border-2 border-primary/20 flex flex-col bg-background/95 backdrop-blur-xl" style={{ maxHeight: 'calc(100vh - 96px)' }}>
      <CardHeader className="flex flex-row items-center justify-between p-4 pb-2 shrink-0 border-b bg-muted/10">
        <div className="space-y-1">
          <CardTitle className="text-lg flex items-center gap-2">
            <ListChecks className="h-5 w-5 text-primary" />
            {isOwner ? 'Operational Audit' : 'Daily Shift Tasks'}
          </CardTitle>
          <CardDescription className="text-[10px] uppercase font-black tracking-widest text-primary/60">
              {isOwner ? 'STRATEGIC VERIFICATION' : 'Pending Accountability'}
          </CardDescription>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted shrink-0" onClick={onMinimize}>
          <Minus className="h-4 w-4" />
          <span className="sr-only">Minimize</span>
        </Button>
      </CardHeader>
      
      <ScrollArea className="flex-1 overflow-hidden">
        <div className="p-4 space-y-6">
          {strategicTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-[10px] font-black uppercase text-primary flex items-center gap-1.5 px-1 tracking-[0.2em]">
                <ShieldCheck className="h-3.5 w-3.5" />
                Strategic Verification
              </h4>
              <div className="space-y-0.5 bg-primary/5 rounded-xl p-1.5 border-2 border-dashed border-primary/20">
                {strategicTasks.map((task) => (
                  <TaskItem key={task.name} task={task} />
                ))}
              </div>
            </div>
          )}

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
        </div>
      </ScrollArea>
    </Card>
  );
}
