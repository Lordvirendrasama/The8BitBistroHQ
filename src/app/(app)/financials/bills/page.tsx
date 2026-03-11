
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { FixedBill, RepeatCycle } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ReceiptIndianRupee, Calendar, CheckCircle2, Clock, Trash2, Wallet, TrendingDown, Pencil } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format, isPast, isToday, differenceInDays } from 'date-fns';
import { addFixedBill, markBillAsPaid, deleteFixedBill, updateFixedBill } from '@/firebase/firestore/financials';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

export default function FixedBillsPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingBill, setEditingBill] = useState<FixedBill | null>(null);

  const [formData, setFormData] = useState<Omit<FixedBill, 'id'>>({
    name: '',
    amount: 0,
    repeatCycle: 'monthly',
    nextDueDate: new Date().toISOString().slice(0, 10),
    reminderDays: 5,
    paymentMethod: 'UPI'
  });

  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'fixedBills'), orderBy('nextDueDate')), [db]);
  const { data: bills, loading } = useCollection<FixedBill>(billsQuery);

  const stats = useMemo(() => {
    if (!bills) return { monthly: 0, daily: 0 };
    
    let totalMonthly = 0;
    bills.forEach(bill => {
        let monthlyEquivalent = 0;
        if (bill.repeatCycle === 'daily') monthlyEquivalent = bill.amount * 30;
        else if (bill.repeatCycle === 'weekly') monthlyEquivalent = bill.amount * (30 / 7);
        else if (bill.repeatCycle === 'yearly') monthlyEquivalent = bill.amount / 12;
        else monthlyEquivalent = bill.amount; // monthly
        
        totalMonthly += monthlyEquivalent;
    });

    return {
        monthly: totalMonthly,
        daily: totalMonthly / 30
    };
  }, [bills]);

  const handleSave = async () => {
    if (!formData.name || !formData.amount || !user) return;
    setIsSubmitting(true);
    
    let success = false;
    if (editingBill) {
        success = await updateFixedBill(editingBill.id, formData, user);
        if (success) toast({ title: "Bill Updated" });
    } else {
        success = await addFixedBill(formData, user);
        if (success) toast({ title: "Fixed Bill Added" });
    }

    if (success) {
      setIsModalOpen(false);
      resetForm();
    }
    setIsSubmitting(false);
  };

  const handleEdit = (bill: FixedBill) => {
    setEditingBill(bill);
    setFormData({
        name: bill.name,
        amount: bill.amount,
        repeatCycle: bill.repeatCycle,
        nextDueDate: bill.nextDueDate.slice(0, 10),
        reminderDays: bill.reminderDays || 5,
        paymentMethod: bill.paymentMethod || 'UPI'
    });
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setEditingBill(null);
    setFormData({ name: '', amount: 0, repeatCycle: 'monthly', nextDueDate: new Date().toISOString().slice(0, 10), reminderDays: 5, paymentMethod: 'UPI' });
  };

  const handlePay = async (id: string) => {
    if (!user) return;
    const success = await markBillAsPaid(id, user);
    if (success) toast({ title: "Bill Paid & Recycled" });
  };

  const getDailyCost = (bill: FixedBill) => {
    let divisor = 30;
    if (bill.repeatCycle === 'daily') divisor = 1;
    if (bill.repeatCycle === 'weekly') divisor = 7;
    if (bill.repeatCycle === 'yearly') divisor = 365;
    return (bill.amount / divisor).toFixed(0);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">FIXED OVERHEADS</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">MANAGEMENT OF RECURRING OPERATIONAL BILLS & SUBSCRIPTIONS</p>
        </div>
        {user?.role === 'admin' && (
            <Dialog open={isModalOpen} onOpenChange={(open) => {
                setIsModalOpen(open);
                if (!open) resetForm();
            }}>
                <DialogTrigger asChild>
                    <Button onClick={() => setEditingBill(null)} className="h-12 px-6 font-black uppercase tracking-tight shadow-xl">
                        <Plus className="mr-2 h-5 w-5" /> New Recurring Bill
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="font-headline text-xl">
                            {editingBill ? 'Modify Recurring Bill' : 'Setup Recurring Bill'}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Bill Name</Label>
                            <Input value={formData.name} onChange={e => setFormData(p => ({...p, name: e.target.value}))} placeholder="e.g. SHOP RENT" className="font-bold uppercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (₹)</Label>
                                <Input type="number" value={formData.amount || ''} onChange={e => setFormData(p => ({...p, amount: Number(e.target.value)}))} placeholder="0" className="font-mono font-bold" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Cycle</Label>
                                <Select value={formData.repeatCycle} onValueChange={(v: RepeatCycle) => setFormData(p => ({...p, repeatCycle: v}))}>
                                    <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="daily" className="text-[10px] uppercase font-bold">Daily</SelectItem>
                                        <SelectItem value="weekly" className="text-[10px] uppercase font-bold">Weekly</SelectItem>
                                        <SelectItem value="monthly" className="text-[10px] uppercase font-bold">Monthly</SelectItem>
                                        <SelectItem value="yearly" className="text-[10px] uppercase font-bold">Yearly</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Next Due Date</Label>
                                <Input type="date" value={formData.nextDueDate} onChange={e => setFormData(p => ({...p, nextDueDate: e.target.value}))} className="font-bold h-10" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Method</Label>
                                <Input value={formData.paymentMethod} onChange={e => setFormData(p => ({...p, paymentMethod: e.target.value}))} placeholder="UPI/Cash" className="font-bold uppercase" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">
                            {editingBill ? 'Save Audit Changes' : 'Create Permanent Record'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-2 shadow-sm bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-primary flex items-center gap-2">
                    <Wallet className="h-4 w-4" /> Total Monthly Overheads
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black text-primary font-mono tabular-nums">₹{Math.round(stats.monthly).toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Combined normalized cost per 30 days</p>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-sm bg-muted/30">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Total Daily Burden
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-4xl font-black font-mono tabular-nums">₹{Math.round(stats.daily).toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Fixed operational cost per day</p>
            </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px] pl-6">Service/Bill Name</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-center">Amount</TableHead>
                <TableHead className="font-black uppercase text-[10px] text-center">Daily Burden</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Frequency</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Due Date</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px] pr-6">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={6} className="h-48 text-center animate-pulse font-headline text-[10px]">Loading Accounts...</TableCell></TableRow>
              ) : bills?.map((bill) => {
                const isOverdue = isPast(new Date(bill.nextDueDate)) && !isToday(new Date(bill.nextDueDate));
                const daysLeft = differenceInDays(new Date(bill.nextDueDate), new Date());
                
                return (
                    <TableRow key={bill.id} className="group hover:bg-muted/5">
                        <TableCell className="py-4 pl-6">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/5 rounded-lg">
                                    <ReceiptIndianRupee className="h-4 w-4 text-primary" />
                                </div>
                                <span className="font-black uppercase text-xs sm:text-sm">{bill.name}</span>
                            </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-black">₹{bill.amount.toLocaleString()}</TableCell>
                        <TableCell className="text-center">
                            <Badge variant="outline" className="h-5 text-[9px] font-black border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
                                ₹{getDailyCost(bill)}/day
                            </Badge>
                        </TableCell>
                        <TableCell>
                            <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest">{bill.repeatCycle}</span>
                        </TableCell>
                        <TableCell>
                            <div className="flex flex-col">
                                <span className={cn("text-[10px] font-black uppercase", isOverdue ? "text-destructive" : "text-foreground")}>
                                    {format(new Date(bill.nextDueDate), 'MMM dd, yyyy')}
                                </span>
                                <span className="text-[8px] font-bold text-muted-foreground uppercase">
                                    {isOverdue ? 'Overdue' : daysLeft === 0 ? 'Due Today' : `${daysLeft} days left`}
                                </span>
                            </div>
                        </TableCell>
                        <TableCell className="text-right pr-6">
                            <div className="flex justify-end gap-2">
                                <Button size="icon" variant="ghost" onClick={() => handleEdit(bill)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                                    <Pencil className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="sm" variant="outline" onClick={() => handlePay(bill.id)} className="h-8 px-3 font-black uppercase text-[9px] border-2 border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all">
                                    <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Mark Paid
                                </Button>
                                {user?.role === 'admin' && (
                                    <Button size="icon" variant="ghost" onClick={() => deleteFixedBill(bill.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                        <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                )}
                            </div>
                        </TableCell>
                    </TableRow>
                );
              })}
              {bills?.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center opacity-30">
                        <div className="flex flex-col items-center justify-center italic">
                            <ReceiptIndianRupee className="h-12 w-12 mb-2" />
                            <p className="font-headline text-[10px] tracking-widest uppercase">No permanent bills configured.</p>
                        </div>
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
