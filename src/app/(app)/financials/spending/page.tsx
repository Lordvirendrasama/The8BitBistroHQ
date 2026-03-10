
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Expense, InventoryPurchase } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, ShoppingBag, Package, Search, Trash2, Banknote, Smartphone, Clock, IndianRupee, TrendingDown } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { addExpense, deleteExpense } from '@/firebase/firestore/expenses';
import { addInventoryPurchase } from '@/firebase/firestore/financials';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const expenseCategories = ['Repairs', 'Maintenance', 'Marketing', 'Transport', 'Utilities', 'Cleaning', 'Decorations', 'Supplies', 'Others'];
const inventoryUnits = ['kg', 'litre', 'packets', 'pieces', 'crates', 'boxes'];
const inventoryCategories = ['Dairy', 'Frozen', 'Produce', 'Beverages', 'Dry Goods', 'Cleaning', 'Consumables', 'Hardware'];

export default function SpendingHubPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('expenses');

  // Expenses State
  const [expenseData, setExpenseData] = useState({
    amount: '',
    description: '',
    category: 'Maintenance',
    paymentMethod: 'cash' as 'cash' | 'upi'
  });

  // Inventory State
  const [stockData, setStockData] = useState<Omit<InventoryPurchase, 'id' | 'unitCost' | 'addedBy'>>({
    itemName: '',
    category: 'Frozen',
    quantity: 1,
    unit: 'kg',
    totalCost: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    supplier: ''
  });

  // Queries
  const expensesQuery = useMemo(() => !db ? null : query(collection(db, 'expenses'), orderBy('timestamp', 'desc'), limit(50)), [db]);
  const { data: expenses, loading: loadingExpenses } = useCollection<Expense>(expensesQuery);

  const inventoryQuery = useMemo(() => !db ? null : query(collection(db, 'inventory'), orderBy('purchaseDate', 'desc'), limit(50)), [db]);
  const { data: inventory, loading: loadingInventory } = useCollection<InventoryPurchase>(inventoryQuery);

  const filteredExpenses = useMemo(() => {
    if (!expenses) return [];
    if (!searchTerm) return expenses;
    const term = searchTerm.toLowerCase();
    return expenses.filter(h => h.description.toLowerCase().includes(term) || h.category?.toLowerCase().includes(term));
  }, [expenses, searchTerm]);

  const filteredInventory = useMemo(() => {
    if (!inventory) return [];
    if (!searchTerm) return inventory;
    const term = searchTerm.toLowerCase();
    return inventory.filter(h => h.itemName.toLowerCase().includes(term) || h.category.toLowerCase().includes(term));
  }, [inventory, searchTerm]);

  const handleSaveExpense = async () => {
    const numAmt = parseFloat(expenseData.amount);
    if (!expenseData.description || isNaN(numAmt) || numAmt <= 0 || !user) {
        toast({ variant: 'destructive', title: "Missing Information" });
        return;
    }
    setIsSubmitting(true);
    const success = await addExpense(numAmt, expenseData.description, user);
    if (success) {
      toast({ title: "Expense Recorded" });
      setExpenseData({ amount: '', description: '', category: 'Maintenance', paymentMethod: 'cash' });
    }
    setIsSubmitting(false);
  };

  const handleSaveStock = async () => {
    if (!stockData.itemName || !stockData.totalCost || !user) {
        toast({ variant: 'destructive', title: "Missing Information" });
        return;
    }
    setIsSubmitting(true);
    const success = await addInventoryPurchase(stockData, user);
    if (success) {
      toast({ title: "Inventory Recorded" });
      setStockData({ itemName: '', category: 'Frozen', quantity: 1, unit: 'kg', totalCost: 0, purchaseDate: new Date().toISOString().slice(0, 10), supplier: '' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">OPERATIONAL OUTFLOW</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">UNIFIED MANAGEMENT OF INVENTORY PURCHASES & AD-HOC EXPENSES</p>
        </div>
        
        <div className="flex gap-2">
            <Dialog>
                <DialogTrigger asChild>
                    <Button variant="outline" className="h-12 border-2 font-black uppercase tracking-tight shadow-md gap-2">
                        <ShoppingBag className="h-4 w-4" />
                        Log Expense
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader><DialogTitle className="font-headline">Operational Expense</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Amount (₹)</Label>
                                <Input type="number" value={expenseData.amount} onChange={e => setExpenseData({...expenseData, amount: e.target.value})} className="font-mono font-black" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Category</Label>
                                <Select value={expenseData.category} onValueChange={v => setExpenseData({...expenseData, category: v})}>
                                    <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {expenseCategories.map(c => <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase">{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Description</Label>
                            <Input value={expenseData.description} onChange={e => setExpenseData({...expenseData, description: e.target.value})} className="font-bold uppercase text-xs" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Payment Mode</Label>
                            <div className="grid grid-cols-2 gap-2">
                                <Button variant={expenseData.paymentMethod === 'cash' ? 'default' : 'outline'} onClick={() => setExpenseData({...expenseData, paymentMethod: 'cash'})} className="font-black uppercase text-[10px] h-10"><Banknote className="mr-2 h-4 w-4"/> Cash</Button>
                                <Button variant={expenseData.paymentMethod === 'upi' ? 'default' : 'outline'} onClick={() => setExpenseData({...expenseData, paymentMethod: 'upi'})} className="font-black uppercase text-[10px] h-10"><Smartphone className="mr-2 h-4 w-4"/> UPI</Button>
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveExpense} disabled={isSubmitting} className="w-full h-12 font-black uppercase tracking-widest shadow-xl">Commit Expense</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog>
                <DialogTrigger asChild>
                    <Button className="h-12 font-black uppercase tracking-tight shadow-xl gap-2 bg-emerald-600 hover:bg-emerald-700">
                        <Package className="h-4 w-4" />
                        Log Stock
                    </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                    <DialogHeader><DialogTitle className="font-headline">Stock Inward Entry</DialogTitle></DialogHeader>
                    <div className="space-y-4 py-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase text-muted-foreground">Item Name</Label>
                            <Input value={stockData.itemName} onChange={e => setStockData({...stockData, itemName: e.target.value})} placeholder="e.g. MILK CRATE" className="font-bold uppercase" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Category</Label>
                                <Select value={stockData.category} onValueChange={v => setStockData({...stockData, category: v})}>
                                    <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {inventoryCategories.map(c => <SelectItem key={c} value={c} className="text-[10px] font-bold uppercase">{c}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Quantity</Label>
                                <div className="flex gap-2">
                                    <Input type="number" value={stockData.quantity} onChange={e => setStockData({...stockData, quantity: Number(e.target.value)})} className="font-bold h-10" />
                                    <Select value={stockData.unit} onValueChange={v => setStockData({...stockData, unit: v})}>
                                        <SelectTrigger className="w-24 font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {inventoryUnits.map(u => <SelectItem key={u} value={u} className="text-[10px] font-bold uppercase">{u}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Total Cost (₹)</Label>
                                <Input type="number" value={stockData.totalCost || ''} onChange={e => setStockData({...stockData, totalCost: Number(e.target.value)})} className="font-mono font-black" />
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-black uppercase text-muted-foreground">Purchase Date</Label>
                                <Input type="date" value={stockData.purchaseDate} onChange={e => setStockData({...stockData, purchaseDate: e.target.value})} className="font-bold" />
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={handleSaveStock} disabled={isSubmitting} className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 font-black uppercase tracking-widest shadow-xl">Finalize Stock Log</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
            <TabsList className="bg-muted/20 p-1 h-12 rounded-xl border-2 border-dashed">
                <TabsTrigger value="expenses" className="px-6 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                    <ShoppingBag className="h-3.5 w-3.5" />
                    Operational Outflow
                </TabsTrigger>
                <TabsTrigger value="inventory" className="px-6 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                    <Package className="h-3.5 w-3.5" />
                    Stock & Inventory
                </TabsTrigger>
            </TabsList>

            <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                    placeholder="FILTER HISTORY..." 
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-10 h-11 border-2 font-black uppercase text-[10px] bg-muted/5"
                />
            </div>
        </div>

        <TabsContent value="expenses" className="space-y-6 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-primary/5 border-primary/20 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2"><TrendingDown className="h-3.5 w-3.5" /> Tab Total</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black font-mono">₹{filteredExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()}</div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Showing {filteredExpenses.length} filtered entries</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-2 shadow-none overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Recent Operational Ledger</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Date</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] bg-muted/20">Description</TableHead>
                                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/20">Mode</TableHead>
                                    <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Amount</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingExpenses ? <TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse">Syncing...</TableCell></TableRow> : 
                                    filteredExpenses.map(e => (
                                        <TableRow key={e.id} className="hover:bg-muted/5 group">
                                            <TableCell className="pl-6 py-4">
                                                <p className="font-black text-[10px] uppercase">{format(new Date(e.timestamp), 'MMM dd')}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{format(new Date(e.timestamp), 'p')}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black uppercase text-xs">{e.description}</span>
                                                    <Badge variant="outline" className="w-fit h-4 text-[7px] font-black uppercase border-primary/20 text-primary mt-1">{e.category || 'OPERATION'}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Badge variant="secondary" className="text-[8px] font-black uppercase">{e.paymentMethod || 'CASH'}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <div className="flex items-center justify-end gap-3">
                                                    <span className="font-mono font-black text-sm text-destructive">₹{e.amount.toLocaleString()}</span>
                                                    {user?.role === 'admin' && <Button variant="ghost" size="icon" onClick={() => deleteExpense(e.id, e.amount, e.description, user)} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"><Trash2 className="h-3.5 w-3.5" /></Button>}
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="inventory" className="space-y-6 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="bg-emerald-500/5 border-emerald-500/20 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2"><Package className="h-3.5 w-3.5" /> Stock Value</CardTitle></CardHeader>
                    <CardContent>
                        <div className="text-3xl font-black font-mono text-emerald-600">₹{filteredInventory.reduce((s, i) => s + i.totalCost, 0).toLocaleString()}</div>
                        <p className="text-[8px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">Audit based on {filteredInventory.length} inward logs</p>
                    </CardContent>
                </Card>
            </div>

            <Card className="border-2 shadow-none overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-black uppercase flex items-center gap-2"><Clock className="h-5 w-5 text-primary" /> Purchase Audit Trail</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                    <ScrollArea className="h-[500px]">
                        <Table>
                            <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                                <TableRow>
                                    <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Date</TableHead>
                                    <TableHead className="font-black uppercase text-[10px] bg-muted/20">Item / Stock</TableHead>
                                    <TableHead className="text-center font-black uppercase text-[10px] bg-muted/20">Inward Qty</TableHead>
                                    <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Total Cost</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {loadingInventory ? <TableRow><TableCell colSpan={4} className="h-32 text-center animate-pulse">Syncing...</TableCell></TableRow> : 
                                    filteredInventory.map(i => (
                                        <TableRow key={i.id} className="hover:bg-muted/5">
                                            <TableCell className="pl-6 py-4">
                                                <p className="font-black text-[10px] uppercase">{format(new Date(i.purchaseDate), 'MMM dd')}</p>
                                                <p className="text-[8px] font-bold text-muted-foreground uppercase">{format(new Date(i.purchaseDate), 'yyyy')}</p>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col">
                                                    <span className="font-black uppercase text-xs">{i.itemName}</span>
                                                    <Badge variant="outline" className="w-fit h-4 text-[7px] font-black uppercase border-emerald-500/20 text-emerald-600 mt-1">{i.category}</Badge>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <div className="flex flex-col">
                                                    <span className="font-black text-xs uppercase">{i.quantity} {i.unit}</span>
                                                    <span className="text-[7px] font-bold text-muted-foreground uppercase opacity-60">₹{Math.round(i.unitCost)} / unit</span>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right pr-6">
                                                <span className="font-mono font-black text-sm text-foreground">₹{i.totalCost.toLocaleString()}</span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                }
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
