
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill, Expense, FixedBill, InventoryPurchase, Settings } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Utensils, Gamepad2, Package, AlertCircle, CheckCircle2, Info, ReceiptIndianRupee, BarChart3, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Separator } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { isBusinessToday, getBusinessDate } from '@/lib/utils';
import { format, startOfMonth, endOfMonth, differenceInDays, addDays, subDays, isSameMonth } from 'date-fns';
import { cn } from '@/lib/utils';
import { calculateDailyFixedCost } from '@/firebase/firestore/financials';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Button } from '@/components/ui/button';

export default function FinancialDashboardPage() {
  const { db } = useFirebase();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // 1. Fetch Data
  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const fixedBillsQuery = useMemo(() => !db ? null : collection(db, 'fixedBills'), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const inventoryQuery = useMemo(() => !db ? null : collection(db, 'inventory'), [db]);
  const { data: inventory } = useCollection<InventoryPurchase>(inventoryQuery);

  // 2. Process Statistics
  const stats = useMemo(() => {
    if (!bills || !expenses || !fixedBills || !inventory) return null;

    const targetDateStr = getBusinessDate(selectedDate);
    const start = startOfMonth(selectedDate);
    const end = endOfMonth(selectedDate);
    const daysInMonth = differenceInDays(end, start) + 1;

    // --- REVENUE ---
    const dayBills = bills.filter(b => b.timestamp && getBusinessDate(new Date(b.timestamp)) === targetDateStr);
    const monthBills = bills.filter(b => {
        const d = new Date(b.timestamp);
        return d >= start && d <= end;
    });

    const revToday = dayBills.reduce((s, b) => s + b.totalAmount, 0);
    
    const revFoodToday = dayBills.reduce((s, b) => {
        if (b.foodSubtotal !== undefined) {
            return s + Math.max(0, b.foodSubtotal - (b.discount || 0));
        }
        const itemizedFood = b.items
            .filter(i => {
                const n = i.name.toLowerCase();
                return !n.startsWith('time:') && 
                       !n.startsWith('recharge:') && 
                       !n.startsWith('buy recharge:') && 
                       !n.includes('(');
            })
            .reduce((sum, item) => sum + (item.price * item.quantity), 0);
        
        return s + Math.max(0, itemizedFood - (b.discount || 0));
    }, 0);

    const revGamingToday = revToday - revFoodToday;
    const revMonth = monthBills.reduce((s, b) => s + b.totalAmount, 0);

    // --- EXPENSES ---
    const dayExpenses = expenses.filter(e => e.timestamp && getBusinessDate(new Date(e.timestamp)) === targetDateStr);
    const monthExpenses = expenses.filter(e => {
        const d = new Date(e.timestamp);
        return d >= start && d <= end;
    });

    const expToday = dayExpenses.reduce((s, e) => s + e.amount, 0);
    const expMonth = monthExpenses.reduce((s, e) => s + e.amount, 0);

    // --- FIXED COSTS ---
    const dailyFixed = calculateDailyFixedCost(fixedBills);
    
    // Respect Business Day Rollover for counting elapsed days in month
    const isNow = isSameMonth(selectedDate, new Date());
    let daysToCount = daysInMonth;
    if (isNow) {
        const bDateStr = getBusinessDate();
        daysToCount = parseInt(bDateStr.split('-')[2], 10);
    }
    const monthFixed = dailyFixed * daysToCount;

    // --- INVENTORY ESTIMATE ---
    const monthStock = inventory.filter(i => {
        const d = new Date(i.purchaseDate);
        return d >= start && d <= end;
    }).reduce((s, i) => s + i.totalCost, 0);
    
    const dailyStockEstimate = monthStock / daysInMonth;

    // --- TOTALS ---
    const totalExpToday = dailyFixed + expToday + dailyStockEstimate;
    const profitToday = revToday - totalExpToday;

    const totalExpMonth = monthFixed + expMonth + monthStock;
    const profitMonth = revMonth - totalExpMonth;

    const breakEven = dailyFixed + dailyStockEstimate;

    return {
        revToday, revGamingToday, revFoodToday, revMonth,
        expToday, expMonth,
        dailyFixed, monthFixed,
        dailyStockEstimate, monthStock,
        totalExpToday, profitToday,
        totalExpMonth, profitMonth,
        breakEven,
        targetDateStr
    };
  }, [bills, expenses, fixedBills, inventory, selectedDate]);

  if (!stats) return <div className="p-12 text-center font-headline text-xs animate-pulse opacity-50">Syncing Financial Core...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground uppercase">Profit Monitor</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">Real-time health audit for business cycle {stats.targetDateStr}</p>
        </div>
        <div className="flex items-center gap-3">
            <div className="flex items-center bg-muted/30 rounded-xl p-1 border-2 border-dashed">
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedDate(prev => subDays(prev, 1))}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button variant="ghost" className="h-10 px-4 font-black uppercase text-[10px] tracking-widest">
                            <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                            {isBusinessToday(selectedDate) ? "Today's Cycle" : format(selectedDate, 'PPP').toUpperCase()}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            initialFocus
                        />
                    </PopoverContent>
                </Popover>
                <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => setSelectedDate(prev => addDays(prev, 1))}>
                    <ChevronRight className="h-5 w-5" />
                </Button>
            </div>
            <div className="hidden lg:flex bg-muted/30 border-2 border-dashed p-3 rounded-xl items-center gap-4">
                <div className="p-1.5 bg-primary/10 rounded-lg">
                    <AlertCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                    <p className="text-[8px] font-black uppercase text-muted-foreground leading-none">Survival Goal</p>
                    <p className="text-sm font-black font-mono">₹{Math.round(stats.breakEven).toLocaleString()}<span className="text-[8px] ml-1 opacity-50">/DAY</span></p>
                </div>
            </div>
        </div>
      </div>

      <Card className={cn(
        "border-4 shadow-2xl relative overflow-hidden transition-all duration-500",
        stats.profitToday > 500 ? "border-emerald-500/40 bg-emerald-500/[0.03]" : 
        stats.profitToday < -100 ? "border-destructive/40 bg-destructive/[0.03]" : "border-amber-500/40 bg-amber-500/[0.03]"
      )}>
        <CardHeader className="text-center pb-2">
            <CardTitle className="text-xs font-black uppercase tracking-[0.3em] opacity-60">Net Position: {isBusinessToday(selectedDate) ? "Today" : format(selectedDate, 'MMM dd')}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
            <div className={cn(
                "text-6xl sm:text-8xl font-black font-mono tracking-tighter tabular-nums",
                stats.profitToday > 0 ? "text-emerald-600" : stats.profitToday < 0 ? "text-destructive" : "text-amber-600"
            )}>
                {stats.profitToday < 0 && '-' }₹{Math.abs(Math.round(stats.profitToday)).toLocaleString()}
            </div>
            <div className="flex items-center gap-2 mt-4">
                {stats.profitToday > 0 ? <CheckCircle2 className="text-emerald-600 h-5 w-5" /> : <TrendingDown className="text-destructive h-5 w-5" />}
                <span className="font-black uppercase text-xs tracking-widest">
                    {stats.profitToday > 0 ? "Target Achieved" : "Operational Deficit"}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full mt-12 pt-8 border-t border-dashed">
                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <TrendingUp className="h-3 w-3 text-emerald-600" />
                        Inflow Breakdown
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm font-bold uppercase">
                            <span>Gaming Sessions</span>
                            <span className="font-mono">₹{Math.round(stats.revGamingToday).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold uppercase">
                            <span>Bistro Orders</span>
                            <span className="font-mono">₹{Math.round(stats.revFoodToday).toLocaleString()}</span>
                        </div>
                        <Separator className="bg-emerald-500/20" />
                        <div className="flex justify-between items-center text-lg font-black uppercase text-emerald-600">
                            <span>Total Revenue</span>
                            <span className="font-mono">₹{Math.round(stats.revToday).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                        <TrendingDown className="h-3 w-3 text-destructive" />
                        Outflow Breakdown
                    </h3>
                    <div className="space-y-2">
                        <div className="flex justify-between items-center text-sm font-bold uppercase">
                            <span>Fixed Overheads Share</span>
                            <span className="font-mono">₹{Math.round(stats.dailyFixed).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold uppercase">
                            <span>Stock Purchase Est.</span>
                            <span className="font-mono">₹{Math.round(stats.dailyStockEstimate).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm font-bold uppercase">
                            <span>Operational Expense</span>
                            <span className="font-mono">₹{Math.round(stats.expToday).toLocaleString()}</span>
                        </div>
                        <Separator className="bg-destructive/20" />
                        <div className="flex justify-between items-center text-lg font-black uppercase text-destructive">
                            <span>Total Burden</span>
                            <span className="font-mono">₹{Math.round(stats.totalExpToday).toLocaleString()}</span>
                        </div>
                    </div>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <Package className="h-4 w-4" /> Monthly Stock Purchase
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">₹{Math.round(stats.monthStock).toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Inventory bought in {format(selectedDate, 'MMMM')}</p>
                <div className="mt-4 pt-4 border-t border-dashed">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>Daily Weighted Avg</span>
                        <span className="text-primary">₹{Math.round(stats.dailyStockEstimate)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <ReceiptIndianRupee className="h-4 w-4" /> Cumulative Overheads
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">₹{Math.round(stats.monthFixed).toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Fixed bill share for period</p>
                <div className="mt-4 pt-4 border-t border-dashed">
                    <div className="flex justify-between text-[10px] font-black uppercase">
                        <span>Daily Fixed Burden</span>
                        <span className="text-primary">₹{Math.round(stats.dailyFixed)}</span>
                    </div>
                </div>
            </CardContent>
        </Card>

        <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-muted-foreground">
                    <BarChart3 className="h-4 w-4" /> {format(selectedDate, 'MMMM')} Outlook
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className={cn("text-3xl font-black", stats.profitMonth >= 0 ? "text-emerald-600" : "text-destructive")}>
                    {stats.profitMonth < 0 && '-' }₹{Math.abs(Math.round(stats.profitMonth)).toLocaleString()}
                </div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Net profit for target month</p>
                <div className="mt-4 pt-4 border-t border-dashed space-y-1">
                    <div className="flex justify-between text-[9px] font-bold uppercase opacity-60">
                        <span>Revenue</span>
                        <span>₹{Math.round(stats.revMonth).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[9px] font-bold uppercase opacity-60">
                        <span>Expenses</span>
                        <span>₹{Math.round(stats.totalExpMonth).toLocaleString()}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
      </div>

      <div className="p-6 rounded-2xl bg-blue-500/5 border-2 border-blue-500/20 flex flex-col sm:flex-row items-center gap-6">
        <div className="bg-blue-500 p-4 rounded-2xl shadow-lg shrink-0">
            <Info className="text-white h-8 w-8" />
        </div>
        <div className="text-center sm:text-left">
            <h4 className="font-black uppercase tracking-tight text-lg">Financial Modeling Notice</h4>
            <p className="text-sm text-muted-foreground max-w-2xl font-medium mt-1">
                You are currently viewing the audit for <strong>{format(selectedDate, 'PPPP')}</strong>. The survival goal of ₹{Math.round(stats.breakEven)} per day is based on the average inventory replenishment and fixed recurring costs for this period.
            </p>
        </div>
      </div>
    </div>
  );
}
