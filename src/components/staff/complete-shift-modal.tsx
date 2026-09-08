'use client';
import type { Shift, ShiftTask, Bill, Debt, Employee, Expense } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Moon, Wallet, TrendingUp, AlertTriangle, User, Phone, MinusCircle, PlusCircle, ShoppingCart, RefreshCw, Link2 } from 'lucide-react';
import { useMemo, useState, useEffect } from 'react';
import { format } from 'date-fns';
import { Input } from '../ui/input';
import { useAuth } from '@/firebase/auth/use-user';
import { cn, isBusinessToday } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { ScrollArea } from '../ui/scroll-area';

interface CompleteShiftModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activeShift: Shift | null;
  onTaskToggle?: (task: ShiftTask) => void;
  onConfirmLogout: (totals: { cashTotal: number, upiTotal: number, shiftExpenses: number }, forceLogout: boolean) => void;
}

export function CompleteShiftModal({
  isOpen,
  onOpenChange,
  activeShift,
  onConfirmLogout,
}: CompleteShiftModalProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  
  const [cashTotal, setCashTotal] = useState('');
  const [upiTotal, setUpiTotal] = useState('');
  const [shiftExpenses, setShiftExpenses] = useState('');
  const [isExpenseCustomized, setIsExpenseCustomized] = useState(false);
  const [employeeSettings, setEmployeeSettings] = useState<Employee | null>(null);

  useEffect(() => {
    if (isOpen && user && db) {
        const fetchSettings = async () => {
            const empsRef = collection(db, 'employees');
            const q = query(empsRef, where('username', '==', user.username), limit(1));
            const snap = await getDocs(q);
            if (!snap.empty) {
                setEmployeeSettings(snap.docs[0].data() as Employee);
            }
        };
        fetchSettings();
    }
  }, [isOpen, user, db]);

  const businessStartIso = useMemo(() => {
    const d = new Date();
    if (d.getHours() < 5) d.setDate(d.getDate() - 1);
    d.setHours(5, 0, 0, 0);
    return d.toISOString();
  }, []);

  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'bills'), where('timestamp', '>=', businessStartIso)), [db, businessStartIso]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const debtsQuery = useMemo(() => !db ? null : query(collection(db, 'debts'), where('status', '==', 'pending')), [db]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const expensesQuery = useMemo(() => !db ? null : collection(db, 'expenses'), [db]);
  const { data: expenses } = useCollection<Expense>(expensesQuery);

  const todayExpensesList = useMemo(() => {
    if (!expenses) return [];
    return expenses.filter(e => e.timestamp && isBusinessToday(e.timestamp));
  }, [expenses]);

  const totalOpExpenses = useMemo(() => {
    return todayExpensesList.reduce((sum, e) => sum + (e.amount || 0), 0);
  }, [todayExpensesList]);

  // Auto-sync shiftExpenses with totalOpExpenses unless overridden
  useEffect(() => {
    if (isOpen && !isExpenseCustomized) {
      setShiftExpenses(totalOpExpenses > 0 ? totalOpExpenses.toString() : '0');
    }
  }, [isOpen, totalOpExpenses, isExpenseCustomized]);

  useEffect(() => {
    if (!isOpen) {
      setIsExpenseCustomized(false);
    }
  }, [isOpen]);

  const { isLoggingOutEarly, timeLeft, targetEndTime } = useMemo(() => {
    if (!activeShift?.startTime) return { isLoggingOutEarly: false, timeLeft: null, targetEndTime: null };
    
    const start = new Date(activeShift.startTime);
    const target = new Date(start.getTime() + 12 * 60 * 60 * 1000); // 12 hours later
    const now = new Date();

    const isEarly = now < target;
    let timeLeftStr = null;
    
    if (isEarly) {
        const diffMs = target.getTime() - now.getTime();
        const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
        const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
        timeLeftStr = `${diffHrs}h ${diffMins}m`;
    }

    return { 
        isLoggingOutEarly: isEarly, 
        timeLeft: timeLeftStr, 
        targetEndTime: format(target, 'HH:mm')
    };
  }, [activeShift]);

  const systemTally = useMemo(() => {
    if (!bills) return { cash: 0, upi: 0, district: 0, pending: 0, opExpenses: 0, activeDebtors: [] as Debt[] };
    
    // Use Business Today logic (5 AM threshold)
    const todayBills = bills.filter(b => b.timestamp && isBusinessToday(b.timestamp));
    const todayDebts = (debts || []).filter(d => d.timestamp && isBusinessToday(d.timestamp));

    const cash = todayBills.reduce((sum, b) => {
        if (b.paymentMethod === 'cash') return sum + b.totalAmount;
        if (b.paymentMethod === 'split') return sum + (b.cashAmount || 0);
        return sum;
    }, 0);

    const upi = todayBills.reduce((sum, b) => {
        if (b.paymentMethod === 'upi') return sum + b.totalAmount;
        if (b.paymentMethod === 'split') return sum + (b.upiAmount || 0);
        return sum;
    }, 0);

    const district = todayBills.reduce((sum, b) => {
        if (b.paymentMethod === 'district-dinein') return sum + b.totalAmount;
        return sum;
    }, 0);

    const pending = todayDebts.filter(d => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0);

    return { 
      cash, 
      upi, 
      district, 
      pending, 
      opExpenses: totalOpExpenses, 
      activeDebtors: todayDebts.filter(d => d.type === 'receivable') 
    };
  }, [bills, debts, totalOpExpenses]);

  const enteredCash = parseFloat(cashTotal) || 0;
  const enteredUpi = parseFloat(upiTotal) || 0;
  const enteredExpenses = parseFloat(shiftExpenses) || 0;
  
  const totalExpected = systemTally.cash + systemTally.upi;
  const totalEntered = enteredCash + enteredUpi + enteredExpenses;
  const variance = totalEntered - totalExpected;

  const handleConfirm = () => {
    onConfirmLogout({ cashTotal: enteredCash, upiTotal: enteredUpi, shiftExpenses: enteredExpenses }, false);
  };

  const titleText = activeShift?.shiftType === 'opening' ? 'Opening Shift Complete' : activeShift?.shiftType === 'closing' ? 'Closing Shift Complete' : 'Complete Shift';

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl lg:max-w-3xl h-[95vh] lg:h-[85vh] flex flex-col p-0 overflow-hidden shadow-2xl font-body">
        <DialogHeader className="p-4 sm:p-6 bg-muted/10 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-display uppercase tracking-tight">
            <Moon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            {titleText}
          </DialogTitle>
          <DialogDescription className="font-semibold text-sm sm:text-sm uppercase text-muted-foreground mt-1 tracking-tight">
            Verify operations and tally financials for closing.
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 bg-transparent">
          <div className="p-4 sm:p-6 space-y-6">
            
            {isLoggingOutEarly && (
                <div className="p-4 rounded-xl border-2 border-destructive bg-destructive/5 flex items-center gap-3 animate-pulse">
                    <AlertTriangle className="h-6 w-6 text-destructive" />
                    <div className="space-y-0.5">
                        <p className="font-bold uppercase text-sm text-destructive">Early Exit Alert</p>
                        <p className="text-sm font-bold text-foreground">You are logging out early. Your 12-hour shift ends at {targetEndTime}. <span className="text-destructive font-bold ml-1 animate-pulse">({timeLeft} left to finish)</span></p>
                    </div>
                </div>
            )}

            <div className="space-y-6">
              {/* Expected and Physical Tally */}
              <div className="p-4 sm:p-5 rounded-2xl border-2 bg-muted/5 space-y-4 shadow-sm">
                <div>
                  <h3 className="font-bold text-sm sm:text-sm uppercase tracking-normal text-muted-foreground flex items-center gap-2 mb-3">
                    <TrendingUp className="h-3.5 w-3.5" />
                    System Reconciliation
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 sm:gap-3">
                      <div className="space-y-1">
                          <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground opacity-60">Expected Cash</p>
                          <p className="text-sm sm:text-base font-bold text-emerald-600 font-mono">₹{systemTally.cash.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground opacity-60">Expected UPI</p>
                          <p className="text-sm sm:text-base font-bold text-primary font-mono">₹{systemTally.upi.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground opacity-60">Op. Expenses</p>
                          <p className="text-sm sm:text-base font-bold text-destructive font-mono">₹{totalOpExpenses.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground opacity-60">District</p>
                          <p className="text-sm sm:text-base font-bold text-amber-600 font-mono">₹{systemTally.district.toLocaleString()}</p>
                      </div>
                      <div className="space-y-1">
                          <p className="text-sm sm:text-sm font-bold uppercase text-muted-foreground opacity-60">Owed (Debts)</p>
                          <p className="text-sm sm:text-base font-bold text-amber-600 font-mono">₹{systemTally.pending.toLocaleString()}</p>
                      </div>
                  </div>
                </div>

                {(enteredCash > 0 || enteredUpi > 0 || enteredExpenses > 0) && (
                  <div className={cn(
                    "p-3 sm:p-4 rounded-xl border-2 animate-in fade-in zoom-in-95 duration-300",
                    variance === 0 ? "bg-emerald-500/5 border-emerald-500/20" : 
                    variance < 0 ? "bg-destructive/5 border-destructive/20" : "bg-blue-500/5 border-blue-500/20"
                  )}>
                    <div className="flex justify-between items-center">
                      <div className="space-y-0.5">
                        <p className="text-sm sm:text-sm font-bold uppercase tracking-normal text-muted-foreground">EOD Financial Reconciled Total</p>
                        <div className="flex items-baseline gap-2 font-mono">
                          <span className="text-lg sm:text-2xl font-bold text-foreground">₹{totalEntered.toLocaleString()}</span>
                          <span className="text-xs text-muted-foreground font-semibold uppercase">Expected Revenue: ₹{totalExpected.toLocaleString()}</span>
                        </div>
                        <p className={cn("text-xs font-bold uppercase pt-0.5", 
                          variance === 0 ? "text-emerald-600" : 
                          variance < 0 ? "text-destructive" : "text-blue-600"
                        )}>
                          Shift Variance: {variance === 0 ? 'Perfect Match (₹0)' : `${variance < 0 ? '-' : '+'} ₹${Math.abs(variance).toLocaleString()}`}
                        </p>
                      </div>
                      {variance < 0 ? (
                        <div className="bg-destructive/10 text-destructive p-1.5 sm:p-2 rounded-lg flex items-center gap-2">
                          <MinusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-sm font-bold uppercase">Short</span>
                        </div>
                      ) : variance > 0 ? (
                        <div className="bg-blue-500/10 text-blue-600 p-1.5 sm:p-2 rounded-lg flex items-center gap-2">
                          <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                          <span className="text-sm font-bold uppercase">Surplus</span>
                        </div>
                      ) : (
                        <Badge className="bg-emerald-600 uppercase font-bold text-sm sm:text-sm">OK</Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {systemTally.activeDebtors.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-bold text-sm sm:text-sm uppercase tracking-normal text-muted-foreground flex items-center gap-2 pl-1">
                    <User className="h-3.5 w-3.5" />
                    Active Debtors
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {systemTally.activeDebtors.map(debt => (
                      <div key={debt.id} className="p-2.5 sm:p-3 rounded-xl border-2 border-dashed bg-amber-500/5 flex items-center justify-between group">
                        <div className="min-w-0">
                          <p className="font-bold text-sm sm:text-sm uppercase truncate text-amber-700">{debt.contactName}</p>
                          <p className="text-sm sm:text-sm font-bold text-muted-foreground uppercase flex items-center gap-1">
                            <Phone className="h-2.5 w-2.5" /> {debt.contactPhone || 'No Phone'}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-sm sm:text-sm text-amber-600">₹{debt.amount.toLocaleString()}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4 bg-card p-4 sm:p-5 rounded-2xl border-2">
                <h3 className="font-bold text-sm sm:text-sm uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  Physical Reconciliation
                </h3>
                <div className="grid gap-3 sm:gap-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Label htmlFor="cash-total" className="text-sm sm:text-sm font-bold uppercase w-32 shrink-0">In-Hand Cash</Label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                      <Input
                        id="cash-total"
                        type="number"
                        placeholder="Actual cash..."
                        value={cashTotal}
                        onChange={(e) => setCashTotal(e.target.value)}
                        className="pl-8 h-10 sm:h-12 font-mono font-bold text-base sm:text-lg bg-muted/10 border-2"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                    <Label htmlFor="upi-total" className="text-sm sm:text-sm font-bold uppercase w-32 shrink-0">Settled UPI</Label>
                    <div className="relative flex-1">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                      <Input
                        id="upi-total"
                        type="number"
                        placeholder="UPI summary..."
                        value={upiTotal}
                        onChange={(e) => setUpiTotal(e.target.value)}
                        className="pl-8 h-10 sm:h-12 font-mono font-bold text-base sm:text-lg bg-muted/10 border-2"
                      />
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                      <Label htmlFor="shift-expenses" className="text-sm sm:text-sm font-bold uppercase w-32 shrink-0 flex items-center gap-1">
                        Petty Cash Out
                      </Label>
                      <div className="relative flex-1">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive/60 font-bold text-sm">₹</span>
                        <Input
                          id="shift-expenses"
                          type="number"
                          placeholder="Misc. expenses..."
                          value={shiftExpenses}
                          onChange={(e) => {
                            setShiftExpenses(e.target.value);
                            setIsExpenseCustomized(true);
                          }}
                          className="pl-8 pr-20 h-10 sm:h-12 font-mono font-bold text-base sm:text-lg text-destructive border-2 border-destructive/20 bg-destructive/5 focus-visible:ring-destructive"
                        />
                        {isExpenseCustomized ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            title="Re-link to logged Operational Expenses"
                            onClick={() => {
                              setIsExpenseCustomized(false);
                              setShiftExpenses(totalOpExpenses > 0 ? totalOpExpenses.toString() : '0');
                            }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 gap-1 flex items-center"
                          >
                            <RefreshCw className="h-3.5 w-3.5" /> Sync
                          </Button>
                        ) : (
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold uppercase text-emerald-600 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1">
                            <Link2 className="h-3 w-3" /> Linked
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="sm:pl-35 flex items-center justify-between text-xs text-muted-foreground font-bold">
                      <span className="flex items-center gap-1">
                        <ShoppingCart className="h-3 w-3 text-destructive" />
                        Logged Op. Expenses: <strong className="text-foreground">₹{totalOpExpenses.toLocaleString()}</strong> ({todayExpensesList.length} items)
                      </span>
                    </div>
                  </div>

                  {todayExpensesList.length > 0 && (
                    <div className="p-3 rounded-xl border bg-muted/10 space-y-2 mt-1">
                      <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground border-b pb-1">
                        <span className="flex items-center gap-1.5">
                          <ShoppingCart className="h-3.5 w-3.5 text-destructive" />
                          Logged Op. Expenses Today
                        </span>
                        <span className="font-mono text-destructive">Total: ₹{totalOpExpenses.toLocaleString()}</span>
                      </div>
                      <div className="space-y-1 max-h-24 overflow-y-auto pr-1">
                        {todayExpensesList.map((exp) => (
                          <div key={exp.id} className="flex justify-between items-center text-xs p-1 rounded bg-background">
                            <span className="font-semibold uppercase truncate max-w-[220px]">{exp.description}</span>
                            <span className="font-mono font-bold text-destructive shrink-0">₹{exp.amount}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t bg-muted/5 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 sm:h-12 uppercase font-bold text-sm sm:text-sm tracking-normal flex-1 border-2">
            CANCEL
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            className="h-12 sm:h-14 uppercase font-bold tracking-[0.2em] flex-[2] shadow-xl text-sm sm:text-sm"
          >
            COMPLETE SHIFT & LOGOUT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
