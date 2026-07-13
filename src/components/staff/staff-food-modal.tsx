'use client';
import { useState, useMemo, useEffect } from 'react';
import type { FoodItem, BillItem, Employee, StaffOrder } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, ShoppingBag, Utensils, Search, AlertTriangle, ShieldCheck, History } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';

interface StaffFoodModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  employee: Employee;
  activeCycle: string;
  onSave: (items: BillItem[], totalAmount: number, newBalance: number) => Promise<void>;
}

export function StaffFoodModal({ isOpen, onOpenChange, employee, activeCycle, onSave }: StaffFoodModalProps) {
  const { db } = useFirebase();
  const [orderItems, setOrderItems] = useState<BillItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'menu' | 'history'>('menu');

  // Fetch food items
  const itemsCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'foodItems');
  }, [db]);
  const { data: foodItems, loading: loadingItems } = useCollection<FoodItem>(itemsCollection);

  // Fetch staff orders
  const myOrdersQuery = useMemo(() => {
    if (!db || !employee.username) return null;
    return query(
      collection(db, 'staffOrders'),
      where('employeeUsername', '==', employee.username)
    );
  }, [db, employee.username]);
  const { data: myOrders, loading: loadingOrders } = useCollection<StaffOrder>(myOrdersQuery);

  const sortedOrders = useMemo(() => {
    if (!myOrders) return [];
    return [...myOrders].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [myOrders]);

  useEffect(() => {
    if (isOpen) {
      setOrderItems([]);
      setSearchTerm('');
      setActiveTab('menu');
    }
  }, [isOpen]);

  const quota = employee.foodAllowanceBalance ?? 1000;

  const menuByCategory = useMemo(() => {
    if (!foodItems) return {};
    const filteredFood = searchTerm
      ? foodItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()) || item.category.toLowerCase().includes(searchTerm.toLowerCase()))
      : foodItems;
    return filteredFood.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {} as Record<string, FoodItem[]>);
  }, [foodItems, searchTerm]);

  const handleAddItem = (id: string, name: string, price: number) => {
    setOrderItems(prev => {
      const existingIndex = prev.findIndex(oi => oi.itemId === id);
      if (existingIndex > -1) {
        return prev.map((oi, i) => i === existingIndex ? { ...oi, quantity: oi.quantity + 1 } : oi);
      }
      return [...prev, { itemId: id, name, price, quantity: 1, addedAt: new Date().toISOString() }];
    });
  };

  const handleUpdateQuantityByIndex = (index: number, newQuantity: number) => {
    setOrderItems(prev => {
      if (newQuantity <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
    });
  };

  const totalAmount = useMemo(() =>
    orderItems.reduce((total, item) => total + item.price * item.quantity, 0),
  [orderItems]);

  const newBalance = quota - totalAmount;
  const isOverQuota = newBalance < 0;

  const handlePlaceOrder = async () => {
    if (orderItems.length === 0 || isOverQuota) return;
    setIsSaving(true);
    try {
      await onSave(orderItems, totalAmount, newBalance);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-5xl h-[90vh] md:h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 md:p-6 bg-muted/10 border-b shrink-0">
          <DialogTitle className="font-headline text-lg md:text-2xl text-primary tracking-tight flex items-center gap-3">
            <Utensils className="h-6 w-6" />
            Place Staff Food Order
          </DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Order meals against your monthly allowance. Placed orders automatically deduct from your quota.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5">
          {/* LEFT COLUMN: Food Catalog or Order History */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r overflow-hidden">
            {/* Tab Selector */}
            <div className="flex border-b bg-muted/10 p-2 gap-2 shrink-0">
              <Button
                variant={activeTab === 'menu' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('menu')}
                className="flex-1 font-black uppercase text-[10px] tracking-tight h-8 rounded-lg"
              >
                <Utensils className="mr-1.5 h-3.5 w-3.5" />
                Order Menu
              </Button>
              <Button
                variant={activeTab === 'history' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setActiveTab('history')}
                className="flex-1 font-black uppercase text-[10px] tracking-tight h-8 rounded-lg relative"
              >
                <History className="mr-1.5 h-3.5 w-3.5" />
                Order History
                {sortedOrders.length > 0 && (
                  <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-[8px] font-black">{sortedOrders.length}</Badge>
                )}
              </Button>
            </div>

            {activeTab === 'menu' ? (
              <>
                <div className="p-3 bg-muted/20 border-b space-y-3 shrink-0">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="SEARCH MENU ITEMS..."
                      className="pl-8 h-9 bg-background border-2 font-black uppercase text-[10px] tracking-tight"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {loadingItems ? (
                    <div className="py-20 text-center font-headline text-xs animate-pulse opacity-50">Syncing Menu...</div>
                  ) : Object.keys(menuByCategory).length > 0 ? (
                    <div className="space-y-6">
                      {Object.entries(menuByCategory).map(([category, items]) => (
                        <div key={category} className="space-y-2">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-primary/70 px-1">{category}</h4>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {items.map(item => (
                              <div
                                key={item.id}
                                onClick={() => handleAddItem(item.id, item.name, item.price)}
                                className="flex items-center justify-between p-3 rounded-lg border-2 bg-background hover:bg-primary/5 hover:border-primary/40 cursor-pointer transition-all active:scale-[0.98] select-none group"
                              >
                                <span className="font-bold text-xs uppercase tracking-tight text-foreground group-hover:text-primary transition-colors">{item.name}</span>
                                <span className="font-mono font-black text-xs text-muted-foreground">₹{item.price}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="py-20 text-center text-xs uppercase font-black tracking-widest opacity-20 italic">No matching food items found</div>
                  )}
                </ScrollArea>
              </>
            ) : (
              <ScrollArea className="flex-1 p-4 bg-muted/5">
                {loadingOrders ? (
                  <div className="py-20 text-center font-headline text-xs animate-pulse opacity-50">Syncing History...</div>
                ) : sortedOrders.length > 0 ? (
                  <div className="space-y-3">
                    {sortedOrders.map((order, idx) => (
                      <div key={order.id || idx} className="p-3.5 bg-background border-2 border-foreground/5 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-mono text-muted-foreground">
                            {new Date(order.timestamp).toLocaleString(undefined, {
                              month: 'short',
                              day: 'numeric',
                              hour: 'numeric',
                              minute: '2-digit',
                              hour12: true
                            })}
                          </span>
                          <span className="font-mono font-black text-xs text-emerald-500">₹{order.totalAmount}</span>
                        </div>
                        <Separator className="opacity-50" />
                        <div className="space-y-1">
                          {order.items?.map((item, itemIdx) => (
                            <div key={itemIdx} className="flex justify-between text-[11px] font-bold">
                              <span className="text-foreground/80 uppercase">
                                {item.name} <span className="text-[9px] text-muted-foreground">x{item.quantity}</span>
                              </span>
                              <span className="font-mono text-muted-foreground">₹{item.price * item.quantity}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-20 text-center text-xs uppercase font-black tracking-widest opacity-20 italic">No past orders recorded</div>
                )}
              </ScrollArea>
            )}
          </div>

          {/* RIGHT COLUMN: Cart & Quota check */}
          <div className="w-full md:w-[360px] bg-background flex flex-col overflow-hidden">
            {/* Employee Allowance Summary */}
            <div className="p-4 bg-muted/20 border-b space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Ordering For</span>
                <span className="font-black text-xs uppercase text-foreground">{employee.displayName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase text-muted-foreground">Current Allowance</span>
                <span className="font-mono font-black text-sm text-emerald-600">₹{quota.toLocaleString()}</span>
              </div>
            </div>

            {/* Selected Items List */}
            <div className="flex-1 overflow-hidden flex flex-col">
              <div className="p-3 bg-muted/10 border-b flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <span className="text-[10px] font-black uppercase tracking-widest">Order items ({orderItems.reduce((s, i) => s + i.quantity, 0)})</span>
              </div>
              <ScrollArea className="flex-1">
                {orderItems.length > 0 ? (
                  <Table>
                    <TableBody>
                      {orderItems.map((item, idx) => (
                        <TableRow key={item.itemId} className="hover:bg-transparent border-b">
                          <TableCell className="py-3 pl-3 pr-1">
                            <div className="flex flex-col gap-0.5">
                              <span className="font-bold text-xs uppercase tracking-tight leading-tight">{item.name}</span>
                              <span className="font-mono text-[10px] text-muted-foreground">₹{item.price} × {item.quantity}</span>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 px-1 text-center w-24">
                            <div className="flex items-center justify-center gap-1.5">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                onClick={() => handleUpdateQuantityByIndex(idx, item.quantity - 1)}
                              >
                                <MinusCircle className="h-4 w-4" />
                              </Button>
                              <span className="font-mono font-bold text-xs">{item.quantity}</span>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6 text-muted-foreground hover:text-primary"
                                onClick={() => handleUpdateQuantityByIndex(idx, item.quantity + 1)}
                              >
                                <PlusCircle className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell className="py-3 pl-1 pr-3 text-right font-mono font-black text-xs w-20">
                            ₹{item.price * item.quantity}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="py-20 text-center text-[10px] font-black uppercase tracking-widest opacity-20 italic">Order cart is empty</div>
                )}
              </ScrollArea>
            </div>

            {/* Calculations & Order Button */}
            <div className="p-4 bg-muted/20 border-t space-y-4">
              <div className="space-y-1.5 font-bold text-xs uppercase">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-black text-[10px]">Subtotal</span>
                  <span className="font-mono font-bold">₹{totalAmount.toLocaleString()}</span>
                </div>
                <Separator className="my-1.5" />
                <div className="flex justify-between items-center">
                  <span className="text-foreground font-black text-[11px]">Total Deducted</span>
                  <span className="font-mono font-black text-sm">₹{totalAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground font-black text-[10px]">Remaining Balance</span>
                  <span className={cn("font-mono font-black text-sm", isOverQuota ? "text-destructive" : "text-emerald-600")}>
                    ₹{newBalance.toLocaleString()}
                  </span>
                </div>
              </div>

              {isOverQuota && (
                <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-[10px] font-black uppercase tracking-tight animate-shake">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>Deduction exceeds available quota by ₹{Math.abs(newBalance).toLocaleString()}!</span>
                </div>
              )}

              {!isOverQuota && orderItems.length > 0 && (
                <div className="flex items-center gap-2 p-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg text-emerald-600 text-[9px] font-bold uppercase tracking-tight">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                  <span>Valid Staff Order</span>
                </div>
              )}

              <Button
                disabled={orderItems.length === 0 || isOverQuota || isSaving}
                onClick={handlePlaceOrder}
                className="w-full h-12 font-black uppercase tracking-widest text-xs shadow-lg"
              >
                {isSaving ? "Placing Order..." : "Confirm Staff Order"}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
