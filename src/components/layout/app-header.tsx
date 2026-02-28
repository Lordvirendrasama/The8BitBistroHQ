
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuRadioGroup, DropdownMenuRadioItem } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/firebase/auth/use-user";
import { LogOut, Clock, ShoppingCart, Receipt, ShieldCheck, Bell, ChevronRight, ListFilter, TrendingUp, IndianRupee, Moon, Coffee, Timer, Play, Square, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useState, useEffect, useMemo } from 'react';
import type { Shift, ShiftTask, Station, Bill, Expense, OwnerTask, GamingPackage } from '@/lib/types';
import { EndOfDayModal } from '@/components/staff/end-of-day-modal';
import { AdminNotifications } from '@/components/admin/notifications';
import { PendingNotifications } from '@/components/layout/pending-notifications';
import { StaffNotepad } from '@/components/staff/staff-notepad';
import { Badge } from "@/components/ui/badge";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { cn, isBusinessToday } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addExpense } from '@/firebase/firestore/expenses';
import { startBreak, endBreak } from '@/firebase/firestore/shifts';
import { format } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { updateOwnerTask } from "@/firebase/firestore/owner-tasks";

const HeaderTimer = ({ station }: { station: Station }) => {
  const [remainingTime, setRemainingTime] = useState(0);
  const router = useRouter();

  useEffect(() => {
    if (station.status === 'paused') {
      setRemainingTime((station.remainingTimeOnPause || 0) * 1000);
      return;
    }
    if (!station.endTime) return;

    const end = new Date(station.endTime).getTime();
    const update = () => {
      const now = Date.now();
      const diff = end - now;
      setRemainingTime(diff > 0 ? diff : 0);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [station]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const isUp = remainingTime <= 0;
  const isLow = remainingTime < 5 * 60 * 1000 && remainingTime > 0;

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className={cn(
        "h-8 px-2 gap-1.5 font-mono text-[10px] sm:text-xs transition-all shrink-0 font-bold",
        isUp ? "border-destructive bg-destructive/10 text-destructive animate-pulse" : 
        isLow ? "border-yellow-500 bg-yellow-500/10 text-yellow-600" : 
        "border-green-500 bg-green-500/10 text-green-600"
      )}
      onClick={() => router.push('/dashboard')}
    >
      <Clock className="h-3 w-3" />
      <span className="hidden xs:inline">{station.name}:</span>
      <span>{formatTime(remainingTime)}</span>
    </Button>
  );
};

const BreakControl = ({ activeShift }: { activeShift: Shift | null }) => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [isProcessing, setIsProcessing] = useState(false);

    const onBreak = useMemo(() => {
        if (!activeShift?.breaks) return false;
        return activeShift.breaks.some(b => !b.endTime);
    }, [activeShift]);

    const handleToggleBreak = async () => {
        if (!activeShift || !user) return;
        setIsProcessing(true);
        if (onBreak) {
            await endBreak(activeShift.id, user);
            toast({ title: "Break Ended", description: "Welcome back to the floor." });
        } else {
            await startBreak(activeShift.id, user);
            toast({ title: "Break Started", description: "Take some time to recharge." });
        }
        setIsProcessing(false);
    };

    if (!activeShift) return null;

    return (
        <Button 
            variant="ghost" 
            size="sm" 
            disabled={isProcessing}
            onClick={handleToggleBreak}
            className={cn(
                "h-8 px-2 sm:px-3 gap-1.5 font-bold uppercase text-[10px] tracking-tight transition-all rounded-full border shrink-0",
                onBreak 
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-600 animate-pulse" 
                    : "bg-muted/50 border-muted text-muted-foreground hover:bg-muted"
            )}
        >
            <Coffee className={cn("h-3.5 w-3.5", onBreak && "fill-current")} />
            <span className="hidden sm:inline">{onBreak ? 'On Break' : 'Start Break'}</span>
        </Button>
    );
};

const TodayRevenue = () => {
  const { db } = useFirebase();
  const router = useRouter();
  
  const billsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'bills');
  }, [db]);

  const { data: bills } = useCollection<Bill>(billsQuery);

  const total = useMemo(() => {
    if (!bills) return 0;
    return bills
      .filter(bill => bill.timestamp && isBusinessToday(bill.timestamp))
      .reduce((sum, bill) => sum + (bill.totalAmount || 0), 0);
  }, [bills]);

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-8 px-2 sm:px-3 gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 rounded-full font-bold transition-all shrink-0 font-body"
      onClick={() => router.push('/billing-history')}
    >
      <Receipt className="h-3.5 w-3.5" />
      <span className="text-xs sm:text-sm">₹{total.toLocaleString()}</span>
    </Button>
  );
};

const TodayExpenses = () => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Guest now allowed to record expenses
  const canEdit = user?.role === 'admin' || user?.role === 'staff' || user?.role === 'guest';
  
  const expensesQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'expenses');
  }, [db]);

  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const filteredToday = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => e.timestamp && isBusinessToday(e.timestamp))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [expenses]);

  const total = useMemo(() => {
    return filteredToday.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [filteredToday]);

  const handleAddExpense = async () => {
    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || !description || !user) return;
    setIsSubmitting(true);
    const success = await addExpense(numAmount, description, user);
    if (success) {
      toast({ title: "Expense Recorded" });
      setAmount('');
      setDescription('');
    }
    setIsSubmitting(false);
  };

  return (
    <>
      <Button 
        variant="ghost" 
        size="sm" 
        className="h-8 px-2 sm:px-3 gap-1.5 bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 rounded-full font-bold transition-all shrink-0 font-body"
        onClick={() => setIsOpen(true)}
      >
        <ShoppingCart className="h-3.5 w-3.5" />
        <span className="text-xs sm:text-sm">₹{total.toLocaleString()}</span>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-tight">
              <ShoppingCart className="text-destructive h-6 w-6" />
              Bistro Day Expenses
            </DialogTitle>
            <DialogDescription className="font-bold text-xs uppercase text-muted-foreground mt-1">
              Total for current business cycle: <span className="text-destructive">₹{total.toLocaleString()}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ScrollArea className="h-48 border rounded-md p-2 bg-muted/5">
              {filteredToday.length > 0 ? (
                <div className="space-y-2">
                  {filteredToday.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-xs p-2 border rounded bg-background">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate uppercase">{e.description}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-medium">{format(new Date(e.timestamp), 'p')}</p>
                      </div>
                      <span className="font-mono font-bold text-destructive shrink-0">₹{e.amount}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-xs italic opacity-50 uppercase font-bold">No expenses for this business day.</p>}
            </ScrollArea>
            {canEdit && (
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="Amt" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-1 h-10 text-xs font-mono font-bold" />
                  <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-2 h-10 text-xs uppercase font-bold" />
                </div>
                <Button onClick={handleAddExpense} disabled={isSubmitting} className="w-full font-bold h-11 bg-destructive hover:bg-destructive/90 text-white shadow-md uppercase text-xs tracking-wider">Record Expense</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ProjectedRevenue = () => {
  const { db } = useFirebase();
  const { user } = useAuth();
  
  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const activeStationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), where('status', 'in', ['in-use', 'paused'])), [db]);
  const { data: activeStations } = useCollection<Station>(activeStationsQuery);

  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: packages } = useCollection<GamingPackage>(packagesQuery);

  const total = useMemo(() => {
    let sum = 0;
    
    // 1. Sum of paid bills for current business day
    if (bills) {
      sum += bills
        .filter(bill => bill.timestamp && isBusinessToday(bill.timestamp))
        .reduce((s, b) => s + (b.totalAmount || 0), 0);
    }

    // 2. Sum of current running sessions
    if (activeStations) {
      activeStations.forEach(station => {
        // Food/Drinks subtotal
        const currentBillSum = (station.currentBill || []).reduce((s, i) => s + (i.price * i.quantity), 0);
        sum += currentBillSum;

        // Initial Package logic
        if (station.packageName && station.packageName !== 'Walk-in Order' && packages) {
          const isItemized = (station.currentBill || []).some(item => 
            item.name === station.packageName || 
            item.name.startsWith(`Time: ${station.packageName}`) ||
            item.name.startsWith(`Buy Recharge: ${station.packageName}`)
          );

          if (!isItemized) {
            const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
            const pkg = packages.find(p => p.name.toLowerCase() === pureName.toLowerCase());
            if (pkg) {
              const playerCount = station.members.length || 1;
              const capacity = pkg.playerCapacity || 1;
              const instances = Math.ceil(playerCount / capacity);
              sum += (pkg.price * instances);
            }
          }
        }

        sum -= (station.discount || 0);
      });
    }

    return Math.max(0, sum);
  }, [bills, activeStations, packages]);

  // Guest now allowed to see projected revenue
  if (user?.role !== 'admin' && user?.role !== 'staff' && user?.role !== 'guest') return null;

  return (
    <Button 
      variant="ghost" 
      size="sm" 
      className="h-8 px-2 sm:px-3 gap-1.5 bg-blue-500/10 hover:bg-blue-500/20 text-blue-600 border border-blue-500/20 rounded-full font-bold transition-all shrink-0 font-body"
    >
      <TrendingUp className="h-3.5 w-3.5" />
      <span className="text-[10px] uppercase font-black tracking-tighter mr-1 hidden sm:inline">Projected:</span>
      <span className="text-xs sm:text-sm">₹{Math.floor(total).toLocaleString()}</span>
    </Button>
  );
};

interface AppHeaderProps {
  activeShift: Shift | null;
  onTaskToggle: (task: ShiftTask) => void;
  tasksVisible: boolean;
  setTasksVisible: (visible: boolean) => void;
  uncompletedTaskCount: number;
}

export function AppHeader({ 
  activeShift, 
  onTaskToggle,
  tasksVisible,
  setTasksVisible,
  uncompletedTaskCount,
}: AppHeaderProps) {
    const { user, logout, switchUser } = useAuth();
    const { db } = useFirebase();
    const router = useRouter();
    const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);
    const [taskSort, setTaskSort] = useState<'manual' | 'due' | 'priority'>('manual');
    const [isTaskPopoverOpen, setIsTaskPopoverOpen] = useState(false);

    const activeStationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), where('status', 'in', ['in-use', 'paused'])), [db]);
    const { data: stations } = useCollection<Station>(activeStationsQuery);

    const ownerTasksQuery = useMemo(() => (!db || user?.username !== 'Viren') ? null : collection(db, 'ownerTasks'), [db, user]);
    const { data: ownerTasks } = useCollection<OwnerTask>(ownerTasksQuery);

    const activeTimers = useMemo(() => (stations || []).filter(s => !!s.endTime || s.status === 'paused'), [stations]);

    const sortedOwnerTasks = useMemo(() => {
      if (!ownerTasks) return [];
      const list = [...ownerTasks].filter(t => t.status === 'pending');
      
      if (taskSort === 'due') return list.filter(t => !t.isSeparator).sort((a, b) => new Date(a.dueDateTime).getTime() - new Date(b.dueDateTime).getTime());
      if (taskSort === 'priority') {
        const pMap = { high: 3, medium: 2, low: 1 };
        return list.filter(t => !t.isSeparator).sort((a, b) => (pMap[b.priority as any] || 0) - (pMap[a.priority as any] || 0));
      }
      return list.sort((a, b) => (a.order || 0) - (b.order || 0));
    }, [ownerTasks, taskSort]);

    const handleLogoutClick = async () => {
        if (user && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest') && activeShift) {
            setIsEndOfDayModalOpen(true);
        } else {
            await logout();
            router.push('/login');
        }
    };

    const handleSwitchUser = () => {
        switchUser();
        router.push('/login');
    };

    const handleConfirmLogout = async (totals: { cashTotal: number; upiTotal: number; shiftExpenses: number }, forceLogout: boolean) => {
        await logout(totals, forceLogout);
        setIsEndOfDayModalOpen(false);
        router.push('/login');
    }

    const isViren = user?.username === 'Viren';
    const isNightShift = new Date().getHours() < 5;

    return (
        <>
            <header className="flex h-16 items-center gap-2 border-b bg-card px-3 sm:px-6 sticky top-0 z-40 w-full overflow-hidden font-body">
                <SidebarTrigger className="shrink-0 scale-90 sm:scale-100"/>
                
                <div className="flex-1 flex items-center gap-2 overflow-x-auto no-scrollbar scroll-smooth">
                    {isNightShift && (
                      <Badge variant="outline" className="h-8 px-2.5 gap-1.5 bg-indigo-500/10 text-indigo-600 border-indigo-500/20 shrink-0 font-bold uppercase text-[9px] animate-pulse">
                        <Moon className="h-3 w-3" /> Night Cycle
                      </Badge>
                    )}
                    {activeTimers.map(station => (
                        <HeaderTimer key={station.id} station={station} />
                    ))}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {isViren && (
                      <Popover open={isTaskPopoverOpen} onOpenChange={setIsTaskPopoverOpen}>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full border-primary/40 relative shadow-sm">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-[90vw] sm:w-80 p-0 overflow-hidden flex flex-col h-[70vh] max-h-[450px]" align="end">
                          <div className="p-3 border-b bg-muted/20 shrink-0 flex items-center justify-between">
                            <h4 className="font-display text-sm uppercase tracking-tight flex items-center gap-2">Strategic Roadmap</h4>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold uppercase tracking-tight gap-1 hover:text-primary">
                                  <ListFilter className="h-3 w-3" />
                                  {taskSort}
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuRadioGroup value={taskSort} onValueChange={(v: any) => setTaskSort(v)}>
                                  <DropdownMenuRadioItem value="manual" className="text-xs font-bold">MANUAL</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="due" className="text-xs font-bold">DUE DATE</DropdownMenuRadioItem>
                                  <DropdownMenuRadioItem value="priority" className="text-xs font-bold">PRIORITY</DropdownMenuRadioItem>
                                </DropdownMenuRadioGroup>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                          <ScrollArea className="flex-1 min-h-0">
                            {sortedOwnerTasks.length > 0 ? (
                              <div className="divide-y">
                                {sortedOwnerTasks.map(task => (
                                  <div key={task.id} className={cn("p-3 flex items-start gap-3 transition-colors hover:bg-muted/10", task.isSeparator && "bg-muted/30 border-y py-2")}>
                                    {task.isSeparator ? (
                                      <span className="text-[10px] font-bold uppercase tracking-wider text-primary/70">{task.title}</span>
                                    ) : (
                                      <>
                                        <Checkbox checked={task.status === 'completed'} onCheckedChange={() => updateOwnerTask(task.id, { status: task.status === 'pending' ? 'completed' : 'pending' }, user!)} className="mt-0.5 border-primary h-4 w-4" />
                                        <div className="min-w-0 flex-1">
                                          <div className="flex items-center gap-2">
                                            <p className={cn("font-bold text-xs uppercase leading-tight truncate", task.status === 'completed' && "line-through opacity-50")}>{task.title}</p>
                                            <div className={cn(
                                              "h-2 w-2 rounded-full shrink-0 shadow-sm",
                                              task.priority === 'high' ? "bg-destructive shadow-[0_0_8px_rgba(239,68,68,0.5)]" : 
                                              task.priority === 'medium' ? "bg-amber-500" : 
                                              "bg-blue-500"
                                            )} />
                                          </div>
                                          <p className="text-[10px] text-muted-foreground font-semibold mt-1 uppercase">{format(new Date(task.dueDateTime), 'MMM d, p')}</p>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : <div className="p-12 text-center text-xs font-bold uppercase opacity-40">No pending actions.</div>}
                          </ScrollArea>
                          <div className="p-3 border-t bg-muted/10 shrink-0">
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              className="w-full h-10 text-xs font-bold uppercase tracking-wider gap-2 shadow-sm"
                              onClick={() => {
                                setIsTaskPopoverOpen(false);
                                router.push('/owner-tasks');
                              }}
                            >
                              Command Center <ChevronRight className="h-4 w-4" />
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    )}
                    <BreakControl activeShift={activeShift} />
                    <ProjectedRevenue />
                    <TodayRevenue />
                    <TodayExpenses />
                    <PendingNotifications />
                    <StaffNotepad />
                    {uncompletedTaskCount > 0 && (
                      <Button variant="outline" size="icon" className="relative h-9 w-9 border-primary/20 shadow-sm" onClick={() => setTasksVisible(true)}>
                        <Bell className="h-5 w-5 text-primary" />
                        <Badge variant="destructive" className="absolute -right-1.5 -top-1.5 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full border-2 border-card">{uncompletedTaskCount}</Badge>
                      </Button>
                    )}
                    <AdminNotifications />
                    <ThemeToggle />
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-9 w-9 shrink-0 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary">
                                <Avatar className="h-8 w-8 border shadow-sm">
                                    <AvatarImage src={user?.photoURL} />
                                    <AvatarFallback>{user?.displayName?.charAt(0)}</AvatarFallback>
                                </Avatar>
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56 p-1.5 font-body">
                            <DropdownMenuLabel className="text-[10px] uppercase font-bold opacity-50 px-2 pb-1.5">Current Operator</DropdownMenuLabel>
                            <div className="flex items-center gap-2 px-2 py-2 mb-1.5 bg-muted/30 rounded-md">
                                <p className="text-sm font-bold truncate">{user?.displayName}</p>
                                <Badge variant="outline" className="text-[8px] uppercase h-4 font-bold">{user?.role}</Badge>
                            </div>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={handleSwitchUser} className="font-bold text-xs uppercase h-10 cursor-pointer">
                                <Users className="mr-2 h-4 w-4" /> Switch Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive font-bold text-xs uppercase h-10 focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                <LogOut className="mr-2 h-4 w-4" /> End Shift & Exit
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            
            <EndOfDayModal 
                isOpen={isEndOfDayModalOpen} 
                onOpenChange={setIsEndOfDayModalOpen} 
                activeShift={activeShift} 
                onTaskToggle={onTaskToggle} 
                onConfirmLogout={handleConfirmLogout} 
            />
        </>
    )
}
