'use client';

import { useMemo, useState, useEffect } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, onSnapshot } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill, Expense, DateRange, FixedBill, LiabilityState, Settings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ReceiptIndianRupee, TrendingUp, IndianRupee, ShoppingCart, Download, Calendar as CalendarIcon, Wallet, FilterX, BarChart3, Target, AlertCircle, CheckCircle2, Info, ArrowUpRight, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Separator } from '@/components/ui/separator';
import { format, startOfDay, endOfDay, startOfMonth, endOfMonth, eachMonthOfInterval, subMonths, isSameMonth, differenceInDays, differenceInCalendarMonths, getDaysInMonth } from "date-fns";
import { cn } from '@/lib/utils';
import { exportAccountingLedger, getAvailableCycles, type CycleMetadata } from '@/firebase/firestore/data-management';
import { Progress } from '@/components/ui/progress';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';

export default function AccountingPage() {
  const { db } = useFirebase();
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [liabilityState, setLiabilityState] = useState<LiabilityState | null>(null);
  const [appSettings, setAppSettings] = useState<Settings | null>(null);
  
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfMonth(new Date()),
    to: endOfMonth(new Date()),
  });

  useEffect(() => {
    getAvailableCycles().then(setAvailableCycles);
    
    if (!db) return;
    const unsubLiab = onSnapshot(doc(db, 'liabilities', 'main_liability_state'), (snap) => {
      if (snap.exists()) setLiabilityState(snap.data() as LiabilityState);
    });
    const unsubSett = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) setAppSettings(snap.data() as Settings);
    });
    return () => { unsubLiab(); unsubSett(); };
  }, [db]);

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills, loading: billsLoading } = useCollection<Bill>(billsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses, loading: expensesLoading } = useCollection<Expense>(expensesQuery);

  const fixedBillsQuery = useMemo(() => !db ? null : collection(db, 'fixedBills'), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const recentMonths = useMemo(() => {
    const end = new Date();
    const start = subMonths(end, 5);
    return eachMonthOfInterval({ start, end }).reverse();
  }, []);

  const stats = useMemo(() => {
    if (!bills || !expenses || !liabilityState || !fixedBills || !appSettings) return null;

    const filterByDate = (itemDate: string) => {
        if (!dateRange.from) return true;
        const d = new Date(itemDate);
        if (dateRange.to) {
            return d >= startOfDay(dateRange.from) && d <= endOfDay(dateRange.to);
        }
        return d >= startOfDay(dateRange.from);
    };

    const matchedBills = bills.filter(b => b.timestamp && filterByDate(b.timestamp));
    const matchedExpenses = expenses.filter(e => e.timestamp && filterByDate(e.timestamp));

    const revenue = matchedBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const opSpend = matchedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const daysInPeriod = dateRange.from && dateRange.to 
        ? differenceInDays(endOfDay(dateRange.to), startOfDay(dateRange.from)) + 1
        : 30;

    const dailyOverheads = calculateDailyFixedCost(fixedBills.filter(fb => !(fb.name || '').toLowerCase().includes('rent')));
    
    const now = new Date();
    const targetDate = new Date(`2030-01-01`);
    const monthsUntilTarget = Math.max(1, differenceInCalendarMonths(targetDate, now));
    const monthlyInterestRate = (liabilityState.annualInterestRate || 9) / 100 / 12;
    const P = liabilityState.loanBalance;
    const r = monthlyInterestRate;
    const n = monthsUntilTarget;
    const monthlyLoan = P > 0 ? ((P * r) / (1 - Math.pow(1 + r, -n))) : 0;
    const monthlyRent = liabilityState.monthlyRent || 0;
    const monthlyBacklog = (liabilityState.rentBalance || 0) / monthsUntilTarget;

    const dailySurvival = 
      (appSettings.includeFixed ? dailyOverheads : 0) + 
      (appSettings.includeLoan ? monthlyLoan / 30 : 0) + 
      (appSettings.includeRent ? monthlyRent / 30 : 0) + 
      (appSettings.includeBacklog ? monthlyBacklog / 30 : 0);

    const fixedBurdenTotal = dailySurvival * daysInPeriod;
    const totalOutflow = opSpend + fixedBurdenTotal;
    const netProfit = revenue - totalOutflow;
    const remainingTarget = Math.max(0, fixedBurdenTotal - revenue);

    // Run-rate Calculations
    const isCurrentMonth = dateRange.from && isSameMonth(dateRange.from, now);
    const totalDaysInMonth = dateRange.from ? getDaysInMonth(dateRange.from) : 30;
    
    let daysPassed = daysInPeriod;
    if (isCurrentMonth) {
        daysPassed = now.getDate();
    }

    const currentDailyAvg = revenue / Math.max(1, daysPassed);
    const targetToMakeIt = totalOutflow + 1; // +1 Rupee profit
    const remainingToMakeIt = Math.max(0, targetToMakeIt - revenue);
    const daysRemaining = isCurrentMonth ? Math.max(0, totalDaysInMonth - daysPassed) : 0;
    const requiredDaily = daysRemaining > 0 ? remainingToMakeIt / daysRemaining : 0;

    const ledger = [
        ...matchedBills.map(b => ({
            date: b.timestamp,
            type: 'income',
            desc: `${b.stationName} Checkout`,
            amount: b.totalAmount,
            method: b.paymentMethod,
        })),
        ...matchedExpenses.map(e => ({
            date: e.timestamp,
            type: 'expense',
            desc: e.description,
            amount: e.amount,
            method: 'CASH',
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { 
        revenue, 
        opSpend, 
        fixedBurdenTotal, 
        totalOutflow, 
        netProfit, 
        ledger,
        remainingTarget,
        survivalGoal: fixedBurdenTotal,
        currentDailyAvg,
        targetToMakeIt,
        remainingToMakeIt,
        requiredDaily,
        daysRemaining,
        daysPassed
    };
  }, [bills, expenses, liabilityState, fixedBills, appSettings, dateRange]);

  const monthlyBreakdown = useMemo(() => {
    if (!bills || !expenses) return [];
    const breakdownMap: Record<string, { monthKey: string, monthName: string, revenue: number, expense: number }> = {};
    bills.forEach(b => {
        const d = new Date(b.timestamp);
        const key = format(d, 'yyyy-MM');
        if (!breakdownMap[key]) breakdownMap[key] = { monthKey: key, monthName: format(d, 'MMMM yyyy'), revenue: 0, expense: 0 };
        breakdownMap[key].revenue += b.totalAmount;
    });
    expenses.forEach(e => {
        const d = new Date(e.timestamp);
        const key = format(d, 'yyyy-MM');
        if (!breakdownMap[key]) breakdownMap[key] = { monthKey: key, monthName: format(d, 'MMMM yyyy'), revenue: 0, expense: 0 };
        breakdownMap[key].expense += e.amount;
    });
    return Object.values(breakdownMap).sort((a, b) => b.monthKey.localeCompare(a.monthKey));
  }, [bills, expenses]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const csv = await exportAccountingLedger({ 
            startDate: dateRange.from ? dateRange.from.toISOString() : undefined,
            endDate: dateRange.to ? dateRange.to.toISOString() : undefined
        });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `audit-ledger-${format(new Date(), 'yyyy-MM-dd')}.csv`;
        link.click();
    } finally {
        setIsExporting(false);
    }
  };

  const setMonth = (monthDate: Date) => {
    setDateRange({ from: startOfMonth(monthDate), to: endOfMonth(monthDate) });
  };

  if (billsLoading || expensesLoading || !stats) {
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Syncing Financial Core...</div>;
  }

  const progress = Math.min(100, (stats.revenue / (stats.survivalGoal || 1)) * 100);
  const isTargetMet = stats.revenue >= stats.survivalGoal;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Financial Audit</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">Surgical Revenue Reconciliation & Performance Tracking.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handleExport} disabled={isExporting} className="h-12 px-6 font-black uppercase tracking-tight shadow-xl bg-primary hover:bg-primary/90">
                <Download className="mr-2 h-5 w-5" /> Export Audit
            </Button>
        </div>
      </div>

      <Card className="border-2 shadow-none bg-muted/5">
        <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mr-2">Quick Periods:</p>
                {recentMonths.map((m, idx) => (
                    <Button 
                        key={idx} 
                        variant={dateRange.from && isSameMonth(m, dateRange.from) ? 'default' : 'outline'}
                        onClick={() => setMonth(m)}
                        className="h-10 px-4 font-black uppercase text-[10px] tracking-tight border-2"
                    >
                        {format(m, 'MMMM')}
                    </Button>
                ))}
            </div>
            
            <div className="flex items-center gap-2">
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                                "w-[240px] h-10 justify-start text-left font-black uppercase text-[10px] border-2 bg-background",
                                !dateRange.from && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange.from ? (
                                dateRange.to ? (
                                    <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}</>
                                ) : (format(dateRange.from, "LLL dd, y"))
                            ) : (<span>Pick Range</span>)}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            initialFocus
                            mode="range"
                            selected={{ from: dateRange.from, to: dateRange.to }}
                            onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                            numberOfMonths={2}
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="outline" size="icon" onClick={() => setMonth(new Date())} className="h-10 w-10 border-2">
                    <FilterX className="h-4 w-4" />
                </Button>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 shadow-xl bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Total Revenue
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-emerald-600">₹{stats.revenue.toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Earnings for selected window</p>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-destructive/5 border-destructive/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Operational Spend
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-destructive">₹{stats.opSpend.toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Ad-hoc repairs and supplies</p>
            </CardContent>
        </Card>

        <Card className={cn("border-4 shadow-2xl relative overflow-hidden transition-all duration-500", isTargetMet ? "bg-emerald-500/5 border-emerald-500/30" : "bg-primary/5 border-primary/20")}>
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                    <Target className={cn("h-4 w-4", isTargetMet ? "text-emerald-600" : "text-primary")} /> 
                    Survival Status
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black font-mono tracking-tighter">
                    {progress.toFixed(1)}%
                </div>
                <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                        <span>Period Target</span>
                        <span>₹{Math.round(stats.survivalGoal).toLocaleString()}</span>
                    </div>
                    <Progress value={progress} className="h-2" indicatorClassName={isTargetMet ? "bg-emerald-500" : "bg-primary"} />
                </div>
            </CardContent>
            {isTargetMet && (
                <div className="absolute top-2 right-2 animate-bounce">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                </div>
            )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-2 shadow-none overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="font-headline text-lg tracking-tight flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-primary" />
                    Month-on-Month Trends
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Historical performance vs variable expenses.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
                <Table>
                    <TableHeader>
                        <TableRow className="bg-muted/5">
                            <TableHead className="font-black uppercase text-[10px]">Month Period</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Revenue</TableHead>
                            <TableHead className="text-center font-black uppercase text-[10px]">Op. Expenses</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] pr-6">Op. Surplus</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {monthlyBreakdown.map((row) => (
                            <TableRow key={row.monthKey} className="hover:bg-muted/5 transition-colors group cursor-pointer" onClick={() => setMonth(new Date(row.monthKey + "-01"))}>
                                <TableCell className="font-black uppercase text-xs py-4">{row.monthName}</TableCell>
                                <TableCell className="text-center font-mono font-bold text-emerald-600">₹{row.revenue.toLocaleString()}</TableCell>
                                <TableCell className="text-center font-mono font-bold text-destructive">₹{row.expense.toLocaleString()}</TableCell>
                                <TableCell className="text-right pr-6">
                                    <span className={cn("font-mono font-black text-sm", (row.revenue - row.expense) >= 0 ? "text-emerald-600" : "text-destructive")}>
                                        ₹{(row.revenue - row.expense).toLocaleString()}
                                    </span>
                                </TableCell>
                            </TableRow>
                        ))}
                        {monthlyBreakdown.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={4} className="h-32 text-center opacity-30 italic font-headline text-[10px] tracking-widest uppercase">No monthly data captured.</TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>

        <div className="space-y-6">
            <Card className="border-2 bg-muted/10">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Period Analysis</CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Comprehensive burden breakdown.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-3">
                        <div className="flex justify-between items-center text-xs font-bold uppercase">
                            <span className="text-muted-foreground">Operational Flow</span>
                            <span className="text-destructive font-mono">- ₹{stats.opSpend.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-xs font-bold uppercase">
                            <span className="text-muted-foreground">Weighted Fixed Costs</span>
                            <span className="text-destructive font-mono">- ₹{Math.round(stats.fixedBurdenTotal).toLocaleString()}</span>
                        </div>
                        <Separator className="border-dashed" />
                        <div className="flex justify-between items-center font-black uppercase">
                            <span className="text-sm">Total Burden</span>
                            <span className="text-lg font-mono text-destructive">₹{Math.round(stats.totalOutflow).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className={cn("p-4 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center gap-1", stats.netProfit >= 0 ? "bg-emerald-500/10 border-emerald-500/20" : "bg-destructive/10 border-destructive/20")}>
                        <p className="text-[10px] font-black uppercase opacity-60">Net Economic Position</p>
                        <p className={cn("text-3xl font-black font-mono", stats.netProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
                            {stats.netProfit < 0 ? '-' : '+'} ₹{Math.abs(Math.round(stats.netProfit)).toLocaleString()}
                        </p>
                    </div>
                </CardContent>
            </Card>

            <Card className="border-2 border-primary/20 bg-primary/5">
                <CardHeader className="pb-3">
                    <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                        <ArrowUpRight className="h-4 w-4" /> Strategic Blueprint
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <p className="text-[8px] font-black uppercase text-muted-foreground">Actual Velocity</p>
                            <p className="text-sm font-black font-mono">₹{Math.round(stats.currentDailyAvg).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                        </div>
                        <div className="space-y-1 text-right">
                            <p className="text-[8px] font-black uppercase text-primary">Required Velocity</p>
                            <p className="text-sm font-black font-mono text-primary">₹{Math.round(stats.requiredDaily).toLocaleString()}<span className="text-[8px] opacity-50 ml-1">/DAY</span></p>
                        </div>
                    </div>
                    
                    <div className="pt-3 border-t border-dashed border-primary/20">
                        <div className="flex justify-between items-center mb-1">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Month Success Target</span>
                            <span className="font-mono text-xs font-bold">₹{Math.round(stats.targetToMakeIt).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Remaining To Make It</span>
                            <span className="font-mono text-xs font-bold text-primary">₹{Math.round(stats.remainingToMakeIt).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className="bg-background/50 p-3 rounded-lg border flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Timer className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[9px] font-black uppercase text-muted-foreground">Cycle Remaining</span>
                        </div>
                        <span className="text-[10px] font-black uppercase">{stats.daysRemaining} Business Days</span>
                    </div>
                </CardContent>
            </Card>
        </div>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="font-headline text-lg tracking-tight">Consolidated Ledger</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Audit trail of all registered cash movements.</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{stats.ledger.length} Entries</Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/10">
                        <TableHead className="font-black uppercase text-[10px]">Timestamp</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Description</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Method</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] pr-6">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stats.ledger.map((item, idx) => (
                        <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                            <TableCell className="py-4">
                                <div className="flex flex-col">
                                    <span className="font-black text-[10px] uppercase">{format(new Date(item.date), 'MMM d, yyyy')}</span>
                                    <span className="text-[9px] text-muted-foreground font-mono">{format(new Date(item.date), 'p')}</span>
                                </div>
                            </TableCell>
                            <TableCell>
                                <div className="flex items-center gap-3">
                                    <div className={cn("p-2 rounded-lg", item.type === 'income' ? "bg-emerald-500/10 text-emerald-600" : "bg-destructive/10 text-destructive")}>
                                        {item.type === 'income' ? <Wallet className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />}
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="font-bold text-xs uppercase leading-tight">{item.desc}</span>
                                        <Badge variant="outline" className={cn("w-fit h-4 text-[8px] uppercase mt-1", item.type === 'income' ? "text-emerald-600 border-emerald-600/20" : "text-destructive border-destructive/20")}>
                                            {item.type}
                                        </Badge>
                                    </div>
                                </div>
                            </TableCell>
                            <TableCell>
                                <Badge variant="secondary" className="font-black uppercase text-[9px] tracking-widest">{item.method}</Badge>
                            </TableCell>
                            <TableCell className="text-right pr-6">
                                <span className={cn("font-mono font-black text-sm", item.type === 'income' ? "text-emerald-600" : "text-destructive")}>
                                    {item.type === 'income' ? '+' : '-'} ₹{item.amount.toLocaleString()}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                    {stats.ledger.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-64 text-center opacity-30 italic font-headline text-[10px] tracking-widest uppercase">No entries detected for this timeframe.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
