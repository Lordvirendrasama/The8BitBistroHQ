
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { LiabilityState, Bill, FixedBill, Expense } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Zap, Target, TrendingUp, Settings2, Timer, AlertCircle, Info, Activity, Calendar as CalendarIcon, ArrowRight } from 'lucide-react';
import { format, addMonths, differenceInCalendarMonths, differenceInDays, startOfMonth, subDays } from 'date-fns';
import { cn, isBusinessToday, getBusinessDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { LiabilityPaymentModal } from './payment-modal';
import { LiabilityConfigModal } from './config-modal';
import { getLiabilityState, processLiabilityCycles } from '@/firebase/firestore/liabilities';
import { useAuth } from '@/firebase/auth/use-user';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';

export function LiabilityDashboard() {
  const { db } = useFirebase();
  const { user } = useAuth();
  
  const [state, setState] = useState<LiabilityState | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  const [missionYear, setMissionYear] = useState<number>(2030);
  const [growthRate, setGrowthRate] = useState<number>(5); 
  
  const [includeFixed, setIncludeFixed] = useState(true);
  const [includeLoan, setIncludeLoan] = useState(true);
  const [includeRent, setIncludeRent] = useState(true);
  const [includeBacklog, setIncludeBacklog] = useState(true);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(val));
  };

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const fixedBillsQuery = useMemo(() => !db ? null : collection(db, 'fixedBills'), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const loadData = async () => {
    if (!user) return;
    setIsProcessing(true);
    await processLiabilityCycles(user);
    const s = await getLiabilityState();
    setState(s);
    setIsProcessing(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  const dailyOverheads = useMemo(() => {
    const otherBills = (fixedBills || []).filter(fb => {
        const name = (fb.name || '').toLowerCase().trim();
        return !name.includes('rent');
    });
    return calculateDailyFixedCost(otherBills);
  }, [fixedBills]);

  const revToday = useMemo(() => {
    if (!bills) return 0;
    return bills
        .filter(b => b.timestamp && isBusinessToday(b.timestamp))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }, [bills]);

  const { ladderGoals, simResults, velocity } = useMemo(() => {
    if (!state) return { ladderGoals: { g1: 0, g2: 0, g3: 0, g4: 0 }, simResults: null, velocity: 0 };
    
    const now = new Date();
    const targetDate = new Date(`${missionYear}-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, now));
    const monthlyInterestRate = (state.annualInterestRate || 9) / 100 / 12; 
    const monthlyGrowth = growthRate / 100;

    const g1 = dailyOverheads;
    
    const P = state.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    const requiredMonthlyLoan = P > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : 0;
    const g2 = requiredMonthlyLoan / 30;
    
    const g3 = state.monthlyRent / 30;
    
    const requiredMonthlyBacklog = state.rentBalance / monthsUntilTarget;
    const g4 = requiredMonthlyBacklog / 30;

    const last30DaysSurplus: number[] = [];
    for (let i = 1; i <= 30; i++) {
        const d = subDays(now, i);
        const bDate = getBusinessDate(d);
        const dayRev = (bills || []).filter(b => b.timestamp && getBusinessDate(new Date(b.timestamp)) === bDate).reduce((s, b) => s + b.totalAmount, 0);
        const dayExp = (expenses || []).filter(e => e.timestamp && getBusinessDate(new Date(e.timestamp)) === bDate).reduce((s, e) => s + e.amount, 0);
        const surplus = Math.max(0, dayRev - (dailyOverheads + dayExp));
        last30DaysSurplus.push(surplus);
    }
    
    const avgDailySurplus = last30DaysSurplus.reduce((a, b) => a + b, 0) / (last30DaysSurplus.length || 1);
    const predictedMonthlyPayment = avgDailySurplus * 30;
    
    const monthsSinceTracking = Math.max(1, differenceInCalendarMonths(now, new Date(state.trackingStartDate || state.loanStartDate)));
    const actualMonthlyPayment = (state.totalLoanPaid + state.totalRentPaid) / monthsSinceTracking;
    
    const behavioralMonthlyPayment = Math.max(actualMonthlyPayment, predictedMonthlyPayment);

    let simLoan = state.loanBalance;
    let simRent = state.rentBalance;
    let simMonths = 0;
    let payoffDate: Date | null = null;

    if ((simLoan + simRent) > 0 && behavioralMonthlyPayment > 0) {
        while ((simLoan + simRent) > 0 && simMonths < 600) {
            simMonths++;
            simLoan += (simLoan * monthlyInterestRate);
            
            let available = behavioralMonthlyPayment * Math.pow(1 + (monthlyGrowth / 12), simMonths);
            
            const rentPay = Math.min(simRent, available);
            simRent -= rentPay;
            available -= rentPay;
            
            const loanPay = Math.min(simLoan, available);
            simLoan -= loanPay;
            
            if ((simLoan + simRent) <= 0) {
                payoffDate = addMonths(now, simMonths);
                break;
            }
        }
    }

    return { 
        ladderGoals: { g1, g2, g3, g4 }, 
        simResults: { payoffDate, monthsToPayoff: simMonths }, 
        velocity: behavioralMonthlyPayment 
    };
  }, [state, missionYear, dailyOverheads, growthRate, bills, expenses]);

  if (isProcessing || !state) {
    return (
      <div className="flex flex-col items-center justify-center p-20 gap-4 opacity-50">
        <Activity className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-[10px] tracking-widest uppercase">Syncing Mission Core...</p>
      </div>
    );
  }

  const activeGoalTotal = (includeFixed ? ladderGoals.g1 : 0) + (includeLoan ? ladderGoals.g2 : 0) + (includeRent ? ladderGoals.g3 : 0) + (includeBacklog ? ladderGoals.g4 : 0);
  const performancePct = Math.min(100, (revToday / (activeGoalTotal || 1)) * 100);
  const remainingTarget = Math.max(0, activeGoalTotal - revToday);

  const earnedColor = revToday >= activeGoalTotal 
    ? "text-emerald-600" 
    : revToday >= ladderGoals.g1 
      ? "text-amber-500" 
      : "text-destructive";

  const loanProgress = state.loanPrincipalStart > 0 ? Math.max(0, Math.min(100, (state.totalLoanPaid / state.loanPrincipalStart) * 100)) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 font-body">
      {/* 1. TOTAL DEBT HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-0">
        <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Financial Reality Balances</h2>
            <div className="flex items-center gap-3">
                <Wallet className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-headline tracking-tighter">{formatCurrency(state.loanBalance + state.rentBalance)}</h1>
                <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px] h-6 px-3">Live Liability</Badge>
            </div>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={() => setIsConfigModalOpen(true)} className="h-14 w-14 border-2">
                <Settings2 className="h-6 w-6" />
            </Button>
            <Button onClick={() => setIsPayModalOpen(true)} className="h-14 px-10 font-black uppercase tracking-widest shadow-xl bg-primary hover:bg-primary/90 text-white">
                <Zap className="mr-2 h-5 w-5 fill-current" />
                Record Payment
            </Button>
        </div>
      </div>

      {/* 2. REALITY CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-4 sm:px-0">
        <Card className="border-2 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-headline text-primary tracking-tight">BUSINESS LOAN</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">9% APR • MONTHLY COMPOUNDING</CardDescription>
                    </div>
                    <Badge className="bg-primary text-white font-black text-[10px]">TRUTH</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-6">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Balance Owed</p>
                        <p className="text-3xl font-black font-mono tracking-tighter">{formatCurrency(state.loanBalance)}</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Principal Paid</p>
                        <p className="text-xl font-black font-mono text-emerald-600">{formatCurrency(state.totalLoanPaid)}</p>
                    </div>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>Repayment Progress</span>
                        <span>{loanProgress.toFixed(1)}%</span>
                    </div>
                    <Progress value={loanProgress} className="h-2" indicatorClassName="bg-emerald-500" />
                </div>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-headline tracking-tight">DEFERRED RENT</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">INTEREST-FREE ARREARS</CardDescription>
                    </div>
                    <Badge variant="secondary" className="font-black text-[10px]">TRUTH</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                <div className="flex justify-between items-end">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Backlog</p>
                        <p className="text-3xl font-black font-mono tracking-tighter text-amber-600">{formatCurrency(state.rentBalance)}</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Duration Behind</p>
                        <p className="text-xl font-black font-mono">{Math.ceil(state.rentBalance / (state.monthlyRent || 1))} MONTHS</p>
                    </div>
                </div>
                <div className="p-4 rounded-xl border-2 border-dashed bg-amber-500/5 flex items-center gap-3">
                    <AlertCircle className="text-amber-600 h-5 w-5" />
                    <p className="text-[10px] font-bold text-amber-700 uppercase leading-tight">Increments automatically by {formatCurrency(state.monthlyRent)} every month.</p>
                </div>
            </CardContent>
        </Card>
      </div>

      {/* 3. MISSION ROADMAP */}
      <Card className="border-4 border-primary/20 bg-primary/[0.02] shadow-2xl relative overflow-hidden mx-4 sm:mx-0">
        <CardHeader className="bg-primary/5 border-b pb-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <CardTitle className="font-headline text-2xl tracking-tight text-primary flex items-center gap-2">
                        <Target className="h-6 w-6" /> MISSION TO ZERO: {missionYear}
                    </CardTitle>
                    <CardDescription className="font-bold text-[9px] uppercase tracking-widest text-primary/60">Strategy Engine: Required daily intake to reach zero debt by the deadline.</CardDescription>
                </div>
                <div className="flex bg-muted/30 p-1 rounded-xl border-2 border-primary/10">
                    {[2026, 2027, 2028, 2029, 2030].map(year => (
                        <button key={year} onClick={() => setMissionYear(year)} className={cn("px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all", missionYear === year ? "bg-primary text-white shadow-lg" : "text-muted-foreground hover:text-primary")}>
                            {year}
                        </button>
                    ))}
                </div>
            </div>
        </CardHeader>
        <CardContent className="pt-8 space-y-10">
            <div className="max-w-md space-y-4">
                <div className="flex justify-between items-center">
                    <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-primary" />
                        Expected Monthly Growth
                    </Label>
                    <Badge className="font-mono bg-primary text-white">{growthRate}%</Badge>
                </div>
                <div className="flex items-center gap-4 bg-muted/20 p-1 rounded-xl border-2">
                    {[2, 4, 5, 6, 8, 10].map(rate => (
                        <button key={rate} onClick={() => setGrowthRate(rate)} className={cn("flex-1 py-2 rounded-lg text-[10px] font-black uppercase transition-all", growthRate === rate ? "bg-background text-primary shadow-sm border" : "text-muted-foreground hover:text-primary")}>
                            {rate}%
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-6 sm:gap-0">
                    {/* LEFT SIDE: EARNED TODAY */}
                    <div className="space-y-1 w-full sm:w-auto">
                        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-70">Earned Today</p>
                        <p className={cn("text-5xl sm:text-7xl font-black font-mono tracking-tighter leading-none transition-colors", earnedColor)}>
                            ₹{Math.round(revToday).toLocaleString()}
                        </p>
                    </div>
                    
                    {/* RIGHT SIDE: MISSION TARGET */}
                    <div className="flex flex-wrap items-end gap-6 sm:gap-10 w-full sm:w-auto">
                        <div className="text-right space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-widest text-primary/70">Remaining</p>
                            <p className="text-3xl font-black font-mono tracking-tight text-primary tabular-nums">
                                ₹{Math.round(remainingTarget).toLocaleString()}
                            </p>
                        </div>
                        <div className="text-right space-y-1 border-l-2 border-dashed border-muted pl-6">
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground opacity-70">Progress</p>
                            <p className="text-3xl font-black font-mono tracking-tight text-foreground tabular-nums">
                                {performancePct.toFixed(1)}%
                            </p>
                        </div>
                        <div className="text-right space-y-1 border-l-2 border-dashed border-muted pl-6">
                            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground opacity-70">Daily Mission Target</p>
                            <p className="text-3xl sm:text-5xl font-black font-mono tracking-tight text-foreground tabular-nums">
                                ₹{Math.round(activeGoalTotal).toLocaleString()}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="h-12 w-full bg-muted/30 rounded-full border-4 p-1.5 overflow-hidden relative shadow-inner">
                    <div className={cn("h-full rounded-full transition-all duration-1000 shadow-lg", performancePct >= 100 ? "bg-emerald-500" : performancePct >= 50 ? "bg-amber-500" : "bg-primary")} style={{ width: `${performancePct}%` }} />
                    {(() => {
                        let cum = 0;
                        const markers = [
                            { e: includeFixed, v: ladderGoals.g1, l: 'O' },
                            { e: includeLoan, v: ladderGoals.g2, l: 'L' },
                            { e: includeRent, v: ladderGoals.g3, l: 'R' },
                            { e: includeBacklog, v: ladderGoals.g4, l: 'B' }
                        ].filter(m => m.e);
                        return markers.map((m, i) => {
                            cum += m.v;
                            const pos = (cum / (activeGoalTotal || 1)) * 100;
                            if (pos >= 100) return null;
                            return (
                                <div key={i} className="absolute top-0 bottom-0 w-[2px] bg-white/40 z-10" style={{ left: `${pos}%` }}>
                                    <span className="absolute -top-6 left-1/2 -translate-x-1/2 text-[8px] font-black text-muted-foreground whitespace-nowrap">{m.l}</span>
                                </div>
                            );
                        });
                    })()}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className={cn("p-4 rounded-2xl border-2 transition-all relative", includeFixed ? "bg-card border-primary/20 shadow-md" : "bg-muted/10 opacity-40")}>
                    <div className="flex justify-between items-center mb-3">
                        <Badge variant="outline" className="text-[8px] font-black">STEP 1</Badge>
                        <Switch checked={includeFixed} onCheckedChange={setIncludeFixed} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-muted-foreground">Fixed Overheads</p>
                    <p className="text-xl font-black mt-1">₹{Math.round(ladderGoals.g1).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                </div>
                <div className={cn("p-4 rounded-2xl border-2 transition-all relative", includeLoan ? "bg-card border-primary/20 shadow-md" : "bg-muted/10 opacity-40")}>
                    <div className="flex justify-between items-center mb-3">
                        <Badge variant="outline" className="text-[8px] font-black text-primary border-primary/40">STEP 2</Badge>
                        <Switch checked={includeLoan} onCheckedChange={setIncludeLoan} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-primary">EMI Debt Share</p>
                    <p className="text-xl font-black mt-1 text-primary">₹{Math.round(ladderGoals.g2).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                </div>
                <div className={cn("p-4 rounded-2xl border-2 transition-all relative", includeRent ? "bg-card border-primary/20 shadow-md" : "bg-muted/10 opacity-40")}>
                    <div className="flex justify-between items-center mb-3">
                        <Badge variant="outline" className="text-[8px] font-black text-emerald-600 border-emerald-400">STEP 3</Badge>
                        <Switch checked={includeRent} onCheckedChange={setIncludeRent} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-emerald-600">Current Lease</p>
                    <p className="text-xl font-black mt-1 text-emerald-600">₹{Math.round(ladderGoals.g3).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                </div>
                <div className={cn("p-4 rounded-2xl border-2 transition-all relative", includeBacklog ? "bg-card border-primary/20 shadow-md" : "bg-muted/10 opacity-40")}>
                    <div className="flex justify-between items-center mb-3">
                        <Badge variant="outline" className="text-[8px] font-black text-amber-600 border-amber-400">STEP 4</Badge>
                        <Switch checked={includeBacklog} onCheckedChange={setIncludeBacklog} />
                    </div>
                    <p className="text-[9px] font-black uppercase text-amber-600">Backlog Wipe</p>
                    <p className="text-xl font-black mt-1 text-amber-600">₹{Math.round(ladderGoals.g4).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                </div>
            </div>
        </CardContent>
      </Card>

      {/* 4. REAL PAYOFF CLOCK */}
      <Card className="border-2 shadow-lg overflow-hidden mx-4 sm:mx-0">
        <CardHeader className="bg-muted/10 border-b">
            <div className="flex items-center gap-3">
                <Timer className="text-primary h-6 w-6" />
                <div>
                    <CardTitle className="text-xl font-headline tracking-tight uppercase">Actual Payoff Clock</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Reality Engine: Estimates freedom based on REAL SURPLUS + Growth.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b">
                <div className="p-6 space-y-2">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Activity className="h-3 w-3 text-primary" /> Monthly Velocity
                    </p>
                    <p className="text-2xl font-black font-mono">{formatCurrency(velocity)}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Repayment capacity based on 30-day rolling surplus.</p>
                </div>
                <div className="p-6 space-y-2 bg-primary/[0.02]">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <Target className="h-3 w-3" /> Days to Freedom
                    </p>
                    <p className="text-2xl font-black font-mono text-primary">
                        {simResults?.payoffDate ? `${differenceInDays(simResults.payoffDate, new Date()).toLocaleString()} DAYS` : "NOT SUSTAINABLE"}
                    </p>
                    <p className="text-[8px] font-bold text-primary/60 uppercase">Calculated using behavioral throughput.</p>
                </div>
                <div className="p-6 space-y-2 bg-emerald-500/[0.02]">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3" /> Freedom Month
                    </p>
                    <p className="text-2xl font-black font-mono text-emerald-600 uppercase">
                        {simResults?.payoffDate ? format(simResults.payoffDate, 'MMM yyyy') : "N/A"}
                    </p>
                    <p className="text-[8px] font-bold text-emerald-600/60 uppercase">Estimated zero-debt crossing month.</p>
                </div>
            </div>
            <div className="p-6 bg-muted/5">
                <div className="flex items-start gap-4">
                    <div className="bg-primary/10 p-2 rounded-lg"><Info className="text-primary h-5 w-5" /></div>
                    <div className="space-y-1">
                        <h4 className="text-xs font-black uppercase tracking-tight">How the Velocity Engine works</h4>
                        <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                            The system scans your last 30 business days. It calculates <strong>Revenue - (Bills + Expenses)</strong> for each day to find your <strong>Daily Surplus</strong>. 
                            This surplus is converted to a monthly repayment capacity. The Payoff Clock then simulates months of interest compounding against this capacity + your expected growth 
                            to find the exact date you kill the loan.
                        </p>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      <LiabilityPaymentModal isOpen={isPayModalOpen} onOpenChange={setIsPayModalOpen} onSuccess={loadData} />
      <LiabilityConfigModal isOpen={isConfigModalOpen} onOpenChange={setIsConfigModalOpen} state={state} onSuccess={loadData} />
    </div>
  );
}
