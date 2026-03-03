
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { InventoryPurchase } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, Package, Calendar, User, Search, TrendingDown, Clock, Filter, ShoppingCart, IndianRupee } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { addInventoryPurchase } from '@/firebase/firestore/financials';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { ScrollArea } from '@/components/ui/scroll-area';

const units = ['kg', 'litre', 'packets', 'pieces', 'crates', 'boxes'];
const categories = ['Dairy', 'Frozen', 'Produce', 'Beverages', 'Dry Goods', 'Cleaning', 'Consumables', 'Hardware'];

export default function InventoryPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState<Omit<InventoryPurchase, 'id' | 'unitCost' | 'addedBy'>>({
    itemName: '',
    category: 'Frozen',
    quantity: 1,
    unit: 'kg',
    totalCost: 0,
    purchaseDate: new Date().toISOString().slice(0, 10),
    supplier: ''
  });

  const inventoryQuery = useMemo(() => !db ? null : query(collection(db, 'inventory'), orderBy('purchaseDate', 'desc'), limit(50)), [db]);
  const { data: history, loading } = useCollection<InventoryPurchase>(inventoryQuery);

  const filteredHistory = useMemo(() => {
    if (!history) return [];
    if (!searchTerm) return history;
    const term = searchTerm.toLowerCase();
    return history.filter(h => h.itemName.toLowerCase().includes(term) || h.category.toLowerCase().includes(term));
  }, [history, searchTerm]);

  const handleSave = async () => {
    if (!formData.itemName || !formData.totalCost || !user) {
        toast({ variant: 'destructive', title: "Missing Information" });
        return;
    }
    setIsSubmitting(true);
    const success = await addInventoryPurchase(formData, user);
    if (success) {
      toast({ title: "Inventory Recorded" });
      setIsModalOpen(false);
      setFormData({ itemName: '', category: 'Frozen', quantity: 1, unit: 'kg', totalCost: 0, purchaseDate: new Date().toISOString().slice(0, 10), supplier: '' });
    }
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">STOCK & INVENTORY</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">TRACKING OF RAW MATERIALS, SUPPLIES & UNIT COST EFFICIENCY</p>
        </div>
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
            <DialogTrigger asChild>
                <Button className="h-12 px-6 font-black uppercase tracking-tight shadow-xl bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-5 w-5" /> Record Stock Purchase
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
                <DialogHeader>
                    <DialogTitle className="font-headline text-xl">Stock Inward Entry</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Item Name</Label>
                        <Input value={formData.itemName} onChange={e => setFormData(p => ({...p, itemName: e.target.value}))} placeholder="e.g. MCCAIN FRIES (LARGE)" className="font-bold uppercase" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Category</Label>
                            <Select value={formData.category} onValueChange={(v) => setFormData(p => ({...p, category: v}))}>
                                <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                    {categories.map(c => <SelectItem key={c} value={c} className="text-[10px] uppercase font-bold">{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Quantity</Label>
                            <div className="flex gap-2">
                                <Input type="number" value={formData.quantity || ''} onChange={e => setFormData(p => ({...p, quantity: Number(e.target.value)}))} placeholder="Qty" className="font-mono font-bold" />
                                <Select value={formData.unit} onValueChange={(v) => setFormData(p => ({...p, unit: v}))}>
                                    <SelectTrigger className="w-24 font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {units.map(u => <SelectItem key={u} value={u} className="text-[10px] uppercase font-bold">{u}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Total Cost (₹)</Label>
                            <Input type="number" value={formData.totalCost || ''} onChange={e => setFormData(p => ({...p, totalCost: Number(e.target.value)}))} placeholder="0" className="font-mono font-bold border-emerald-500/20 bg-emerald-500/5" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Supplier (Optional)</Label>
                            <Input value={formData.supplier} onChange={e => setFormData(p => ({...p, supplier: e.target.value}))} placeholder="e.g. METRO" className="font-bold uppercase" />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Date of Purchase</Label>
                        <Input type="date" value={formData.purchaseDate} onChange={e => setFormData(p => ({...p, purchaseDate: e.target.value}))} className="font-bold" />
                    </div>
                </div>
                <DialogFooter>
                    <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-14 font-black uppercase tracking-widest shadow-xl bg-emerald-600 hover:bg-emerald-700">Finalize Entry</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
            <Card className="border-2 shadow-none bg-muted/5">
                <CardHeader>
                    <CardTitle className="text-sm font-black uppercase tracking-tight">Search Stock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="ITEM OR CATEGORY..." className="pl-10 h-11 border-2 font-bold uppercase text-[10px]" value={searchTerm} onChange={e => setSearchTerm(e.target.value)} />
                    </div>
                    <div className="p-4 rounded-xl bg-emerald-500/5 border-2 border-emerald-500/20 space-y-1">
                        <p className="text-[10px] font-black uppercase text-emerald-600">Inventory Estimate</p>
                        <div className="flex items-baseline gap-1">
                            <span className="text-2xl font-black">₹{filteredHistory.reduce((s, h) => s + h.totalCost, 0).toLocaleString()}</span>
                            <span className="text-[10px] font-bold opacity-50">SHOWN HISTORY</span>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>

        <Card className="lg:col-span-3 border-2 shadow-none overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <Clock className="h-5 w-5 text-primary" /> Purchase Audit Trail
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
                <ScrollArea className="h-[600px]">
                    <Table>
                        <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                            <TableRow>
                                <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Date</TableHead>
                                <TableHead className="font-black uppercase text-[10px] bg-muted/20">Item/Stock</TableHead>
                                <TableHead className="font-black uppercase text-[10px] bg-muted/20">Quantity</TableHead>
                                <TableHead className="font-black uppercase text-[10px] text-center bg-muted/20">Unit Price</TableHead>
                                <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Total Cost</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {loading ? (
                                <TableRow><TableCell colSpan={5} className="h-48 text-center animate-pulse">Syncing Inventory...</TableCell></TableRow>
                            ) : filteredHistory.map((item) => (
                                <TableRow key={item.id} className="hover:bg-muted/5">
                                    <TableCell className="pl-6 py-4">
                                        <p className="font-black text-[10px] uppercase">{format(new Date(item.purchaseDate), 'MMM dd')}</p>
                                        <p className="text-[8px] font-bold text-muted-foreground uppercase">{format(new Date(item.purchaseDate), 'yyyy')}</p>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase text-xs">{item.itemName}</span>
                                            <div className="flex items-center gap-2 mt-0.5">
                                                <Badge variant="outline" className="h-3.5 text-[7px] font-black uppercase py-0">{item.category}</Badge>
                                                {item.supplier && <span className="text-[8px] font-bold text-muted-foreground uppercase">Via: {item.supplier}</span>}
                                            </div>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <span className="font-bold text-xs uppercase">{item.quantity} {item.unit}</span>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black font-mono text-emerald-600">₹{item.unitCost.toFixed(1)}</span>
                                            <span className="text-[7px] font-bold text-muted-foreground uppercase leading-none">per {item.unit.slice(0, -1) || 'unit'}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <span className="font-mono font-black text-sm">₹{item.totalCost.toLocaleString()}</span>
                                    </TableCell>
                                </TableRow>
                            ))}
                            {filteredHistory.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={5} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No inventory records found.</TableCell>
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
