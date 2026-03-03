
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/firebase/auth/use-user";
import { LogOut, Clock, ShoppingCart, ShieldCheck, Bell, TrendingUp, Settings2, Moon, Utensils, Target } from "lucide-react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from '@/components/layout/theme-toggle';
import { useState, useEffect, useMemo } from 'react';
import type { Shift, ShiftTask, Station, Bill, Expense, LiabilityState, FixedBill, Settings } from '@/lib/types';
import { EndOfDayModal } from '@/components/staff/end-of-day-modal';
import { AdminNotifications } from '@/components/admin/notifications';
import { PendingNotifications } from '@/components/layout/pending-notifications';
import { StaffNotepad } from '@/components/staff/staff-notepad';
import { Badge } from "@/components/ui/badge";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { cn, isBusinessToday, getBusinessDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addExpense } from '@/firebase/firestore/expenses';
import { format, differenceInCalendarMonths } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/firebase/firestore/settings";
import { calculateDailyFixedCost } from "@/firebase/firestore/financials";

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
        "h-8 px-2 sm:px-3 gap-1.5 sm:gap-2 font-mono text-[10px] sm:text-[11px] transition-all shrink-0 font-bold rounded-md border-2",
        isUp ? "border-destructive text-destructive animate-pulse bg-destructive/5" : 
        isLow ? "border-amber-500 text-amber-600 bg-amber-500/5" : 
        "border-emerald-500 text-emerald-500 bg-emerald-500/5"
      )}
      onClick={() => router.push('/dashboard')}
    >
      <Clock className="h-3 sm:h-3.5 w-3 sm:w-3.5" />
      <span>{formatTime(remainingTime)}</span>
    </Button>
  );
};

const StrategicTarget = ({ projectedRevenue }: { projectedRevenue: number }) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const [globalSettings, setGlobalSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsubscribe = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) setGlobalSettings(snap.data() as Settings);
    });
    return () => unsubscribe();
  }, [db]);

  const fixedBillsQuery = useMemo(() => !db ? null : collection(db, 'fixedBills'), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const [liabilityState, setLiabilityState] = useState<LiabilityState | null>(null);
  
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'liabilities', 'main_liability_state');
    getDoc(docRef).then(snap => {
      if (snap.exists()) setLiabilityState(snap.data() as LiabilityState);
    });
  }, [db]);

  const { target, breakdown } = useMemo(() => {
    if (!liabilityState || !fixedBills || !globalSettings) return { target: 0, breakdown: { overheads: 0, loan: 0, rent: 0, backlog: 0 } };
    
    const otherBills = fixedBills.filter(fb => !(fb.name || '').toLowerCase().includes('rent'));
    const overheads = calculateDailyFixedCost(otherBills);
    
    const now = new Date();
    const targetDate = new Date(`2030-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, now));
    const monthlyInterestRate = (liabilityState.annualInterestRate || 9) / 100 / 12;
    
    const P = liabilityState.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    const requiredMonthlyLoan = P > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : 0;
    const loanShare = requiredMonthlyLoan / 30;
    
    const rentShare = (liabilityState.monthlyRent || 0) / 30;
    const backlogShare = (liabilityState.rentBalance || 0) / monthsUntilTarget / 30;
    
    const finalTarget = 
      (globalSettings.includeFixed ? overheads : 0) + 
      (globalSettings.includeLoan ? loanShare : 0) + 
      (globalSettings.includeRent ? rentShare : 0) + 
      (globalSettings.includeBacklog ? backlogShare : 0);

    return {
      target: finalTarget,
      breakdown: { overheads, loan: loanShare, rent: rentShare, backlog: backlogShare }
    };
  }, [liabilityState, fixedBills, globalSettings]);

  const handleToggle = async (key: keyof Settings, value: boolean) => {
    if (user?.username !== 'Viren') return;
    await updateSettings({ [key]: value });
  };

  if (!user) return null;

  const isMet = projectedRevenue >= target && target > 0;
  const diff = target - projectedRevenue;
  const isViren = user.username === 'Viren';
  const progress = target > 0 ? Math.min(100, (projectedRevenue / target) * 100) : 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex flex-col justify-center h-10 sm:h-11 w-48 sm:w-64 px-3 rounded-lg border transition-all bg-card hover:bg-muted/5 group border-primary/20 data-[state=open]:border-primary overflow-hidden relative shadow-sm">
          <div className="flex justify-between items-center w-full mb-1">
            <span className={cn("text-[11px] sm:text-xs font-black font-mono tracking-tighter", isMet ? "text-emerald-600" : "text-foreground")}>
              ₹{Math.round(projectedRevenue).toLocaleString()}
            </span>
            
            <span className={cn(
              "text-[9px] font-black font-mono",
              isMet ? "text-emerald-600" : "text-primary"
            )}>
              {isMet ? `+₹${Math.abs(Math.round(diff)).toLocaleString()}` : `-₹${Math.round(diff).toLocaleString()}`}
            </span>

            <span className="text-[10px] font-black font-mono opacity-30">
              ₹{Math.round(target).toLocaleString()}
            </span>
          </div>
          <div className="w-full h-1 bg-muted/30 rounded-full relative overflow-hidden">
            <div 
              className={cn(
                "h-full transition-all duration-1000 rounded-full", 
                isMet ? "bg-emerald-500" : "bg-primary"
              )} 
              style={{ width: `${progress}%` }} 
            />
          </div>
          <div className={cn("absolute top-0 left-0 w-0.5 h-full", isMet ? "bg-emerald-500" : "bg-primary")} />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden font-body border-2 shadow-2xl" align="center">
        <div className="p-4 bg-muted/20 border-b flex justify-between items-center">
          <h4 className="font-black text-[10px] uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Strategy Engine
          </h4>
          <Badge variant="outline" className="text-[8px] font-black border-primary/30 text-primary uppercase">Financial Pillars</Badge>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-[10px] font-black uppercase tracking-tight">Fixed Overheads</Label>
              <p className="text-[9px] font-mono text-muted-foreground">Daily burden: ₹{Math.round(breakdown.overheads).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeFixed || false} 
              onCheckedChange={(v) => handleToggle('includeFixed', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-[10px] font-black uppercase tracking-tight text-primary">Debt EMI Share</Label>
              <p className="text-[9px] font-mono text-muted-foreground">Daily burden: ₹{Math.round(breakdown.loan).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeLoan || false} 
              onCheckedChange={(v) => handleToggle('includeLoan', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-[10px] font-black uppercase tracking-tight text-emerald-600">Lease (Rent)</Label>
              <p className="text-[9px] font-mono text-muted-foreground">Daily burden: ₹{Math.round(breakdown.rent).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeRent || false} 
              onCheckedChange={(v) => handleToggle('includeRent', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-[10px] font-black uppercase tracking-tight text-amber-600">Backlog Recovery</Label>
              <p className="text-[9px] font-mono text-muted-foreground">Daily burden: ₹{Math.round(breakdown.backlog).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeBacklog || false} 
              onCheckedChange={(v) => handleToggle('includeBacklog', v)} 
              disabled={!isViren}
            />
          </div>
        </div>
        <div className={cn("p-4 border-t border-dashed", isMet ? "bg-emerald-500/10" : "bg-primary/5")}>
          <div className="flex justify-between items-center">
            <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Survival Threshold</span>
            <span className={cn("text-lg font-black font-mono", isMet ? "text-emerald-600" : "text-primary")}>₹{Math.round(target).toLocaleString()}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
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
        variant="outline" 
        size="sm" 
        className="h-10 sm:h-11 px-2 sm:px-4 gap-1 sm:gap-2 bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/30 rounded-lg font-black transition-all shrink-0 font-body"
        onClick={() => setIsOpen(true)}
      >
        <ShoppingCart className="h-3 sm:h-4 w-3 sm:w-4" />
        <div className="flex flex-col items-start leading-tight">
          <span className="font-mono text-[10px] sm:text-sm">₹{total.toLocaleString()}</span>
        </div>
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

    const activeStationsQuery = useMemo(() => !db ? null : query(collection(db, 'stations'), where('status', 'in', ['in-use', 'paused'])), [db]);
    const { data: stations } = useCollection<Station>(activeStationsQuery);

    const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
    const { data: bills } = useCollection<Bill>(billsQuery);

    const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
    const { data: packages } = useCollection<GamingPackage>(packagesQuery);

    const activeTimers = useMemo(() => (stations || []).filter(s => !!s.endTime || s.status === 'paused'), [stations]);

    const projectedRevenue = useMemo(() => {
      let sum = 0;
      if (bills) {
        sum += bills
          .filter(bill => bill.timestamp && isBusinessToday(bill.timestamp))
          .reduce((s, b) => s + (b.totalAmount || 0), 0);
      }
      if (stations) {
        stations.filter(s => s.status === 'in-use' || s.status === 'paused').forEach(station => {
          sum += (station.currentBill || []).reduce((s, i) => s + (i.price * i.quantity), 0);
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
    }, [bills, stations, packages]);

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

    const handleConfirmLogout = async (totals: { cashTotal: number; upiTotal: number; shiftExpenses: number; }, forceLogout: boolean) => {
        await logout(totals, forceLogout);
        setIsEndOfDayModalOpen(false);
        router.push('/login');
    }

    const isNightShift = new Date().getHours() < 5;

    return (
        <>
            <header className="flex h-20 items-center gap-1.5 sm:gap-2 border-b bg-card px-2 sm:px-6 sticky top-0 z-40 w-full overflow-hidden font-body">
                <SidebarTrigger className="shrink-0 scale-90 sm:scale-100"/>
                
                <div className="flex-1 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth pr-1 sm:pr-4">
                    {activeTimers.map(station => (
                        <HeaderTimer key={station.id} station={station} />
                    ))}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    <StrategicTarget projectedRevenue={projectedRevenue} />
                    <TodayExpenses />
                    
                    <div className="flex items-center gap-1 px-1 py-1 rounded-xl bg-muted/20 border-2">
                        <PendingNotifications />
                        <div className="flex items-center gap-1">
                            <StaffNotepad />
                            <Button variant="ghost" size="icon" className="relative h-8 w-8 text-muted-foreground hover:text-primary rounded-lg" onClick={() => setTasksVisible(true)}>
                              <Bell className="h-4 w-4" />
                              {uncompletedTaskCount > 0 && (
                                <Badge variant="destructive" className="absolute -right-1 -top-1 h-4 w-4 p-0 flex items-center justify-center text-[8px] rounded-full">{uncompletedTaskCount}</Badge>
                              )}
                            </Button>
                            <AdminNotifications />
                        </div>
                        {isNightShift && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 animate-pulse rounded-lg hidden xs:flex">
                            <Moon className="h-4 w-4 fill-current" />
                          </Button>
                        )}
                        <ThemeToggle />
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 sm:h-9 sm:w-9 shrink-0 ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-primary ml-0.5 sm:ml-1">
                                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 border shadow-sm">
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
                                <ShieldCheck className="mr-2 h-4 w-4" /> Switch Profile
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
