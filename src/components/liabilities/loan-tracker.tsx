
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { LiabilityState, Bill, FixedBill, Expense } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, Zap, Target, TrendingUp, Settings2, Timer, Info, Activity, Calendar as CalendarIcon, Landmark, ArrowRight, CheckCircle2 } from 'lucide-react';
import { format, addMonths, differenceInCalendarMonths, differenceInDays, subDays } from 'date-fns';
import { cn, isBusinessToday, getBusinessDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Label } from '@/components/ui/label';
import { LiabilityPaymentModal } from './payment-modal';
import { LiabilityConfigModal } from './config-modal';
import { getLiabilityState, processLiabilityCycles } from '@/firebase/firestore/liabilities';
import { useAuth } from '@/firebase/auth/use-user';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';

export function LoanTracker() {
  const { db } = useFirebase();
  const { user } = useAuth();
  
  const [state, setState] = useState<LiabilityState | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);
  
  const [missionYear, setMissionYear] = useState<number>(2030);
  const [growthRate, setGrowthRate] = useState<number>(5); 

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
    const otherBills = (fixedBills || []).filter(fb => !(fb.name || '').toLowerCase().includes('rent'));
    return calculateDailyFixedCost(otherBills);
  }, [fixedBills]);

  const revToday = useMemo(() => {
    if (!bills) return 0;
    return bills
        .filter(b => b.timestamp && isBusinessToday(b.timestamp))
        .reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  }, [bills]);

  const { goal, simResults, velocity } = useMemo(() => {
    if (!state) return { goal: 0, simResults: null, velocity: 0 };
    
    const now = new Date();
    const targetDate = new Date(`${missionYear}-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, now));
    const monthlyInterestRate = (state.annualInterestRate || 9) / 100 / 12; 
    const monthlyGrowth = growthRate / 100;

    const P = state.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    const requiredMonthlyLoan = P > 0 ? (P * r) / (1 - Math.pow(1 + r, -n)) : 0;
    const g2 = requiredMonthlyLoan / 30;

    // Behavioral Prediction
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
    const behavioralMonthlyPayment = Math.max(0, predictedMonthlyPayment);

    let simLoan = state.loanBalance;
    let simMonths = 0;
    let payoffDate: Date | null = null;

    if (simLoan > 0 && behavioralMonthlyPayment > 0) {
        while (simLoan > 0 && simMonths < 600) {
            simMonths++;
            simLoan += (simLoan * monthlyInterestRate);
            let available = behavioralMonthlyPayment * Math.pow(1 + (monthlyGrowth / 12), simMonths);
            simLoan -= Math.min(simLoan, available);
            if (simLoan <= 0) {
                payoffDate = addMonths(now, simMonths);
                break;
            }
        }
    }

    return { goal: g2, simResults: { payoffDate, monthsToPayoff: simMonths }, velocity: behavioralMonthlyPayment };
  }, [state, missionYear, dailyOverheads, growthRate, bills, expenses]);

  if (isProcessing || !state) {
    return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Syncing Loan Protocols...</div>;
  }

  const performancePct = Math.min(100, (revToday / (goal || 1)) * 100);
  const loanProgress = state.loanPrincipalStart > 0 ? Math.max(0, Math.min(100, (state.totalLoanPaid / state.loanPrincipalStart) * 100)) : 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Strategic Debt Recovery</h2>
            <div className="flex items-center gap-3">
                <Landmark className="h-8 w-8 text-primary" />
                <h1 className="text-4xl font-headline tracking-tighter">{formatCurrency(state.loanBalance)}</h1>
                <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase text-[10px]">Active Principal</Badge>
            </div>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={() => setIsConfigModalOpen(true)} className="h-14 w-14 border-2">
                <Settings2 className="h-6 w-6" />
            </Button>
            <Button onClick={() => setIsPayModalOpen(true)} className="h-14 px-10 font-black uppercase tracking-widest shadow-xl bg-primary text-white">
                <Zap className="mr-2 h-5 w-5 fill-current" />
                Record Repayment
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 border-2 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b p-6">
                <div className="flex justify-between items-start">
                    <div className="space-y-1">
                        <CardTitle className="text-xl font-headline text-primary tracking-tight uppercase">Payoff Progress</CardTitle>
                        <CardDescription className="text-[10px] font-black uppercase tracking-widest opacity-60">Interest Rate: {state.annualInterestRate}% APR • Compounded Monthly</CardDescription>
                    </div>
                    <Badge className="bg-emerald-600 text-white font-black text-[10px] uppercase">Repaying</Badge>
                </div>
            </CardHeader>
            <CardContent className="p-6 space-y-10">
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Original Principal</p>
                        <p className="text-2xl font-black font-mono">{formatCurrency(state.loanPrincipalStart)}</p>
                    </div>
                    <div className="text-right space-y-1">
                        <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest">Total Repaid</p>
                        <p className="text-2xl font-black font-mono text-emerald-600">{formatCurrency(state.totalLoanPaid)}</p>
                    </div>
                </div>
                <div className="space-y-3">
                    <div className="flex justify-between text-[10px] font-black uppercase tracking-widest">
                        <span>Repayment Milestone</span>
                        <span>{loanProgress.toFixed(1)}% Completed</span>
                    </div>
                    <div className="h-4 w-full bg-muted rounded-full overflow-hidden border p-0.5">
                        <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000" style={{ width: `${loanProgress}%` }} />
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-2 border-primary/20 bg-primary/5 shadow-xl relative overflow-hidden">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <Target className="h-4 w-4" /> Daily Recovery Goal
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-1">
                    <p className="text-4xl font-black font-mono tracking-tighter">₹{Math.round(goal).toLocaleString()}</p>
                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Required daily intake to hit {missionYear} deadline.</p>
                </div>
                <div className="space-y-2">
                    <div className="flex justify-between text-[9px] font-black uppercase">
                        <span className="opacity-60">Today's Performance</span>
                        <span className="text-primary">{performancePct.toFixed(1)}%</span>
                    </div>
                    <Progress value={performancePct} className="h-1.5" />
                </div>
                <div className="pt-4 border-t border-dashed border-primary/20">
                    <div className="flex bg-muted/30 p-1 rounded-lg border">
                        {[2027, 2028, 2029, 2030].map(y => (
                            <button key={y} onClick={() => setMissionYear(y)} className={cn("flex-1 py-1.5 rounded text-[9px] font-black uppercase transition-all", missionYear === y ? "bg-primary text-white shadow-sm" : "text-muted-foreground hover:text-primary")}>
                                {y}
                            </button>
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-lg overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
            <div className="flex items-center gap-3">
                <Timer className="text-primary h-6 w-6" />
                <div>
                    <CardTitle className="text-xl font-headline tracking-tight uppercase">Reality Payoff Clock</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Estimates freedom based on REAL SURPLUS + {growthRate}% Growth.</CardDescription>
                </div>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x border-b">
                <div className="p-6 space-y-2">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                        <Activity className="h-3 w-3 text-primary" /> Surplus Velocity
                    </p>
                    <p className="text-2xl font-black font-mono">{formatCurrency(velocity)}</p>
                    <p className="text-[8px] font-bold text-muted-foreground uppercase">Estimated monthly surplus available for repayment.</p>
                </div>
                <div className="p-6 space-y-2 bg-primary/[0.02]">
                    <p className="text-[9px] font-black uppercase text-primary tracking-widest flex items-center gap-2">
                        <CalendarIcon className="h-3 w-3" /> Zero-Debt Month
                    </p>
                    <p className="text-2xl font-black font-mono text-primary uppercase">
                        {simResults?.payoffDate ? format(simResults.payoffDate, 'MMMM yyyy') : "NOT SUSTAINABLE"}
                    </p>
                    <p className="text-[8px] font-bold text-primary/60 uppercase">Calculated using longitudinal behavioral data.</p>
                </div>
                <div className="p-6 space-y-2 bg-emerald-500/[0.02]">
                    <p className="text-[9px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-2">
                        <Timer className="h-3 w-3" /> Time Remaining
                    </p>
                    <p className="text-2xl font-black font-mono text-emerald-600 uppercase">
                        {simResults?.payoffDate ? `${differenceInDays(simResults.payoffDate, new Date()).toLocaleString()} DAYS` : "N/A"}
                    </p>
                    <p className="text-[8px] font-bold text-emerald-600/60 uppercase">The exact countdown to financial freedom.</p>
                </div>
            </div>
            <div className="p-6 bg-muted/5 flex items-start gap-4">
                <div className="bg-primary/10 p-2 rounded-lg"><Info className="text-primary h-5 w-5" /></div>
                <div className="space-y-1">
                    <h4 className="text-xs font-black uppercase tracking-tight">Understanding the Clock</h4>
                    <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                        This is not a theoretical number. The system scans your actual revenue and fixed overheads over the last 30 days to determine how much surplus cash you generate. 
                        It then simulates interest compounding monthly against that surplus to find the moment your balance hits zero.
                    </p>
                </div>
            </div>
        </CardContent>
      </Card>

      <LiabilityPaymentModal isOpen={isPayModalOpen} onOpenChange={setIsPayModalOpen} onSuccess={loadData} />
      <LiabilityConfigModal isOpen={isConfigModalOpen} onOpenChange={setIsConfigModalOpen} state={state} onSuccess={loadData} />
    </div>
  );
}
