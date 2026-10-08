'use client';

import { useState, useMemo } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, doc, deleteDoc } from 'firebase/firestore';
import type { PaidBill, Expense, Employee, SalaryPayment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import {
  undoSalaryPayment,
  updateSalaryPayment,
  recordManualSalaryPayment,
  undoBillPayment,
  updatePaidBillRecord,
  updateExpenseRecord
} from '@/firebase/firestore/financials';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  Receipt, Calendar, Clock, CheckCircle2, Plus,
  Wallet, Building, Pencil, Trash2, Search, Filter, RotateCcw,
  CheckCheck, ArrowUpDown, ChevronDown
} from 'lucide-react';

const safeFormatDate = (d: Date | string | null | undefined, fmt: string = 'dd MMM yyyy, HH:mm'): string => {
  if (!d) return 'N/A';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
  try {
    return format(dateObj, fmt);
  } catch (e) {
    return 'N/A';
  }
};

export function SettledPaymentsAuditHub() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedCycleMonth, setSelectedCycleMonth] = useState<string>('all-time');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'salary' | 'bill' | 'expense'>('all');
  const [searchFilter, setSearchFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest' | 'amount-high' | 'amount-low'>('newest');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit Modals State
  const [editingPayment, setEditingPayment] = useState<{
    id: string;
    type: 'salary' | 'bill' | 'expense';
    title: string;
    amount: number;
    paidAt: string;
    paymentMethod: string;
    cycleKey?: string;
    category?: string;
    note?: string;
    raw: any;
  } | null>(null);

  const [editForm, setEditForm] = useState({
    amount: '',
    paidAt: '',
    paymentMethod: 'UPI',
    cycleKey: '',
    category: '',
    description: '',
    note: ''
  });

  // Manual Log Salary Modal State
  const [isLogSalaryOpen, setIsLogSalaryOpen] = useState(false);
  const [newSalaryForm, setNewSalaryForm] = useState({
    employeeId: '',
    amountPaid: '',
    cycleKey: currentMonthKey,
    paidAt: new Date().toISOString().slice(0, 16),
    paymentMethod: 'UPI',
    note: ''
  });

  // Subscriptions
  const paidBillsQuery = useMemo(() => (!db ? null : query(collection(db, 'paidBills'), orderBy('paidAt', 'desc'))), [db]);
  const { data: paidBills } = useCollection<PaidBill>(paidBillsQuery);

  const salaryPaymentsQuery = useMemo(() => (!db ? null : query(collection(db, 'salaryPayments'), orderBy('paidAt', 'desc'))), [db]);
  const { data: salaryPayments } = useCollection<SalaryPayment>(salaryPaymentsQuery);

  const expensesQuery = useMemo(() => (!db ? null : query(collection(db, 'expenses'), orderBy('timestamp', 'desc'))), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const employeesQuery = useMemo(() => (!db ? null : query(collection(db, 'employees'))), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  // Month selector options
  const monthOptions = useMemo(() => {
    const options: Array<{ key: string; label: string }> = [
      { key: 'all-time', label: 'All-Time (All Settled)' }
    ];
    const now = new Date();
    for (let i = 0; i >= -11; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = format(d, 'MMMM yyyy') + (key === currentMonthKey ? ' (Current)' : '');
      options.push({ key, label });
    }
    return options;
  }, [currentMonthKey]);

  // Unified payments list
  const allSettledPayments = useMemo(() => {
    const list: Array<{
      id: string;
      type: 'salary' | 'bill' | 'expense';
      title: string;
      category: string;
      amount: number;
      paidAt: string;
      paidAtDate: Date;
      paidBy: string;
      paymentMethod: string;
      cycleKey?: string;
      note?: string;
      raw: any;
    }> = [];

    // 1. Staff Salaries Paid
    (salaryPayments || []).forEach(sp => {
      const pDate = new Date(sp.paidAt);
      list.push({
        id: `sal-${sp.id}`,
        type: 'salary',
        title: `${sp.employeeDisplayName}'s Salary`,
        category: 'Staff Salary Payout',
        amount: sp.amountPaid || 0,
        paidAt: sp.paidAt,
        paidAtDate: isNaN(pDate.getTime()) ? new Date() : pDate,
        paidBy: sp.paidBy?.displayName || 'Viren',
        paymentMethod: sp.paymentMethod || 'UPI / Cash',
        cycleKey: sp.cycleKey,
        note: sp.note,
        raw: sp
      });
    });

    // 2. Paid Fixed & Variable Bills
    (paidBills || []).forEach(pb => {
      const pDate = new Date(pb.paidAt);
      list.push({
        id: `bill-${pb.id}`,
        type: 'bill',
        title: pb.name,
        category: `${pb.repeatCycle || 'Monthly'} Bill`,
        amount: pb.amountPaid || 0,
        paidAt: pb.paidAt,
        paidAtDate: isNaN(pDate.getTime()) ? new Date() : pDate,
        paidBy: pb.paidBy?.displayName || 'Viren',
        paymentMethod: pb.paymentMethod || 'UPI',
        note: pb.isVariable ? 'Variable Rate Bill' : undefined,
        raw: pb
      });
    });

    // 3. Operational Expenses Paid
    (expenses || []).forEach(exp => {
      const pDate = new Date(exp.timestamp);
      list.push({
        id: `exp-${exp.id}`,
        type: 'expense',
        title: exp.description,
        category: exp.category || 'Operational Expense',
        amount: exp.amount || 0,
        paidAt: exp.timestamp,
        paidAtDate: isNaN(pDate.getTime()) ? new Date() : pDate,
        paidBy: exp.addedBy?.displayName || 'Viren',
        paymentMethod: exp.paymentMethod || 'UPI',
        note: exp.notes,
        raw: exp
      });
    });

    return list;
  }, [salaryPayments, paidBills, expenses]);

  // Filtered by month cycle, category, and search
  const filteredPayments = useMemo(() => {
    return allSettledPayments.filter(p => {
      // Month Filter
      if (selectedCycleMonth !== 'all-time') {
        const [targetYear, targetMonth] = selectedCycleMonth.split('-').map(Number);
        const pYear = p.paidAtDate.getFullYear();
        const pMonth = p.paidAtDate.getMonth() + 1;
        const matchesDate = pYear === targetYear && pMonth === targetMonth;
        const matchesCycle = p.cycleKey && p.cycleKey.includes(selectedCycleMonth);
        if (!matchesDate && !matchesCycle) return false;
      }

      // Category Filter
      if (categoryFilter !== 'all' && p.type !== categoryFilter) {
        return false;
      }

      // Search Query
      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchesTitle = p.title.toLowerCase().includes(q);
        const matchesCategory = p.category.toLowerCase().includes(q);
        const matchesMethod = p.paymentMethod.toLowerCase().includes(q);
        const matchesNote = (p.note || '').toLowerCase().includes(q);
        const matchesPaidBy = p.paidBy.toLowerCase().includes(q);
        if (!matchesTitle && !matchesCategory && !matchesMethod && !matchesNote && !matchesPaidBy) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => {
      if (sortOrder === 'newest') return b.paidAtDate.getTime() - a.paidAtDate.getTime();
      if (sortOrder === 'oldest') return a.paidAtDate.getTime() - b.paidAtDate.getTime();
      if (sortOrder === 'amount-high') return b.amount - a.amount;
      if (sortOrder === 'amount-low') return a.amount - b.amount;
      return 0;
    });
  }, [allSettledPayments, selectedCycleMonth, categoryFilter, searchFilter, sortOrder]);

  // Metric totals for the selected view
  const summaryMetrics = useMemo(() => {
    const list = selectedCycleMonth === 'all-time'
      ? allSettledPayments
      : allSettledPayments.filter(p => {
          const [targetYear, targetMonth] = selectedCycleMonth.split('-').map(Number);
          const pYear = p.paidAtDate.getFullYear();
          const pMonth = p.paidAtDate.getMonth() + 1;
          return (pYear === targetYear && pMonth === targetMonth) || (p.cycleKey && p.cycleKey.includes(selectedCycleMonth));
        });

    const totalAmount = list.reduce((s, p) => s + p.amount, 0);
    const salaryItems = list.filter(p => p.type === 'salary');
    const billItems = list.filter(p => p.type === 'bill');
    const expenseItems = list.filter(p => p.type === 'expense');

    return {
      totalAmount,
      totalCount: list.length,
      salaryAmount: salaryItems.reduce((s, p) => s + p.amount, 0),
      salaryCount: salaryItems.length,
      billAmount: billItems.reduce((s, p) => s + p.amount, 0),
      billCount: billItems.length,
      expenseAmount: expenseItems.reduce((s, p) => s + p.amount, 0),
      expenseCount: expenseItems.length
    };
  }, [allSettledPayments, selectedCycleMonth]);

  // Open Edit Dialog
  const handleOpenEdit = (p: (typeof allSettledPayments)[0]) => {
    const pDate = new Date(p.paidAt);
    const dateFormatted = !isNaN(pDate.getTime())
      ? `${pDate.toISOString().slice(0, 10)}T${pDate.toTimeString().slice(0, 5)}`
      : new Date().toISOString().slice(0, 16);

    setEditingPayment({
      id: p.raw.id,
      type: p.type,
      title: p.title,
      amount: p.amount,
      paidAt: p.paidAt,
      paymentMethod: p.paymentMethod,
      cycleKey: p.cycleKey,
      category: p.category,
      note: p.note,
      raw: p.raw
    });

    setEditForm({
      amount: p.amount.toString(),
      paidAt: dateFormatted,
      paymentMethod: p.paymentMethod || 'UPI',
      cycleKey: p.cycleKey || currentMonthKey,
      category: p.raw.category || p.category,
      description: p.type === 'expense' ? p.raw.description : p.title,
      note: p.note || ''
    });
  };

  // Save Edit Handler
  const handleSaveEdit = async () => {
    if (!editingPayment || !user) return;
    const amountNum = parseFloat(editForm.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: 'destructive', title: "Invalid Amount", description: "Please enter a valid amount." });
      return;
    }

    setIsSubmitting(true);
    try {
      const paidDateISO = editForm.paidAt ? new Date(editForm.paidAt).toISOString() : new Date().toISOString();

      if (editingPayment.type === 'salary') {
        const success = await updateSalaryPayment(editingPayment.id, {
          amountPaid: amountNum,
          cycleKey: editForm.cycleKey || selectedCycleMonth,
          paidAt: paidDateISO,
          paymentMethod: editForm.paymentMethod || 'UPI',
          note: editForm.note || ''
        }, user);

        if (success) {
          toast({ title: "Salary Payment Updated", description: `Updated salary record for ${editingPayment.title}.` });
          setEditingPayment(null);
        } else {
          toast({ variant: 'destructive', title: "Update Failed" });
        }
      } else if (editingPayment.type === 'bill') {
        const success = await updatePaidBillRecord(editingPayment.id, {
          amountPaid: amountNum,
          paymentMethod: editForm.paymentMethod || 'UPI',
          paidAt: paidDateISO,
          name: editingPayment.raw.name
        }, user);

        if (success) {
          toast({ title: "Paid Bill Updated", description: `Updated record for ${editingPayment.title}.` });
          setEditingPayment(null);
        } else {
          toast({ variant: 'destructive', title: "Update Failed" });
        }
      } else if (editingPayment.type === 'expense') {
        const success = await updateExpenseRecord(editingPayment.id, {
          amount: amountNum,
          description: editForm.description || editingPayment.title,
          category: editForm.category || 'General',
          paymentMethod: (editForm.paymentMethod.toLowerCase() === 'cash' ? 'cash' : 'upi'),
          timestamp: paidDateISO,
          notes: editForm.note || ''
        }, user);

        if (success) {
          toast({ title: "Expense Record Updated", description: `Updated expense: ${editForm.description || editingPayment.title}.` });
          setEditingPayment(null);
        } else {
          toast({ variant: 'destructive', title: "Update Failed" });
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Undo / Delete Handler
  const handleUndoOrDelete = async (p: (typeof allSettledPayments)[0]) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      if (p.type === 'salary') {
        const success = await undoSalaryPayment(p.raw.id, p.raw.employeeId, user);
        if (success) {
          toast({ title: "Salary Payment Undone", description: `Restored ${p.title} as unpaid for cycle.` });
        }
      } else if (p.type === 'bill') {
        const success = await undoBillPayment(p.raw.id, p.raw.billId, user);
        if (success) {
          toast({ title: "Bill Payment Undone", description: `Restored ${p.title} as unpaid.` });
        }
      } else if (p.type === 'expense') {
        if (db) {
          await deleteDoc(doc(db, 'expenses', p.raw.id));
          toast({ title: "Expense Removed", description: `Deleted expense: ${p.title}.` });
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Undo Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save New Manual Salary Record
  const handleSaveNewSalary = async () => {
    if (!user) return;
    const amountNum = parseFloat(newSalaryForm.amountPaid);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: 'destructive', title: "Invalid Amount", description: "Please enter a valid salary amount." });
      return;
    }

    const emp = (employees || []).find(e => e.id === newSalaryForm.employeeId);
    if (!emp) {
      toast({ variant: 'destructive', title: "Select Staff Member", description: "Please select an employee." });
      return;
    }

    setIsSubmitting(true);
    try {
      const paidDateISO = newSalaryForm.paidAt ? new Date(newSalaryForm.paidAt).toISOString() : new Date().toISOString();
      const paymentId = await recordManualSalaryPayment({
        employeeId: emp.id,
        employeeUsername: emp.username,
        employeeDisplayName: emp.displayName,
        amountPaid: amountNum,
        baseSalary: emp.salary || amountNum,
        cycleKey: newSalaryForm.cycleKey || currentMonthKey,
        paidAt: paidDateISO,
        paymentMethod: newSalaryForm.paymentMethod || 'UPI',
        note: newSalaryForm.note || 'Logged via Settled Payments Log'
      }, user);

      if (paymentId) {
        toast({
          title: "Salary Payment Logged",
          description: `Recorded ₹${amountNum.toLocaleString()} payout for ${emp.displayName}.`
        });
        setIsLogSalaryOpen(false);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="space-y-5 font-body pt-6 border-t-2 border-border/60">
      {/* 1. SECTION HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 shadow-sm">
              <CheckCheck className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-headline uppercase tracking-wider text-foreground flex items-center gap-2">
                ACCOUNTS PAID &bull; SETTLED PAYMENTS &amp; OUTFLOWS AUDIT
              </h2>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                PAID SYSTEM &bull; COMPREHENSIVE AUDIT TRAIL OF ALL STAFF SALARIES, RECURRING BILLS &amp; OPERATIONAL OUTFLOWS
              </p>
            </div>
          </div>
        </div>

        {/* PRIMARY ACTIONS: MONTH FILTER & LOG SALARY BUTTON */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* MONTH SELECTOR */}
          <div className="flex items-center gap-1.5 bg-muted/40 p-1.5 rounded-xl border border-border/60">
            <Filter className="h-4 w-4 text-emerald-400 pl-1" />
            <Select value={selectedCycleMonth} onValueChange={setSelectedCycleMonth}>
              <SelectTrigger className="w-[200px] h-9 text-xs font-black uppercase border-none bg-transparent focus:ring-0">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map(opt => (
                  <SelectItem key={opt.key} value={opt.key} className="text-xs font-bold uppercase">
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* + LOG SALARY BUTTON */}
          <Button
            onClick={() => {
              const firstEmp = (employees || []).filter(e => e.username?.toLowerCase() !== 'viren')[0];
              setNewSalaryForm({
                employeeId: firstEmp?.id || '',
                amountPaid: firstEmp?.salary ? firstEmp.salary.toString() : '',
                cycleKey: selectedCycleMonth !== 'all-time' ? selectedCycleMonth : currentMonthKey,
                paidAt: new Date().toISOString().slice(0, 16),
                paymentMethod: 'UPI',
                note: ''
              });
              setIsLogSalaryOpen(true);
            }}
            className="h-10 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider gap-2 rounded-xl shadow-lg"
          >
            <Plus className="h-4 w-4" /> + Log Past Salary
          </Button>
        </div>
      </div>

      {/* 2. SUMMARY METRIC STRIP */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <Card className="p-4 border-2 border-emerald-500/50 bg-emerald-950/20 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-emerald-400">
            <span className="flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Total Paid Outflows</span>
            <Badge className="bg-emerald-500 text-white font-mono text-[10px]">{summaryMetrics.totalCount} RECORDS</Badge>
          </div>
          <p className="text-2xl font-black font-mono text-emerald-400">₹{summaryMetrics.totalAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">
            {selectedCycleMonth === 'all-time' ? 'All-Time Outflows' : `${selectedCycleMonth} Total Settled`}
          </p>
        </Card>

        <Card className="p-4 border-2 border-indigo-500/40 bg-indigo-950/20 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-indigo-400">
            <span className="flex items-center gap-1.5"><Building className="h-4 w-4" /> Staff Salaries Paid</span>
            <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 font-mono text-[10px]">{summaryMetrics.salaryCount} PAID</Badge>
          </div>
          <p className="text-2xl font-black font-mono text-indigo-300">₹{summaryMetrics.salaryAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Net Salary Payouts</p>
        </Card>

        <Card className="p-4 border-2 border-amber-500/40 bg-amber-950/20 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-amber-400">
            <span className="flex items-center gap-1.5"><Receipt className="h-4 w-4" /> Recurring Bills Paid</span>
            <Badge variant="outline" className="border-amber-500/40 text-amber-300 font-mono text-[10px]">{summaryMetrics.billCount} CLEARED</Badge>
          </div>
          <p className="text-2xl font-black font-mono text-amber-300">₹{summaryMetrics.billAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Fixed &amp; Variable Overheads</p>
        </Card>

        <Card className="p-4 border-2 border-rose-500/40 bg-rose-950/20 rounded-xl space-y-1">
          <div className="flex items-center justify-between text-xs font-extrabold uppercase text-rose-400">
            <span className="flex items-center gap-1.5"><Clock className="h-4 w-4" /> Operational Expenses Paid</span>
            <Badge variant="outline" className="border-rose-500/40 text-rose-300 font-mono text-[10px]">{summaryMetrics.expenseCount} LOGGED</Badge>
          </div>
          <p className="text-2xl font-black font-mono text-rose-300">₹{summaryMetrics.expenseAmount.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground uppercase font-bold">Café Daily Expenses</p>
        </Card>
      </div>

      {/* 3. LOG MANAGEMENT CARD WITH CONTROLS & TABLE */}
      <Card className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-xl rounded-xl overflow-hidden">
        {/* CONTROLS HEADER */}
        <div className="p-4 bg-muted/20 border-b border-border/40 space-y-3">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            {/* CATEGORY FILTER PILLS - HIGH CONTRAST & VISIBILITY */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-black uppercase text-muted-foreground tracking-wider mr-1">
                Filter:
              </span>
              <Button
                size="sm"
                variant={categoryFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase rounded-lg transition-all",
                  categoryFilter === 'all'
                    ? "bg-emerald-600 text-white shadow-md shadow-emerald-600/30 ring-1 ring-emerald-400"
                    : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
                )}
              >
                All Paid ({summaryMetrics.totalCount})
              </Button>

              <Button
                size="sm"
                variant={categoryFilter === 'salary' ? 'default' : 'outline'}
                onClick={() => setCategoryFilter('salary')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 transition-all",
                  categoryFilter === 'salary'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 ring-1 ring-indigo-400"
                    : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
                )}
              >
                <Building className="h-3.5 w-3.5 text-indigo-400" /> Salaries Paid ({summaryMetrics.salaryCount})
              </Button>

              <Button
                size="sm"
                variant={categoryFilter === 'bill' ? 'default' : 'outline'}
                onClick={() => setCategoryFilter('bill')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 transition-all",
                  categoryFilter === 'bill'
                    ? "bg-amber-600 text-white shadow-md shadow-amber-600/30 ring-1 ring-amber-400"
                    : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
                )}
              >
                <Receipt className="h-3.5 w-3.5 text-amber-400" /> Bills Paid ({summaryMetrics.billCount})
              </Button>

              <Button
                size="sm"
                variant={categoryFilter === 'expense' ? 'default' : 'outline'}
                onClick={() => setCategoryFilter('expense')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 transition-all",
                  categoryFilter === 'expense'
                    ? "bg-rose-600 text-white shadow-md shadow-rose-600/30 ring-1 ring-rose-400"
                    : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
                )}
              >
                <Clock className="h-3.5 w-3.5 text-rose-400" /> Expenses Paid ({summaryMetrics.expenseCount})
              </Button>
            </div>

            {/* SEARCH & SORT */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={searchFilter}
                  onChange={e => setSearchFilter(e.target.value)}
                  placeholder="Search staff, bill, note..."
                  className="pl-9 h-9 text-xs font-bold uppercase bg-background/60 border-border/70"
                />
              </div>

              <Select value={sortOrder} onValueChange={(val: any) => setSortOrder(val)}>
                <SelectTrigger className="w-[140px] h-9 text-xs font-bold uppercase bg-background/60 border-border/70">
                  <ArrowUpDown className="h-3 w-3 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest" className="text-xs font-bold uppercase">Newest First</SelectItem>
                  <SelectItem value="oldest" className="text-xs font-bold uppercase">Oldest First</SelectItem>
                  <SelectItem value="amount-high" className="text-xs font-bold uppercase">Amount: High-Low</SelectItem>
                  <SelectItem value="amount-low" className="text-xs font-bold uppercase">Amount: Low-High</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* 4. PAYMENTS AUDIT TABLE */}
        <div className="overflow-x-auto">
          <Table>
            <TableHead>
              <TableRow className="border-b border-border/40 text-[11px] uppercase font-black text-muted-foreground bg-muted/10">
                <TableHeader className="w-[30%]">Date Paid &amp; Description</TableHeader>
                <TableHeader className="w-[20%]">Classification / Cycle</TableHeader>
                <TableHeader className="w-[15%]">Payment Mode</TableHeader>
                <TableHeader className="w-[15%]">Recorded By</TableHeader>
                <TableHeader className="w-[10%] text-right">Amount Settled</TableHeader>
                <TableHeader className="w-[10%] text-right">Actions</TableHeader>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredPayments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-16 text-muted-foreground font-bold text-xs uppercase">
                    No settled payment records found for {selectedCycleMonth === 'all-time' ? 'all-time' : selectedCycleMonth}
                    {searchFilter ? ` matching "${searchFilter}"` : ''}.
                  </TableCell>
                </TableRow>
              ) : (
                filteredPayments.map((p) => (
                  <TableRow key={p.id} className="border-b border-border/30 hover:bg-muted/15 font-mono text-xs transition-colors">
                    <TableCell className="py-3.5">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-extrabold uppercase text-foreground text-sm tracking-tight">{p.title}</p>
                          {p.type === 'salary' && (
                            <Badge className="text-[9px] font-mono font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                              SALARY
                            </Badge>
                          )}
                          {p.type === 'bill' && (
                            <Badge className="text-[9px] font-mono font-black uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                              BILL
                            </Badge>
                          )}
                          {p.type === 'expense' && (
                            <Badge className="text-[9px] font-mono font-black uppercase bg-rose-500/20 text-rose-300 border border-rose-500/40">
                              EXPENSE
                            </Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1 font-mono">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          Settled: {safeFormatDate(p.paidAt)}
                        </p>
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5">
                      <div>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase border-border/60">
                          {p.category}
                        </Badge>
                        {p.cycleKey && (
                          <span className="text-[10px] text-indigo-400 font-mono ml-2 font-bold">
                            Cycle: {p.cycleKey}
                          </span>
                        )}
                        {p.note && (
                          <p className="text-[10px] text-muted-foreground mt-0.5 max-w-[240px] truncate" title={p.note}>
                            {p.note}
                          </p>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="py-3.5 uppercase text-xs font-bold text-foreground">
                      <Badge variant="outline" className="font-mono text-[10px] border-border/60">
                        {p.paymentMethod}
                      </Badge>
                    </TableCell>

                    <TableCell className="py-3.5 text-xs font-bold text-muted-foreground">
                      {p.paidBy}
                    </TableCell>

                    <TableCell className="py-3.5 text-right font-black font-mono text-base text-emerald-400">
                      ₹{p.amount.toLocaleString()}
                    </TableCell>

                    <TableCell className="py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* EDIT BUTTON - HIGH CONTRAST */}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(p)}
                          className="h-8 px-2.5 text-xs font-bold uppercase border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 gap-1 rounded-lg shadow-sm"
                          title="Edit Payment Record"
                        >
                          <Pencil className="h-3.5 w-3.5 text-indigo-400" />
                          <span className="hidden sm:inline">Edit</span>
                        </Button>

                        {/* UNDO / DELETE BUTTON */}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleUndoOrDelete(p)}
                          className="h-8 px-2 text-xs font-bold uppercase text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10 rounded-lg"
                          title={p.type === 'expense' ? "Delete Expense" : "Undo Payment"}
                        >
                          {p.type === 'expense' ? <Trash2 className="h-3.5 w-3.5" /> : <RotateCcw className="h-3.5 w-3.5" />}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* MODAL 1: EDIT PAYMENT DIALOG (SALARY / BILL / EXPENSE) */}
      <Dialog open={!!editingPayment} onOpenChange={(open) => !open && setEditingPayment(null)}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <Pencil className="text-indigo-400" /> Edit Settled Payment
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Modify recorded payment details for {editingPayment?.title} ({editingPayment?.type.toUpperCase()}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Amount Paid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Amount Paid (₹)</Label>
              <Input
                type="number"
                value={editForm.amount}
                onChange={e => setEditForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="Enter paid amount"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            {/* Description (for Expense) */}
            {editingPayment?.type === 'expense' && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
                <Input
                  value={editForm.description}
                  onChange={e => setEditForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="Expense description"
                  className="font-bold text-xs h-10"
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              {/* Payment Mode */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Mode</Label>
                <Input
                  value={editForm.paymentMethod}
                  onChange={e => setEditForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  placeholder="UPI / Cash / Bank"
                  className="font-bold text-xs uppercase h-10"
                />
              </div>

              {/* Cycle Month (for Salary) or Category (for Expense) */}
              {editingPayment?.type === 'salary' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Cycle Month</Label>
                  <Input
                    value={editForm.cycleKey}
                    onChange={e => setEditForm(p => ({ ...p, cycleKey: e.target.value }))}
                    placeholder="e.g. 2026-10"
                    className="font-mono font-bold text-xs h-10"
                  />
                </div>
              ) : editingPayment?.type === 'expense' ? (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
                  <Input
                    value={editForm.category}
                    onChange={e => setEditForm(p => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Maintenance"
                    className="font-bold text-xs h-10"
                  />
                </div>
              ) : null}
            </div>

            {/* Date & Time Paid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Date &amp; Time Settled</Label>
              <Input
                type="datetime-local"
                value={editForm.paidAt}
                onChange={e => setEditForm(p => ({ ...p, paidAt: e.target.value }))}
                className="font-mono text-xs h-10"
              />
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Notes / Remarks</Label>
              <Input
                value={editForm.note}
                onChange={e => setEditForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Optional notes"
                className="text-xs h-10"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingPayment(null)}
              className="text-xs font-bold uppercase"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEdit}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase text-xs tracking-wider shadow-lg"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: LOG NEW SALARY PAYOUT */}
      <Dialog open={isLogSalaryOpen} onOpenChange={setIsLogSalaryOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <Building className="text-emerald-400" /> Log Past Salary Payment
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Record a salary payout already disbursed to a team member.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Staff Member</Label>
              <Select
                value={newSalaryForm.employeeId}
                onValueChange={(val) => {
                  const emp = (employees || []).find(e => e.id === val);
                  setNewSalaryForm(p => ({
                    ...p,
                    employeeId: val,
                    amountPaid: emp?.salary ? emp.salary.toString() : p.amountPaid
                  }));
                }}
              >
                <SelectTrigger className="font-bold text-xs uppercase h-10">
                  <SelectValue placeholder="Select Staff Member" />
                </SelectTrigger>
                <SelectContent>
                  {(employees || []).filter(e => e.username?.toLowerCase() !== 'viren').map(emp => (
                    <SelectItem key={emp.id} value={emp.id} className="text-xs font-bold uppercase">
                      {emp.displayName} (Base: ₹{(emp.salary || 0).toLocaleString()})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Amount Paid (₹)</Label>
              <Input
                type="number"
                value={newSalaryForm.amountPaid}
                onChange={e => setNewSalaryForm(p => ({ ...p, amountPaid: e.target.value }))}
                placeholder="e.g. 6000"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Cycle Month</Label>
                <Input
                  value={newSalaryForm.cycleKey}
                  onChange={e => setNewSalaryForm(p => ({ ...p, cycleKey: e.target.value }))}
                  placeholder="e.g. 2026-10"
                  className="font-mono font-bold text-xs h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Mode</Label>
                <Input
                  value={newSalaryForm.paymentMethod}
                  onChange={e => setNewSalaryForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  placeholder="UPI / Cash"
                  className="font-bold text-xs uppercase h-10"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Date &amp; Time Paid</Label>
              <Input
                type="datetime-local"
                value={newSalaryForm.paidAt}
                onChange={e => setNewSalaryForm(p => ({ ...p, paidAt: e.target.value }))}
                className="font-mono text-xs h-10"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Notes / Remarks</Label>
              <Input
                value={newSalaryForm.note}
                onChange={e => setNewSalaryForm(p => ({ ...p, note: e.target.value }))}
                placeholder="e.g. Early payment, Cash + UPI split"
                className="text-xs h-10"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setIsLogSalaryOpen(false)}
              className="text-xs font-bold uppercase"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveNewSalary}
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold uppercase text-xs tracking-wider shadow-lg"
            >
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
