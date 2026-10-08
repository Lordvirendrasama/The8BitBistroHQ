'use client';

import { useState, useMemo, useEffect } from 'react';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, orderBy, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { FixedBill, Expense, Debt, Employee, RepeatCycle, PaidBill, SalaryPayment } from '@/lib/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { addFixedBill, markBillAsPaid, deleteFixedBill, updateFixedBill, undoBillPayment, undoSalaryPayment, recordManualSalaryPayment, updateSalaryPayment, recordSalaryPayment } from '@/firebase/firestore/financials';
import { getCycleInfo } from '@/components/owner-pulse/owner-pulse-employee-intel';
import { format, differenceInDays, isPast, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { 
  Receipt, Calendar, Clock, AlertTriangle, CheckCircle2, Plus, 
  Wallet, Building, Pencil, Trash2, Search, ShieldAlert, Check, Layers,
  Zap, CheckCheck, Filter, RotateCcw
} from 'lucide-react';

// Robust Date Formatting Helper to prevent RangeError: Invalid time value crashes
const safeFormatDate = (d: Date | string | null | undefined, fmt: string = 'dd MMM yyyy'): string => {
  if (!d) return 'N/A';
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (!dateObj || isNaN(dateObj.getTime())) return 'N/A';
  try {
    return format(dateObj, fmt);
  } catch (e) {
    return 'N/A';
  }
};

export function ExecutiveExpensesHub() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  const [activeTab, setActiveTab] = useState<'all' | 'bills' | 'salaries'>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'payable' | 'paid' | 'all'>('payable');
  const [searchFilter, setSearchFilter] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'urgent' | 'week' | 'overdue' | 'unpaid'>('all');
  
  // Monthly Cycle Selector state (Default: Current Year-Month e.g. "2026-10")
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const [selectedCycleMonth, setSelectedCycleMonth] = useState(currentMonthKey);
  const selectedMonthLabel = safeFormatDate(new Date(`${selectedCycleMonth}-01`), 'MMMM yyyy');

  // Modals state
  const [isLogExpenseOpen, setIsLogExpenseOpen] = useState(false);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedBill | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Pay Bill Modal state for Variable Amounts
  const [payBillTarget, setPayBillTarget] = useState<FixedBill | null>(null);
  const [payBillAmount, setPayBillAmount] = useState('');
  const [payBillNextAmount, setPayBillNextAmount] = useState('');
  const [isPayBillModalOpen, setIsPayBillModalOpen] = useState(false);

  // Pay Salary Modal state (1-Click Mark Paid for Staff in Payable system)
  const [paySalaryTarget, setPaySalaryTarget] = useState<Employee | null>(null);
  const [paySalaryAmount, setPaySalaryAmount] = useState('');
  const [paySalaryMethod, setPaySalaryMethod] = useState('UPI');
  const [paySalaryCycleKey, setPaySalaryCycleKey] = useState('');
  const [paySalaryNote, setPaySalaryNote] = useState('');
  const [paySalarySettleAdjustments, setPaySalarySettleAdjustments] = useState(true);
  const [isPaySalaryModalOpen, setIsPaySalaryModalOpen] = useState(false);

  // Expense form state
  const [expenseForm, setExpenseForm] = useState({
    amount: '',
    description: '',
    category: 'Food & Beverages',
    paymentMethod: 'upi' as 'cash' | 'upi',
    notes: ''
  });

  // Salary Payment Log & Edit state
  const [isLogSalaryOpen, setIsLogSalaryOpen] = useState(false);
  const [editingSalaryPayment, setEditingSalaryPayment] = useState<SalaryPayment | null>(null);
  const [salaryForm, setSalaryForm] = useState<{
    employeeId: string;
    amountPaid: string;
    cycleKey: string;
    paidAt: string;
    paymentMethod: string;
    note: string;
  }>({
    employeeId: '',
    amountPaid: '',
    cycleKey: currentMonthKey,
    paidAt: new Date().toISOString().slice(0, 16),
    paymentMethod: 'UPI',
    note: ''
  });

  // Fixed Bill form state
  const [billForm, setBillForm] = useState<{
    name: string;
    amount: number;
    repeatCycle: RepeatCycle;
    dueDayOfMonth: number;
    nextDueDate: string;
    reminderDays: number;
    paymentMethod: string;
    isVariable: boolean;
    notes?: string;
  }>({
    name: '',
    amount: 0,
    repeatCycle: 'monthly',
    dueDayOfMonth: 1,
    nextDueDate: new Date().toISOString().slice(0, 10),
    reminderDays: 5,
    paymentMethod: 'UPI',
    isVariable: false,
    notes: ''
  });

  // Firestore Subscriptions
  const fixedBillsQuery = useMemo(() => (!db ? null : query(collection(db, 'fixedBills'), orderBy('nextDueDate'))), [db]);
  const { data: fixedBills } = useCollection<FixedBill>(fixedBillsQuery);

  const expensesQuery = useMemo(() => (!db ? null : query(collection(db, 'expenses'), orderBy('timestamp', 'desc'))), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const debtsQuery = useMemo(() => (!db ? null : query(collection(db, 'debts'), where('status', '==', 'pending'))), [db]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const employeesQuery = useMemo(() => (!db ? null : query(collection(db, 'employees'), where('isActive', '==', true))), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const paidBillsQuery = useMemo(() => (!db ? null : query(collection(db, 'paidBills'), orderBy('paidAt', 'desc'))), [db]);
  const { data: paidBills } = useCollection<PaidBill>(paidBillsQuery);

  const salaryPaymentsQuery = useMemo(() => (!db ? null : query(collection(db, 'salaryPayments'), orderBy('paidAt', 'desc'))), [db]);
  const { data: salaryPayments } = useCollection<SalaryPayment>(salaryPaymentsQuery);

  // Auto-sync past mock dates to the current monthly cycle
  useEffect(() => {
    if (!fixedBills || !db) return;
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    fixedBills.forEach(async (bill) => {
      const rawDate = new Date(bill.nextDueDate);
      if (isNaN(rawDate.getTime())) return;
      
      if (rawDate.getFullYear() < currentYear || (rawDate.getFullYear() === currentYear && rawDate.getMonth() < currentMonth)) {
        const cycleDay = bill.dueDayOfMonth || rawDate.getDate() || 1;
        const maxDays = new Date(currentYear, currentMonth + 1, 0).getDate();
        const validDay = Math.min(Math.max(1, cycleDay), maxDays);
        const syncedDate = new Date(currentYear, currentMonth, validDay);

        try {
          await updateDoc(doc(db, 'fixedBills', bill.id), {
            nextDueDate: syncedDate.toISOString(),
            dueDayOfMonth: cycleDay
          });
        } catch (e) {
          console.warn("Could not auto-sync past bill date:", e);
        }
      }
    });
  }, [fixedBills, db]);

  // Unified Due Items Calculation (Aligned to Monthly Cycles & Selected Month)
  const dueItems = useMemo(() => {
    const items: Array<{
      id: string;
      title: string;
      category: 'Fixed Bill' | 'Staff Salary' | 'Pending Payable';
      amount: number;
      dueDate: Date;
      dueDateFormatted: string;
      daysLeft: number;
      isOverdue: boolean;
      isDueToday: boolean;
      isPaidInSelectedMonth: boolean;
      paymentMethod?: string;
      isVariable?: boolean;
      cycleDay: number;
      raw: any;
      type: 'bill' | 'salary' | 'debt';
    }> = [];

    const now = new Date();
    const [selYear, selMonth] = selectedCycleMonth.split('-').map(Number);
    const targetMonthIndex = (isNaN(selMonth) ? now.getMonth() + 1 : selMonth) - 1;
    const targetYear = isNaN(selYear) ? now.getFullYear() : selYear;

    // 1. Fixed Bills (Monthly Cycled)
    (fixedBills || []).forEach(bill => {
      const rawDate = new Date(bill.nextDueDate);
      const validRawDate = isNaN(rawDate.getTime()) ? new Date() : rawDate;
      const cycleDay = bill.dueDayOfMonth || validRawDate.getDate() || 1;
      
      // Calculate due date in selected cycle month
      const maxDaysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
      const validDay = Math.min(Math.max(1, cycleDay), maxDaysInTargetMonth);
      const dDate = new Date(targetYear, targetMonthIndex, validDay);

      if (isNaN(dDate.getTime())) return;

      // Check if bill was paid in the selected month
      const isPaid = (paidBills || []).some(pb => {
        if (pb.billId === bill.id || pb.name.toLowerCase() === bill.name.toLowerCase()) {
          const pDate = new Date(pb.paidAt);
          if (isNaN(pDate.getTime())) return false;
          return pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonthIndex;
        }
        return false;
      }) || (bill.lastPaidDate && !isNaN(new Date(bill.lastPaidDate).getTime()) && new Date(bill.lastPaidDate).getFullYear() === targetYear && new Date(bill.lastPaidDate).getMonth() === targetMonthIndex);

      const days = differenceInDays(dDate, now);
      const overdue = isPast(dDate) && !isToday(dDate) && !isPaid;
      const dueToday = isToday(dDate) && !isPaid;

      items.push({
        id: bill.id,
        title: bill.name,
        category: 'Fixed Bill',
        amount: bill.amount || 0,
        dueDate: dDate,
        dueDateFormatted: safeFormatDate(dDate, 'dd MMM yyyy'),
        daysLeft: days,
        isOverdue: overdue,
        isDueToday: dueToday,
        isPaidInSelectedMonth: !!isPaid,
        paymentMethod: bill.paymentMethod || 'UPI',
        isVariable: !!bill.isVariable || bill.name.toLowerCase().includes('light') || bill.name.toLowerCase().includes('internet') || bill.name.toLowerCase().includes('electric'),
        cycleDay,
        raw: bill,
        type: 'bill'
      });
    });

    // 2. Staff Salaries (Monthly Cycled)
    (employees || []).filter(e => e.username?.toLowerCase() !== 'viren').forEach(emp => {
      const cycle = getCycleInfo(emp.joinDate, emp.lastSalaryPaidDate, emp.lastSalaryPaidCycle);
      const cycleDay = (cycle && typeof cycle.joinDay === 'number' && !isNaN(cycle.joinDay))
        ? cycle.joinDay
        : 1;

      const maxDaysInTargetMonth = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
      const validDay = Math.min(Math.max(1, cycleDay), maxDaysInTargetMonth);
      const nextSalDate = new Date(targetYear, targetMonthIndex, validDay);

      if (isNaN(nextSalDate.getTime())) return;

      const targetMonthString = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`;

      // Check if salary was paid for this employee in selected month
      const matchingSalaryPayment = (salaryPayments || []).find(sp => {
        if (sp.employeeId === emp.id || sp.employeeUsername?.toLowerCase() === emp.username?.toLowerCase()) {
          const pDate = new Date(sp.paidAt);
          if (isNaN(pDate.getTime())) return false;
          return (pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonthIndex) || (sp.cycleKey && sp.cycleKey.includes(targetMonthString));
        }
        return false;
      });

      const hasPaidDateInMonth = emp.lastSalaryPaidDate && !isNaN(new Date(emp.lastSalaryPaidDate).getTime()) && (() => {
        const lp = new Date(emp.lastSalaryPaidDate);
        return lp.getFullYear() === targetYear && lp.getMonth() === targetMonthIndex;
      })();

      const hasCycleKeyMatch = emp.lastSalaryPaidCycle && emp.lastSalaryPaidCycle.includes(targetMonthString);

      const isPaid = !!matchingSalaryPayment || !!hasPaidDateInMonth || !!hasCycleKeyMatch;

      const adjustments = emp.salaryAdjustments || [];
      const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + (a.amount || 0), 0);
      const activeMealOverages = adjustments.filter(a => a.status === 'active' && a.type === 'meal_overage').reduce((s, a) => s + (a.amount || 0), 0);
      const activeDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction').reduce((s, a) => s + (a.amount || 0), 0);
      const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + (a.amount || 0), 0);
      
      const netSalary = isPaid && matchingSalaryPayment
        ? matchingSalaryPayment.amountPaid
        : (isPaid && emp.lastSalaryAmount)
        ? emp.lastSalaryAmount
        : Math.max(0, (emp.salary || 0) + activeBonuses - activeAdvances - activeMealOverages - activeDeductions);

      const days = differenceInDays(nextSalDate, now);
      const overdue = isPast(nextSalDate) && !isToday(nextSalDate) && !isPaid;
      const dueToday = isToday(nextSalDate) && !isPaid;

      items.push({
        id: `salary-${emp.id}`,
        title: `${emp.displayName}'s Salary Payout`,
        category: 'Staff Salary',
        amount: netSalary,
        dueDate: nextSalDate,
        dueDateFormatted: safeFormatDate(nextSalDate, 'dd MMM yyyy'),
        daysLeft: days,
        isOverdue: overdue,
        isDueToday: dueToday,
        isPaidInSelectedMonth: !!isPaid,
        paymentMethod: 'UPI / Cash',
        isVariable: false,
        cycleDay,
        raw: {
          ...emp,
          matchingSalaryPayment
        },
        type: 'salary'
      });
    });

    // 3. Pending Debts / Payables
    (debts || []).forEach(d => {
      if (d.type === 'payable') {
        const dDate = new Date(d.timestamp);
        if (isNaN(dDate.getTime())) return;

        const days = differenceInDays(dDate, now);

        items.push({
          id: d.id,
          title: `Payable to ${d.contactName}`,
          category: 'Pending Payable',
          amount: d.amount || 0,
          dueDate: dDate,
          dueDateFormatted: safeFormatDate(dDate, 'dd MMM yyyy'),
          daysLeft: days,
          isOverdue: days < 0,
          isDueToday: isToday(dDate),
          isPaidInSelectedMonth: d.status === 'cleared',
          paymentMethod: 'Direct Payment',
          isVariable: false,
          cycleDay: dDate.getDate() || 1,
          raw: d,
          type: 'debt'
        });
      }
    });

    // Sort by urgency: Unpaid first (Overdue -> Due Today -> Days Left), then Paid items
    return items.sort((a, b) => {
      if (a.isPaidInSelectedMonth && !b.isPaidInSelectedMonth) return 1;
      if (!a.isPaidInSelectedMonth && b.isPaidInSelectedMonth) return -1;
      if (a.isOverdue && !b.isOverdue) return -1;
      if (!a.isOverdue && b.isOverdue) return 1;
      if (a.isDueToday && !b.isDueToday) return -1;
      if (!a.isDueToday && b.isDueToday) return 1;
      return a.daysLeft - b.daysLeft;
    });
  }, [fixedBills, employees, debts, paidBills, salaryPayments, selectedCycleMonth]);

  // Overall Financial Overview Summary for Selected Month
  const financialSummary = useMemo(() => {
    const pendingItems = dueItems.filter(i => !i.isPaidInSelectedMonth);
    const overdueItems = pendingItems.filter(i => i.isOverdue);
    const dueTodayItems = pendingItems.filter(i => i.isDueToday);

    const totalMoneyToSpendStill = pendingItems.reduce((sum, item) => sum + item.amount, 0);
    const urgentAmount = overdueItems.reduce((s, i) => s + i.amount, 0) + dueTodayItems.reduce((s, i) => s + i.amount, 0);

    const fixedBillsTotal = pendingItems.filter(i => i.type === 'bill').reduce((s, i) => s + i.amount, 0);
    const totalStaffSalaryNet = pendingItems.filter(i => i.type === 'salary').reduce((s, i) => s + i.amount, 0);

    const [selYear, selMonth] = selectedCycleMonth.split('-').map(Number);
    const targetMonthIndex = (isNaN(selMonth) ? new Date().getMonth() + 1 : selMonth) - 1;
    const targetYear = isNaN(selYear) ? new Date().getFullYear() : selYear;
    const targetMonthString = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`;

    // 1. Paid Bills for selected month
    const monthPaidBills = (paidBills || []).filter(pb => {
      const pDate = new Date(pb.paidAt);
      if (isNaN(pDate.getTime())) return false;
      return pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonthIndex;
    });
    const totalPaidBillsAmount = monthPaidBills.reduce((s, p) => s + (p.amountPaid || 0), 0);

    // 2. Paid Salaries for selected month
    const monthSalaryPayments = (salaryPayments || []).filter(sp => {
      const pDate = new Date(sp.paidAt);
      if (isNaN(pDate.getTime())) return false;
      return (pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonthIndex) || (sp.cycleKey && sp.cycleKey.includes(targetMonthString));
    });
    const totalPaidSalariesAmount = monthSalaryPayments.reduce((s, p) => s + (p.amountPaid || 0), 0);

    // 3. Logged Expenses for selected month
    const monthExpenses = (expenses || []).filter(exp => {
      const eDate = new Date(exp.timestamp);
      if (isNaN(eDate.getTime())) return false;
      return eDate.getFullYear() === targetYear && eDate.getMonth() === targetMonthIndex;
    });
    const totalExpensesAmount = monthExpenses.reduce((s, e) => s + (e.amount || 0), 0);

    const totalOverallPaidAmount = totalPaidBillsAmount + totalPaidSalariesAmount + totalExpensesAmount;
    const totalOverallPaidCount = monthPaidBills.length + monthSalaryPayments.length + monthExpenses.length;

    return {
      totalMoneyToSpendStill,
      dueItemsCount: pendingItems.length,
      overdueCount: overdueItems.length,
      dueTodayCount: dueTodayItems.length,
      urgentAmount,
      fixedBillsTotal,
      totalStaffSalaryNet,
      totalPaidBillsAmount,
      paidBillsCount: monthPaidBills.length,
      totalPaidSalariesAmount,
      paidSalariesCount: monthSalaryPayments.length,
      totalExpensesAmount,
      expensesCount: monthExpenses.length,
      totalOverallPaidAmount,
      totalOverallPaidCount
    };
  }, [dueItems, paidBills, salaryPayments, expenses, selectedCycleMonth]);

  // Dynamic Urgency Classifier for Enhanced UX Contrast
  const getUrgencyConfig = (item: (typeof dueItems)[0]) => {
    if (item.isPaidInSelectedMonth) {
      return {
        level: 'settled',
        label: `SETTLED FOR ${selectedMonthLabel}`,
        badgeClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 font-bold',
        cardClass: 'border-l-4 border-l-emerald-500 border-emerald-500/30 bg-emerald-950/10 opacity-75',
        amountClass: 'text-emerald-400 line-through opacity-70',
        iconClass: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40',
        progressPct: 100,
        progressColor: 'bg-emerald-500',
        icon: <CheckCircle2 className="h-5 w-5 text-emerald-400" />
      };
    }

    if (item.isOverdue) {
      return {
        level: 'overdue',
        label: `🚨 OVERDUE BY ${Math.abs(item.daysLeft)} DAYS!`,
        badgeClass: 'bg-rose-600 text-white font-black shadow-lg shadow-rose-600/40 animate-pulse border-rose-400',
        cardClass: 'border-l-4 border-l-rose-500 border-rose-500/50 bg-rose-950/35 shadow-rose-950/30 ring-1 ring-rose-500/30',
        amountClass: 'text-rose-400 font-black text-xl drop-shadow-sm',
        iconClass: 'bg-rose-500/25 text-rose-400 border-rose-500/50 animate-bounce',
        progressPct: 100,
        progressColor: 'bg-rose-500 animate-pulse',
        icon: <AlertTriangle className="h-5 w-5 text-rose-400" />
      };
    }

    if (item.isDueToday) {
      return {
        level: 'due-today',
        label: `⚡ DUE TODAY! ACTION REQUIRED`,
        badgeClass: 'bg-orange-500 text-white font-black shadow-lg shadow-orange-500/40 animate-pulse border-orange-300',
        cardClass: 'border-l-4 border-l-orange-500 border-orange-500/50 bg-orange-950/30 shadow-orange-950/30 ring-1 ring-orange-500/30',
        amountClass: 'text-orange-400 font-black text-xl',
        iconClass: 'bg-orange-500/25 text-orange-400 border-orange-500/50 animate-pulse',
        progressPct: 98,
        progressColor: 'bg-orange-500',
        icon: <Zap className="h-5 w-5 text-orange-400" />
      };
    }

    if (item.daysLeft <= 1) {
      return {
        level: 'due-tomorrow',
        label: `🔥 DUE TOMORROW! (1 DAY LEFT)`,
        badgeClass: 'bg-amber-500 text-black font-extrabold shadow-md shadow-amber-500/20 border-amber-300 animate-pulse',
        cardClass: 'border-l-4 border-l-amber-500 border-amber-500/50 bg-amber-950/25 shadow-amber-950/20',
        amountClass: 'text-amber-400 font-extrabold text-xl',
        iconClass: 'bg-amber-500/20 text-amber-400 border-amber-500/40',
        progressPct: 95,
        progressColor: 'bg-amber-500',
        icon: <Clock className="h-5 w-5 text-amber-400" />
      };
    }

    if (item.daysLeft <= 3) {
      return {
        level: 'critical-upcoming',
        label: `🔥 DUE IN ${item.daysLeft} DAYS (${safeFormatDate(item.dueDate, 'dd MMM')})`,
        badgeClass: 'bg-amber-500/30 text-amber-300 border border-amber-500/60 font-extrabold',
        cardClass: 'border-l-4 border-l-amber-400 border-amber-500/30 bg-amber-950/15',
        amountClass: 'text-amber-300 font-extrabold text-lg',
        iconClass: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
        progressPct: 88,
        progressColor: 'bg-amber-400',
        icon: <Clock className="h-5 w-5 text-amber-400" />
      };
    }

    if (item.daysLeft <= 7) {
      return {
        level: 'week-upcoming',
        label: `⏳ DUE IN ${item.daysLeft} DAYS (${safeFormatDate(item.dueDate, 'dd MMM')})`,
        badgeClass: 'bg-yellow-500/15 text-yellow-300 border border-yellow-500/30 font-bold',
        cardClass: 'border-l-4 border-l-yellow-500/50 border-border/50 bg-muted/20',
        amountClass: 'text-yellow-200 font-bold text-lg',
        iconClass: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        progressPct: 70,
        progressColor: 'bg-yellow-500/80',
        icon: item.type === 'bill' ? <Receipt className="h-5 w-5 text-yellow-400" /> : <Wallet className="h-5 w-5 text-yellow-400" />
      };
    }

    // Default: > 7 days left
    const pct = Math.min(60, Math.max(10, Math.round(((30 - item.daysLeft) / 30) * 100)));
    return {
      level: 'normal-upcoming',
      label: `🗓️ IN ${item.daysLeft} DAYS (${safeFormatDate(item.dueDate, 'dd MMM')})`,
      badgeClass: 'bg-slate-800/90 text-slate-300 border border-slate-700 font-semibold',
      cardClass: 'border-l-4 border-l-slate-700/80 border-border/40 bg-card/60 hover:border-slate-600',
      amountClass: 'text-slate-200 font-bold text-lg',
      iconClass: 'bg-slate-800 text-slate-300 border-slate-700',
      progressPct: pct,
      progressColor: 'bg-slate-600',
      icon: item.type === 'bill' ? <Receipt className="h-5 w-5 text-slate-400" /> : <Wallet className="h-5 w-5 text-slate-400" />
    };
  };

  // Trigger Open Pay Bill Dialog
  const handleOpenPayBillModal = (bill: FixedBill) => {
    setPayBillTarget(bill);
    setPayBillAmount(bill.amount?.toString() || '0');
    setPayBillNextAmount(bill.amount?.toString() || '0');
    setIsPayBillModalOpen(true);
  };

  // Confirm Marking Bill as Paid
  const handleConfirmPayBill = async () => {
    if (!payBillTarget || !user) return;
    const paidAmt = parseFloat(payBillAmount);
    const nextAmt = parseFloat(payBillNextAmount);

    if (isNaN(paidAmt) || paidAmt <= 0) {
      toast({ variant: 'destructive', title: "Invalid Paid Amount", description: "Please enter a valid amount greater than 0." });
      return;
    }

    setIsSubmitting(true);
    try {
      const success = await markBillAsPaid(
        payBillTarget.id,
        user,
        paidAmt,
        !isNaN(nextAmt) && nextAmt > 0 ? nextAmt : undefined
      );

      if (success) {
        toast({
          title: "Bill Paid & Recorded",
          description: `Logged ₹${paidAmt.toLocaleString()} payment for ${payBillTarget.name}. Next cycle updated.`,
        });
        setIsPayBillModalOpen(false);
        setPayBillTarget(null);
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Failed to mark paid", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Undo Payment Handler
  const handleUndoPayment = async (billId: string, billName: string) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const matchingPaid = (paidBills || []).find(pb => pb.billId === billId || pb.name.toLowerCase() === billName.toLowerCase());
      const success = await undoBillPayment(matchingPaid?.id, billId, user);

      if (success) {
        toast({
          title: "Payment Undone",
          description: `Restored ${billName} as UNPAID for ${selectedMonthLabel}.`,
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Undo Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Undo Specific Paid History Record
  const handleUndoPaidRecord = async (paidRecordId: string, billId?: string, billName?: string) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const success = await undoBillPayment(paidRecordId, billId, user);
      if (success) {
        toast({
          title: "Payment Record Undone",
          description: `Removed payment record for ${billName || 'bill'}.`,
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Undo Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Undo Specific Salary Payment Record
  const handleUndoSalaryPayment = async (salaryPaymentId?: string, empId?: string, empName?: string) => {
    if (!user) return;
    setIsSubmitting(true);
    try {
      const success = await undoSalaryPayment(salaryPaymentId, empId, user);
      if (success) {
        toast({
          title: "Salary Payment Undone",
          description: `Restored ${empName || 'staff'} salary as UNPAID for ${selectedMonthLabel}.`,
        });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Undo Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Edit Salary Payment Modal
  const handleOpenEditSalaryPayment = (payment: SalaryPayment) => {
    setEditingSalaryPayment(payment);
    const pDate = new Date(payment.paidAt);
    const dateFormatted = !isNaN(pDate.getTime())
      ? `${pDate.toISOString().slice(0, 10)}T${pDate.toTimeString().slice(0, 5)}`
      : new Date().toISOString().slice(0, 16);

    setSalaryForm({
      employeeId: payment.employeeId,
      amountPaid: payment.amountPaid?.toString() || '0',
      cycleKey: payment.cycleKey || selectedCycleMonth,
      paidAt: dateFormatted,
      paymentMethod: payment.paymentMethod || 'UPI',
      note: payment.note || ''
    });
    setIsLogSalaryOpen(true);
  };

  // Open Direct Pay Staff Salary Modal (1-Click Mark Paid from Accounts Payable)
  const handleOpenPaySalaryModal = (emp: Employee, netAmount: number, cycleKey: string) => {
    setPaySalaryTarget(emp);
    setPaySalaryAmount(netAmount > 0 ? netAmount.toString() : (emp.salary || 0).toString());
    setPaySalaryMethod('UPI');
    setPaySalaryCycleKey(cycleKey || selectedCycleMonth);
    setPaySalaryNote(`Monthly salary payout for ${emp.displayName}`);
    setPaySalarySettleAdjustments(true);
    setIsPaySalaryModalOpen(true);
  };

  // Confirm Direct Salary Payout from Accounts Payable
  const handleConfirmPaySalary = async () => {
    if (!paySalaryTarget || !user) return;
    const amountNum = parseFloat(paySalaryAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: 'destructive', title: "Invalid Amount", description: "Please enter a valid salary amount." });
      return;
    }

    setIsSubmitting(true);
    try {
      const cycle = getCycleInfo(paySalaryTarget.joinDate, paySalaryTarget.lastSalaryPaidDate, paySalaryTarget.lastSalaryPaidCycle);
      const adjustments = paySalaryTarget.salaryAdjustments || [];
      const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
      const activeDeductions = adjustments.filter(a => a.status === 'active' && (a.type === 'deduction' || a.type === 'meal_overage')).reduce((s, a) => s + a.amount, 0);
      const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
      const baseSalary = paySalaryTarget.salary || amountNum;

      const settledTimestamp = new Date().toISOString();
      const updatedAdjustments = paySalarySettleAdjustments && adjustments.length > 0
        ? adjustments.map(a => a.status === 'active' ? { ...a, status: 'settled' as const, settledAt: settledTimestamp } : a)
        : adjustments;

      const employeeWithAdjustments: Employee = {
        ...paySalaryTarget,
        salaryAdjustments: updatedAdjustments
      };

      const paymentId = await recordSalaryPayment(
        employeeWithAdjustments,
        {
          amountPaid: amountNum,
          baseSalary,
          advancesSettled: activeAdvances,
          deductionsSettled: activeDeductions,
          bonusesAdded: activeBonuses,
          cycleKey: paySalaryCycleKey || cycle.scheduledCycleKey || cycle.currentCycleKey,
          paymentMethod: paySalaryMethod || 'UPI',
          note: paySalaryNote || 'Monthly salary cleared via Accounts Payable'
        },
        user
      );

      if (paymentId) {
        toast({
          title: "Salary Paid & Settled",
          description: `Successfully logged ₹${amountNum.toLocaleString()} payout for ${paySalaryTarget.displayName}. Moved to Accounts Paid.`
        });
        setIsPaySalaryModalOpen(false);
        setPaySalaryTarget(null);
      } else {
        toast({ variant: 'destructive', title: "Payment Failed", description: "Could not record salary payout." });
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Create Manual Salary Payment Modal
  const handleOpenAddSalaryPayment = (defaultEmpId?: string) => {
    setEditingSalaryPayment(null);
    const defaultEmp = (employees || []).find(e => e.id === defaultEmpId) || (employees || [])[0];
    const initialAmount = defaultEmp?.salary ? defaultEmp.salary.toString() : '';

    setSalaryForm({
      employeeId: defaultEmp?.id || '',
      amountPaid: initialAmount,
      cycleKey: selectedCycleMonth,
      paidAt: new Date().toISOString().slice(0, 16),
      paymentMethod: 'UPI',
      note: 'Salary paid via Owner Hub'
    });
    setIsLogSalaryOpen(true);
  };

  // Save (Create or Update) Salary Payment
  const handleSaveSalaryPayment = async () => {
    if (!user) return;
    const amountNum = parseFloat(salaryForm.amountPaid);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast({ variant: 'destructive', title: "Invalid Amount", description: "Please enter a valid salary amount." });
      return;
    }

    const emp = (employees || []).find(e => e.id === salaryForm.employeeId);
    if (!emp && !editingSalaryPayment) {
      toast({ variant: 'destructive', title: "Select Staff Member", description: "Please select an employee." });
      return;
    }

    setIsSubmitting(true);
    try {
      const paidDateISO = salaryForm.paidAt ? new Date(salaryForm.paidAt).toISOString() : new Date().toISOString();

      if (editingSalaryPayment) {
        const success = await updateSalaryPayment(editingSalaryPayment.id, {
          amountPaid: amountNum,
          cycleKey: salaryForm.cycleKey || selectedCycleMonth,
          paidAt: paidDateISO,
          paymentMethod: salaryForm.paymentMethod || 'UPI',
          note: salaryForm.note || ''
        }, user);

        if (success) {
          toast({
            title: "Salary Record Updated",
            description: `Updated salary payout record for ${editingSalaryPayment.employeeDisplayName}.`
          });
          setIsLogSalaryOpen(false);
          setEditingSalaryPayment(null);
        } else {
          toast({ variant: 'destructive', title: "Update Failed", description: "Could not update salary record." });
        }
      } else if (emp) {
        const paymentId = await recordManualSalaryPayment({
          employeeId: emp.id,
          employeeUsername: emp.username,
          employeeDisplayName: emp.displayName,
          amountPaid: amountNum,
          baseSalary: emp.salary || amountNum,
          cycleKey: salaryForm.cycleKey || selectedCycleMonth,
          paidAt: paidDateISO,
          paymentMethod: salaryForm.paymentMethod || 'UPI',
          note: salaryForm.note || 'Manual salary payment logged'
        }, user);

        if (paymentId) {
          toast({
            title: "Salary Payment Logged",
            description: `Recorded ₹${amountNum.toLocaleString()} salary for ${emp.displayName} (${salaryForm.cycleKey}).`
          });
          setIsLogSalaryOpen(false);
        } else {
          toast({ variant: 'destructive', title: "Save Failed", description: "Could not record salary payment." });
        }
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteBill = async (billId: string) => {
    try {
      await deleteFixedBill(billId);
      toast({ title: "Recurring Bill Removed" });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Delete Failed" });
    }
  };

  const handleOpenEditBill = (bill: FixedBill) => {
    setEditingBill(bill);
    const rawDate = new Date(bill.nextDueDate);
    const validDay = !isNaN(rawDate.getTime()) ? rawDate.getDate() : 1;
    setBillForm({
      name: bill.name,
      amount: bill.amount,
      repeatCycle: bill.repeatCycle,
      dueDayOfMonth: bill.dueDayOfMonth || validDay,
      nextDueDate: bill.nextDueDate.slice(0, 10),
      reminderDays: bill.reminderDays || 5,
      paymentMethod: bill.paymentMethod || 'UPI',
      isVariable: !!bill.isVariable || bill.name.toLowerCase().includes('light') || bill.name.toLowerCase().includes('internet'),
      notes: bill.notes || ''
    });
    setIsAddBillOpen(true);
  };

  const handleSaveBill = async () => {
    if (!billForm.name.trim() || !billForm.amount || !user) {
      toast({ variant: 'destructive', title: "Missing Fields", description: "Please enter a valid bill name and amount." });
      return;
    }

    setIsSubmitting(true);
    try {
      const now = new Date();
      const cycleDay = Number(billForm.dueDayOfMonth) || 1;
      const maxDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const validDay = Math.min(Math.max(1, cycleDay), maxDays);
      const computedDueDate = new Date(now.getFullYear(), now.getMonth(), validDay);

      const billData = {
        ...billForm,
        dueDayOfMonth: cycleDay,
        nextDueDate: computedDueDate.toISOString()
      };

      if (editingBill) {
        await updateFixedBill(editingBill.id, billData, user);
        toast({ title: "Recurring Bill Updated" });
      } else {
        await addFixedBill(billData, user);
        toast({ title: "Recurring Bill Added" });
      }
      setIsAddBillOpen(false);
      setEditingBill(null);
      setBillForm({
        name: '',
        amount: 0,
        repeatCycle: 'monthly',
        dueDayOfMonth: 1,
        nextDueDate: new Date().toISOString().slice(0, 10),
        reminderDays: 5,
        paymentMethod: 'UPI',
        isVariable: false,
        notes: ''
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveExpense = async () => {
    const amountNum = parseFloat(expenseForm.amount);
    if (isNaN(amountNum) || amountNum <= 0 || !expenseForm.description.trim() || !db || !user) {
      toast({ variant: 'destructive', title: "Invalid Input", description: "Please enter a valid amount and description." });
      return;
    }

    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'expenses'), {
        amount: amountNum,
        description: expenseForm.description.trim(),
        category: expenseForm.category,
        paymentMethod: expenseForm.paymentMethod,
        notes: expenseForm.notes.trim() || undefined,
        timestamp: new Date().toISOString(),
        addedBy: {
          uid: user.username,
          displayName: user.displayName
        }
      });

      await addDoc(collection(db, 'logs'), {
        type: 'EXPENSE_ADDED',
        description: `Viren logged expense of <strong>₹${amountNum.toLocaleString()}</strong>: ${expenseForm.description.trim()} (${expenseForm.category}).`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName }
      });

      toast({
        title: "Expense Logged",
        description: `Logged ₹${amountNum.toLocaleString()} for ${expenseForm.description}.`,
      });

      setIsLogExpenseOpen(false);
      setExpenseForm({
        amount: '',
        description: '',
        category: 'Food & Beverages',
        paymentMethod: 'upi',
        notes: ''
      });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Save Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteExpense = async (expenseId: string, desc: string) => {
    if (!db) return;
    try {
      await deleteDoc(doc(db, 'expenses', expenseId));
      toast({ title: "Expense Deleted", description: `Removed expense: ${desc}` });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Delete Failed" });
    }
  };

  const handleClearDebt = async (debtId: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'debts', debtId), {
        status: 'cleared',
        clearedAt: new Date().toISOString()
      });
      toast({ title: "Debt Cleared", description: "Marked payable debt as settled." });
    } catch (e: any) {
      toast({ variant: 'destructive', title: "Action Failed" });
    }
  };

  // Filtered due items by activeTab, paymentStatusFilter, urgencyFilter & searchFilter
  const filteredDueItems = useMemo(() => {
    return dueItems.filter(item => {
      if (searchFilter) {
        const queryStr = searchFilter.toLowerCase();
        const matchesName = item.title.toLowerCase().includes(queryStr);
        const matchesCat = item.category.toLowerCase().includes(queryStr);
        if (!matchesName && !matchesCat) return false;
      }

      // 1. Category Tab Filter
      if (activeTab === 'bills' && item.type !== 'bill') return false;
      if (activeTab === 'salaries' && item.type !== 'salary') return false;

      // 2. Payable vs Paid System Status Filter
      if (paymentStatusFilter === 'payable' && item.isPaidInSelectedMonth) return false;
      if (paymentStatusFilter === 'paid' && !item.isPaidInSelectedMonth) return false;

      // 3. Urgency Filter
      if (urgencyFilter === 'urgent') return !item.isPaidInSelectedMonth && (item.isOverdue || item.isDueToday || item.daysLeft <= 3);
      if (urgencyFilter === 'week') return !item.isPaidInSelectedMonth && (item.isOverdue || item.isDueToday || item.daysLeft <= 7);
      if (urgencyFilter === 'overdue') return !item.isPaidInSelectedMonth && (item.isOverdue || item.isDueToday);
      if (urgencyFilter === 'unpaid') return !item.isPaidInSelectedMonth;

      return true;
    });
  }, [dueItems, activeTab, paymentStatusFilter, urgencyFilter, searchFilter]);

  // Filtered logged expenses for selected month
  const filteredLoggedExpenses = useMemo(() => {
    const [selYear, selMonth] = selectedCycleMonth.split('-').map(Number);
    const targetMonthIndex = (isNaN(selMonth) ? new Date().getMonth() + 1 : selMonth) - 1;
    const targetYear = isNaN(selYear) ? new Date().getFullYear() : selYear;

    return (expenses || []).filter(exp => {
      const eDate = new Date(exp.timestamp);
      if (isNaN(eDate.getTime())) return false;
      if (eDate.getFullYear() !== targetYear || eDate.getMonth() !== targetMonthIndex) return false;

      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return exp.description.toLowerCase().includes(q) || (exp.category || '').toLowerCase().includes(q);
    });
  }, [expenses, searchFilter, selectedCycleMonth]);

  // Filtered paid bills history for selected month
  const filteredPaidBills = useMemo(() => {
    const [selYear, selMonth] = selectedCycleMonth.split('-').map(Number);
    const targetMonthIndex = (isNaN(selMonth) ? new Date().getMonth() + 1 : selMonth) - 1;
    const targetYear = isNaN(selYear) ? new Date().getFullYear() : selYear;

    return (paidBills || []).filter(pb => {
      const pDate = new Date(pb.paidAt);
      if (isNaN(pDate.getTime())) return false;
      if (pDate.getFullYear() !== targetYear || pDate.getMonth() !== targetMonthIndex) return false;

      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return pb.name.toLowerCase().includes(q) || (pb.paymentMethod || '').toLowerCase().includes(q);
    });
  }, [paidBills, searchFilter, selectedCycleMonth]);

  // Filtered salary payments history for selected month
  const filteredSalaryPayments = useMemo(() => {
    const [selYear, selMonth] = selectedCycleMonth.split('-').map(Number);
    const targetMonthIndex = (isNaN(selMonth) ? new Date().getMonth() + 1 : selMonth) - 1;
    const targetYear = isNaN(selYear) ? new Date().getFullYear() : selYear;
    const targetMonthString = `${targetYear}-${String(targetMonthIndex + 1).padStart(2, '0')}`;

    return (salaryPayments || []).filter(sp => {
      const pDate = new Date(sp.paidAt);
      if (isNaN(pDate.getTime())) return false;
      const matchesMonth = (pDate.getFullYear() === targetYear && pDate.getMonth() === targetMonthIndex) || (sp.cycleKey && sp.cycleKey.includes(targetMonthString));
      if (!matchesMonth) return false;

      if (!searchFilter) return true;
      const q = searchFilter.toLowerCase();
      return (
        sp.employeeDisplayName.toLowerCase().includes(q) ||
        sp.employeeUsername.toLowerCase().includes(q) ||
        (sp.note || '').toLowerCase().includes(q) ||
        (sp.paymentMethod || '').toLowerCase().includes(q)
      );
    });
  }, [salaryPayments, searchFilter, selectedCycleMonth]);

  // Unified overall payments history across Paid Bills, Staff Salaries & Logged Expenses
  const unifiedPayments = useMemo(() => {
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
      note?: string;
      raw: any;
    }> = [];

    // 1. Add Paid Recurring Bills
    filteredPaidBills.forEach(pb => {
      list.push({
        id: `pb-${pb.id}`,
        type: 'bill',
        title: pb.name,
        category: `${pb.repeatCycle || 'Monthly'} Bill`,
        amount: pb.amountPaid || 0,
        paidAt: pb.paidAt,
        paidAtDate: new Date(pb.paidAt),
        paidBy: pb.paidBy?.displayName || 'Viren',
        paymentMethod: pb.paymentMethod || 'UPI',
        note: pb.isVariable ? 'Variable Rate' : undefined,
        raw: pb
      });
    });

    // 2. Add Staff Salaries Paid
    filteredSalaryPayments.forEach(sp => {
      list.push({
        id: `sp-${sp.id}`,
        type: 'salary',
        title: `${sp.employeeDisplayName}'s Salary`,
        category: 'Staff Salary Payout',
        amount: sp.amountPaid || 0,
        paidAt: sp.paidAt,
        paidAtDate: new Date(sp.paidAt),
        paidBy: sp.paidBy?.displayName || 'Viren',
        paymentMethod: sp.paymentMethod || 'UPI / Cash',
        note: sp.note || `Cycle: ${sp.cycleKey}`,
        raw: sp
      });
    });

    // 3. Add Logged Expenses
    filteredLoggedExpenses.forEach(exp => {
      list.push({
        id: `exp-${exp.id}`,
        type: 'expense',
        title: exp.description,
        category: exp.category || 'Operational Expense',
        amount: exp.amount || 0,
        paidAt: exp.timestamp,
        paidAtDate: new Date(exp.timestamp),
        paidBy: exp.addedBy?.displayName || 'Viren',
        paymentMethod: exp.paymentMethod || 'UPI',
        note: exp.notes,
        raw: exp
      });
    });

    return list.sort((a, b) => b.paidAtDate.getTime() - a.paidAtDate.getTime());
  }, [filteredPaidBills, filteredSalaryPayments, filteredLoggedExpenses]);

  // Available Month Cycle Selector options
  const monthOptions = useMemo(() => {
    const options: Array<{ key: string; label: string }> = [];
    const now = new Date();
    for (let i = -6; i <= 3; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const key = d.toISOString().slice(0, 7);
      const label = safeFormatDate(d, 'MMMM yyyy') + (key === currentMonthKey ? ' (Current Month)' : '');
      options.push({ key, label });
    }
    return options;
  }, [currentMonthKey]);

  return (
    <section className="space-y-6 font-body">
      {/* 1. TOP EXECUTIVE EXPENSES & DUE DATES HEADER */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-400">
              <Receipt className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-headline uppercase tracking-wider text-foreground flex items-center gap-2">
                ACCOUNTS PAYABLE &bull; UPCOMING DUE OBLIGATIONS
              </h2>
              <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">
                PAYABLE SYSTEM &bull; RECURRING BILLS &bull; STAFF SALARIES &bull; DISBURSEMENTS DUE
              </p>
            </div>
          </div>
        </div>

        {/* MONTH SELECTOR & PRIMARY ACTIONS */}
        <div className="flex flex-wrap items-center gap-2">
          {/* MONTH CYCLE SELECTOR DROPDOWN */}
          <div className="flex items-center gap-1.5 bg-muted/30 p-1 rounded-xl border border-border/50">
            <Filter className="h-4 w-4 text-rose-400 pl-1" />
            <Select value={selectedCycleMonth} onValueChange={setSelectedCycleMonth}>
              <SelectTrigger className="w-[180px] h-9 text-xs font-extrabold uppercase border-none bg-transparent focus:ring-0">
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

          <Button
            onClick={() => setIsLogExpenseOpen(true)}
            className="h-10 px-4 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs uppercase tracking-wider gap-2 shadow-lg rounded-xl"
          >
            <Plus className="h-4 w-4" /> + Log Expense
          </Button>

          <Button
            onClick={() => {
              setEditingBill(null);
              setBillForm({
                name: '',
                amount: 0,
                repeatCycle: 'monthly',
                dueDayOfMonth: 1,
                nextDueDate: new Date().toISOString().slice(0, 10),
                reminderDays: 5,
                paymentMethod: 'UPI',
                isVariable: false,
                notes: ''
              });
              setIsAddBillOpen(true);
            }}
            variant="outline"
            className="h-10 px-4 border-rose-500/30 text-rose-400 hover:bg-rose-500/10 font-bold text-xs uppercase tracking-wider gap-2 rounded-xl"
          >
            <Calendar className="h-4 w-4" /> + New Recurring Bill
          </Button>

          <Button
            onClick={() => handleOpenAddSalaryPayment()}
            variant="outline"
            className="h-10 px-4 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10 font-bold text-xs uppercase tracking-wider gap-2 rounded-xl"
          >
            <Building className="h-4 w-4 text-indigo-400" /> + Log Salary Payout
          </Button>
        </div>
      </div>

      {/* 2. EXECUTIVE METRICS CARDS FOR SELECTED MONTH */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* CARD 1: TOTAL ACCOUNTS PAYABLE */}
        <Card className="border-2 border-emerald-500/60 bg-emerald-950/20 shadow-emerald-950/20 p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <Wallet className="h-4 w-4 text-emerald-400" /> Total Accounts Payable
            </span>
            <Badge className="bg-emerald-500 text-white font-extrabold text-[10px]">
              {financialSummary.dueItemsCount} DUES PENDING
            </Badge>
          </div>
          <div>
            <p className="text-3xl font-extrabold font-mono text-emerald-400">
              ₹{financialSummary.totalMoneyToSpendStill.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold uppercase mt-0.5">
              {selectedMonthLabel} Payable Commitments
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/40">
            Unpaid Dues for {selectedMonthLabel}
          </div>
        </Card>

        {/* CARD 2: URGENT / OVERDUE DUES */}
        <Card className={cn(
          "border-2 transition-all p-4 flex flex-col justify-between space-y-2 bg-card/80 backdrop-blur-sm shadow-md",
          financialSummary.overdueCount > 0 || financialSummary.dueTodayCount > 0
            ? "border-rose-500/60 bg-rose-950/20 shadow-rose-950/20"
            : "border-border/60"
        )}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-rose-400 flex items-center gap-1.5">
              <ShieldAlert className="h-4 w-4 text-rose-400" /> Urgent &amp; Overdue Payables
            </span>
            {(financialSummary.overdueCount > 0 || financialSummary.dueTodayCount > 0) ? (
              <Badge className="bg-rose-500 text-white font-extrabold text-[10px] animate-pulse">
                {financialSummary.overdueCount + financialSummary.dueTodayCount} ACTION REQUIRED
              </Badge>
            ) : (
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">
                ALL CLEAR
              </Badge>
            )}
          </div>
          <div>
            <p className="text-2xl font-extrabold font-mono text-rose-400">
              ₹{financialSummary.urgentAmount.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold uppercase mt-0.5">
              {financialSummary.overdueCount} Overdue &bull; {financialSummary.dueTodayCount} Due Today
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/40">
            Immediate Attention Required
          </div>
        </Card>

        {/* CARD 3: RECURRING FIXED & VARIABLE BILLS */}
        <Card className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-md p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-amber-400" /> Bills Payable
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-400">
              {(fixedBills || []).length} BILLS
            </Badge>
          </div>
          <div>
            <p className="text-2xl font-extrabold font-mono text-amber-400">
              ₹{financialSummary.fixedBillsTotal.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold uppercase mt-0.5">
              Light Bill, Internet &amp; Utilities Due
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/40">
            Pending Overheads for {selectedMonthLabel}
          </div>
        </Card>

        {/* CARD 4: STAFF SALARIES PAYABLE */}
        <Card className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-md p-4 flex flex-col justify-between space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Building className="h-4 w-4 text-indigo-400" /> Salaries Payable
            </span>
            <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-400">
              {(employees || []).filter(e => e.username?.toLowerCase() !== 'viren').length} STAFF
            </Badge>
          </div>
          <div>
            <p className="text-2xl font-extrabold font-mono text-indigo-400">
              ₹{financialSummary.totalStaffSalaryNet.toLocaleString()}
            </p>
            <p className="text-[11px] text-muted-foreground font-bold uppercase mt-0.5 truncate">
              Net Staff Payroll Outstanding
            </p>
          </div>
          <div className="text-[10px] text-muted-foreground font-mono pt-1 border-t border-border/40">
            Pending Salaries for {selectedMonthLabel}
          </div>
        </Card>
      </div>

      {/* 3. DUE DATES MANAGEMENT COMMAND CENTER */}
      <Card className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-lg overflow-hidden">
        <div className="bg-muted/20 border-b border-border/40 p-4 space-y-3.5">
          {/* TOP BAR: HEADER & SEARCH */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <Layers className="h-4 w-4 text-primary" /> Command Center Navigation:
              </span>
            </div>

            {/* SEARCH INPUT */}
            <div className="relative w-full sm:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchFilter}
                onChange={e => setSearchFilter(e.target.value)}
                placeholder="Search bills, salaries, expenses..."
                className="pl-9 h-9 text-xs font-bold uppercase bg-background/70 border-border/70 shadow-sm"
              />
            </div>
          </div>

          {/* PROMINENT NAVIGATION & STATUS CONTROLS - PAYABLE / PAID ARCHITECTURE */}
          <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3 bg-muted/40 p-2 border border-border/60 rounded-xl">
            {/* 1. PRIMARY SYSTEM STATUS SWITCHER: PAYABLE VS PAID */}
            <div className="flex items-center gap-1.5 p-1 bg-black/40 rounded-lg border border-border/60">
              <button
                type="button"
                onClick={() => setPaymentStatusFilter('payable')}
                className={cn(
                  "h-8 px-3.5 text-xs font-black uppercase tracking-wider gap-1.5 rounded-md border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  paymentStatusFilter === 'payable'
                    ? "bg-amber-500 text-black border-amber-400 shadow-lg shadow-amber-500/20 font-black ring-1 ring-amber-300"
                    : "bg-transparent text-muted-foreground border-transparent hover:text-white"
                )}
              >
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>⏳ Payable / Due ({dueItems.filter(i => !i.isPaidInSelectedMonth).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatusFilter('paid')}
                className={cn(
                  "h-8 px-3.5 text-xs font-black uppercase tracking-wider gap-1.5 rounded-md border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  paymentStatusFilter === 'paid'
                    ? "bg-emerald-600 text-white border-emerald-400 shadow-lg shadow-emerald-600/30 font-black ring-1 ring-emerald-300"
                    : "bg-transparent text-muted-foreground border-transparent hover:text-white"
                )}
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                <span>✅ Paid This Cycle ({dueItems.filter(i => i.isPaidInSelectedMonth).length})</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentStatusFilter('all')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase tracking-wider gap-1.5 rounded-md border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  paymentStatusFilter === 'all'
                    ? "bg-white text-zinc-950 border-white shadow-md font-black"
                    : "bg-transparent text-muted-foreground border-transparent hover:text-white"
                )}
              >
                <Layers className="h-3.5 w-3.5 shrink-0" />
                <span>All ({dueItems.length})</span>
              </button>
            </div>

            {/* 2. CATEGORY TABS */}
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab('all')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase tracking-wider gap-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  activeTab === 'all'
                    ? "bg-zinc-800 text-white border-zinc-600 shadow-sm font-black"
                    : "bg-background/60 text-muted-foreground border-border/50 hover:bg-muted hover:text-white"
                )}
              >
                <Layers className="h-3.5 w-3.5 text-amber-400" />
                <span>All Categories</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('bills')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase tracking-wider gap-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  activeTab === 'bills'
                    ? "bg-sky-500 text-white border-sky-400 shadow-md ring-1 ring-sky-300/50 font-black"
                    : "bg-background/60 text-muted-foreground border-border/50 hover:bg-muted hover:text-white"
                )}
              >
                <Receipt className="h-3.5 w-3.5 text-sky-400" />
                <span>Bills</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('salaries')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase tracking-wider gap-1.5 rounded-lg border transition-all inline-flex items-center justify-center cursor-pointer select-none",
                  activeTab === 'salaries'
                    ? "bg-indigo-600 text-white border-indigo-400 shadow-md ring-1 ring-indigo-300/50 font-black"
                    : "bg-background/60 text-muted-foreground border-border/50 hover:bg-muted hover:text-white"
                )}
              >
                <Building className="h-3.5 w-3.5 text-indigo-400" />
                <span>Salaries</span>
              </button>
            </div>
          </div>
        </div>

        {/* QUICK URGENCY FILTER BAR FOR DUE ITEMS */}
        <div className="flex items-center gap-2 p-3 bg-muted/15 border-b border-border/40 overflow-x-auto">
            <span className="text-xs font-black uppercase text-muted-foreground tracking-wider shrink-0 flex items-center gap-1 mr-1">
              <Filter className="h-3.5 w-3.5 text-rose-400" /> Urgency Filter:
            </span>

            <Button
              size="sm"
              variant={urgencyFilter === 'all' ? 'default' : 'outline'}
              onClick={() => setUrgencyFilter('all')}
              className={cn(
                "h-8 px-3 text-xs font-black uppercase rounded-lg transition-all",
                urgencyFilter === 'all'
                  ? "bg-rose-600 text-white shadow-md shadow-rose-900/30 ring-1 ring-rose-400"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              All Urgencies
            </Button>

            <Button
              size="sm"
              variant={urgencyFilter === 'urgent' ? 'default' : 'outline'}
              onClick={() => setUrgencyFilter('urgent')}
              className={cn(
                "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 transition-all",
                urgencyFilter === 'urgent'
                  ? "bg-amber-500 text-black font-black shadow-md ring-1 ring-amber-300"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              🔥 Urgent ≤3 Days ({dueItems.filter(i => !i.isPaidInSelectedMonth && (i.isOverdue || i.isDueToday || i.daysLeft <= 3)).length})
            </Button>

            <Button
              size="sm"
              variant={urgencyFilter === 'week' ? 'default' : 'outline'}
              onClick={() => setUrgencyFilter('week')}
              className={cn(
                "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 transition-all",
                urgencyFilter === 'week'
                  ? "bg-yellow-500 text-black font-black shadow-md ring-1 ring-yellow-300"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              ⏳ This Week ≤7 Days ({dueItems.filter(i => !i.isPaidInSelectedMonth && (i.isOverdue || i.isDueToday || i.daysLeft <= 7)).length})
            </Button>

            {dueItems.some(i => !i.isPaidInSelectedMonth && (i.isOverdue || i.isDueToday)) && (
              <Button
                size="sm"
                variant={urgencyFilter === 'overdue' ? 'default' : 'outline'}
                onClick={() => setUrgencyFilter('overdue')}
                className={cn(
                  "h-8 px-3 text-xs font-black uppercase rounded-lg gap-1.5 animate-pulse transition-all",
                  urgencyFilter === 'overdue'
                    ? "bg-rose-600 text-white shadow-md ring-1 ring-rose-300"
                    : "border-rose-500/50 text-rose-400 bg-rose-950/20 hover:bg-rose-950/40"
                )}
              >
                🚨 Overdue / Today ({dueItems.filter(i => !i.isPaidInSelectedMonth && (i.isOverdue || i.isDueToday)).length})
              </Button>
            )}

            <Button
              size="sm"
              variant={urgencyFilter === 'unpaid' ? 'default' : 'outline'}
              onClick={() => setUrgencyFilter('unpaid')}
              className={cn(
                "h-8 px-3 text-xs font-black uppercase rounded-lg transition-all",
                urgencyFilter === 'unpaid'
                  ? "bg-emerald-600 text-white shadow-md shadow-emerald-900/30 ring-1 ring-emerald-400"
                  : "bg-background/80 text-foreground border-border/70 hover:bg-muted"
              )}
            >
              Unpaid Only ({financialSummary.dueItemsCount})
            </Button>
          </div>

        <div>
          {/* TAB CONTENT: DUE ITEMS (ALL / BILLS / SALARIES) */}
          <div className="p-4 space-y-3">
              {filteredDueItems.length === 0 ? (
                <div className="p-12 text-center text-muted-foreground font-bold uppercase text-xs space-y-2">
                  <CheckCircle2 className="h-8 w-8 mx-auto text-emerald-400/60" />
                  <p>
                    {paymentStatusFilter === 'payable'
                      ? `All obligations settled for ${selectedMonthLabel}! No payable items remaining.`
                      : paymentStatusFilter === 'paid'
                      ? `No payments settled yet for ${selectedMonthLabel}.`
                      : `No items match your filter for ${selectedMonthLabel}.`}
                  </p>
                </div>
              ) : (
                filteredDueItems.map((item) => {
                  const urgency = getUrgencyConfig(item);
                  return (
                    <div
                      key={item.id}
                      className={cn(
                        "p-4 rounded-xl border transition-all duration-200 shadow-sm hover:shadow-md flex flex-col md:flex-row md:items-center justify-between gap-4 relative overflow-hidden",
                        urgency.cardClass
                      )}
                    >
                      {/* Item Info & Urgency Indicator */}
                      <div className="flex items-start gap-3.5 flex-1 min-w-0">
                        <div className={cn("p-3 rounded-xl border shrink-0 mt-0.5 shadow-sm", urgency.iconClass)}>
                          {urgency.icon}
                        </div>

                        <div className="space-y-1.5 flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-extrabold text-sm md:text-base uppercase tracking-tight text-foreground">
                              {item.title}
                            </h4>
                            <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase border-border/60 bg-background/50">
                              {item.category}
                            </Badge>
                            <Badge variant="outline" className="text-[9px] font-mono font-bold uppercase border-indigo-500/30 text-indigo-400 bg-indigo-950/20">
                              Cycle: Day {item.cycleDay}
                            </Badge>
                            {item.isVariable && (
                              <Badge className="text-[9px] font-mono font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1">
                                <Zap className="h-3 w-3 text-amber-400" /> VARIABLE RATE
                              </Badge>
                            )}
                            {item.paymentMethod && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                &bull; {item.paymentMethod}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
                            <span className="text-muted-foreground flex items-center gap-1.5">
                              <Calendar className="h-3.5 w-3.5 text-muted-foreground" /> Due Date: <strong className="text-foreground">{item.dueDateFormatted}</strong>
                            </span>

                            <Badge className={cn("text-[10px] font-mono font-extrabold uppercase px-2.5 py-0.5 shadow-sm", urgency.badgeClass)}>
                              {urgency.label}
                            </Badge>
                          </div>

                          {/* Urgency Progress Bar / Timeline */}
                          {!item.isPaidInSelectedMonth && (
                            <div className="w-full max-w-md pt-1">
                              <div className="flex justify-between text-[9px] font-mono text-muted-foreground mb-0.5">
                                <span>Cycle Timeline</span>
                                <span className="font-bold">{urgency.progressPct}% Urgency</span>
                              </div>
                              <div className="w-full h-1.5 bg-black/40 rounded-full overflow-hidden border border-white/5">
                                <div
                                  className={cn("h-full transition-all duration-500 rounded-full", urgency.progressColor)}
                                  style={{ width: `${urgency.progressPct}%` }}
                                />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right Section: Amount & Actions */}
                      <div className="flex items-center justify-between md:justify-end gap-4 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-border/40">
                        <div className="text-right">
                          <p className="text-[10px] uppercase font-extrabold text-muted-foreground tracking-wider">
                            {item.isPaidInSelectedMonth ? 'Amount Settled' : 'Amount Due'}
                          </p>
                          <p className={cn("font-mono font-extrabold tracking-tight", urgency.amountClass)}>
                            ₹{item.amount.toLocaleString()}
                          </p>
                        </div>

                        {/* Action Triggers */}
                        <div className="flex items-center gap-2">
                          {item.type === 'bill' && (
                            <>
                              {item.isPaidInSelectedMonth ? (
                                <Button
                                  size="sm"
                                  disabled={isSubmitting}
                                  onClick={() => handleUndoPayment(item.id, item.title)}
                                  className="h-9 px-3.5 text-xs font-bold uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 gap-1.5 rounded-lg shadow-sm active:scale-95 transition-all"
                                  title="Undo Payment for this Month"
                                >
                                  <RotateCcw className="h-4 w-4" /> Undo Payment
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  onClick={() => handleOpenPayBillModal(item.raw)}
                                  className="h-9 px-4 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 rounded-lg shadow-md shadow-emerald-900/40 active:scale-95 transition-all"
                                  title="Mark Bill Paid"
                                >
                                  <CheckCircle2 className="h-4 w-4" /> Mark Paid
                                </Button>
                              )}

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleOpenEditBill(item.raw)}
                                className="h-9 w-9 text-muted-foreground hover:text-primary rounded-lg border border-border/40 bg-background/40 hover:bg-muted"
                                title="Edit Bill"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteBill(item.id)}
                                className="h-9 w-9 text-muted-foreground hover:text-rose-400 rounded-lg border border-border/40 bg-background/40 hover:bg-muted"
                                title="Delete Bill"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}

                          {item.type === 'salary' && (
                            <div className="flex items-center gap-2">
                              {item.isPaidInSelectedMonth ? (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={isSubmitting}
                                    onClick={() => handleUndoSalaryPayment(item.raw?.matchingSalaryPayment?.id, item.raw?.id, item.title)}
                                    className="h-9 px-3.5 text-xs font-bold uppercase bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 gap-1.5 rounded-lg shadow-sm active:scale-95 transition-all"
                                    title="Undo Salary Settlement for this Cycle"
                                  >
                                    <RotateCcw className="h-4 w-4" /> Undo Payment
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const empElement = document.getElementById(`emp-card-${item.raw.id}`);
                                      if (empElement) {
                                        empElement.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }}
                                    className="h-9 px-3 text-xs font-bold uppercase border-indigo-500/40 text-indigo-300 bg-indigo-950/20 hover:bg-indigo-600/30 gap-1 rounded-lg shadow-sm"
                                    title="View Staff Profile Card"
                                  >
                                    <Building className="h-3.5 w-3.5" /> Staff Card
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    size="sm"
                                    disabled={isSubmitting}
                                    onClick={() => {
                                      const cycle = getCycleInfo(item.raw.joinDate, item.raw.lastSalaryPaidDate, item.raw.lastSalaryPaidCycle);
                                      handleOpenPaySalaryModal(item.raw, item.amount, cycle.scheduledCycleKey || cycle.currentCycleKey);
                                    }}
                                    className="h-9 px-4 text-xs font-black uppercase bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 rounded-lg shadow-md shadow-emerald-900/40 active:scale-95 transition-all"
                                    title="Mark Salary Paid"
                                  >
                                    <CheckCircle2 className="h-4 w-4" /> Mark Paid
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => {
                                      const empElement = document.getElementById(`emp-card-${item.raw.id}`);
                                      if (empElement) {
                                        empElement.scrollIntoView({ behavior: 'smooth' });
                                      }
                                    }}
                                    className="h-9 px-3 text-xs font-bold uppercase border-indigo-500/40 text-indigo-300 bg-indigo-950/20 hover:bg-indigo-600/30 gap-1 rounded-lg shadow-sm"
                                    title="View Staff Profile Card"
                                  >
                                    <Building className="h-3.5 w-3.5" /> Staff Card
                                  </Button>
                                </>
                              )}
                            </div>
                          )}

                          {item.type === 'debt' && (
                            <Button
                              size="sm"
                              disabled={item.isPaidInSelectedMonth}
                              onClick={() => handleClearDebt(item.id)}
                              className="h-9 px-3.5 text-xs font-bold uppercase bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 rounded-lg shadow-sm"
                            >
                              <Check className="h-4 w-4" /> {item.isPaidInSelectedMonth ? "Cleared" : "Clear Debt"}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
        </div>
      </Card>

      {/* MODAL 0: MARK BILL PAID (HANDLES VARIABLE BILL AMOUNTS) */}
      <Dialog open={isPayBillModalOpen} onOpenChange={setIsPayBillModalOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <CheckCircle2 className="text-emerald-500" /> Confirm Bill Payment
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              {payBillTarget?.name} &bull; Enter actual amount paid for this cycle.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1">
              <p className="text-xs font-extrabold uppercase text-foreground">{payBillTarget?.name}</p>
              <p className="text-[11px] text-muted-foreground font-mono">
                Monthly Cycle: Day {payBillTarget?.dueDayOfMonth || 1} &bull; Method: {payBillTarget?.paymentMethod}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Actual Amount Paid This Cycle (₹)
              </Label>
              <Input
                type="number"
                value={payBillAmount}
                onChange={e => setPayBillAmount(e.target.value)}
                placeholder="Enter paid amount"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            {(payBillTarget?.isVariable || payBillTarget?.name.toLowerCase().includes('light') || payBillTarget?.name.toLowerCase().includes('internet')) && (
              <div className="space-y-1.5 pt-2 border-t border-border/40">
                <Label className="text-xs font-bold uppercase text-amber-400 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Next Cycle Expected Base Amount (₹)
                </Label>
                <Input
                  type="number"
                  value={payBillNextAmount}
                  onChange={e => setPayBillNextAmount(e.target.value)}
                  placeholder="Estimated amount for next bill"
                  className="font-mono font-bold h-10"
                />
                <p className="text-[10px] text-muted-foreground">
                  This updates the bill estimate for the next upcoming cycle.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsPayBillModalOpen(false)} className="h-11 font-bold text-xs uppercase">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPayBill}
              disabled={isSubmitting}
              className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-wider shadow-lg flex-1"
            >
              {isSubmitting ? 'Recording Payment...' : 'Confirm Paid & Recycle Date'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 0.5: MARK SALARY PAID (ACCOUNTS PAYABLE SYSTEM) */}
      <Dialog open={isPaySalaryModalOpen} onOpenChange={setIsPaySalaryModalOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Confirm Staff Salary Payout
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              {paySalaryTarget?.displayName} &bull; Settle payroll and record to Accounts Paid.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Staff info & Base Salary */}
            <div className="p-3.5 rounded-xl bg-muted/20 border border-border/40 space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-extrabold uppercase text-sm text-foreground">{paySalaryTarget?.displayName}</h4>
                  <p className="text-[10px] text-muted-foreground font-mono">@{paySalaryTarget?.username} &bull; {paySalaryTarget?.role}</p>
                </div>
                <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 font-mono text-[10px]">
                  Cycle: {paySalaryCycleKey}
                </Badge>
              </div>

              {/* Adjustments Breakdown */}
              {paySalaryTarget && (() => {
                const adjustments = paySalaryTarget.salaryAdjustments || [];
                const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
                const activeDeductions = adjustments.filter(a => a.status === 'active' && (a.type === 'deduction' || a.type === 'meal_overage')).reduce((s, a) => s + a.amount, 0);
                const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
                return (
                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/30 text-[10px] font-mono">
                    <div>
                      <span className="text-muted-foreground block">Base Salary:</span>
                      <strong className="text-foreground">₹{(paySalaryTarget.salary || 0).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Deductions/Adv:</span>
                      <strong className="text-rose-400">-₹{(activeAdvances + activeDeductions).toLocaleString()}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Bonuses:</span>
                      <strong className="text-emerald-400">+₹{activeBonuses.toLocaleString()}</strong>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Payout Amount Field */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">
                Net Salary Payout Amount (₹)
              </Label>
              <Input
                type="number"
                value={paySalaryAmount}
                onChange={e => setPaySalaryAmount(e.target.value)}
                placeholder="Enter payout amount"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            {/* Payment Method */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Method</Label>
              <Select value={paySalaryMethod} onValueChange={setPaySalaryMethod}>
                <SelectTrigger className="font-bold text-xs uppercase h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="UPI" className="text-xs uppercase font-bold">UPI (GPay / PhonePe / Paytm)</SelectItem>
                  <SelectItem value="Cash" className="text-xs uppercase font-bold">Cash</SelectItem>
                  <SelectItem value="Bank Transfer" className="text-xs uppercase font-bold">Bank Transfer (NEFT/IMPS)</SelectItem>
                  <SelectItem value="Cheque" className="text-xs uppercase font-bold">Cheque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Note / Memo */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Memo / Note</Label>
              <Input
                value={paySalaryNote}
                onChange={e => setPaySalaryNote(e.target.value)}
                placeholder="e.g. Monthly salary payout cleared"
                className="font-medium text-xs h-10"
              />
            </div>

            {/* Settle Active Adjustments Toggle */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-foreground">
                  Mark Active Advances &amp; Deductions Settled
                </Label>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Automatically clears active advances &amp; meal overages with this payout.
                </p>
              </div>
              <Switch
                checked={paySalarySettleAdjustments}
                onCheckedChange={setPaySalarySettleAdjustments}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setIsPaySalaryModalOpen(false)} className="h-11 font-bold text-xs uppercase">
              Cancel
            </Button>
            <Button
              onClick={handleConfirmPaySalary}
              disabled={isSubmitting}
              className="h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase text-xs tracking-wider shadow-lg flex-1"
            >
              {isSubmitting ? 'Recording Payout...' : 'Confirm Paid & Move to Paid Hub'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 1: LOG ONE-TIME OPERATIONAL EXPENSE */}
      <Dialog open={isLogExpenseOpen} onOpenChange={setIsLogExpenseOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <Plus className="text-rose-500" /> Log Operational Expense
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Record a new cash or UPI expense directly into the Bistro ledger.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Amount (₹)</Label>
              <Input
                type="number"
                value={expenseForm.amount}
                onChange={e => setExpenseForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="e.g. 1500"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Description</Label>
              <Input
                value={expenseForm.description}
                onChange={e => setExpenseForm(p => ({ ...p, description: e.target.value }))}
                placeholder="e.g. Purchased Coffee Beans & Fresh Milk"
                className="font-bold text-sm uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Category</Label>
                <Select value={expenseForm.category} onValueChange={v => setExpenseForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="font-bold text-xs uppercase h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Food &amp; Beverages" className="text-xs uppercase font-bold">Food &amp; Beverages</SelectItem>
                    <SelectItem value="Utilities" className="text-xs uppercase font-bold">Utilities</SelectItem>
                    <SelectItem value="Maintenance" className="text-xs uppercase font-bold">Maintenance</SelectItem>
                    <SelectItem value="Software &amp; Subscriptions" className="text-xs uppercase font-bold">Software</SelectItem>
                    <SelectItem value="Wastage" className="text-xs uppercase font-bold">Wastage</SelectItem>
                    <SelectItem value="Marketing" className="text-xs uppercase font-bold">Marketing</SelectItem>
                    <SelectItem value="Misc" className="text-xs uppercase font-bold">Misc</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Method</Label>
                <Select value={expenseForm.paymentMethod} onValueChange={(v: any) => setExpenseForm(p => ({ ...p, paymentMethod: v }))}>
                  <SelectTrigger className="font-bold text-xs uppercase h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upi" className="text-xs uppercase font-bold">UPI</SelectItem>
                    <SelectItem value="cash" className="text-xs uppercase font-bold">Cash</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Optional Notes</Label>
              <Input
                value={expenseForm.notes}
                onChange={e => setExpenseForm(p => ({ ...p, notes: e.target.value }))}
                placeholder="Additional details or vendor info"
                className="font-medium text-xs"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveExpense}
              disabled={isSubmitting}
              className="w-full h-12 bg-rose-600 hover:bg-rose-700 text-white font-bold uppercase text-xs tracking-wider shadow-lg"
            >
              {isSubmitting ? 'Logging...' : 'Save Expense Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: ADD / EDIT RECURRING FIXED BILL */}
      <Dialog open={isAddBillOpen} onOpenChange={setIsAddBillOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <Calendar className="text-amber-500" />
              {editingBill ? 'Modify Recurring Bill' : 'Setup Recurring Bill'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Define recurring operational overhead with automated due dates.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Bill Name</Label>
              <Input
                value={billForm.name}
                onChange={e => setBillForm(p => ({ ...p, name: e.target.value }))}
                placeholder="e.g. WiFi Broadband / Electricity"
                className="font-bold text-sm uppercase"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Amount (₹)</Label>
                <Input
                  type="number"
                  value={billForm.amount || ''}
                  onChange={e => setBillForm(p => ({ ...p, amount: Number(e.target.value) }))}
                  placeholder="0"
                  className="font-mono font-bold h-10"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Repeat Cycle</Label>
                <Select value={billForm.repeatCycle} onValueChange={(v: RepeatCycle) => setBillForm(p => ({ ...p, repeatCycle: v }))}>
                  <SelectTrigger className="font-bold text-xs uppercase h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily" className="text-xs uppercase font-bold">Daily</SelectItem>
                    <SelectItem value="weekly" className="text-xs uppercase font-bold">Weekly</SelectItem>
                    <SelectItem value="monthly" className="text-xs uppercase font-bold">Monthly</SelectItem>
                    <SelectItem value="yearly" className="text-xs uppercase font-bold">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Monthly Cycle Day (1-31)</Label>
                <Input
                  type="number"
                  min={1}
                  max={31}
                  value={billForm.dueDayOfMonth || 1}
                  onChange={e => setBillForm(p => ({ ...p, dueDayOfMonth: Number(e.target.value) }))}
                  placeholder="e.g. 1st or 15th"
                  className="font-mono font-bold h-10 text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Method</Label>
                <Input
                  value={billForm.paymentMethod}
                  onChange={e => setBillForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  placeholder="UPI / Cash"
                  className="font-bold text-xs uppercase h-10"
                />
              </div>
            </div>

            {/* VARIABLE BILL TOGGLE */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/20 border border-border/40">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold uppercase text-foreground flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5 text-amber-400" /> Variable Amount Bill
                </Label>
                <p className="text-[10px] text-muted-foreground font-medium">
                  Enable if price changes each cycle (e.g. Light &amp; Internet bills).
                </p>
              </div>
              <Switch
                checked={billForm.isVariable}
                onCheckedChange={checked => setBillForm(p => ({ ...p, isVariable: checked }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleSaveBill}
              disabled={isSubmitting}
              className="w-full h-12 font-bold uppercase text-xs tracking-wider shadow-lg"
            >
              {editingBill ? 'Save Changes' : 'Create Recurring Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: LOG & EDIT SALARY PAYOUT */}
      <Dialog open={isLogSalaryOpen} onOpenChange={setIsLogSalaryOpen}>
        <DialogContent className="sm:max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl flex items-center gap-2">
              <Building className="text-indigo-400" /> {editingSalaryPayment ? 'Edit Salary Payment' : 'Log Staff Salary Payout'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              {editingSalaryPayment ? `Modify recorded payout for ${editingSalaryPayment.employeeDisplayName}` : 'Record a new salary payment for your staff roster'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* Employee Selector (or locked display if editing) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Staff Member</Label>
              {editingSalaryPayment ? (
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                  <div>
                    <p className="font-extrabold uppercase text-sm text-foreground">{editingSalaryPayment.employeeDisplayName}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">@{editingSalaryPayment.employeeUsername}</p>
                  </div>
                  <Badge variant="outline" className="border-indigo-500/30 text-indigo-400 font-mono text-[10px]">
                    Cycle: {editingSalaryPayment.cycleKey}
                  </Badge>
                </div>
              ) : (
                <Select
                  value={salaryForm.employeeId}
                  onValueChange={(val) => {
                    const emp = (employees || []).find(e => e.id === val);
                    setSalaryForm(p => ({
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
              )}
            </div>

            {/* Amount Paid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Amount Paid (₹)</Label>
              <Input
                type="number"
                value={salaryForm.amountPaid}
                onChange={e => setSalaryForm(p => ({ ...p, amountPaid: e.target.value }))}
                placeholder="e.g. 6000"
                className="font-mono font-bold text-lg h-11"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Target Cycle Month */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Cycle Month</Label>
                <Select
                  value={salaryForm.cycleKey}
                  onValueChange={val => setSalaryForm(p => ({ ...p, cycleKey: val }))}
                >
                  <SelectTrigger className="font-mono font-bold text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map(opt => (
                      <SelectItem key={opt.key} value={opt.key} className="text-xs font-bold font-mono">
                        {opt.key}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Payment Mode</Label>
                <Input
                  value={salaryForm.paymentMethod}
                  onChange={e => setSalaryForm(p => ({ ...p, paymentMethod: e.target.value }))}
                  placeholder="UPI / Cash / Bank"
                  className="font-bold text-xs uppercase h-10"
                />
              </div>
            </div>

            {/* Date & Time Paid */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Date &amp; Time Paid</Label>
              <Input
                type="datetime-local"
                value={salaryForm.paidAt}
                onChange={e => setSalaryForm(p => ({ ...p, paidAt: e.target.value }))}
                className="font-mono text-xs h-10"
              />
            </div>

            {/* Notes / Reference */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Notes / Remarks</Label>
              <Input
                value={salaryForm.note}
                onChange={e => setSalaryForm(p => ({ ...p, note: e.target.value }))}
                placeholder="Optional remark e.g. Early payment, Cash + UPI split"
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
              onClick={handleSaveSalaryPayment}
              disabled={isSubmitting}
              className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold uppercase text-xs tracking-wider shadow-lg"
            >
              {editingSalaryPayment ? 'Update Record' : 'Record Salary Payout'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
