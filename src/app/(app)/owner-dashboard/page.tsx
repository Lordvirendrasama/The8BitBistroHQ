
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import type { Station, Bill, Expense, Employee, Shift, LiabilityState, FixedBill, Settings, OwnerConsumption, Member, GamingPackage } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  Users, 
  Gamepad2, 
  ShoppingBag, 
  Wallet, 
  AlertCircle, 
  Clock, 
  IndianRupee, 
  Zap, 
  ArrowRight, 
  Smartphone, 
  Banknote, 
  ShieldCheck, 
  Crown, 
  Plus, 
  Send, 
  Play, 
  Percent,
  CheckCircle2,
  Calendar,
  Target,
  BarChart3
} from 'lucide-react';
import { isBusinessToday, getBusinessDate } from '@/lib/utils';
import { format, differenceInCalendarMonths, subDays } from 'date-fns';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ProductSalesChart } from '@/components/analytics/product-sales-chart';

export default function OwnerDashboardPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const router = useRouter();

  // ONLY Viren can see this page
  useEffect(() => {
    if (user && user.username !== 'Viren') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // 1. Data Subscriptions
  const stationsQuery = useMemo(() => !db ? null : collection(db, 'stations'), [db]);
  const { data: stations } = useCollection<Station>(stationsQuery);

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const employeesQuery = useMemo(() => !db ? null : query(collection(db, 'employees'), where('isActive', '==', true)), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const shiftsQuery = useMemo(() => !db ? null : query(collection(db, 'shifts'), where('endTime', '==', null)), [db]);
  const { data: activeShifts } = useCollection<Shift>(shiftsQuery);

  const fixedBillsQuery = useMemo(() => !db ? null : collection(db, 'fixedBills'), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const consumptionQuery = useMemo(() => !db ? null : collection(db, 'ownerConsumption'), [db]);
  const { data: consumptions } = useCollection<OwnerConsumption>(consumptionQuery);

  const membersQuery = useMemo(() => !db ? null : collection(db, 'members'), [db]);
  const { data: members } = useCollection<Member>(membersQuery);

  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: packages } = useCollection<GamingPackage>(packagesQuery);

  const [liabilityState, setLiabilityState] = useState<LiabilityState | null>(null);
  const [appSettings, setAppSettings] = useState<Settings | null>(null);

  useEffect(() => {
    if (!db) return;
    const unsubLiab = onSnapshot(doc(db, 'liabilities', 'main_liability_state'), (snap) => {
      if (snap.exists()) setLiabilityState(snap.data() as LiabilityState);
    });
    const unsubSett = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) setAppSettings(snap.data() as Settings);
    });
    return () => { unsubLiab(); unsubSett(); };
  }, [db]);

  // 2. Computed Statistics
  const stats = useMemo(() => {
    if (!bills || !expenses || !liabilityState || !fixedBills || !appSettings || !members || !stations) return null;

    const todayBills = bills.filter(b => b.timestamp && isBusinessToday(b.timestamp));
    const todayExpenses = expenses.filter(e => e.timestamp && isBusinessToday(e.timestamp));
    const monthExpenses = expenses.filter(e => {
        const d = new Date(e.timestamp);
        const now = new Date();
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    // Revenue
    const revTotal = todayBills.reduce((s, b) => s + b.totalAmount, 0);
    const revCash = todayBills.reduce((s, b) => s + (b.paymentMethod === 'cash' ? b.totalAmount : b.paymentMethod === 'split' ? (b.cashAmount || 0) : 0), 0);
    const revUpi = todayBills.reduce((s, b) => s + (b.paymentMethod === 'upi' ? b.totalAmount : b.paymentMethod === 'split' ? (b.upiAmount || 0) : 0), 0);
    const revPending = todayBills.reduce((s, b) => s + (b.paymentMethod === 'pending' ? b.totalAmount : 0), 0);

    const revGaming = todayBills.reduce((s, b) => s + (b.initialPackagePrice || 0) + b.items.filter(i => i.name.startsWith('Time:')).reduce((sum, i) => sum + (i.price * i.quantity), 0), 0);
    const revFood = revTotal - revGaming - revPending;

    // Survival Goal (Matches logic in Header)
    const otherBills = fixedBills.filter(fb => !(fb.name || '').toLowerCase().includes('rent'));
    const overheads = calculateDailyFixedCost(otherBills);
    const targetDate = new Date(`2030-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, new Date()));
    const monthlyInterestRate = (liabilityState.annualInterestRate || 9) / 100 / 12;
    const P = liabilityState.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    const loanShare = P > 0 ? ((P * r) / (1 - Math.pow(1 + r, -n))) / 30 : 0;
    const rentShare = (liabilityState.monthlyRent || 0) / 30;
    const backlogShare = (liabilityState.rentBalance || 0) / monthsUntilTarget / 30;

    const survivalGoal = 
      (appSettings.includeFixed ? overheads : 0) + 
      (appSettings.includeLoan ? loanShare : 0) + 
      (appSettings.includeRent ? rentShare : 0) + 
      (appSettings.includeBacklog ? backlogShare : 0);

    // Member Engagement
    const newToday = members.filter(m => isBusinessToday(m.joinDate)).length;
    const newWeek = members.filter(m => {
        const d = new Date(m.joinDate);
        const weekAgo = subDays(new Date(), 7);
        return d >= weekAgo;
    }).length;

    // Top Customers Today
    const todayMemberActivity = todayBills.map(b => ({
        name: b.members[0]?.name || 'Unknown',
        amount: b.totalAmount,
        xp: Math.floor(b.totalAmount * (appSettings.xpPerRupee || 1))
    })).sort((a, b) => b.amount - a.amount).slice(0, 3);

    // Recharge Pool
    const rechargeOwed = members.reduce((sum, m) => sum + (m.recharges || []).filter(r => new Date(r.expiryDate) > new Date()).reduce((s, r) => s + r.remainingDuration, 0), 0);
    const rechargeSoldToday = todayBills.filter(b => b.isRechargePurchase).reduce((s, b) => s + b.totalAmount, 0);

    // Owner Consumption
    const todayConsumption = consumptions?.filter(c => isBusinessToday(c.timestamp)) || [];
    const consumptionValue = todayConsumption.reduce((s, c) => s + c.totalValue, 0);

    return {
        revTotal, revCash, revUpi, revPending, revGaming, revFood,
        survivalGoal,
        newToday, newWeek,
        todayMemberActivity,
        rechargeOwed, rechargeSoldToday,
        expToday: todayExpenses.reduce((s, e) => s + e.amount, 0),
        expMonth: monthExpenses.reduce((s, e) => s + e.amount, 0),
        consumptionValue,
        loanBalance: liabilityState.loanBalance,
        rentBalance: liabilityState.rentBalance
    };
  }, [bills, expenses, liabilityState, fixedBills, appSettings, members, stations, consumptions]);

  if (!stats || !stations) return <div className="p-20 text-center animate-pulse font-headline text-xs uppercase tracking-[0.2em]">Recalibrating Owner Pulse...</div>;

  const healthScore = stats.revTotal / (stats.survivalGoal || 1);
  const healthStatus = healthScore >= 1.2 ? 'STRONG' : healthScore >= 0.8 ? 'STABLE' : 'DANGER';
  const healthColor = healthStatus === 'STRONG' ? 'bg-emerald-600' : healthStatus === 'STABLE' ? 'bg-amber-600' : 'bg-destructive';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-body">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-4">
          <Crown className="h-10 w-10 text-primary fill-current" />
          OWNER PULSE
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs pl-1">
          OPERATIONAL COMMAND & CONTROL &bull; {format(new Date(), 'PPPP').toUpperCase()}
        </p>
      </div>

      {/* 1. FINAL HEALTH BANNER - MOVED TO TOP */}
      <div className={cn(
        "w-full p-6 rounded-2xl flex items-center justify-between text-white shadow-2xl transition-all duration-500",
        healthColor
      )}>
        <div className="flex items-center gap-4">
          <ShieldCheck className="h-10 w-10" />
          <div>
            <h3 className="text-2xl font-headline tracking-tighter">CAFÉ STATUS: {healthStatus}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
              Health check performed based on current business day intake and utilization metrics.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <p className="text-[10px] font-black uppercase opacity-60">Goal Performance</p>
          <p className="text-3xl font-black font-mono">{(healthScore * 100).toFixed(1)}%</p>
        </div>
      </div>

      {/* 2. TOP ROW: FINANCIAL OVERVIEW */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-2 bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <IndianRupee className="h-3 w-3" /> Today's Intake
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-3xl font-black font-mono">₹{stats.revTotal.toLocaleString()}</div>
            <div className="flex justify-between mt-2 text-[9px] font-bold uppercase opacity-60">
              <span>Gaming: ₹{stats.revGaming}</span>
              <span>Bistro: ₹{stats.revFood}</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-2 bg-card shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Wallet className="h-3 w-3" /> Collection Mix
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <p className="text-[8px] font-black uppercase opacity-40">Cash</p>
                <p className="text-lg font-black font-mono text-emerald-600">₹{stats.revCash}</p>
              </div>
              <div className="flex-1 border-l pl-4">
                <p className="text-[8px] font-black uppercase opacity-40">UPI</p>
                <p className="text-lg font-black font-mono text-primary">₹{stats.revUpi}</p>
              </div>
            </div>
            {stats.revPending > 0 && (
              <p className="mt-2 text-[9px] font-black text-destructive uppercase">Pending: ₹{stats.revPending}</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-2 bg-primary/5 border-primary/20 shadow-lg">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
              <Target className="h-3 w-3" /> Survival Goal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-2">
            <div className="flex justify-between items-baseline">
              <div className="text-2xl font-black font-mono">₹{Math.round(stats.survivalGoal).toLocaleString()}</div>
              <Badge variant="outline" className="text-[8px] h-4 font-black border-primary/30 text-primary">DAILY</Badge>
            </div>
            <Progress value={(stats.revTotal / stats.survivalGoal) * 100} className="h-1.5" />
          </CardContent>
        </Card>

        <Card className="border-2 bg-muted/5 shadow-sm">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <AlertCircle className="h-3 w-3" /> Current Liabilities
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-black font-mono">₹{(stats.loanBalance + stats.rentBalance).toLocaleString()}</div>
            <p className="text-[9px] font-bold uppercase opacity-50 mt-1">Loan: ₹{Math.round(stats.loanBalance).toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. MIDDLE ROW: ANALYTICS & STAFF */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* STRATEGIC ANALYTICS REPLACES LIVE STATIONS */}
        <Card className="lg:col-span-2 border-2 overflow-hidden flex flex-col">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Strategic Pulse
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Real-time revenue distribution.</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary uppercase">LIVE INSIGHTS</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6 flex-1 flex flex-col items-center justify-center min-h-[300px]">
            <ProductSalesChart bills={bills?.filter(b => b.timestamp && isBusinessToday(b.timestamp)) || []} />
          </CardContent>
        </Card>

        {/* STAFF ON DUTY */}
        <Card className="border-2 flex flex-col">
          <CardHeader className="border-b bg-muted/10">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" /> Staff on Duty
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-4 flex-1">
            {activeShifts && activeShifts.length > 0 ? activeShifts.map(shift => (
              <div key={shift.id} className="space-y-3">
                {shift.employees.map(emp => (
                  <div key={emp.username} className="flex items-center justify-between p-3 rounded-xl border-2 bg-muted/5">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary">{emp.displayName[0]}</div>
                      <div>
                        <p className="text-xs font-black uppercase">{emp.displayName}</p>
                        <p className="text-[9px] font-bold opacity-50 uppercase flex items-center gap-1"><Clock className="h-2 w-2" /> Since {format(new Date(shift.startTime), 'p')}</p>
                      </div>
                    </div>
                    {shift.lateMinutes ? <Badge variant="destructive" className="text-[8px] font-black">LATE</Badge> : <Badge className="bg-emerald-600 text-[8px] font-black">ACTIVE</Badge>}
                  </div>
                ))}
              </div>
            )) : (
              <div className="h-full flex flex-col items-center justify-center opacity-30 italic py-8">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p className="text-[10px] font-black uppercase tracking-widest">No staff logged in</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. BOTTOM ROW: EXPENSES, UTILIZATION, MEMBERS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* EXPENSES & CONSUMPTION */}
        <Card className="border-2">
          <CardHeader className="p-4 pb-2 border-b bg-muted/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <ShoppingBag className="h-3 w-3" /> Expenses & Consumption
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-[8px] font-black uppercase opacity-40">Spent Today</p>
                <p className="text-xl font-black font-mono text-destructive">₹{stats.expToday}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-[8px] font-black uppercase opacity-40">Month Outflow</p>
                <p className="text-xl font-black font-mono text-destructive">₹{stats.expMonth.toLocaleString()}</p>
              </div>
            </div>
            <div className="pt-4 border-t border-dashed space-y-2">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Crown className="h-3 w-3 text-indigo-600" />
                  <span className="text-[9px] font-black uppercase text-indigo-700">Owner Consumption</span>
                </div>
                <span className="text-xs font-black font-mono text-indigo-600">₹{stats.consumptionValue}</span>
              </div>
              <p className="text-[8px] font-bold text-muted-foreground italic">Shadow cost tracked but excluded from official revenue.</p>
            </div>
          </CardContent>
        </Card>

        {/* RECHARGE POOL */}
        <Card className="border-2">
          <CardHeader className="p-4 pb-2 border-b bg-muted/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Zap className="h-3 w-3" /> Recharge Pool Status
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
            <div className="space-y-1">
              <p className="text-[8px] font-black uppercase opacity-40">Total Prepaid Liability (Time)</p>
              <p className="text-2xl font-black font-mono text-yellow-600">
                {Math.floor(stats.rechargeOwed / 3600)}h {Math.floor((stats.rechargeOwed % 3600) / 60)}m
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
              <div>
                <p className="text-[8px] font-black uppercase opacity-40">Sold Today</p>
                <p className="text-lg font-black font-mono text-emerald-600">₹{stats.rechargeSoldToday}</p>
              </div>
              <div className="border-l pl-4">
                <p className="text-[8px] font-black uppercase opacity-40">Redeemed Today</p>
                <p className="text-lg font-black font-mono">₹0</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* MEMBER ENGAGEMENT */}
        <Card className="border-2">
          <CardHeader className="p-4 pb-2 border-b bg-muted/5">
            <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
              <Users className="h-3 w-3" /> Member Engagement
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-6">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-[8px] font-black uppercase opacity-40">New Today</p>
                <p className="text-xl font-black">+{stats.newToday}</p>
              </div>
              <div className="text-right">
                <p className="text-[8px] font-black uppercase opacity-40">New This Week</p>
                <p className="text-xl font-black">+{stats.newWeek}</p>
              </div>
            </div>
            <div className="space-y-2 border-t border-dashed pt-4">
              <p className="text-[9px] font-black uppercase text-muted-foreground opacity-60">Top Customers (Today)</p>
              <div className="space-y-1.5">
                {stats.todayMemberActivity.map((act, i) => (
                  <div key={i} className="flex justify-between items-center text-[10px] font-bold">
                    <span className="uppercase">{act.name}</span>
                    <span className="font-mono text-primary">₹{act.amount} &bull; {act.xp} XP</span>
                  </div>
                ))}
                {stats.todayMemberActivity.length === 0 && <p className="text-[9px] italic opacity-30 text-center py-2">No activity recorded today</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 5. QUICK ACTIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Button onClick={() => router.push('/financials/expenses')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-primary hover:text-white transition-all shadow-md">
          <Plus className="h-4 w-4" /> Add Expense
        </Button>
        <Button onClick={() => router.push('/financials/payroll')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-emerald-600 hover:text-white transition-all shadow-md">
          <IndianRupee className="h-4 w-4" /> Pay Salary
        </Button>
        <Button onClick={() => router.push('/users')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-indigo-600 hover:text-white transition-all shadow-md">
          <Send className="h-4 w-4" /> Broadcast
        </Button>
        <Button onClick={() => router.push('/dashboard')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-orange-600 hover:text-white transition-all shadow-md">
          <Play className="h-4 w-4" /> Start Station
        </Button>
        <Button onClick={() => router.push('/settings/packages')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-pink-600 hover:text-white transition-all shadow-md">
          <Zap className="h-4 w-4" /> Create Offer
        </Button>
      </div>
    </div>
  );
}
