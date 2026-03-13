
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
  BarChart3,
  Utensils,
  Coffee,
  Flame,
  LineChart,
  TrendingDown,
  Separator,
  Sparkles,
  Activity,
  ChevronRight
} from 'lucide-react';
import { isBusinessToday, getBusinessDate } from '@/lib/utils';
import { format, differenceInCalendarMonths, subDays, startOfDay, startOfMonth, endOfMonth } from 'date-fns';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { AppUpdatesDropdown } from '@/components/owner/app-updates-dropdown';

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

    const todayStr = getBusinessDate();
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    // DAILY DATA (For main financials)
    const dailyBills = bills.filter(b => b.timestamp && isBusinessToday(b.timestamp));
    const dailyExpenses = expenses.filter(e => e.timestamp && isBusinessToday(e.timestamp));
    
    // Revenue (Daily)
    const revTotal = dailyBills.reduce((s, b) => s + b.totalAmount, 0);
    const revCash = dailyBills.reduce((s, b) => s + (b.paymentMethod === 'cash' ? b.totalAmount : b.paymentMethod === 'split' ? (b.cashAmount || 0) : 0), 0);
    const revUpi = dailyBills.reduce((s, b) => s + (b.paymentMethod === 'upi' ? b.totalAmount : b.paymentMethod === 'split' ? (b.upiAmount || 0) : 0), 0);
    const revPending = dailyBills.reduce((s, b) => s + (b.paymentMethod === 'pending' ? b.totalAmount : 0), 0);

    const revGaming = dailyBills.reduce((s, b) => s + (b.initialPackagePrice || 0) + b.items.filter(i => i.name.startsWith('Time:')).reduce((sum, i) => sum + (i.price * i.quantity), 0), 0);
    const revFood = revTotal - revGaming - revPending;

    // MONTHLY DATA (For Performers)
    const monthlyBills = bills.filter(b => {
        const d = new Date(b.timestamp);
        return d >= monthStart && d <= monthEnd;
    });

    // Footfall Logic (Recent Bills Volume)
    const footfallVolume = dailyBills.length;
    const footfallIntensity = footfallVolume > 15 ? 'HIGH' : footfallVolume > 5 ? 'MODERATE' : 'LOW';

    // Item Analytics (Monthly for volume)
    const foodCounts: Record<string, number> = {};
    const drinkCounts: Record<string, number> = {};
    const packageCounts: Record<string, number> = {};

    monthlyBills.forEach(bill => {
        if (bill.packageName) {
            const pureName = bill.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
            packageCounts[pureName] = (packageCounts[pureName] || 0) + 1;
        }
        bill.items.forEach(item => {
            if (item.name.startsWith('Time:')) {
                const pureName = item.name.replace('Time: ', '').split('(')[0].trim();
                packageCounts[pureName] = (packageCounts[pureName] || 0) + item.quantity;
            } else {
                const isDrink = item.name.toLowerCase().includes('coffee') || 
                                item.name.toLowerCase().includes('tea') || 
                                item.name.toLowerCase().includes('latte') ||
                                item.name.toLowerCase().includes('soda');
                const target = isDrink ? drinkCounts : foodCounts;
                target[item.name] = (target[item.name] || 0) + item.quantity;
            }
        });
    });

    const getTop = (map: Record<string, number>) => {
        const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);
        return sorted.length > 0 ? sorted[0] : null;
    };
    
    const topFood = getTop(foodCounts);
    const topDrink = getTop(drinkCounts);
    const topPkg = getTop(packageCounts);

    // --- MONTH-ON-MONTH (MoM) ANALYTICS FOR HEATMAPS ---
    const momHourCounts: Record<number, number> = {};
    const momDayCounts: Record<string, number> = {};
    
    bills.forEach(b => {
        const d = new Date(b.timestamp);
        const h = d.getHours();
        const day = format(d, 'EEEE');
        momHourCounts[h] = (momHourCounts[h] || 0) + 1;
        momDayCounts[day] = (momDayCounts[day] || 0) + 1;
    });

    const topHour = Object.entries(momHourCounts).sort((a, b) => b[1] - a[1])[0];
    const topDay = Object.entries(momDayCounts).sort((a, b) => b[1] - a[1])[0];

    // Survival Goal (Fixed costs logic)
    const otherBills = fixedBills.filter(fb => !(fb.name || '').toLowerCase().includes('rent'));
    const overheads = calculateDailyFixedCost(otherBills);
    const targetDate = new Date(`2030-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, new Date()));
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

    const survivalGoal = 
      (appSettings.includeFixed ? overheads : 0) + 
      (appSettings.includeLoanInterest ? loanIntShare : 0) + 
      (appSettings.includeLoanPrincipal ? loanPriShare : 0) + 
      (appSettings.includeRent ? rentShare : 0) + 
      (appSettings.includeBacklog ? backlogShare : 0);

    return {
        revTotal, revCash, revUpi, revPending, revGaming, revFood,
        survivalGoal,
        topFood, topDrink, topPkg,
        topHour, topDay,
        expToday: dailyExpenses.reduce((s, e) => s + e.amount, 0),
        loanBalance: liabilityState.loanBalance,
        rentBalance: liabilityState.rentBalance,
        footfallIntensity,
        footfallVolume,
        todayStr
    };
  }, [bills, expenses, liabilityState, fixedBills, appSettings, members, stations]);

  if (!stats || !stations) return <div className="p-20 text-center animate-pulse font-headline text-xs uppercase tracking-[0.2em]">Recalibrating Owner Pulse...</div>;

  const healthScore = stats.revTotal / (stats.survivalGoal || 1);
  const healthStatus = healthScore >= 1.2 ? 'STRONG' : healthScore >= 0.8 ? 'STABLE' : 'DANGER';
  const healthColor = healthStatus === 'STRONG' ? 'bg-emerald-600' : healthStatus === 'STABLE' ? 'bg-amber-600' : 'bg-destructive';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12 font-body">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-4">
            <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-4">
              <Crown className="h-10 w-10 text-primary fill-current" />
              OWNER PULSE
            </h1>
            <AppUpdatesDropdown />
          </div>
          <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs pl-1">
            OPERATIONAL COMMAND & CONTROL &bull; CYCLE: {stats.todayStr}
          </p>
        </div>
      </div>

      {/* 1. FINAL HEALTH BANNER */}
      <div className={cn(
        "w-full p-6 rounded-2xl flex items-center justify-between text-white shadow-2xl transition-all duration-500",
        healthColor
      )}>
        <div className="flex items-center gap-4">
          <ShieldCheck className="h-10 w-10" />
          <div>
            <h3 className="text-2xl font-headline tracking-tighter">TODAY'S STATUS: {healthStatus}</h3>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
              Audit performed based on current business day intake vs calculated survival threshold.
            </p>
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end">
          <p className="text-[10px] font-black uppercase opacity-60">Daily Goal Performance</p>
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
              <Badge variant="outline" className="text-[8px] h-4 font-black border-primary/30 text-primary">DAILY TARGET</Badge>
            </div>
            <Progress value={(stats.revTotal / stats.survivalGoal) * 100} className="h-1.5" />
          </CardContent>
        </Card>

        {/* FOOTFALL INTENSITY SUMMARY */}
        <Card className="border-2 bg-muted/5 shadow-sm group hover:border-primary/30 transition-all cursor-pointer" onClick={() => router.push('/analytics/footfall')}>
          <CardHeader className="p-4 pb-2">
            <div className="flex justify-between items-center">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Activity className="h-3 w-3" /> Footfall Intensity
                </CardTitle>
                <ChevronRight className="h-3 w-3 opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </div>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex justify-between items-end">
                <div>
                    <div className={cn(
                        "text-3xl font-black font-mono",
                        stats.footfallIntensity === 'HIGH' ? "text-emerald-600" : stats.footfallIntensity === 'MODERATE' ? "text-amber-600" : "text-muted-foreground"
                    )}>
                        {stats.footfallIntensity}
                    </div>
                    <p className="text-[9px] font-bold uppercase opacity-50 mt-1">{stats.footfallVolume} Orders Registered</p>
                </div>
                <div className="h-10 w-10 rounded-lg bg-background border-2 border-dashed flex items-center justify-center">
                    <TrendingUp className="h-5 w-5 opacity-20" />
                </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 3. MIDDLE ROW: STRATEGIC PULSE & STAFF */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-2 overflow-hidden flex flex-col">
          <CardHeader className="border-b bg-muted/10">
            <div className="flex justify-between items-center">
              <div>
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Monthly Top Performers
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">High-Volume Items for the current month.</CardDescription>
              </div>
              <Badge variant="outline" className="text-[10px] font-black border-primary/20 text-primary uppercase">{format(new Date(), 'MMMM yyyy')}</Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-orange-500/5 border-orange-500/20">
                    <div className="p-2 bg-orange-500/10 rounded-lg"><Utensils className="h-5 w-5 text-orange-600" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Top Food</p>
                        <p className="text-xs font-black uppercase truncate">{stats.topFood ? stats.topFood[0] : 'N/A'}</p>
                        {stats.topFood && <p className="text-[10px] font-bold text-orange-600 mt-0.5">{stats.topFood[1]} Units Sold</p>}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-blue-500/5 border-blue-500/20">
                    <div className="p-2 bg-blue-500/10 rounded-lg"><Coffee className="h-5 w-5 text-blue-600" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Top Beverage</p>
                        <p className="text-xs font-black uppercase truncate">{stats.topDrink ? stats.topDrink[0] : 'N/A'}</p>
                        {stats.topDrink && <p className="text-[10px] font-bold text-blue-600 mt-0.5">{stats.topDrink[1]} Units Sold</p>}
                    </div>
                </div>

                <div className="flex items-center gap-3 p-4 rounded-xl border-2 bg-primary/5 border-primary/20">
                    <div className="p-2 bg-primary/10 rounded-lg"><Zap className="h-5 w-5 text-primary" /></div>
                    <div className="min-w-0 flex-1">
                        <p className="text-[8px] font-black text-muted-foreground uppercase tracking-widest">Top Package</p>
                        <p className="text-xs font-black uppercase truncate">{stats.topPkg ? stats.topPkg[0] : 'N/A'}</p>
                        {stats.topPkg && <p className="text-[10px] font-bold text-primary mt-0.5">{stats.topPkg[1]} Sessions</p>}
                    </div>
                </div>
            </div>
          </CardContent>
        </Card>

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
                    <Badge className="bg-emerald-600 text-[8px] font-black">ACTIVE</Badge>
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

      {/* 4. OPERATIONAL INTELLIGENCE HEATMAPS - MONTH-ON-MONTH DATA */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 bg-muted/5 overflow-hidden group hover:border-primary/30 transition-all cursor-pointer" onClick={() => router.push('/analytics/footfall')}>
            <CardHeader className="border-b pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Clock className="h-4 w-4 text-primary" />
                        Global Peak Hours
                    </CardTitle>
                    <Badge variant="secondary" className="text-[8px] font-black bg-primary/10 text-primary uppercase">MoM ANALYTICS</Badge>
                </div>
                <CardDescription className="text-[9px] font-bold uppercase tracking-tight">Most popular login windows based on full system history.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-4xl font-black font-mono tracking-tighter">
                        {stats.topHour ? `${stats.topHour[0]}:00` : 'N/A'}
                    </p>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Power Hour</p>
                </div>
                <div className="h-16 w-[2px] bg-primary/10 mx-6" />
                <div className="flex-1 space-y-3">
                    <div className="flex justify-between items-center text-[10px] font-bold uppercase">
                        <span>Intake Velocity</span>
                        <span className="text-emerald-600">MONTHLY TREND</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary w-[85%] rounded-full shadow-[0_0_10px_rgba(239,0,53,0.3)]" />
                    </div>
                    <p className="text-[8px] text-muted-foreground uppercase font-black">Busiest window identified from month-on-month behavioral data.</p>
                </div>
            </CardContent>
        </Card>

        <Card className="border-2 bg-muted/5 overflow-hidden group hover:border-primary/30 transition-all cursor-pointer" onClick={() => router.push('/analytics/footfall')}>
            <CardHeader className="border-b pb-3">
                <div className="flex justify-between items-center">
                    <CardTitle className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" />
                        Prime Business Days
                    </CardTitle>
                    <Badge variant="secondary" className="text-[8px] font-black bg-primary/10 text-primary uppercase">MoM ANALYTICS</Badge>
                </div>
                <CardDescription className="text-[9px] font-bold uppercase tracking-tight">Highest traffic days identified across all months.</CardDescription>
            </CardHeader>
            <CardContent className="p-6 flex items-center justify-between">
                <div className="space-y-1">
                    <p className="text-3xl font-black uppercase tracking-tighter">
                        {stats.topDay ? stats.topDay[0] : 'N/A'}
                    </p>
                    <p className="text-[10px] font-black uppercase text-primary tracking-widest">Strongest Day</p>
                </div>
                <div className="h-16 w-[2px] bg-primary/10 mx-6" />
                <div className="flex-1 space-y-3">
                    <div className="grid grid-cols-7 gap-1">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                            <div key={d} className={cn(
                                "h-8 rounded flex items-center justify-center text-[8px] font-black uppercase border",
                                stats.topDay?.[0].startsWith(d) ? "bg-primary border-primary text-white shadow-md" : "bg-card border-muted opacity-40"
                            )}>
                                {d[0]}
                            </div>
                        ))}
                    </div>
                    <p className="text-[8px] text-muted-foreground uppercase font-black">Historical high-impact day derived from longitudinal month-on-month data.</p>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* 5. QUICK ACTIONS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <Button onClick={() => router.push('/financials/spending')} variant="outline" className="h-16 flex flex-col gap-1 border-2 font-black uppercase text-[10px] tracking-tight hover:bg-primary hover:text-white transition-all shadow-md">
          <Plus className="h-4 w-4" /> Add Outflow
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
