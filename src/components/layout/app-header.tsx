
"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useAuth } from "@/firebase/auth/use-user";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from 'react';
import type { Shift, ShiftTask, Station, Bill, Expense, LiabilityState, FixedBill, Settings, OwnerTask, OwnerConsumption, FoodItem, GamingPackage, Employee, BillItem, StaffOrder } from '@/lib/types';
import { CompleteShiftModal } from '@/components/staff/complete-shift-modal';
import { addStaffOrder } from '@/firebase/firestore/staff-orders';
import { StaffFoodModal } from '@/components/staff/staff-food-modal';
import { AdminNotifications } from '@/components/admin/notifications';
import { PendingNotifications } from '@/components/layout/pending-notifications';
import { announceGlobally } from '@/components/notifications/global-timer-notifications';
import { StaffNotepad } from '@/components/staff/staff-notepad';
import { Badge } from "@/components/ui/badge";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, getDoc, onSnapshot, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { cn, isBusinessToday, getBusinessDate } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { addExpense } from '@/firebase/firestore/expenses';
import { format, differenceInCalendarMonths, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { updateSettings } from "@/firebase/firestore/settings";
import { startBreak, endBreak, notifyLateBreak } from "@/firebase/firestore/shifts";
import { calculateDailyFixedCost } from "@/firebase/firestore/financials";
import { updateOwnerTask } from "@/firebase/firestore/owner-tasks";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { OwnerConsumptionModal } from "@/components/owner/owner-consumption-modal";
import { LogOut, Volume2, VolumeX, Clock, ShoppingCart, ShieldCheck, Bell, TrendingUp, Settings2, Moon, Sun, Utensils, Target, ListTodo, CheckCircle2, AlertCircle, Crown, Coffee, History, Edit, CalendarDays, Activity, ShieldAlert, Percent, Zap, ChevronDown, ChevronUp, X, Save, Eye, EyeOff, User, ListChecks } from "lucide-react";
import { useCustomerView } from '@/context/customer-view-context';
import { getSyncedNow } from '@/lib/synced-time';
import { isSoundEnabled, toggleSound } from '@/lib/audio/chiptune';

const ChiptuneSoundToggle = () => {
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    setEnabled(isSoundEnabled());
  }, []);

  const handleToggle = () => {
    const nextState = toggleSound();
    setEnabled(nextState);
  };

  return (
    <Button 
      variant="ghost" 
      size="icon" 
      className={cn(
        "h-8 w-8 rounded-lg transition-colors",
        enabled ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-muted"
      )}
      onClick={handleToggle}
      title={enabled ? "8-Bit Sound FX: Enabled (Click to Mute)" : "8-Bit Sound FX: Muted (Click to Enable)"}
    >
      {enabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
    </Button>
  );
};

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
      const now = getSyncedNow();
      const diff = end - now;
      setRemainingTime(diff > 0 ? diff : 0);
    };
    
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [station]);

  const formatTime = (ms: number) => {
    if (ms < 0) ms = 0;
    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const isUp = remainingTime <= 0;
  const isLow = remainingTime < 5 * 60 * 1000 && remainingTime > 0;

  return (
    <Button 
      variant="outline" 
      size="sm" 
      className={cn(
        "h-8 px-2 sm:px-3 gap-1.5 sm:gap-2 font-mono text-sm sm:text-sm transition-all shrink-0 font-bold rounded-md border-2",
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

const StrategicTarget = ({ projectedRevenue, cashTotal = 0, upiTotal = 0 }: { projectedRevenue: number, cashTotal?: number, upiTotal?: number }) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();
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
  const [isPressed, setIsPressed] = useState(false);
  
  useEffect(() => {
    if (!db) return;
    const docRef = doc(db, 'liabilities', 'main_liability_state');
    getDoc(docRef).then(snap => {
      if (snap.exists()) setLiabilityState(snap.data() as LiabilityState);
    });
  }, [db]);

  const { target, breakdown } = useMemo(() => {
    if (!liabilityState || !fixedBills || !globalSettings) return { target: 0, breakdown: { overheads: 0, loanInterest: 0, loanPrincipal: 0, rent: 0, backlog: 0 } };
    
    const otherBills = fixedBills.filter(fb => !(fb.name || '').toLowerCase().includes('rent'));
    const overheads = calculateDailyFixedCost(otherBills);
    
    const now = new Date();
    const targetDate = new Date(`2030-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, now));
    const monthlyInterestRate = (liabilityState.annualInterestRate || 9) / 100 / 12;
    
    const P = liabilityState.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    
    // Monthly Split
    const monthlyInterest = P * r;
    const totalMonthlyEMI = P > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : 0;
    const monthlyPrincipal = Math.max(0, totalMonthlyEMI - monthlyInterest);

    const loanIntShare = monthlyInterest / 30;
    const loanPriShare = monthlyPrincipal / 30;
    
    const rentShare = (liabilityState.monthlyRent || 0) / 30;
    const backlogShare = (liabilityState.rentBalance || 0) / monthsUntilTarget / 30;
    
    const finalTarget = 
      (globalSettings.includeFixed ? overheads : 0) + 
      (globalSettings.includeLoanInterest ? loanIntShare : 0) + 
      (globalSettings.includeLoanPrincipal ? loanPriShare : 0) + 
      (globalSettings.includeRent ? rentShare : 0) + 
      (globalSettings.includeBacklog ? backlogShare : 0);

    return {
      target: finalTarget,
      breakdown: { overheads, loanInterest: loanIntShare, loanPrincipal: loanPriShare, rent: rentShare, backlog: backlogShare }
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

  if (!isViren) {
    return (
      <div 
        className="flex flex-col justify-center h-10 sm:h-11 w-48 sm:w-64 px-3 rounded-lg border bg-card border-primary/20 overflow-hidden relative shadow-sm select-none cursor-pointer touch-none"
        onMouseDown={() => setIsPressed(true)}
        onMouseUp={() => setIsPressed(false)}
        onMouseLeave={() => setIsPressed(false)}
        onTouchStart={() => setIsPressed(true)}
        onTouchEnd={() => setIsPressed(false)}
      >
        <div className="flex justify-between items-center w-full mb-1">
          {!isPressed ? (
            <span className="text-sm sm:text-sm font-bold tracking-tight text-foreground/70 uppercase w-full text-center">
              TOTAL
            </span>
          ) : (
            <>
              <span className="text-sm font-bold font-mono tracking-tight text-emerald-600" title="Cash">
                ₹{cashTotal.toLocaleString()} (C)
              </span>
              
              <span className="text-sm font-bold font-mono text-primary" title="UPI">
                ₹{upiTotal.toLocaleString()} (U)
              </span>

              <span className="text-sm font-bold font-mono text-foreground" title="Grand Total">
                ₹{Math.round(projectedRevenue).toLocaleString()}
              </span>
            </>
          )}
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
      </div>
    );
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="flex flex-col justify-center h-10 sm:h-11 w-48 sm:w-64 px-3 rounded-lg border transition-all bg-card hover:bg-muted/5 group border-primary/20 data-[state=open]:border-primary overflow-hidden relative shadow-sm">
          <div className="flex justify-between items-center w-full mb-1">
            <span className={cn("text-sm sm:text-sm font-bold font-mono tracking-tight", isMet ? "text-emerald-600" : "text-foreground")}>
              ₹{Math.round(projectedRevenue).toLocaleString()}
            </span>
            
            <span className={cn(
              "text-sm font-bold font-mono",
              isMet ? "text-emerald-600" : "text-primary"
            )}>
              {isMet ? `+₹${Math.abs(Math.round(diff)).toLocaleString()}` : `-₹${Math.round(diff).toLocaleString()}`}
            </span>

            <span className="text-sm font-bold font-mono opacity-30">
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
          <h4 className="font-bold text-sm uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
            <Settings2 className="h-3.5 w-3.5" />
            Strategy Engine
          </h4>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              className="h-6 px-2 text-sm font-bold uppercase tracking-tight border-primary/20 hover:bg-primary hover:text-white"
              onClick={() => { router.push('/billing-history'); }}
            >
              <History className="h-2.5 w-2.5 mr-1" />
              History
            </Button>
            <Badge variant="outline" className="text-sm font-bold border-primary/30 text-primary uppercase">Financial Pillars</Badge>
          </div>
        </div>
        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold uppercase tracking-tight">Fixed Overheads</Label>
              <p className="text-sm font-mono text-muted-foreground">₹{Math.round(breakdown.overheads).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeFixed || false} 
              onCheckedChange={(v) => handleToggle('includeFixed', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold uppercase tracking-tight text-primary">Loan Interest</Label>
              <p className="text-sm font-mono text-muted-foreground">₹{Math.round(breakdown.loanInterest).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeLoanInterest || false} 
              onCheckedChange={(v) => handleToggle('includeLoanInterest', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold uppercase tracking-tight text-primary">Loan Principal</Label>
              <p className="text-sm font-mono text-muted-foreground">₹{Math.round(breakdown.loanPrincipal).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeLoanPrincipal || false} 
              onCheckedChange={(v) => handleToggle('includeLoanPrincipal', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold uppercase tracking-tight text-emerald-600">Lease (Rent)</Label>
              <p className="text-sm font-mono text-muted-foreground">₹{Math.round(breakdown.rent).toLocaleString()}</p>
            </div>
            <Switch 
              checked={globalSettings?.includeRent || false} 
              onCheckedChange={(v) => handleToggle('includeRent', v)} 
              disabled={!isViren}
            />
          </div>
          <div className="flex items-center justify-between group">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold uppercase tracking-tight text-amber-600">Backlog Recovery</Label>
              <p className="text-sm font-mono text-muted-foreground">₹{Math.round(breakdown.backlog).toLocaleString()}</p>
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
            <span className="text-sm font-bold uppercase tracking-normal text-muted-foreground">Survival Threshold</span>
            <span className={cn("text-lg font-bold font-mono", isMet ? "text-emerald-600" : "text-primary")}>₹{Math.round(target).toLocaleString()}</span>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const OwnerConsumptionHeader = () => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'day' | 'month'>('day');
  const [editingConsumption, setEditingConsumption] = useState<OwnerConsumption | null>(null);

  const consumptionQuery = useMemo(() => !db ? null : collection(db, 'ownerConsumption'), [db]);
  const { data: consumptions } = useCollection<OwnerConsumption>(consumptionQuery);

  const foodItemsQuery = useMemo(() => !db ? null : collection(db, 'foodItems'), [db]);
  const { data: foodItems } = useCollection<FoodItem>(foodItemsQuery);

  const todayConsumptions = useMemo(() => {
    if (!consumptions) return [];
    return consumptions.filter(c => c.timestamp && isBusinessToday(c.timestamp))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [consumptions]);

  const monthConsumptions = useMemo(() => {
    if (!consumptions) return [];
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return consumptions.filter(c => {
      const d = new Date(c.timestamp);
      return d >= start && d <= end;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [consumptions]);

  const dayTotal = useMemo(() => todayConsumptions.reduce((sum, c) => sum + (c.totalValue || 0), 0), [todayConsumptions]);
  const monthTotal = useMemo(() => monthConsumptions.reduce((sum, c) => sum + (c.totalValue || 0), 0), [monthConsumptions]);

  const displayConsumptions = viewMode === 'day' ? todayConsumptions : monthConsumptions;

  const handleEdit = (c: OwnerConsumption) => {
    setEditingConsumption(c);
    setIsOpen(true);
  };

  const handleAddNew = () => {
    setEditingConsumption(null);
    setIsOpen(true);
  };

  return (
    <>
      <Popover onOpenChange={(open) => !open && setViewMode('day')}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 sm:h-11 px-2 sm:px-4 gap-1 sm:gap-2 bg-indigo-500/5 hover:bg-indigo-500/10 text-indigo-600 border border-indigo-500/30 rounded-lg font-bold transition-all shrink-0 font-body"
          >
            <Crown className="h-3 sm:h-4 w-3 sm:w-4 fill-current" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-mono text-sm sm:text-sm">₹{dayTotal.toLocaleString()}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-0 overflow-hidden font-body border-2 shadow-2xl" align="center">
          <div className="p-4 bg-indigo-600 text-white flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Crown className="h-4 w-4 fill-current" />
              <h4 className="font-bold text-sm uppercase tracking-normal">Internal Ledger</h4>
            </div>
            <div className="flex bg-white/10 p-0.5 rounded-lg border border-white/20">
                <button 
                    onClick={() => setViewMode('day')}
                    className={cn(
                        "px-2 py-1 text-sm font-bold uppercase rounded-md transition-all",
                        viewMode === 'day' ? "bg-white text-indigo-600 shadow-sm" : "text-white/60 hover:text-white"
                    )}
                >DAY</button>
                <button 
                    onClick={() => setViewMode('month')}
                    className={cn(
                        "px-2 py-1 text-sm font-bold uppercase rounded-md transition-all",
                        viewMode === 'month' ? "bg-white text-indigo-600 shadow-sm" : "text-white/60 hover:text-white"
                    )}
                >MONTH</button>
            </div>
          </div>
          
          <div className="px-4 py-2 bg-indigo-50 border-b flex justify-between items-center">
            <span className="text-sm font-bold uppercase text-indigo-700/60">{viewMode === 'day' ? "Today's Total" : "Monthly Total"}</span>
            <span className="font-mono font-bold text-indigo-600 text-sm">₹{(viewMode === 'day' ? dayTotal : monthTotal).toLocaleString()}</span>
          </div>

          <ScrollArea className="max-h-[300px]">
            <div className="divide-y">
              {displayConsumptions.length > 0 ? displayConsumptions.map((c) => (
                <div key={c.id} className="p-3 bg-card hover:bg-muted/5 transition-colors group relative">
                  <div className="flex justify-between items-start pr-8">
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold uppercase text-foreground leading-tight">
                        {c.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </p>
                      <p className="text-sm font-bold text-muted-foreground uppercase flex items-center gap-1">
                        <Clock className="h-2.5 w-2.5" /> {format(new Date(c.timestamp), 'MMM d, p')} • By {c.addedBy.displayName}
                      </p>
                    </div>
                    <span className="font-mono font-bold text-sm text-indigo-600">₹{c.totalValue}</span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => handleEdit(c)}
                  >
                    <Edit className="h-3.5 w-3.5 text-indigo-600" />
                  </Button>
                </div>
              )) : (
                <div className="py-12 text-center space-y-2 opacity-30">
                  <Utensils className="h-8 w-8 mx-auto text-muted-foreground" />
                  <p className="text-sm font-bold uppercase tracking-normal">No Shadow Orders</p>
                </div>
              )}
            </div>
          </ScrollArea>
          
          <div className="p-3 bg-muted/10 border-t border-dashed">
            <Button 
              className="w-full h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-sm tracking-normal shadow-lg"
              onClick={handleAddNew}
            >
              <History className="mr-2 h-3.5 w-3.5" />
              Add Owner Order
            </Button>
          </div>
        </PopoverContent>
      </Popover>

      <OwnerConsumptionModal 
        isOpen={isOpen} 
        onOpenChange={setIsOpen} 
        foodItems={foodItems || []} 
        consumption={editingConsumption}
      />
    </>
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
        className="h-10 sm:h-11 px-2 sm:px-4 gap-1 sm:gap-2 bg-destructive/5 hover:bg-destructive/10 text-destructive border border-destructive/30 rounded-lg font-bold transition-all shrink-0 font-body"
        onClick={() => setIsOpen(true)}
      >
        <ShoppingCart className="h-3 sm:h-4 w-3 sm:w-4" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-sm uppercase opacity-50 hidden sm:block">Operational Expense</span>
          <span className="font-mono text-sm sm:text-sm">₹{total.toLocaleString()}</span>
        </div>
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-display uppercase tracking-tight">
              <ShoppingCart className="text-destructive h-6 w-6" />
              Operational Expense
            </DialogTitle>
            <DialogDescription className="font-bold text-sm uppercase text-muted-foreground mt-1">
              Operational Expense for current business cycle: <span className="text-destructive">₹{total.toLocaleString()}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <ScrollArea className="h-48 border rounded-md p-2 bg-muted/5">
              {filteredToday.length > 0 ? (
                <div className="space-y-2">
                  {filteredToday.map(e => (
                    <div key={e.id} className="flex justify-between items-center text-sm p-2 border rounded bg-background">
                      <div className="min-w-0 pr-2">
                        <p className="font-bold truncate uppercase">{e.description}</p>
                        <p className="text-sm text-muted-foreground uppercase font-medium">{format(new Date(e.timestamp), 'p')}</p>
                      </div>
                      <span className="font-mono font-bold text-destructive shrink-0">₹{e.amount}</span>
                    </div>
                  ))}
                </div>
              ) : <p className="text-center py-8 text-sm italic opacity-50 uppercase font-bold">No expenses for this business day.</p>}
            </ScrollArea>
            {canEdit && (
              <div className="space-y-3 pt-2 border-t">
                <div className="grid grid-cols-3 gap-2">
                  <Input type="number" placeholder="Amt" value={amount} onChange={e => setAmount(e.target.value)} className="col-span-1 h-10 text-sm font-mono font-bold" />
                  <Input placeholder="Description" value={description} onChange={e => setDescription(e.target.value)} className="col-span-2 h-10 text-sm uppercase font-bold" />
                </div>
                <Button onClick={handleAddExpense} disabled={isSubmitting} className="w-full font-bold h-11 bg-destructive hover:bg-destructive/90 text-white shadow-md uppercase text-sm tracking-wider">Record Expense</Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const OwnerStaffFoodHeader = ({ 
  activeShift, 
  currentEmployee, 
  activeCycle, 
  handleSaveStaffOrder 
}: { 
  activeShift: Shift | null;
  currentEmployee: Employee | null;
  activeCycle: string;
  handleSaveStaffOrder: (items: BillItem[], totalAmount: number, newBalance: number, targetEmployee?: Employee | null) => Promise<void>;
}) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedEmployeeUsername, setSelectedEmployeeUsername] = useState<string>('all');

  const staffOrdersQuery = useMemo(() => !db ? null : collection(db, 'staffOrders'), [db]);
  const { data: staffOrders } = useCollection<StaffOrder>(staffOrdersQuery);

  const employeesQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: allEmployees } = useCollection<Employee>(employeesQuery);

  const monthOrders = useMemo(() => {
    if (!staffOrders) return [];
    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    return staffOrders.filter(o => {
      const d = new Date(o.timestamp);
      return d >= start && d <= end;
    }).sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [staffOrders]);

  const monthTotal = useMemo(() => monthOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0), [monthOrders]);

  const filteredOrders = useMemo(() => {
    if (selectedEmployeeUsername === 'all') return monthOrders;
    const target = selectedEmployeeUsername.toLowerCase();
    return monthOrders.filter(o => o.employeeUsername?.toLowerCase() === target);
  }, [monthOrders, selectedEmployeeUsername]);

  const stats = useMemo(() => {
    const totalOrders = filteredOrders.length;
    const totalSpent = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const avgSpent = totalOrders > 0 ? Math.round(totalSpent / totalOrders) : 0;
    
    const selectedEmp = allEmployees?.find(emp => emp.username?.toLowerCase() === selectedEmployeeUsername.toLowerCase());
    const allowance = selectedEmp ? (selectedEmp.foodAllowanceBalance ?? 1000) : null;
    
    return {
      totalOrders,
      totalSpent,
      avgSpent,
      allowance
    };
  }, [filteredOrders, selectedEmployeeUsername, allEmployees]);

  const overallPendingCount = useMemo(() => {
    return monthOrders.filter(o => !o.approved).length;
  }, [monthOrders]);

  const employeeSummaries = useMemo(() => {
    if (!allEmployees) return [];
    
    const empMap = new Map<string, Employee>();
    allEmployees.forEach(emp => {
      if (emp.username) empMap.set(emp.username.toLowerCase(), emp);
    });

    const allUsernames = new Set<string>();
    allEmployees.forEach(emp => emp.username && allUsernames.add(emp.username.toLowerCase()));
    monthOrders.forEach(o => o.employeeUsername && allUsernames.add(o.employeeUsername.toLowerCase()));

    const summaries: Array<{ emp: Employee; spent: number; count: number; pendingCount: number; isFormer?: boolean }> = [];

    allUsernames.forEach(uname => {
      const knownEmp = empMap.get(uname);
      const empOrders = monthOrders.filter(o => o.employeeUsername?.toLowerCase() === uname);
      const spent = empOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      const count = empOrders.length;
      const approvedCount = empOrders.filter(o => o.approved).length;
      const pendingCount = count - approvedCount;

      if (knownEmp) {
        summaries.push({ emp: knownEmp, spent, count, pendingCount });
      } else if (empOrders.length > 0) {
        const rawName = empOrders[0]?.employeeDisplayName || (uname.charAt(0).toUpperCase() + uname.slice(1));
        const formerEmp: Employee = {
          id: `former-${uname}`,
          username: uname,
          displayName: `${rawName} (Ex-Staff)`,
          role: 'staff',
          pin: '0000',
          salary: 0,
          salaryType: 'monthly',
          weekOffDay: 0,
          joinDate: new Date().toISOString(),
          isActive: false,
          foodAllowanceBalance: 0
        };
        summaries.push({ emp: formerEmp, spent, count, pendingCount, isFormer: true });
      }
    });

    return summaries.sort((a, b) => b.spent - a.spent);
  }, [allEmployees, monthOrders]);

  const showAllowance = !!(currentEmployee || user);
  const selectedEmp = selectedEmployeeUsername !== 'all' ? allEmployees?.find(emp => emp.username?.toLowerCase() === selectedEmployeeUsername.toLowerCase()) : null;
  const effectiveEmployee: Employee = selectedEmp || currentEmployee || {
    id: user?.username || 'temp-staff',
    username: user?.username?.toLowerCase() || 'staff',
    displayName: user?.displayName || 'Staff Member',
    role: user?.role || 'staff',
    pin: '0000',
    salary: 0,
    salaryType: 'monthly',
    weekOffDay: 0,
    joinDate: new Date().toISOString(),
    isActive: true,
    foodAllowanceBalance: 1000
  };

  const handlePopoverOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedEmployeeUsername('all');
    }
  };

  const handleApproveOrder = async (orderId: string) => {
    if (!db) return;
    try {
      const orderRef = doc(db, 'staffOrders', orderId);
      await updateDoc(orderRef, { approved: true });
      toast({ title: "Order Approved", description: "The staff food order has been approved." });
    } catch (error) {
      console.error("Error approving staff order:", error);
      toast({ variant: "destructive", title: "Approval Failed", description: "Could not approve the order." });
    }
  };

  const handleDenyOrder = async (orderId: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'staffOrders', orderId));
      toast({ title: "Order Denied", description: "The staff food order has been denied and removed." });
    } catch (error) {
      console.error("Error denying staff order:", error);
      toast({ variant: "destructive", title: "Denial Failed", description: "Could not deny the order." });
    }
  };

  return (
    <>
      <Popover onOpenChange={handlePopoverOpenChange}>
        <PopoverTrigger asChild>
          <Button 
            variant="outline" 
            size="sm" 
            className="h-10 sm:h-11 px-2 sm:px-4 gap-1.5 sm:gap-2 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 border border-amber-500/30 rounded-lg font-bold transition-all shrink-0 font-body shadow-sm"
          >
            <Utensils className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <div className="flex flex-col items-start leading-tight">
              <span className="font-mono text-sm sm:text-sm">₹{monthTotal.toLocaleString()}</span>
            </div>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[340px] p-0 overflow-hidden font-body border border-border/50 shadow-2xl rounded-xl" align="center">
          <div className="p-4 bg-gradient-to-r from-amber-600 to-amber-700 text-white flex justify-between items-center shadow-inner">
            <div className="flex items-center gap-2.5">
              <div className="bg-white/20 p-1.5 rounded-md backdrop-blur-sm">
                <Utensils className="h-4 w-4" />
              </div>
              <h4 className="font-bold text-sm uppercase tracking-wider text-white/90">Monthly Staff Food</h4>
            </div>
          </div>
          
          <div className="px-3 py-2.5 bg-muted/30 border-b border-border/40 flex items-center justify-between gap-3 backdrop-blur-md">
            <span className="text-xs font-bold uppercase text-muted-foreground shrink-0 tracking-wider">Filter Employee:</span>
            <select 
              value={selectedEmployeeUsername} 
              onChange={(e) => setSelectedEmployeeUsername(e.target.value)}
              className="bg-background border-2 border-amber-500/20 rounded-md px-2 py-1 text-xs font-bold uppercase outline-none focus:border-amber-500 text-foreground cursor-pointer transition-colors shadow-sm w-full"
            >
              <option value="all">-- ALL EMPLOYEES --</option>
              {employeeSummaries.map(({ emp }) => (
                <option key={emp.id} value={emp.username}>
                  {emp.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="p-3 bg-gradient-to-b from-amber-500/5 to-transparent border-b grid grid-cols-3 gap-2 text-center">
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-2 shadow-sm flex flex-col justify-center transition-all hover:border-amber-500/30">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Spent</span>
              <span className="font-mono font-bold text-amber-600 text-sm">₹{stats.totalSpent.toLocaleString()}</span>
            </div>
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-2 shadow-sm flex flex-col justify-center transition-all hover:border-amber-500/30">
              <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Orders</span>
              <span className="font-mono font-bold text-foreground text-sm">{stats.totalOrders}</span>
            </div>
            <div className="bg-background/80 backdrop-blur-sm border border-border/50 rounded-xl p-2 shadow-sm flex flex-col justify-center transition-all hover:border-amber-500/30">
              {selectedEmployeeUsername === 'all' ? (
                <>
                  <span className="text-[10px] font-bold uppercase text-amber-600 tracking-widest mb-1">Pending</span>
                  <span className="font-mono font-bold text-amber-600 text-sm">{overallPendingCount}</span>
                </>
              ) : stats.allowance !== null ? (
                <>
                  <span className="text-[10px] font-bold uppercase text-emerald-600 tracking-widest mb-1">Bal</span>
                  <span className="font-mono font-bold text-emerald-600 text-sm">₹{stats.allowance.toLocaleString()}</span>
                </>
              ) : (
                <>
                  <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1">Avg</span>
                  <span className="font-mono font-bold text-foreground text-sm">₹{stats.avgSpent.toLocaleString()}</span>
                </>
              )}
            </div>
          </div>

          {selectedEmployeeUsername === 'all' ? (
            <div className="max-h-[350px] overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                {employeeSummaries.map(({ emp, spent, count, pendingCount }) => (
                  <div 
                    key={emp.id} 
                    onClick={() => setSelectedEmployeeUsername(emp.username)}
                    className="p-3 bg-card/40 border border-border/40 hover:border-amber-500/30 hover:bg-card hover:shadow-md transition-all cursor-pointer flex justify-between items-center group rounded-xl"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-bold uppercase text-foreground group-hover:text-amber-600 transition-colors tracking-wide">
                        {emp.displayName}
                      </p>
                      <p className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-widest">
                        Quota: ₹{(emp.foodAllowanceBalance ?? 1000).toLocaleString()} • {count} Orders
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1.5">
                      <div className="text-right flex items-center gap-2">
                        {pendingCount > 0 && (
                          <span className="bg-amber-500 text-white text-[10px] font-bold uppercase px-1.5 py-0.5 rounded shadow-sm shadow-amber-500/20 animate-pulse">
                            {pendingCount} Pending
                          </span>
                        )}
                        <p className="font-mono font-bold text-sm text-foreground group-hover:text-amber-600 transition-colors">₹{spent.toLocaleString()}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground/60 font-bold uppercase tracking-widest">This Month</p>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="max-h-[350px] overflow-y-auto p-2 space-y-2 custom-scrollbar">
                {filteredOrders.length > 0 ? filteredOrders.map((o) => (
                  <div key={o.id} className="p-3 bg-card/50 hover:bg-card transition-all rounded-xl border border-transparent hover:border-amber-500/20 shadow-sm flex flex-col gap-3 group relative">
                    <div className="flex justify-between items-start gap-4">
                      <div className="space-y-1 min-w-0 pr-2 flex-1">
                        <p className="text-sm font-bold uppercase text-foreground leading-tight">
                          {o.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>
                        <p className="text-xs font-bold text-muted-foreground uppercase flex items-center gap-1.5 opacity-70">
                          <Clock className="h-3 w-3" /> {format(new Date(o.timestamp), 'MMM d, p')}
                        </p>
                      </div>
                      <span className="font-mono font-bold text-base text-amber-600 bg-amber-500/10 px-2.5 py-0.5 rounded-md border border-amber-500/20 shrink-0">₹{o.totalAmount}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2 w-full pt-2 border-t border-dashed border-amber-500/20">
                      {o.approved ? (
                        <span className="bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 text-xs font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1.5 shadow-sm">
                          <CheckCircle2 className="h-3.5 w-3.5 fill-current" /> Approved
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-4 text-xs font-bold uppercase border-destructive/30 text-destructive bg-destructive/5 hover:bg-destructive hover:text-white transition-all rounded-full"
                            onClick={() => handleDenyOrder(o.id!)}
                          >
                            <X className="mr-1.5 h-3.5 w-3.5" /> Deny
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-8 px-4 text-xs font-bold uppercase bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white shadow-md shadow-emerald-500/20 border-0 transition-all rounded-full"
                            onClick={() => handleApproveOrder(o.id!)}
                          >
                            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Approve
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )) : (
                  <div className="py-12 text-center space-y-3 opacity-40">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-2">
                      <Utensils className="h-6 w-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold uppercase tracking-widest text-muted-foreground">No Staff Food Recorded</p>
                  </div>
                )}
            </div>
          )}
          
          {showAllowance && (
            <div className="p-3 bg-muted/10 border-t border-dashed">
              <Button 
                className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold uppercase text-sm tracking-normal shadow-lg"
                onClick={() => setIsModalOpen(true)}
              >
                <Utensils className="mr-2 h-3.5 w-3.5" />
                Place Staff Order
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>

      {showAllowance && (
        <StaffFoodModal
          isOpen={isModalOpen}
          onOpenChange={setIsModalOpen}
          employee={effectiveEmployee}
          activeCycle={activeCycle}
          onSave={(items, total, newBal) => handleSaveStaffOrder(items, total, newBal, effectiveEmployee)}
        />
      )}
    </>
  );
};

const StaffFoodHeaderButton = ({ 
  currentEmployee, 
  activeCycle, 
  handleSaveStaffOrder 
}: { 
  currentEmployee: Employee | null;
  activeCycle: string;
  handleSaveStaffOrder: (items: BillItem[], totalAmount: number, newBalance: number, targetEmployee?: Employee | null) => Promise<void>;
}) => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const staffOrdersQuery = useMemo(() => !db ? null : collection(db, 'staffOrders'), [db]);
  const { data: staffOrders } = useCollection<StaffOrder>(staffOrdersQuery);

  const balance = useMemo(() => {
    const targetUsername = (currentEmployee?.username || user?.username || '').toLowerCase();
    if (!targetUsername) return 1000;
    
    const now = new Date();
    const startM = startOfMonth(now);
    const endM = endOfMonth(now);
    
    const monthSpent = (staffOrders || [])
      .filter(o => {
        const uMatch = o.employeeUsername?.toLowerCase() === targetUsername;
        const d = new Date(o.timestamp);
        return uMatch && d >= startM && d <= endM;
      })
      .reduce((sum, o) => sum + (o.totalAmount || 0), 0);
      
    return Math.max(0, 1000 - monthSpent);
  }, [currentEmployee, user, staffOrders]);

  const activeEmployee: Employee = useMemo(() => {
    const baseEmp = currentEmployee || {
      id: user?.username || 'temp-staff',
      username: user?.username?.toLowerCase() || 'staff',
      displayName: user?.displayName || 'Staff Member',
      role: user?.role || 'staff',
      pin: '0000',
      salary: 0,
      salaryType: 'monthly',
      weekOffDay: 0,
      joinDate: new Date().toISOString(),
      isActive: true,
      foodAllowanceBalance: 1000
    };
    return {
      ...baseEmp,
      foodAllowanceBalance: balance
    };
  }, [currentEmployee, user, balance]);

  return (
    <>
      <Button 
        variant="outline" 
        size="sm" 
        className="h-10 sm:h-11 px-2 sm:px-4 gap-1.5 sm:gap-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30 rounded-lg font-bold transition-all shrink-0 font-body shadow-sm"
        onClick={() => setIsModalOpen(true)}
        title="Order a meal from your meal allowance"
      >
        <Utensils className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-600" />
        <div className="flex flex-col items-start leading-tight">
          <span className="text-[10px] uppercase opacity-75 hidden sm:block font-extrabold tracking-wider">Meal Allowance</span>
          <span className="font-mono text-xs sm:text-sm font-bold">₹{balance.toLocaleString()}</span>
        </div>
      </Button>

      <StaffFoodModal
        isOpen={isModalOpen}
        onOpenChange={setIsModalOpen}
        employee={activeEmployee}
        activeCycle={activeCycle}
        onSave={(items, total, newBal) => handleSaveStaffOrder(items, total, newBal, activeEmployee)}
      />
    </>
  );
};

const OwnerTaskDropdown = () => {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const router = useRouter();

  const tasksQuery = useMemo(() => {
    if (!db || user?.username !== 'Viren') return null;
    return collection(db, 'ownerTasks');
  }, [db, user]);

  const { data: tasks } = useCollection<OwnerTask>(tasksQuery);

  const pendingTasks = useMemo(() => {
    if (!tasks) return [];
    return tasks
      .filter(t => t.status === 'pending' && !t.isSeparator) // Hide headers/separators in the dropdown
      .sort((a, b) => (a.order || 0) - (b.order || 0));
  }, [tasks]);

  const handleToggle = async (task: OwnerTask) => {
    if (!user) return;
    const success = await updateOwnerTask(task.id, { status: 'completed' }, user);
    if (success) {
      toast({ title: "Task Completed", description: `"${task.title}" checked off.` });
    }
  };

  if (user?.username !== 'Viren') return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon" className="relative h-8 w-8 rounded-lg border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all">
          <ListTodo className="h-4 w-4 text-primary" />
          {pendingTasks.length > 0 && (
            <Badge variant="destructive" className="absolute -right-2 -top-2 h-4 min-w-[16px] p-0 flex items-center justify-center text-sm rounded-full ring-2 ring-background font-bold">
              {pendingTasks.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0 overflow-hidden font-body border-2 shadow-2xl" align="end">
        <div className="p-4 bg-muted/20 border-b flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h4 className="font-bold text-sm uppercase tracking-normal text-muted-foreground">Owner Checklist</h4>
          </div>
          <Button variant="ghost" size="sm" onClick={() => router.push('/owner-tasks')} className="h-6 text-sm font-bold uppercase tracking-tight">View All</Button>
        </div>
        
        <ScrollArea className="h-[350px]">
          <div className="divide-y">
            {pendingTasks.length > 0 ? pendingTasks.map((task) => (
              <div key={task.id} className="p-3 bg-card hover:bg-muted/5 transition-colors group">
                <div className="flex items-start gap-3">
                  <Checkbox 
                    id={`header-task-${task.id}`} 
                    checked={false} 
                    onCheckedChange={() => handleToggle(task)}
                    className="mt-0.5 border-primary/40 data-[state=checked]:bg-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={`header-task-${task.id}`}
                      className="text-sm font-bold uppercase tracking-tight leading-tight cursor-pointer group-hover:text-primary transition-colors block truncate"
                    >
                      {task.title}
                    </Label>
                    <div className="flex items-center gap-2 mt-1">
                      <div className={cn(
                        "h-1.5 w-1.5 rounded-full shrink-0",
                        task.priority === 'high' ? "bg-destructive" : task.priority === 'medium' ? "bg-amber-500" : "bg-blue-500"
                      )} />
                      <span className="text-sm font-bold text-muted-foreground uppercase">{task.category || 'Strategic'}</span>
                    </div>
                  </div>
                </div>
              </div>
            )) : (
              <div className="p-8 text-center space-y-2 opacity-30">
                <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-500" />
                <p className="text-sm font-bold uppercase tracking-normal">Horizon Clear</p>
              </div>
            )}
          </div>
        </ScrollArea>
        
        <div className="p-3 bg-muted/5 border-t border-dashed">
          <Button 
            variant="outline" 
            size="sm" 
            className="w-full h-9 text-sm font-bold uppercase tracking-[0.2em] gap-2 border-2"
            onClick={() => router.push('/owner-tasks')}
          >
            Mission Control Center
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

const ShiftTaskDropdown = ({ 
  activeShift, 
  onTaskToggle 
}: { 
  activeShift: Shift | null; 
  onTaskToggle: (task: ShiftTask, result?: 'yes' | 'no') => void; 
}) => {
  const [showCompleted, setShowCompleted] = useState(false);

  const tasks = activeShift?.tasks || [];
  
  const operationalTasks = useMemo(() => 
    tasks.filter(t => t.shiftType !== undefined || t.type === 'strategic'),
  [tasks]);

  const pendingTasks = useMemo(() => 
    operationalTasks.filter(t => !t.completed),
  [operationalTasks]);

  const completedTasks = useMemo(() => 
    operationalTasks.filter(t => t.completed),
  [operationalTasks]);

  const totalCount = operationalTasks.length;
  const completedCount = completedTasks.length;
  const progressPercent = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 100;

  const isNightShift = activeShift?.shiftType === 'night';
  const shiftTitle = isNightShift ? "Closing Shift Protocols" : "Opening Shift Protocols";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button 
          variant="outline" 
          size="icon" 
          title="Daily Shift Tasks & Protocols" 
          className="relative h-8 w-8 rounded-lg border-primary/20 bg-primary/5 hover:bg-primary/10 transition-all"
        >
          <ListChecks className="h-4 w-4 text-primary" />
          {pendingTasks.length > 0 && (
            <Badge 
              variant="destructive" 
              className="absolute -right-2 -top-2 h-5 min-w-[20px] px-1 flex items-center justify-center text-xs rounded-full ring-2 ring-background font-bold animate-pulse"
            >
              {pendingTasks.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0 overflow-hidden font-body border-2 shadow-2xl" align="end">
        <div className="p-4 bg-muted/20 border-b">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {isNightShift ? <Moon className="h-4 w-4 text-indigo-400" /> : <Sun className="h-4 w-4 text-amber-500" />}
              <h4 className="font-bold text-sm uppercase tracking-normal text-foreground">{shiftTitle}</h4>
            </div>
            <Badge variant={progressPercent === 100 ? "default" : "outline"} className="text-xs font-bold font-mono">
              {progressPercent}%
            </Badge>
          </div>
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-bold text-muted-foreground uppercase">
              <span>Progress ({completedCount} / {totalCount} Done)</span>
              <span className="text-destructive font-mono">{pendingTasks.length} Remaining</span>
            </div>
            <Progress value={progressPercent} className="h-2 bg-muted/50" />
          </div>
        </div>

        <ScrollArea className="h-[350px]">
          <div className="p-2 space-y-1">
            {pendingTasks.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto animate-bounce" />
                <p className="font-bold text-sm uppercase text-emerald-500">All Shift Tasks Done!</p>
                <p className="text-xs text-muted-foreground uppercase font-bold">Great job keeping the bistro operational.</p>
              </div>
            ) : (
              pendingTasks.map((task, idx) => (
                <div 
                  key={`${task.name}-${idx}`} 
                  className="flex items-start gap-3 p-2.5 rounded-lg bg-card hover:bg-muted/30 border border-border/40 transition-colors group cursor-pointer"
                  onClick={() => onTaskToggle(task)}
                >
                  <Checkbox 
                    id={`shift-task-${task.name}-${idx}`}
                    checked={task.completed}
                    onCheckedChange={() => onTaskToggle(task)}
                    className="mt-0.5 border-primary/40 data-[state=checked]:bg-primary"
                  />
                  <div className="flex-1 min-w-0">
                    <Label 
                      htmlFor={`shift-task-${task.name}-${idx}`}
                      className="text-sm font-bold uppercase tracking-tight text-foreground leading-tight cursor-pointer group-hover:text-primary transition-colors block"
                    >
                      {task.name}
                    </Label>
                    {(task as any).description && (
                      <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5 font-medium">
                        {(task as any).description}
                      </p>
                    )}
                  </div>
                </div>
              ))
            )}

            {completedTasks.length > 0 && (
              <div className="pt-3 border-t border-dashed mt-2">
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="w-full text-xs font-bold uppercase tracking-wider text-muted-foreground h-7"
                  onClick={() => setShowCompleted(!showCompleted)}
                >
                  {showCompleted ? "Hide Completed Tasks" : `Show Completed Tasks (${completedTasks.length})`}
                </Button>
                {showCompleted && completedTasks.map((task, idx) => (
                  <div 
                    key={`${task.name}-${idx}`} 
                    className="flex items-start gap-3 p-2.5 rounded-lg bg-muted/20 opacity-60 border border-border/20 transition-colors cursor-pointer mt-1"
                    onClick={() => onTaskToggle(task)}
                  >
                    <Checkbox 
                      checked={task.completed}
                      onCheckedChange={() => onTaskToggle(task)}
                      className="mt-0.5 border-emerald-500 data-[state=checked]:bg-emerald-500"
                    />
                    <p className="text-sm font-bold uppercase tracking-tight text-muted-foreground leading-tight line-through">
                      {task.name}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

interface AppHeaderProps {
  activeShift: Shift | null;
  onTaskToggle: (task: ShiftTask, result?: 'yes' | 'no') => void;
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
    const { isCustomerView, toggleCustomerView } = useCustomerView();
    const { db } = useFirebase();
    const { toast } = useToast();
    const router = useRouter();
    const [isEndOfDayModalOpen, setIsEndOfDayModalOpen] = useState(false);

    // Fetch current logged-in employee record in real-time
    const allEmployeesQuery = useMemo(() => {
        if (!db) return null;
        return collection(db, 'employees');
    }, [db]);
    const { data: allEmployeesDocs } = useCollection<Employee>(allEmployeesQuery);
    const currentEmployee = useMemo(() => {
        if (!allEmployeesDocs || !user?.username) return null;
        const target = user.username.toLowerCase();
        return allEmployeesDocs.find(e => e.username?.toLowerCase() === target) || null;
    }, [allEmployeesDocs, user?.username]);

    // Fetch active settings/cycle in real-time
    const settingsQuery = useMemo(() => {
        if (!db) return null;
        return query(collection(db, 'settings'));
    }, [db]);
    const { data: settingsDocs } = useCollection<any>(settingsQuery);
    const appConfig = settingsDocs?.find(doc => doc.id === 'app_config');
    const activeCycle = appConfig?.activeCycle || 'Launch Live';

    const handleSaveStaffOrder = async (items: BillItem[], totalAmount: number, newBalance: number, targetEmployee?: Employee | null) => {
        const rawEmp: Employee = targetEmployee || currentEmployee || {
            id: user?.username || 'temp-staff',
            username: user?.username?.toLowerCase() || 'staff',
            displayName: user?.displayName || 'Staff Member',
            role: user?.role || 'staff',
            pin: '0000',
            salary: 0,
            salaryType: 'monthly',
            weekOffDay: 0,
            joinDate: new Date().toISOString(),
            isActive: true,
            foodAllowanceBalance: 1000
        };
        const realEmpDoc = allEmployeesDocs?.find(e => e.username?.toLowerCase() === rawEmp.username?.toLowerCase() || e.id === rawEmp.id);
        const empToUse = realEmpDoc || rawEmp;

        try {
            await addStaffOrder(empToUse.id, newBalance, {
                employeeUsername: empToUse.username,
                employeeDisplayName: empToUse.displayName,
                items,
                totalAmount,
                timestamp: new Date().toISOString(),
                cycle: activeCycle
            });
            toast({ title: "Order Placed Successfully", description: `₹${totalAmount.toLocaleString()} deducted from meal allowance.` });
        } catch (error) {
            console.error("Error saving staff order:", error);
            toast({ variant: "destructive", title: "Order Placement Failed", description: "Please try again later." });
        }
    };

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
            const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim().toLowerCase();
            const isItemized = (station.currentBill || []).some(item => {
              const nameLower = item.name.toLowerCase();
              return (
                nameLower.includes(pureName) ||
                nameLower.startsWith('time:') ||
                nameLower.startsWith('buy recharge:') ||
                nameLower.startsWith('recharge:')
              );
            });
            if (!isItemized) {
              const pkg = packages.find(p => p.name.toLowerCase() === pureName);
              if (pkg) {
                const playerCount = station.members.length || 1;
                const capacity = pkg.playerCapacity || 1;
                const instances = Math.ceil(playerCount / capacity);
                if (!station.packageName.startsWith('Recharge: ')) {
                  sum += (pkg.price * instances);
                }
              }
            }
          }
          sum -= (station.discount || 0);
        });
      }
      return Math.max(0, sum);
    }, [bills, stations, packages]);

    const { cashTotal, upiTotal } = useMemo(() => {
      let cash = 0, upi = 0;
      if (bills) {
        bills.filter(b => b.timestamp && isBusinessToday(b.timestamp)).forEach(b => {
          if (b.paymentMethod === 'cash') cash += (b.totalAmount || 0);
          else if (b.paymentMethod === 'upi') upi += (b.totalAmount || 0);
          else if (b.paymentMethod === 'split') {
            cash += (b.cashAmount || 0);
            upi += (b.upiAmount || 0);
          }
        });
      }
      return { cashTotal: cash, upiTotal: upi };
    }, [bills]);

    const { monthRevenue, businessDayCount, monthName, totalDaysInMonth, dailyAverageDiff, dailyAverageDiffPercent, bestDay, worstDay, avgBillValue } = useMemo(() => {
      const bDateStr = getBusinessDate(); // respecting 5am boundary
      const parts = bDateStr.split('-');
      const bYear = parseInt(parts[0], 10);
      const bMonth = parseInt(parts[1], 10) - 1;
      const bDay = parseInt(parts[2], 10);
      
      const bDate = new Date(bYear, bMonth, bDay);
      const bMonthStart = new Date(bYear, bMonth, 1, 5, 0, 0);
      const nextMonthStart = new Date(bYear, bMonth + 1, 1, 5, 0, 0);
      const mName = format(bDate, 'MMMM');
      const daysInMonth = getDaysInMonth(bDate);

      const monthBills = !bills ? [] : bills.filter(bill => {
        const d = new Date(bill.timestamp);
        return d >= bMonthStart && d < nextMonthStart;
      });

      const total = monthBills.reduce((s, b) => s + (b.totalAmount || 0), 0);

      const todayBills = monthBills.filter(bill => getBusinessDate(new Date(bill.timestamp)) === bDateStr);
      const todayRev = todayBills.reduce((s, b) => s + (b.totalAmount || 0), 0);

      const activeDays = Math.max(1, bDay);
      const currentAvg = total / activeDays;

      let diff = 142;
      let diffPercent = 8.4;
      if (activeDays > 1) {
        const prevRevenue = total - todayRev;
        const prevDays = activeDays - 1;
        const prevAvg = prevRevenue / prevDays;
        diff = currentAvg - prevAvg;
        diffPercent = prevAvg > 0 ? (diff / prevAvg) * 100 : 0;
      }

      // Calculate Best Day, Worst Day, and Average Bill Value
      const dailyTotalsMap: Record<string, number> = {};
      monthBills.forEach(b => {
        const dayStr = getBusinessDate(new Date(b.timestamp));
        dailyTotalsMap[dayStr] = (dailyTotalsMap[dayStr] || 0) + (b.totalAmount || 0);
      });

      const dailyTotals = Object.values(dailyTotalsMap);
      const best = dailyTotals.length > 0 ? Math.max(...dailyTotals) : 0;
      const worst = dailyTotals.length > 0 ? Math.min(...dailyTotals) : 0;
      const avgBill = monthBills.length > 0 ? Math.round(total / monthBills.length) : 0;

      return { 
        monthRevenue: total, 
        businessDayCount: activeDays,
        monthName: mName,
        totalDaysInMonth: daysInMonth,
        dailyAverageDiff: diff,
        dailyAverageDiffPercent: diffPercent,
        bestDay: best,
        worstDay: worst,
        avgBillValue: avgBill
      };
    }, [bills]);

    const dailyAverage = monthRevenue / businessDayCount;
    const projectedMonthEnd = dailyAverage * totalDaysInMonth;




    /**
     * UNIFIED LOGOUT PROTOCOL (v2.7.5):
     * - All roles (Staff, Admin, Owner) now trigger the settlement modal if a shift is active.
     */
    const handleLogoutClick = async () => {
        if (user && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest' || user.username === 'Viren') && activeShift) {
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
            <header className="flex h-20 items-center gap-1.5 sm:gap-2 border-b glass-panel px-2 sm:px-6 sticky top-0 z-40 w-full overflow-hidden font-body">
                <SidebarTrigger className="shrink-0 scale-90 sm:scale-100"/>
                
                <div className="flex-1 flex items-center gap-1 sm:gap-2 overflow-x-auto no-scrollbar scroll-smooth pr-1 sm:pr-4">
                    {activeTimers.map(station => (
                        <HeaderTimer key={station.id} station={station} />
                    ))}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
                    {/* ── Customer View Toggle ── */}
                    <button
                        onClick={toggleCustomerView}
                        title={isCustomerView ? 'Exit Customer View' : 'Enter Customer View'}
                        className={cn(
                            "relative h-9 w-9 flex items-center justify-center rounded-xl border-2 transition-all duration-300 shrink-0 shadow-sm",
                            isCustomerView
                                ? "bg-primary border-primary text-primary-foreground shadow-primary/30 shadow-md animate-pulse"
                                : "bg-muted/20 border-muted-foreground/20 text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5"
                        )}
                    >
                        {isCustomerView ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        {isCustomerView && (
                            <span className="absolute -top-1.5 -right-1.5 flex h-3 w-3">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
                                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
                            </span>
                        )}
                    </button>

                    {(user?.role === 'admin' || user?.username === 'Viren') && !isCustomerView && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <button className="flex flex-col items-end gap-0.5 mr-1 shrink-0 hover:bg-muted/10 p-1 rounded transition-colors text-right">
                                    <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground tracking-normal leading-none">Month Total</p>
                                    <p className="text-sm sm:text-sm font-bold font-mono text-emerald-600 leading-none">₹{Math.round(monthRevenue).toLocaleString()}</p>
                                </button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-0 overflow-hidden font-body border-2 shadow-2xl" align="end">
                                <div className="p-3 bg-muted/20 border-b flex justify-between items-center">
                                    <h4 className="font-bold text-sm uppercase tracking-normal text-muted-foreground flex items-center gap-2">
                                        <Activity className="h-3.5 w-3.5 text-emerald-600" />
                                        {monthName} Performance
                                    </h4>
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/40 px-1.5 py-0.5 rounded">
                                        {businessDayCount}d Active
                                    </span>
                                </div>
                                <div className="p-3.5 space-y-2.5">
                                    <div className="flex justify-between items-center">
                                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-tight">Total Sales</span>
                                        <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                                            ₹{Math.round(monthRevenue).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-start pt-2 border-t border-dashed">
                                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-tight">Daily Average</span>
                                        <div className="flex flex-col items-end">
                                            <span className="text-sm font-bold font-mono text-emerald-600 tabular-nums">
                                                ₹{Math.round(dailyAverage).toLocaleString()}
                                            </span>
                                            <span className={cn(
                                                "text-[10px] font-semibold tracking-tight mt-0.5 flex items-center gap-0.5",
                                                dailyAverageDiff >= 0 ? "text-emerald-500" : "text-rose-500"
                                            )}>
                                                {dailyAverageDiff >= 0 ? '↑' : '↓'} ₹{Math.abs(Math.round(dailyAverageDiff)).toLocaleString()} ({dailyAverageDiffPercent >= 0 ? '+' : ''}{dailyAverageDiffPercent.toFixed(1)}%) vs yesterday
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-tight">Projected End</span>
                                        <span className="text-sm font-bold font-mono text-primary tabular-nums">
                                            ₹{Math.round(projectedMonthEnd).toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center pt-2 border-t border-dashed">
                                        <span className="text-xs font-bold uppercase text-muted-foreground tracking-tight">Avg Bill Value</span>
                                        <span className="text-sm font-bold font-mono text-foreground tabular-nums">
                                            ₹{avgBillValue.toLocaleString()}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-dashed text-xs">
                                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-1.5 rounded flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-emerald-600/80 tracking-tight">Best Day</span>
                                            <span className="font-bold font-mono text-emerald-600 tabular-nums mt-0.5">₹{Math.round(bestDay).toLocaleString()}</span>
                                        </div>
                                        <div className="bg-rose-500/5 border border-rose-500/20 p-1.5 rounded flex flex-col">
                                            <span className="text-[10px] font-bold uppercase text-rose-600/80 tracking-tight">Worst Day</span>
                                            <span className="font-bold font-mono text-rose-600 tabular-nums mt-0.5">₹{Math.round(worstDay).toLocaleString()}</span>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-dashed">
                                        <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-normal leading-tight text-center">
                                            Calculated across {businessDayCount} days of active business.
                                        </p>
                                    </div>
                                </div>
                            </PopoverContent>
                        </Popover>
                    )}
                    {!isCustomerView && <StrategicTarget projectedRevenue={projectedRevenue} cashTotal={cashTotal} upiTotal={upiTotal} />}
                    {!isCustomerView && <OwnerConsumptionHeader />}
                    {!isCustomerView && <TodayExpenses />}
                    {!isCustomerView && (user?.role === 'admin' || user?.username === 'Viren') && (
                        <OwnerStaffFoodHeader 
                            activeShift={activeShift} 
                            currentEmployee={currentEmployee}
                            activeCycle={activeCycle}
                            handleSaveStaffOrder={handleSaveStaffOrder}
                        />
                    )}
                    {!isCustomerView && (
                        <StaffFoodHeaderButton 
                            currentEmployee={currentEmployee}
                            activeCycle={activeCycle}
                            handleSaveStaffOrder={handleSaveStaffOrder}
                        />
                    )}
                    
                    <div className="flex items-center gap-1 px-1 py-1 rounded-xl bg-muted/20 border-2">
                        <ChiptuneSoundToggle />
                        <PendingNotifications />
                        <div className="flex items-center gap-1">
                            <OwnerTaskDropdown />
                            <StaffNotepad />
                            <ShiftTaskDropdown activeShift={activeShift} onTaskToggle={onTaskToggle} />
                            <AdminNotifications />
                        </div>
                        {isNightShift && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-indigo-500 animate-pulse rounded-lg hidden xs:flex">
                            <Moon className="h-4 w-4 fill-current" />
                          </Button>
                        )}
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
                            <DropdownMenuLabel className="text-sm uppercase font-bold opacity-50 px-2 pb-1.5">Current Operator</DropdownMenuLabel>
                            <div className="flex items-center gap-2 px-2 py-2 mb-1.5 bg-muted/30 rounded-md">
                                <p className="text-sm font-bold truncate">{user?.displayName}</p>
                                <Badge variant="outline" className="text-sm uppercase h-4 font-bold">{user?.role}</Badge>
                            </div>
                            {currentEmployee && (
                              <div className="flex items-center justify-between px-2 py-1.5 mb-1.5 rounded-md bg-emerald-500/10 border border-emerald-500/20">
                                <span className="text-sm font-bold uppercase text-emerald-600 tracking-wider flex items-center gap-1.5">
                                  <Utensils className="h-3 w-3" /> Meal Quota
                                </span>
                                <span className="text-sm font-mono font-bold text-emerald-600">
                                  ₹{(currentEmployee.foodAllowanceBalance ?? 1000).toLocaleString()}
                                </span>
                              </div>
                            )}
                            <DropdownMenuSeparator />
                            {(user?.role === 'admin' || user?.username === 'Viren') && (
                              <DropdownMenuItem onClick={() => router.push('/profile')} className="font-bold text-sm uppercase h-10 cursor-pointer">
                                  <User className="mr-2 h-4 w-4" /> View Profile
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onClick={() => { 
                                announceGlobally("This is a test");
                                toast({ title: "Audio Test Triggered", description: "You should hear 'This is a test'." });
                            }} className="font-bold text-sm uppercase h-10 cursor-pointer">
                                <Volume2 className="mr-2 h-4 w-4 text-primary" /> Test Audio Output
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleSwitchUser} className="font-bold text-sm uppercase h-10 cursor-pointer">
                                <ShieldCheck className="mr-2 h-4 w-4" /> Switch Profile
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={handleLogoutClick} className="text-destructive font-bold text-sm uppercase h-10 focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                                <LogOut className="mr-2 h-4 w-4" /> 
                                End Shift & Exit
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            </header>
            
            <CompleteShiftModal 
                isOpen={isEndOfDayModalOpen} 
                onOpenChange={setIsEndOfDayModalOpen} 
                activeShift={activeShift} 
                onTaskToggle={onTaskToggle} 
                onConfirmLogout={handleConfirmLogout} 
            />
        </>
    )
}
