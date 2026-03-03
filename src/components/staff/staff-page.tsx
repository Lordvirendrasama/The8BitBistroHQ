
'use client';
import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Shift, ShiftTask } from '@/lib/types';
import { getActiveOrStartShift, updateTask } from '@/firebase/firestore/shifts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format, formatDistanceToNow } from 'date-fns';
import { Clock, Coffee, Sun, Moon, LogOut, PlayCircle, ListChecks } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';
import { EndOfDayModal } from '@/components/staff/end-of-day-modal';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import Image from 'next/image';

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
                ? { ...t, completed: !t.completed, completedBy: !t.completed ? user : undefined } 
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
        return <div className="flex h-screen items-center justify-center">Loading shift data...</div>;
    }

    const currentEmployeeNames = activeShift?.employees.map(e => e.displayName).join(', ') || 'Staff';

    const TaskList = ({ tasks, title }: { tasks: ShiftTask[], title: string }) => (
        <div>
            <h3 className="mb-4 text-lg font-semibold text-foreground">{title}</h3>
            <div className="space-y-4">
                {tasks.map((task) => (
                    <div key={task.name} className="flex items-center space-x-3">
                        <Checkbox
                            id={task.name}
                            checked={task.completed}
                            onCheckedChange={() => handleTaskToggle(task)}
                        />
                        <div className="flex-1">
                            <Label
                                htmlFor={task.name}
                                className={`text-sm ${
                                task.completed ? 'text-muted-foreground line-through' : 'text-foreground'
                                }`}
                            >
                                {task.name}
                            </Label>
                             {task.completed && task.completedBy ? (
                                <p className="text-xs text-muted-foreground">
                                    Completed by {task.completedBy.displayName}
                                </p>
                            ) : isAdmin ? (
                                <p className="text-xs text-destructive/80 font-medium">
                                    (Not done by {currentEmployeeNames})
                                </p>
                            ) : null}
                        </div>
                    </div>
                ))}
                {tasks.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-4">No tasks for this period.</p>
                )}
            </div>
        </div>
    );

    return (
        <div className="space-y-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-3">
                        {greeting.icon} {greeting.text}, {user?.displayName}!
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        {activeShift
                            ? `Shift active since ${formatDistanceToNow(new Date(activeShift.startTime), { addSuffix: true })}.`
                            : 'You are currently off the clock.'}
                    </p>
                </div>
                {activeShift ? (
                    <Button onClick={handleLogoutClick} size="lg" variant="destructive" className="font-bold">
                        <Clock className="mr-2 h-5 w-5"/> End Daily Shift
                    </Button>
                ) : (
                     <div className="text-right">
                         <Button onClick={handleStartShift} size="lg" className="font-bold">
                            <PlayCircle className="mr-2 h-5 w-5"/> Start Daily Shift
                         </Button>
                    </div>
                )}
            </div>

            {activeShift ? (
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><ListChecks /> Active Shift Checklist</CardTitle>
                        <CardDescription>
                            Today's shared checklist. Your changes are visible to all staff on shift.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <TaskList tasks={startOfDayTasks} title="Start of Day" />
                        <TaskList tasks={endOfDayTasks} title="End of Day" />
                    </CardContent>
                </Card>
            ) : (
                <Card>
                    <CardHeader>
                        <CardTitle>No Active Shift</CardTitle>
                    </CardHeader>
                    <CardContent className="text-center py-12">
                        <p className="text-muted-foreground mb-4">There is no active shift for today.</p>
                        <Button onClick={handleStartShift} size="lg">
                            <PlayCircle className="mr-2 h-4 w-4" /> Start Daily Shift
                        </Button>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Recent Shift History</CardTitle>
                    <CardDescription>The last five completed daily shifts.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        {recentShifts && recentShifts.length > 0 ? (
                            recentShifts.map(shift => (
                                <div key={shift.id} className="flex items-start justify-between p-3 rounded-md bg-muted/50">
                                    <div>
                                        <p className="font-semibold">{format(new Date(shift.startTime), 'EEEE, MMMM d')}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {format(new Date(shift.startTime), 'p')} - {shift.endTime ? format(new Date(shift.endTime), 'p') : 'Ongoing'}
                                        </p>
                                        <div className="flex -space-x-2 mt-2">
                                            {(shift.employees || []).map(emp => (
                                                <Avatar key={emp.username} className="h-6 w-6 border-background border">
                                                    <Image src={`https://picsum.photos/seed/${emp.username}/40/40`} alt={emp.displayName} width={24} height={24} />
                                                    <AvatarFallback>{emp.displayName.charAt(0)}</AvatarFallback>
                                                </Avatar>
                                            ))}
                                        </div>
                                    </div>
                                    <Badge variant={(shift.tasks || []).every(t => t.completed) ? 'default' : 'secondary'} className={(shift.tasks || []).every(t => t.completed) ? 'bg-green-600' : ''}>
                                        {(shift.tasks || []).filter(t => t.completed).length} / {(shift.tasks || []).length} tasks completed
                                    </Badge>
                                </div>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">
                                No completed shifts found.
                            </p>
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
