
'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Station, FoodItem, BillItem, GamingPackage, Member, AssignedMember, PaymentMethod } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Save, Ticket, CreditCard, Search, ShoppingBag, Utensils, Tag, X } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from "@radix-ui/react-dialog";

interface BillModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  station: Station | null;
  allMembers: Member[];
  foodItems: FoodItem[];
  onSaveBill: (stationId: string, newBill: BillItem[], newDiscount: number) => void;
  gamingPackages: GamingPackage[];
  onConfirmCheckout: (stationId: string, finalBill: number, billItems: BillItem[], discount: number, paymentMethod: PaymentMethod) => void;
  onStartFoodSession: (stationId: string, assignedPlayers: AssignedMember[]) => void;
}

export function BillModal({ 
    isOpen, onOpenChange, station, foodItems, 
    onSaveBill, gamingPackages, onConfirmCheckout 
}: BillModalProps) {
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'review'>('menu');
  
  useEffect(() => {
    if (isOpen) {
        if (station) {
            setBillItems(station.currentBill || []);
            setDiscount(station.discount || 0);
        }
        setSearchTerm('');
        setActiveTab('menu');
    }
  }, [station, isOpen]);

  const categories = useMemo(() => {
    const cats = Array.from(new Set(foodItems.map(item => item.category)));
    return cats.sort();
  }, [foodItems]);

  useEffect(() => {
    if (categories.length > 0 && !activeCategory) {
        setActiveCategory(categories[0]);
    }
  }, [categories, activeCategory]);

  const menuByCategory = useMemo(() => {
    return foodItems.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {} as Record<string, FoodItem[]>);
  }, [foodItems]);

  const filteredMenu = useMemo(() => {
    if (!searchTerm) return menuByCategory;
    
    const term = searchTerm.toLowerCase();
    const filtered: Record<string, FoodItem[]> = {};
    
    Object.entries(menuByCategory).forEach(([cat, items]) => {
        const matches = items.filter(i => i.name.toLowerCase().includes(term));
        if (matches.length > 0) filtered[cat] = matches;
    });
    
    return filtered;
  }, [menuByCategory, searchTerm]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    const element = document.getElementById(`category-section-${category}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleAddItem = (item: FoodItem | { id: string, name: string, price: number }) => {
    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(bi => bi.itemId === item.id && bi.name === item.name);
      if (existingItemIndex > -1) {
        return prevItems.map((bi, i) => i === existingItemIndex ? { ...bi, quantity: bi.quantity + 1 } : bi);
      } else {
        return [...prevItems, { itemId: item.id, name: item.name, price: item.price, quantity: 1, addedAt: new Date().toISOString() }];
      }
    });
  };

  const handleUpdateQuantityByIndex = (index: number, newQuantity: number) => {
    setBillItems(prevItems => {
        if (newQuantity <= 0) {
            return prevItems.filter((_, i) => i !== index);
        }
        return prevItems.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
    });
  };

  const foodSubtotal = useMemo(() => {
    return billItems.filter(item => !item.name.startsWith('Time:') && !item.name.startsWith('Buy Recharge:') && !item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);

  const timePackageTotal = useMemo(() => {
    return billItems.filter(item => item.name.startsWith('Time:') || item.name.startsWith('Buy Recharge:') || item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);
  
  const initialPackagePrice = useMemo(() => {
    if (!station || !station.packageName || station.packageName === 'Walk-in Order') return 0;
    
    // Robust check for itemized session items to prevent double charging
    const hasItemizedSessionItems = billItems.some(i => {
        const nameLower = i.name.toLowerCase();
        const pkgNameLower = station.packageName!.toLowerCase();
        return (
            station.members.some(m => nameLower.includes(`(${m.name.toLowerCase()})`)) ||
            nameLower.startsWith('time:') ||
            nameLower.startsWith('buy recharge:') ||
            nameLower.startsWith('recharge:') ||
            nameLower === pkgNameLower
        );
    });

    if (hasItemizedSessionItems) return 0;

    const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
    const pkg = gamingPackages.find(p => p.name.toLowerCase() === pureName.toLowerCase());
    if (!pkg) return 0;

    const numberOfPlayers = station.members.length > 0 ? station.members.length : 1;
    const capacity = pkg.playerCapacity || 1;
    return pkg.price * Math.ceil(numberOfPlayers / capacity);
  }, [station, gamingPackages, billItems]);

  const totalBeforeDiscount = foodSubtotal + initialPackagePrice + timePackageTotal;
  const finalTotal = Math.max(0, totalBeforeDiscount - discount);

  const handleSave = () => {
    if (station) {
      onSaveBill(station.id, billItems, discount);
      onOpenChange(false);
    }
  };
  
  const handleCheckout = () => {
    if (station) {
      onSaveBill(station.id, billItems, discount);
      onConfirmCheckout(station.id, finalTotal, billItems, discount, 'cash');
      onOpenChange(false);
    }
  };

  if (!station) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] md:max-w-6xl h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <div className="flex flex-col shrink-0 bg-background border-b z-20">
            <DialogHeader className="px-4 pt-3 md:px-5 md:pt-4 pb-1 relative">
                <div className="flex justify-between items-start gap-2 pr-8">
                    <div className="min-w-0">
                        <DialogTitle className="font-headline tracking-[0.1em] text-lg md:text-2xl text-primary truncate">{station.name}</DialogTitle>
                        <DialogDescription className="font-bold text-[8px] uppercase tracking-widest text-muted-foreground hidden sm:block">
                            Station Management
                        </DialogDescription>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1 min-w-0">
                        {station.members.map(m => (
                            <Badge key={m.id} variant="outline" className="h-5 md:h-7 gap-1 pl-1 pr-2 rounded-full bg-muted/50 border-primary/20">
                                <Avatar className="h-3.5 w-3.5 md:h-5 md:w-5 border-none"><AvatarFallback className="text-[6px] md:text-[9px]">{m.name[0]}</AvatarFallback></Avatar>
                                <span className="font-black text-[6px] md:text-[9px] uppercase truncate max-w-[45px]">{m.name}</span>
                            </Badge>
                        ))}
                    </div>
                </div>
                <DialogPrimitive.Close className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
                    <X className="h-5 w-5" />
                    <span className="sr-only">Close</span>
                </DialogPrimitive.Close>
            </DialogHeader>

            <div className="flex md:hidden w-full bg-background border-t">
                <button 
                    onClick={() => setActiveTab('menu')}
                    className={cn(
                        "flex-1 h-10 font-black uppercase text-[9px] tracking-widest border-b-4 transition-all", 
                        activeTab === 'menu' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground"
                    )}
                >
                    <Utensils className="inline h-3 w-3 mr-1" /> Menu
                </button>
                <button 
                    onClick={() => setActiveTab('review')}
                    className={cn(
                        "flex-1 h-10 font-black uppercase text-[9px] tracking-widest border-b-4 transition-all flex items-center justify-center gap-2", 
                        activeTab === 'review' ? "border-primary text-primary bg-primary/5" : "border-transparent text-muted-foreground"
                    )}
                >
                    <ShoppingBag className="h-3 w-3" /> Review
                    <Badge className="font-mono h-3.5 px-1 min-w-[16px] bg-primary text-primary-foreground text-[8px]">{billItems.length}</Badge>
                </button>
            </div>

            {activeTab === 'menu' && (
                <div className="flex flex-col bg-card">
                    <div className="px-3 py-1.5 md:p-3 bg-muted/10 border-b">
                        <div className="relative">
                            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                            <Input 
                                placeholder="SEARCH ITEMS..." 
                                className="pl-7 h-8 md:h-10 bg-background border-none font-black uppercase tracking-tight text-[9px] md:text-xs"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="flex md:hidden overflow-x-auto no-scrollbar scroll-smooth bg-background border-b">
                        {categories.map(cat => (
                            <button 
                                key={cat} 
                                onClick={() => scrollToCategory(cat)}
                                className={cn(
                                    "px-3 py-2 text-center border-b-2 transition-all whitespace-nowrap shrink-0",
                                    activeCategory === cat 
                                        ? "border-primary text-primary font-black bg-primary/5" 
                                        : "border-transparent text-muted-foreground font-bold"
                                )}
                            >
                                <span className="text-[8px] uppercase tracking-[0.1em]">{cat}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5">
            <div className={cn(
                "hidden md:flex bg-card border-r shrink-0 flex-col overflow-y-auto w-40",
                activeTab === 'review' && "md:hidden"
            )}>
                {categories.map(cat => (
                    <button 
                        key={cat} 
                        onClick={() => scrollToCategory(cat)}
                        className={cn(
                            "px-5 py-4 text-left border-l-4 transition-all",
                            activeCategory === cat 
                                ? "bg-primary/10 border-primary text-primary font-black" 
                                : "border-transparent text-muted-foreground font-bold hover:bg-muted"
                        )}
                    >
                        <span className="text-[10px] uppercase tracking-[0.1em]">{cat}</span>
                    </button>
                ))}
            </div>

            <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", activeTab === 'review' && "hidden md:flex")}>
                <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-5 md:py-4 scroll-smooth">
                    <div className="space-y-8 md:space-y-10 pb-16">
                        {Object.entries(filteredMenu).map(([category, items]) => (
                            <div key={category} id={`category-section-${category}`} className="space-y-2 md:space-y-3">
                                <h3 className="sticky top-[-1px] z-10 font-headline text-[9px] md:text-xs tracking-widest text-muted-foreground/60 bg-background/95 backdrop-blur-sm border-b border-dashed py-1.5 uppercase shadow-sm">
                                    {category}
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 md:gap-2.5">
                                    {items.map(item => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => handleAddItem(item)}
                                            className="group p-2.5 md:p-3 rounded-lg md:rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between h-16 md:h-24 relative overflow-hidden active:scale-95 shadow-sm"
                                        >
                                            <p className="font-black uppercase text-[9px] md:text-[11px] leading-tight tracking-tight pr-8 group-hover:text-primary transition-colors line-clamp-2">{item.name}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-black text-xs md:text-base">₹{item.price}</span>
                                                <PlusCircle className="h-3.5 w-3.5 md:h-5 md:w-5 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                            <div className="absolute -right-3 -bottom-3 bg-primary/5 rounded-full h-8 w-8 md:h-12 md:w-12 group-hover:scale-150 transition-transform duration-500" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className={cn(
                "w-full md:w-[320px] bg-card border-t md:border-t-0 md:border-l shrink-0 flex flex-col overflow-hidden shadow-2xl transition-all",
                activeTab === 'menu' && "hidden md:flex"
            )}>
                <div className="p-3 border-b bg-muted/10 shrink-0 flex justify-between items-center">
                    <h3 className="font-black text-[9px] md:text-[10px] uppercase tracking-[0.1em] flex items-center gap-1.5">
                        <ShoppingBag className="h-3.5 w-3.5 text-primary" />
                        Bill Audit
                    </h3>
                    <Badge className="font-mono h-4 px-1.5 bg-primary text-primary-foreground text-[10px]">{billItems.length}</Badge>
                </div>

                <ScrollArea className="flex-1 px-3 min-h-0 bg-background/50">
                    <Table>
                        <TableBody>
                            {billItems.length > 0 ? billItems.map((item, idx) => (
                                <TableRow key={`${item.itemId}-${idx}`} className="border-b hover:bg-transparent">
                                    <TableCell className="py-2.5 md:py-3 pl-0">
                                        <p className="font-black text-[9px] md:text-[11px] uppercase leading-tight">{item.name}</p>
                                        <p className="text-[8px] md:text-[9px] font-bold text-muted-foreground mt-0.5">₹{item.price} x {item.quantity}</p>
                                    </TableCell>
                                    <TableCell className="py-2.5 md:py-3 px-0">
                                        <div className="flex items-center justify-end gap-1.5 md:gap-2">
                                            <button onClick={() => handleUpdateQuantityByIndex(idx, item.quantity - 1)} className="text-muted-foreground hover:text-destructive"><MinusCircle className="h-4 w-4" /></button>
                                            <span className="min-w-3 text-center font-black text-xs">{item.quantity}</span>
                                            <button onClick={() => handleAddItem({ id: item.itemId, name: item.name, price: item.price })} className="text-muted-foreground hover:text-green-600"><PlusCircle className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2.5 md:py-3 pr-0 font-black text-[11px] md:text-xs font-mono whitespace-nowrap text-primary">
                                        ₹{(item.price * item.quantity).toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            )) : (
                                <TableRow>
                                    <TableCell colSpan={3} className="text-center py-16 text-[9px] italic font-bold text-muted-foreground uppercase tracking-widest opacity-40">
                                        No items added
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </ScrollArea>

                <div className="p-3 md:p-4 border-t bg-muted/20 space-y-2.5 md:space-y-3 shrink-0">
                    <div className="space-y-1.5">
                        {initialPackagePrice > 0 && (
                            <div className="flex justify-between items-center text-[8px] md:text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                                <span className="flex items-center gap-1.5"><Ticket className="h-2.5 w-2.5" /> Initial Package</span>
                                <span className="font-mono">₹{initialPackagePrice.toLocaleString()}</span>
                            </div>
                        )}
                        <div className="flex justify-between items-center text-[8px] md:text-[9px] font-bold uppercase text-muted-foreground tracking-widest">
                            <span>Items Subtotal</span>
                            <span className="font-mono">₹{(foodSubtotal + timePackageTotal).toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                                <Label htmlFor="discount-in" className="text-[8px] md:text-[9px] font-black uppercase tracking-widest flex items-center gap-1"><Tag className="h-2.5 w-2.5 text-destructive"/> Discount</Label>
                                <Input 
                                    id="discount-in" type="number" 
                                    value={discount || ''} 
                                    onChange={e => setDiscount(Math.max(0, Math.min(totalBeforeDiscount, Number(e.target.value))))}
                                    className="w-12 md:w-14 h-6 text-right bg-background font-mono text-[9px] border-primary/20"
                                    placeholder="0"
                                />
                            </div>
                            <span className="font-mono font-bold text-destructive text-[10px] md:text-xs">- ₹{discount.toLocaleString()}</span>
                        </div>
                    </div>
                    
                    <Separator className="bg-primary/20" />
                    
                    <div className="flex justify-between items-center">
                        <span className="text-[8px] md:text-[9px] font-black uppercase tracking-[0.15em] text-muted-foreground">Total Paid</span>
                        <span className="text-xl md:text-2xl font-black text-primary font-mono tracking-tighter">₹{finalTotal.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 p-2.5 md:p-3 border-t bg-background shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="flex gap-2 w-full sm:flex-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1 font-black uppercase tracking-[0.1em] h-10 md:h-12 border-2 text-[9px] md:text-[10px]">Cancel</Button>
            <Button variant="secondary" size="sm" onClick={handleSave} className="flex-1 font-black uppercase tracking-[0.1em] h-10 md:h-12 border-2 text-[9px] md:text-[10px]"><Save className="mr-1 h-3.5 w-3.5" /> Save</Button>
          </div>
          <Button size="sm" onClick={handleCheckout} className="w-full sm:flex-[2] font-black uppercase tracking-[0.1em] h-10 md:h-12 shadow-lg text-xs md:text-sm"><CreditCard className="mr-1.5 h-4 w-4 md:h-5 md:w-5"/> Pay & Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
