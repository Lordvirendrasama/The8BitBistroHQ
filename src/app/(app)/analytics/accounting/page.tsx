'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill, Expense, Period, DateRange } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ReceiptIndianRupee, TrendingUp, IndianRupee, ShoppingCart, Download, Filter, CalendarIcon, ArrowRight, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, startOfMonth, endOfDay } from "date-fns";
import { cn } from '@/lib/utils';
import { exportAccountingLedger, getAvailableCycles, type CycleMetadata } from '@/firebase/firestore/data-management';
import { Progress } from '@/components/ui/progress';
import { useEffect } from 'react';

export default function AccountingPage() {
  const { db } = useFirebase();
  const [exportCycle, setExportCycle] = useState('all_cycles');
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    getAvailableCycles().then(setAvailableCycles);
  }, []);

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills, loading: billsLoading } = useCollection<Bill>(billsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses, loading: expensesLoading } = useCollection<Expense>(expensesQuery);

  const filteredData = useMemo(() => {
    if (!bills || !expenses) return { revenue: 0, spend: 0, items: [] };

    const filterByCycle = (item: any) => exportCycle === 'all_cycles' || item.cycle === exportCycle;

    const matchedBills = bills.filter(filterByCycle);
    const matchedExpenses = expenses.filter(filterByCycle);

    const revenue = matchedBills.reduce((sum, b) => sum + b.totalAmount, 0);
    const spend = matchedExpenses.reduce((sum, e) => sum + e.amount, 0);

    const combined = [
        ...matchedBills.map(b => ({
            date: b.timestamp,
            type: 'income',
            desc: `${b.stationName} Checkout`,
            amount: b.totalAmount,
            method: b.paymentMethod
        })),
        ...matchedExpenses.map(e => ({
            date: e.timestamp,
            type: 'expense',
            desc: e.description,
            amount: e.amount,
            method: 'CASH'
        }))
    ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return { revenue, spend, items: combined };
  }, [bills, expenses, exportCycle]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
        const csv = await exportAccountingLedger({ cycle: exportCycle === 'all_cycles' ? undefined : exportCycle });
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `accounting-ledger-${exportCycle}.csv`;
        link.click();
    } finally {
        setIsExporting(false);
    }
  };

  const netProfit = filteredData.revenue - filteredData.spend;
  const margin = filteredData.revenue > 0 ? (netProfit / filteredData.revenue) * 100 : 0;

  if (billsLoading || expensesLoading) {
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Loading Financial Audit...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Financial Audit</h1>
          <p className="mt-2 text-muted-foreground font-bold uppercase text-xs tracking-widest">Reconcile revenue and operating costs by operational cycle.</p>
        </div>
        <div className="flex gap-2">
            <Select value={exportCycle} onValueChange={setExportCycle}>
                <SelectTrigger className="w-[200px] h-12 font-black uppercase text-[10px] border-2">
                    <SelectValue placeholder="Select Phase" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all_cycles">ALL PHASES</SelectItem>
                    {availableCycles.map(c => <SelectItem key={c.name} value={c.name}>{c.name}</SelectItem>)}
                </SelectContent>
            </Select>
            <Button onClick={handleExport} disabled={isExporting} className="h-12 px-6 font-black uppercase tracking-tight shadow-lg">
                <Download className="mr-2 h-5 w-5" /> Export Ledger
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 shadow-xl bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-600 flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Total Revenue
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-emerald-600">₹{filteredData.revenue.toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Total earnings from checkouts</p>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-destructive/5 border-destructive/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-destructive flex items-center gap-2">
                    <ShoppingCart className="h-4 w-4" /> Total Expenses
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-destructive">₹{filteredData.spend.toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Operational and food costs</p>
            </CardContent>
        </Card>

        <Card className={cn("border-4 shadow-2xl relative overflow-hidden", netProfit >= 0 ? "bg-primary/5 border-primary/20" : "bg-destructive/10 border-destructive/40")}>
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Net Position
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-foreground">₹{netProfit.toLocaleString()}</div>
                <div className="mt-3 space-y-1.5">
                    <div className="flex justify-between text-[9px] font-black uppercase tracking-widest">
                        <span>Net Margin</span>
                        <span>{margin.toFixed(1)}%</span>
                    </div>
                    <Progress value={Math.max(0, Math.min(100, margin))} className="h-2" indicatorClassName={netProfit >= 0 ? "bg-emerald-500" : "bg-destructive"} />
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/30 border-b">
            <div className="flex justify-between items-center">
                <div>
                    <CardTitle className="font-headline text-lg tracking-tight">Consolidated Ledger</CardTitle>
                    <CardDescription className="text-xs font-bold uppercase tracking-widest">Chronological audit of all cash movements.</CardDescription>
                </div>
                <Badge variant="outline" className="font-mono text-[10px]">{filteredData.items.length} Entries</Badge>
            </div>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow className="bg-muted/10">
                        <TableHead className="font-black uppercase text-[10px]">Timestamp</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Description</TableHead>
                        <TableHead className="font-black uppercase text-[10px]">Method</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px]">Amount</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {filteredData.items.map((item, idx) => (
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
                            <TableCell className="text-right">
                                <span className={cn("font-mono font-black text-sm", item.type === 'income' ? "text-emerald-600" : "text-destructive")}>
                                    {item.type === 'income' ? '+' : '-'} ₹{item.amount.toLocaleString()}
                                </span>
                            </TableCell>
                        </TableRow>
                    ))}
                    {filteredData.items.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={4} className="h-64 text-center opacity-30 italic font-headline text-[10px] tracking-widest">No entries found for this period.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
