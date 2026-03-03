
'use client';
import type { Shift, ShiftTask, Bill, Debt } from '@/lib/types';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Moon, IndianRupee, Wallet, ListChecks, TrendingUp, AlertTriangle, User, Phone, Info, MinusCircle, PlusCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '../ui/input';
import { useAuth } from '@/firebase/auth/use-user';
import { cn, isBusinessToday } from '@/lib/utils';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { ScrollArea } from '../ui/scroll-area';

interface EndOfDayModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  activeShift: Shift | null;
  onTaskToggle: (task: ShiftTask) => void;
  onConfirmLogout: (totals: { cashTotal: number, upiTotal: number, shiftExpenses: number }, forceLogout: boolean) => void;
}

export function EndOfDayModal({
  isOpen,
  onOpenChange,
  activeShift,
  onTaskToggle,
  onConfirmLogout,
}: EndOfDayModalProps) {
  const { user } = useAuth();
  const { db } = useFirebase();
  
  const [cashTotal, setCashTotal] = useState('');
  const [upiTotal, setUpiTotal] = useState('');
  const [shiftExpenses, setShiftExpenses] = useState('');

  const billsQuery = useMemo(() => !db ? null : collection(db, 'bills'), [db]);
  const { data: bills } = useCollection<Bill>(billsQuery);

  const debtsQuery = useMemo(() => !db ? null : query(collection(db, 'debts'), where('status', '==', 'pending')), [db]);
  const { data: debts } = useCollection<Debt>(debtsQuery);

  const systemTally = useMemo(() => {
    if (!bills) return { cash: 0, upi: 0, pending: 0, activeDebtors: [] as Debt[] };
    
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

    const pending = todayDebts.filter(d => d.type === 'receivable').reduce((sum, d) => sum + d.amount, 0);

    return { cash, upi, pending, activeDebtors: todayDebts.filter(d => d.type === 'receivable') };
  }, [bills, debts]);

  const visibleTasks = useMemo(() => {
    if (!activeShift?.tasks) return [];
    return activeShift.tasks.filter((task) => 
        task.type === 'end-of-day' || (task.type === 'start-of-day' && !task.completed)
    );
  }, [activeShift]);

  const allTasksCompleted = useMemo(() => {
    if (!activeShift) return false;
    return activeShift.tasks.every(task => task.completed);
  }, [activeShift]);

  const enteredCash = parseFloat(cashTotal) || 0;
  const enteredUpi = parseFloat(upiTotal) || 0;
  const enteredExpenses = parseFloat(shiftExpenses) || 0;
  
  const totalExpected = systemTally.cash + systemTally.upi;
  const totalEntered = enteredCash + enteredUpi + enteredExpenses;
  const variance = totalEntered - totalExpected;

  const handleConfirm = () => {
    onConfirmLogout({ cashTotal: enteredCash, upiTotal: enteredUpi, shiftExpenses: enteredExpenses }, false);
  };
  
  const handleLogoutAnyway = () => {
    onConfirmLogout({ cashTotal: enteredCash, upiTotal: enteredUpi, shiftExpenses: enteredExpenses }, true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl h-[90vh] md:h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
        <DialogHeader className="p-4 sm:p-6 bg-muted/10 border-b shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl sm:text-2xl font-display uppercase tracking-tight">
            <Moon className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            Shift Settlement
          </DialogTitle>
          <DialogDescription className="font-semibold text-[10px] sm:text-xs uppercase text-muted-foreground mt-1 tracking-tight">
            Verify operations and tally financials for closing (Bistro Business Day).
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="flex-1 min-h-0 bg-background">
          <div className="p-4 sm:p-6 space-y-4">
            <div className="p-4 sm:p-5 rounded-2xl border-2 bg-muted/5 space-y-4 shadow-sm">
              <div>
                <h3 className="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-3">
                  <TrendingUp className="h-3.5 w-3.5" />
                  System Reconciliation
                </h3>
                <div className="grid grid-cols-3 gap-2 sm:gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground opacity-60">Expected Cash</p>
                        <p className="text-base sm:text-xl font-black text-emerald-600 font-mono">₹{systemTally.cash.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground opacity-60">Expected UPI</p>
                        <p className="text-base sm:text-xl font-black text-primary font-mono">₹{systemTally.upi.toLocaleString()}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] sm:text-[10px] font-bold uppercase text-muted-foreground opacity-60">Owed (Debts)</p>
                        <p className="text-base sm:text-xl font-black text-amber-600 font-mono">₹{systemTally.pending.toLocaleString()}</p>
                    </div>
                </div>
              </div>

              {(enteredCash > 0 || enteredUpi > 0) && (
                <div className={cn(
                  "p-3 sm:p-4 rounded-xl border-2 animate-in fade-in zoom-in-95 duration-300",
                  variance === 0 ? "bg-emerald-500/5 border-emerald-500/20" : 
                  variance < 0 ? "bg-destructive/5 border-destructive/20" : "bg-blue-500/5 border-blue-500/20"
                )}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-widest text-muted-foreground">Shift Variance</p>
                      <p className={cn("text-lg sm:text-2xl font-black font-mono", 
                        variance === 0 ? "text-emerald-600" : 
                        variance < 0 ? "text-destructive" : "text-blue-600"
                      )}>
                        {variance === 0 ? 'Perfect Match' : `${variance < 0 ? '-' : '+'} ₹${Math.abs(variance).toLocaleString()}`}
                      </p>
                    </div>
                    {variance < 0 ? (
                      <div className="bg-destructive/10 text-destructive p-1.5 sm:p-2 rounded-lg flex items-center gap-2">
                        <MinusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-[9px] font-black uppercase">Short</span>
                      </div>
                    ) : variance > 0 ? (
                      <div className="bg-blue-500/10 text-blue-600 p-1.5 sm:p-2 rounded-lg flex items-center gap-2">
                        <PlusCircle className="h-4 w-4 sm:h-5 sm:w-5" />
                        <span className="text-[9px] font-black uppercase">Surplus</span>
                      </div>
                    ) : (
                      <Badge className="bg-emerald-600 uppercase font-black text-[8px] sm:text-xs">OK</Badge>
                    )}
                  </div>
                </div>
              )}
            </div>

            {systemTally.activeDebtors.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-bold text-[9px] sm:text-[10px] uppercase tracking-widest text-muted-foreground flex items-center gap-2 pl-1">
                  <User className="h-3.5 w-3.5" />
                  Active Debtors
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {systemTally.activeDebtors.map(debt => (
                    <div key={debt.id} className="p-2.5 sm:p-3 rounded-xl border-2 border-dashed bg-amber-500/5 flex items-center justify-between group">
                      <div className="min-w-0">
                        <p className="font-black text-[10px] sm:text-[11px] uppercase truncate text-amber-700">{debt.contactName}</p>
                        <p className="text-[8px] sm:text-[9px] font-bold text-muted-foreground uppercase flex items-center gap-1">
                          <Phone className="h-2.5 w-2.5" /> {debt.contactPhone || 'No Phone'}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono font-black text-xs sm:text-sm text-amber-600">₹{debt.amount.toLocaleString()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4 bg-card p-4 sm:p-5 rounded-2xl border-2">
              <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Physical Reconciliation
              </h3>
              <div className="grid gap-3 sm:gap-4">
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Label htmlFor="cash-total" className="text-[10px] sm:text-xs font-bold uppercase w-32 shrink-0">In-Hand Cash</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      id="cash-total"
                      type="number"
                      placeholder="Actual cash..."
                      value={cashTotal}
                      onChange={(e) => setCashTotal(e.target.value)}
                      className="pl-8 h-10 sm:h-12 font-mono font-black text-base sm:text-lg bg-muted/10 border-2"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Label htmlFor="upi-total" className="text-[10px] sm:text-xs font-bold uppercase w-32 shrink-0">Settled UPI</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-sm">₹</span>
                    <Input
                      id="upi-total"
                      type="number"
                      placeholder="UPI summary..."
                      value={upiTotal}
                      onChange={(e) => setUpiTotal(e.target.value)}
                      className="pl-8 h-10 sm:h-12 font-mono font-black text-base sm:text-lg bg-muted/10 border-2"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
                  <Label htmlFor="shift-expenses" className="text-[10px] sm:text-xs font-bold uppercase w-32 shrink-0">Petty Cash Out</Label>
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive/60 font-bold text-sm">₹</span>
                    <Input
                      id="shift-expenses"
                      type="number"
                      placeholder="Misc. expenses..."
                      value={shiftExpenses}
                      onChange={(e) => setShiftExpenses(e.target.value)}
                      className="pl-8 h-10 sm:h-12 font-mono font-black text-base sm:text-lg text-destructive border-2 border-destructive/20 bg-destructive/5 focus-visible:ring-destructive"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-card p-4 sm:p-5 rounded-2xl border-2 border-dashed space-y-3 mb-8">
              <div className="flex justify-between items-center">
                  <h3 className="font-bold text-[10px] sm:text-xs uppercase tracking-tight text-muted-foreground flex items-center gap-2">
                  <ListChecks className="h-4 w-4" />
                  Accountability Audit
                  </h3>
                  {!allTasksCompleted && (
                      <Badge variant="outline" className="text-[8px] sm:text-[10px] font-bold border-destructive/30 text-destructive bg-destructive/5 gap-1 uppercase h-5 sm:h-6 px-2">
                          <AlertTriangle className="h-3 w-3" /> {activeShift?.tasks.filter(t => !t.completed).length} Pending
                      </Badge>
                  )}
              </div>
              <div className="space-y-3">
                {visibleTasks.map((task) => (
                  <div key={task.name} className="flex items-start space-x-3 group">
                    <Checkbox
                      id={`eod-${task.name}`}
                      checked={task.completed}
                      onCheckedChange={() => onTaskToggle(task)}
                      className="mt-0.5 h-4 w-4 sm:h-5 sm:w-5 border-2"
                    />
                     <div className="flex-1">
                        <Label
                            htmlFor={`eod-${task.name}`}
                            className={cn(
                              "text-xs sm:text-sm font-bold transition-all cursor-pointer block leading-tight",
                              task.completed ? 'text-muted-foreground line-through opacity-50' : 'text-foreground'
                            )}
                        >
                            {task.name}
                            {task.type === 'start-of-day' && !task.completed && (
                                <Badge variant="outline" className="ml-2 text-[8px] sm:text-[9px] font-bold text-amber-600 border-amber-600/30 uppercase h-3.5 sm:h-4">Morning Item</Badge>
                            )}
                        </Label>
                          {task.completed && task.completedBy ? (
                            <p className="text-[9px] sm:text-[10px] font-medium text-green-600 uppercase mt-1">
                                Verified by {task.completedBy.displayName}
                            </p>
                          ) : (
                              <p className="text-[9px] sm:text-[10px] text-destructive/70 font-medium uppercase mt-1">
                                  Not Verified
                              </p>
                          )}
                      </div>
                  </div>
                ))}
                {visibleTasks.length === 0 && (
                    <p className="text-xs sm:text-sm text-muted-foreground text-center py-4 italic">
                      All tasks verified for this shift.
                    </p>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 sm:gap-3 p-4 sm:p-6 border-t bg-muted/5 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="h-10 sm:h-12 uppercase font-black text-[9px] sm:text-[10px] tracking-widest flex-1 border-2">
            CANCEL
          </Button>
          {!allTasksCompleted && (
            <Button variant="secondary" onClick={handleLogoutAnyway} className="h-10 sm:h-12 uppercase font-black text-[9px] sm:text-[10px] tracking-widest flex-1 border-2 border-amber-500/20 text-amber-700 bg-amber-500/5 hover:bg-amber-500/10">
              FORCE EXIT
            </Button>
          )}
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={!allTasksCompleted}
            className="h-12 sm:h-14 uppercase font-black tracking-[0.2em] flex-[2] shadow-xl text-[10px] sm:text-xs"
          >
            END SHIFT & LOGOUT
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
