
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Search, ShoppingBag, Utensils, Zap, Crown } from 'lucide-react';
import type { FoodItem, BillItem } from '@/lib/types';
import { useAuth } from '@/firebase/auth/use-user';
import { addOwnerConsumption } from '@/firebase/firestore/owner-consumption';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

interface OwnerConsumptionModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  foodItems: FoodItem[];
  onSuccess?: () => void;
}

export function OwnerConsumptionModal({ isOpen, onOpenChange, foodItems, onSuccess }: OwnerConsumptionModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<BillItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItems([]);
      setSearchTerm('');
    }
  }, [isOpen]);

  const filteredFood = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return foodItems
      .filter(f => f.name.toLowerCase().includes(term) || f.category.toLowerCase().includes(term))
      .sort((a, b) => a.category.localeCompare(b.category));
  }, [foodItems, searchTerm]);

  const handleAddItem = (item: FoodItem) => {
    setItems(prev => {
      const existing = prev.findIndex(i => i.itemId === item.id);
      if (existing > -1) {
        return prev.map((i, idx) => idx === existing ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { itemId: item.id, name: item.name, price: item.price, quantity: 1, addedAt: new Date().toISOString() }];
    });
  };

  const handleUpdateQuantity = (idx: number, delta: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, quantity: Math.max(0, item.quantity + delta) } : item).filter(i => i.quantity > 0));
  };

  const totalValue = items.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  const handleSave = async () => {
    if (!user || items.length === 0) return;
    setIsSubmitting(true);
    const result = await addOwnerConsumption(items, user);
    if (result) {
      toast({ title: "Internal Consumption Logged", description: `Opportunity cost of ₹${totalValue.toLocaleString()} recorded.` });
      onSuccess?.();
      onOpenChange(false);
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-4xl h-[85vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
        <DialogHeader className="p-6 bg-indigo-600 text-white shrink-0">
          <DialogTitle className="flex items-center gap-3 text-xl font-display uppercase tracking-tight">
            <Crown className="h-7 w-7 fill-current" />
            Owner Internal Order
          </DialogTitle>
          <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-widest mt-1">
            Logging items for Viren. Tracked as opportunity cost (NOT added to revenue).
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5">
          {/* MENU SIDE */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r overflow-hidden">
            <div className="p-4 bg-muted/20 border-b">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="SEARCH MENU CATALOG..." 
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="pl-10 h-11 bg-background border-2 font-black uppercase text-[10px] tracking-tight"
                />
              </div>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-2 pb-10">
                {filteredFood.map(food => (
                  <button 
                    key={food.id}
                    onClick={() => handleAddItem(food)}
                    className="p-3 rounded-xl border-2 bg-card hover:border-indigo-500 hover:bg-indigo-50 transition-all text-left flex justify-between items-center group active:scale-95 shadow-sm"
                  >
                    <div className="min-w-0 pr-2">
                      <p className="font-bold text-[11px] uppercase truncate group-hover:text-indigo-600">{food.name}</p>
                      <p className="text-[8px] font-black text-muted-foreground uppercase opacity-50">{food.category}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-xs">₹{food.price}</span>
                      <PlusCircle className="h-4 w-4 text-indigo-500 opacity-20 group-hover:opacity-100" />
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>

          {/* TRAY SIDE */}
          <div className="w-full md:w-[320px] flex flex-col bg-card shrink-0">
            <div className="p-4 bg-indigo-50 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-indigo-600" />
                <h3 className="font-black text-[10px] uppercase tracking-widest text-indigo-700">Internal Tray</h3>
              </div>
              <Badge className="bg-indigo-600 font-mono text-[10px]">{items.length}</Badge>
            </div>

            <ScrollArea className="flex-1 px-4">
              <Table>
                <TableBody>
                  {items.length > 0 ? items.map((item, idx) => (
                    <TableRow key={idx} className="border-b hover:bg-transparent">
                      <TableCell className="py-3 px-0">
                        <p className="font-bold text-[10px] uppercase leading-tight">{item.name}</p>
                        <p className="text-[8px] font-bold text-muted-foreground mt-0.5">Value: ₹{item.price}</p>
                      </TableCell>
                      <TableCell className="py-3 px-2">
                        <div className="flex items-center justify-end gap-2">
                          <button onClick={() => handleUpdateQuantity(idx, -1)} className="text-muted-foreground hover:text-destructive"><MinusCircle className="h-4 w-4" /></button>
                          <span className="min-w-3 text-center font-black text-xs font-mono">{item.quantity}</span>
                          <button onClick={() => handleUpdateQuantity(idx, 1)} className="text-muted-foreground hover:text-indigo-600"><PlusCircle className="h-4 w-4" /></button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={2} className="h-48 text-center opacity-30 italic font-bold uppercase text-[10px] tracking-widest">Tray Empty</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="p-6 bg-indigo-50/50 border-t space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-700/60">Shadow Total</span>
                <span className="text-2xl font-black font-mono text-indigo-600 tracking-tighter">₹{totalValue.toLocaleString()}</span>
              </div>
              <Button 
                disabled={isSubmitting || items.length === 0} 
                onClick={handleSave} 
                className="w-full h-14 bg-indigo-600 hover:bg-indigo-700 text-white font-black uppercase tracking-widest text-lg shadow-xl"
              >
                {isSubmitting ? "SYNCING..." : "COMMIT LOG"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
