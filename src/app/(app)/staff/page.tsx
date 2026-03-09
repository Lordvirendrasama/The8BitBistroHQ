
'use client';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Shift, ShiftTask } from '@/lib/types';
import { getActiveOrStartShift, updateTask, startBreak, endBreak } from '@/firebase/firestore/shifts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { Clock, Coffee, Sun, Moon, LogOut, PlayCircle, ListChecks, Timer } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { EndOfDayModal } from '@/components/staff/end-of-day-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';
import { cn } from '@/lib/utils';

export default function StaffPage() {
    const { user, loading: userLoading, logout } = useAuth();
    const { db } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();

    const [activeShift, setActiveShift] = useState<Shift | null>(null);
    const [isLoadingShift, setIsLoadingShift] = useState(true);
    const [recentShifts, setRecentShifts] = useState<Shift[]>([]);
    const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);

    const isAdmin = user?.role === 'admin';

    // Fetch recent completed shifts
    const recentShiftsQuery = useMemo(() => {
        if (!db) return null;
        return query(
            collection(db, 'shifts'),
            where('endTime', '!=', null),
            orderBy('endTime', 'desc'),
            limit(5)
        );
    }, [db]);
    const { data: completedShifts } = useCollection<Shift>(recentShiftsQuery);
    useEffect(() => {
        if (completedShifts) {
            setRecentShifts(completedShifts);
        }
    }, [completedShifts]);

    // Refresh active shift state
    const refreshShift = async () => {
        if (user) {
            const shift = await getActiveOrStartShift(user);
            setActiveShift(shift);
        }
    };

    // Get or create the active shift for today
    useEffect(() => {
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
    
    const handleStartShift = async () => {
        if (!user) return;
        setIsLoadingShift(true);
        const newShift = await getActiveOrStartShift(user);
        setActiveShift(newShift);
        setIsLoadingShift(false);
        toast({ title: "Shift Started", description: "Your new shift has begun. Good luck!" });
    };

    const handleToggleBreak = async () => {
        if (!user || !activeShift) return;
        const currentBreak = activeShift.breaks?.find(b => !b.endTime);
        
        if (currentBreak) {
            await endBreak(activeShift.id, user);
            toast({ title: "Break Ended", description: "Returning to duty." });
        } else {
            await startBreak(activeShift.id, user);
            toast({ title: "Break Started", description: "Enjoy your rest period." });
        }
        await refreshShift();
    };

    const startOfDayTasks = useMemo(() => {
        if (!activeShift) return [];
        return activeShift.tasks.filter(task => task.type === 'start-of-day');
    }, [activeShift]);

    const endOfDayTasks = useMemo(() => {
        if (!activeShift) return [];
        return activeShift.tasks.filter(task => task.type === 'end-of-day');
    }, [activeShift]);

    const handleTaskToggle = async (task: ShiftTask) => {
        if (!user || !activeShift) return;
        await updateTask(activeShift.id, task.name, !task.completed, user);
        
        setActiveShift(prev => {
            if (!prev) return null;
            const updatedTasks = prev.tasks.map(t => 
                t.name === task.name 
                ? { ...t, completed: !t.completed, completedBy: !t.completed ? { username: user.username, displayName: user.displayName } : undefined } 
                : t
            );
            return { ...prev, tasks: updatedTasks };
        });

        toast({ title: "Task Updated", description: `"${task.name}" marked as ${!task.completed ? 'complete' : 'incomplete'}.` });
    };
    
    const handleLogoutClick = async () => {
        if (user && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest') && activeShift) {
            setIsEndOfDayModalOpen(true);
        } else {
            await logout();
            router.push('/login');
        }
    };
    
    const handleConfirmLogout = async (totals: { cashTotal: number; upiTotal: number; shiftExpenses: number }, forceLogout: boolean) => {
        await logout(totals, forceLogout);
        setIsEndOfDayModalOpen(false);
        router.push('/login');
    }
    
    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return { icon: <Sun className="h-5 w-5"/>, text: "Good Morning" };
        if (hour < 18) return { icon: <Coffee className="h-5 w-5"/>, text: "Good Afternoon" };
        return { icon: <Moon className="h-5 w-5"/>, text: "Good Evening" };
    };
    
    const greeting = getGreeting();

    if (userLoading || isLoadingShift) {
        return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Accessing Shift Protocols...</div>;
    }

    const currentEmployeeNames = activeShift?.employees.map(e => e.displayName).join(', ') || 'Staff';
    const activeBreak = activeShift?.breaks?.find(b => !b.endTime);

    const TaskList = ({ tasks, title }: { tasks: ShiftTask[], title: string }) => (
        <div>
            <h3 className="mb-4 text-lg font-black uppercase tracking-tight text-foreground">{title}</h3>
            <div className="space-y-4">
                {tasks.map((task) => (
                    <div key={task.name} className="flex items-center space-x-3 group">
                        <Checkbox
                            id={task.name}
                            checked={task.completed}
                            onCheckedChange={() => handleTaskToggle(task)}
                            className="h-5 w-5 border-2"
                        />
                        <div className="flex-1">
                            <Label
                                htmlFor={task.name}
                                className={cn(
                                    "text-sm font-bold transition-all cursor-pointer",
                                    task.completed ? 'text-muted-foreground line-through opacity-50' : 'text-foreground hover:text-primary'
                                )}
                            >
                                {task.name}
                            </Label>
                             {task.completed && task.completedBy ? (
                                <p className="text-[10px] font-black uppercase text-green-600 mt-0.5">
                                    Verified by {task.completedBy.displayName}
                                </p>
                            ) : isAdmin ? (
                                <p className="text-[10px] font-bold text-destructive/60 uppercase mt-0.5 tracking-tighter">
                                    (Pending Verification)
                                </p>
                            ) : null}
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4 italic uppercase font-bold opacity-30 tracking-widest">No tasks defined</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-8 max-w-5xl mx-auto font-body">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-3">
                        {greeting.icon} {greeting.text}, {user?.displayName}!
                    </h1>
                    <p className="mt-2 text-muted-foreground font-black uppercase text-[10px] tracking-widest">
                        {user?.role === 'guest'
                            ? 'Viewing the operational audit checklist.'
                            : activeShift
                            ? `Daily Record Active since ${formatDistanceToNow(new Date(activeShift.startTime), { addSuffix: true })}.`
                            : 'Bistro OS Status: Off Duty'}
                    </p>
                </div>
                {activeShift && user?.role !== 'guest' ? (
                    <div className="flex gap-2">
                        <Button 
                            variant="outline" 
                            onClick={handleToggleBreak} 
                            className={cn(
                                "h-12 px-6 font-black uppercase tracking-tight border-2 shadow-sm",
                                activeBreak ? "bg-amber-500 border-amber-600 text-white" : "border-amber-500/20 text-amber-600 hover:bg-amber-500 hover:text-white"
                            )}
                        >
                            {activeBreak ? <Timer className="mr-2 h-5 w-5 animate-pulse" /> : <Coffee className="mr-2 h-5 w-5" />}
                            {activeBreak ? "End Break" : "Take Break"}
                        </Button>
                        <Button onClick={handleLogoutClick} size="lg" variant="destructive" className="h-12 px-6 font-black uppercase tracking-widest shadow-lg">
                            <Clock className="mr-2 h-5 w-5"/> End Shift
                        </Button>
                    </div>
                ) : (
                     <div className="text-right">
                         {user?.role !== 'guest' ? (
                             <Button onClick={handleStartShift} size="lg" className="h-14 px-8 font-black uppercase tracking-[0.2em] shadow-xl">
                                <PlayCircle className="mr-2 h-6 w-6 text-emerald-400"/> Initialize Shift
                             </Button>
                         ) : (
                            <Button onClick={handleLogoutClick} size="lg" variant="secondary" className="font-bold">
                                <LogOut className="mr-2 h-5 w-5"/> Log Out
                            </Button>
                         )}
                    </div>
                )}
            </div>

            {activeShift && user?.role !== 'guest' ? (
                <Card className="border-2 shadow-none overflow-hidden">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="flex items-center gap-2 uppercase tracking-tight"><ListChecks className="text-primary" /> Shared Operational Ledger</CardTitle>
                        <CardDescription className="text-xs font-bold uppercase tracking-widest opacity-60">
                            Real-time synchronization across all logged-in staff units.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-12 p-6 sm:p-8">
                        <TaskList tasks={startOfDayTasks} title="Morning Protocols" />
                        <TaskList tasks={endOfDayTasks} title="Closing Protocols" />
                    </CardContent>
                </Card>
            ) : user?.role !== 'guest' && (
                <Card className="border-2 border-dashed bg-muted/5">
                    <CardContent className="text-center py-20 flex flex-col items-center gap-4">
                        <div className="p-4 rounded-full bg-primary/5 border-2 border-primary/10">
                            <AlertCircle className="h-12 w-12 text-primary opacity-20" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-xl font-headline tracking-tighter uppercase">Station Idle</p>
                            <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">A daily record must be initialized to begin checklists.</p>
                        </div>
                        <Button onClick={handleStartShift} size="lg" className="mt-4 font-black uppercase tracking-widest h-12 px-8">
                            Initialize Shared Shift
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card className="border-2 shadow-none overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-black uppercase">Recent Shift Cycles</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">History of final settlements.</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                    <div className="divide-y">
                        {recentShifts && recentShifts.length > 0 ? (
                            recentShifts.map(shift => (
                                <div key={shift.id} className="flex items-center justify-between p-4 hover:bg-muted/5 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 rounded-lg bg-muted/20 flex items-center justify-center">
                                            <Calendar className="h-5 w-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="font-black uppercase text-xs sm:text-sm tracking-tight">{format(new Date(shift.startTime), 'EEEE, MMMM d')}</p>
                                            <p className="text-[10px] font-mono font-bold text-muted-foreground uppercase">
                                                {format(new Date(shift.startTime), 'p')} - {shift.endTime ? format(new Date(shift.endTime), 'p') : 'Ongoing'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <div className="hidden sm:flex -space-x-2">
                                            {(shift.employees || []).map(emp => (
                                                <Avatar key={emp.username} className="h-7 w-7 border-2 border-background shadow-sm">
                                                    <AvatarImage src={`https://picsum.photos/seed/${emp.username}/40/40`} />
                                                    <AvatarFallback className="text-[8px] font-black">{emp.displayName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                        <Badge variant={(shift.tasks || []).every(t => t.completed) ? 'default' : 'secondary'} className={cn("text-[9px] font-black uppercase tracking-tighter h-6", (shift.tasks || []).every(t => t.completed) ? 'bg-emerald-600' : '')}>
                                            {(shift.tasks || []).filter(t => t.completed).length} / {(shift.tasks || []).length} TASKS
                                        </Badge>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="py-20 text-center text-[10px] font-black uppercase opacity-30 italic tracking-widest">
                                {user?.role === 'guest' ? 'Visitor Access Restricted' : 'No completion records detected.'}
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            <EndOfDayModal 
                isOpen={isEndOfDayModalOpen}
                onOpenChange={setIsEndOfDayModalOpen}
                activeShift={activeShift}
                onTaskToggle={handleTaskToggle}
                onConfirmLogout={handleConfirmLogout}
            />

        </div>
    );
}

function Calendar({ className }: { className?: string }) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={className}
        >
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
            <line x1="16" x2="16" y1="2" y2="6" />
            <line x1="8" x2="8" y1="2" y2="6" />
            <line x1="3" x2="21" y1="10" y2="10" />
        </svg>
    )
}
