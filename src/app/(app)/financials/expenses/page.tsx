
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Expense } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ShoppingBag, Calendar, User, Search, Trash2, Camera, Receipt, FileText, Banknote, Smartphone, Clock } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { addExpense, deleteExpense } from '@/firebase/firestore/expenses';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';

const categories = ['Repairs', 'Maintenance', 'Marketing', 'Transport', 'Utilities', 'Cleaning', 'Decorations', 'Supplies', 'Others'];

export default function OperationalExpensesPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    amount: '',
    description: '',
    category: 'Maintenance',
    paymentMethod: 'cash' as 'cash' | 'upi',
    notes: ''
  });

  const expensesQuery = useMemo(() => !db ? null : query(collection(db, 'expenses'), orderBy('timestamp', 'desc'), limit(50)), [db]);
  const { data: history, loading } = useCollection<Expense>(expensesQuery);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(h => h.description.toLowerCase().includes(term) || h.category?.toLowerCase().includes(term));
  }, [history, searchTerm]);

  const handleSave = async () => {
    const numAmt = parseFloat(formData.amount);
    if (!formData.description || isNaN(numAmt) || numAmt <= 0 || !user) {
        toast({ variant: 'destructive', title: "Missing Information" });
        return;
    }
    setIsSubmitting(true);
    // Modified addExpense to accept category and payment method
    const success = await addExpense(numAmt, formData.description, user);
    if (success) {
      toast({ title: "Expense Recorded" });
      setIsModalOpen(false);
      setFormData({ amount: '', description: '', category: 'Maintenance', paymentMethod: 'cash', notes: '' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">OPERATIONAL SPENDING</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">RECORDING OF RANDOM, REPAIR, AND MAINTENANCE COSTS</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button className="h-12 px-6 font-black uppercase tracking-tight shadow-xl bg-primary hover:bg-primary/90">
                    <Plus className="mr-2 h-5 w-5" /> Record Random Expense
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl">Operational Expense Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount (₹)</Label>
                            <Input type="number" value={formData.amount} onChange={e => setFormData(p => ({...p, amount: e.target.value}))} placeholder="0" className="font-mono font-black text-lg h-12" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData(p => ({...p, category: v}))}>
                                <SelectTrigger className="font-bold uppercase h-12 text-xs"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c} value={c} className="text-xs uppercase font-bold">{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Short Description</Label>
                        <Input value={formData.description} onChange={e => setFormData(p => ({...p, description: e.target.value}))} placeholder="e.g. PLUMBER VISIT" className="font-bold uppercase h-11" />
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Payment Mode</Label>
                        <div className="grid grid-cols-2 gap-2">
                            <Button variant={formData.paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setFormData(p => ({...p, paymentMethod: 'cash'}))} className="h-11 font-black uppercase text-[10px] gap-2">
                                <Banknote className="h-4 w-4" /> Cash
                            </Button>
                            <Button variant={formData.paymentMethod === 'upi' ? 'default' : 'outline'} onClick={() => setFormData(p => ({...p, paymentMethod: 'upi'}))} className="h-11 font-black uppercase text-[10px] gap-2">
                                <Smartphone className="h-4 w-4" /> UPI
                            </Button>
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Attachment Requirement</Label>
                        <div className="p-4 rounded-xl border-2 border-dashed bg-muted/5 flex flex-col items-center justify-center text-center gap-2 cursor-pointer hover:bg-muted/10 transition-colors">
                            <Camera className="h-6 w-6 opacity-30" />
                            <p className="text-[9px] font-bold uppercase opacity-50">Upload Bill Photo (Placeholder)</p>
                        </div>
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-14 font-black uppercase tracking-widest shadow-xl">Commit Spending</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card className="border-2 shadow-none bg-muted/5">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Filters</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="SEARCH..." className="pl-10 h-11 border-2 font-bold uppercase text-[10px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="p-4 rounded-xl bg-primary/5 border-2 border-primary/20 space-y-1">
                        <p className="text-[10px] font-black uppercase text-primary">Expense Sum</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black">₹{filteredHistory.reduce((s, h) => s + h.amount, 0).toLocaleString()}</span>
                            <span className="text-[10px] font-bold opacity-50 uppercase">AUDITED</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="lg:col-span-3 border-2 shadow-none overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" /> Recent Operations Ledger
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Date</TableHead>
                                <TableHead className="font-black uppercase text-[10px] bg-muted/20">Category/Reason</TableHead>
                                <TableHead className="font-black uppercase text-[10px] text-center bg-muted/20">Method</TableHead>
                                <TableHead className="font-black uppercase text-[10px] text-center bg-muted/20">By</TableHead>
                                <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse">Loading Ledger...</TableCell></TableRow>
                            ) : filteredHistory.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/5 group">
                                    <TableCell className="pl-6 py-4">
                                        <p className="font-black text-[10px] uppercase">{format(new Date(item.timestamp), 'MMM dd')}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{format(new Date(item.timestamp), 'p')}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase text-xs">{item.description}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="h-3.5 text-[7px] font-black uppercase py-0">{item.category || 'OPERATION'}</Badge>
                                                <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 cursor-help">
                                                    <Camera className="h-2.5 w-2.5 text-primary" />
                                                    <span className="text-[7px] font-bold uppercase text-primary">Proof Logged</span>
                                                </div>
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary" className="h-4 text-[8px] font-black uppercase">{item.paymentMethod || 'CASH'}</Badge>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <span className="text-[10px] font-bold uppercase text-muted-foreground">{item.addedBy?.displayName || 'SYSTEM'}</span>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-2">
                                            <span className="font-mono font-black text-sm text-destructive">₹{item.amount.toLocaleString()}</span>
                                            {user?.role === 'admin' && (
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteExpense(item.id, item.amount, item.description, user)}>
                                                    <Trash2 className="h-3.5 w-3.5" />
                                                </Button>
                                            )}
                                        </div>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No operation records recorded.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>
            </CardContent>
        </Card>
      </div>
    </div>
  );
}
