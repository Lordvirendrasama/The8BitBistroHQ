'use client';

import { useState, useEffect, useMemo } from 'react';
import type { Station, FoodItem, BillItem, GamingPackage, Member, AssignedMember, PaymentMethod, Bill } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Save, Ticket, CreditCard, Search, ShoppingBag, Utensils, Tag, X, Gamepad2, Flame, Clock, CheckCircle2 } from 'lucide-react';
import { Separator } from '../ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, limit } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { useToast } from '@/hooks/use-toast';

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
  onCheckoutClick?: (stationId: string) => void;
}

export function BillModal({ 
    isOpen, onOpenChange, station, foodItems, 
    onSaveBill, gamingPackages, onConfirmCheckout, onCheckoutClick
}: BillModalProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [activeCategory, setActiveCategory] = useState<string>('SESSION');
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'menu' | 'review'>('menu');
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Live Clock for remaining session time
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch bills to determine real popularity (optional metadata)
  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'bills'), orderBy('timestamp', 'desc'), limit(200)), [db]);
  const { data: recentBills } = useCollection<Bill>(billsQuery);

  useEffect(() => {
    if (isOpen && station) {
        setBillItems(station.currentBill || []);
        setDiscount(station.discount || 0);
        setSearchTerm('');
        setActiveCategory('SESSION');
        setActiveTab('menu');
    }
  }, [isOpen, station?.id]);

  // Master Categories
  const categories = ["SESSION", "FOOD", "BEVERAGES", "ADD ONS"];

  // Helper to map raw product category to Master POS Categories
  const getMasterCategory = (item: FoodItem) => {
    const cat = item.category.toLowerCase();
    const name = item.name.toLowerCase();
    
    if (
      cat.includes('coffee') || 
      cat.includes('beverage') || 
      cat.includes('drink') || 
      cat.includes('tea') || 
      name.includes('coffee') || 
      name.includes('hot chocolate') || 
      name.includes('tea') || 
      name.includes('latte') || 
      name.includes('water') || 
      name.includes('drink') || 
      name.includes('shake') || 
      name.includes('cooler')
    ) {
      return 'BEVERAGES';
    }
    
    if (cat.includes('add-on') || cat.includes('addon') || cat.includes('add ons') || cat.includes('add-ons') || cat.includes('dip')) {
      return 'ADD ONS';
    }
    
    return 'FOOD';
  };

  // Group food items under master categories, filtering by search query
  const menuByMasterCategory = useMemo(() => {
    const term = searchTerm.toLowerCase();
    const grouped: Record<string, FoodItem[]> = {
      FOOD: [],
      BEVERAGES: [],
      'ADD ONS': []
    };
    
    foodItems.forEach(item => {
      if (term && !item.name.toLowerCase().includes(term)) return;
      const mCat = getMasterCategory(item);
      grouped[mCat].push(item);
    });
    
    return grouped;
  }, [foodItems, searchTerm]);

  // Filter gaming packages based on search query
  const filteredGaming = useMemo(() => {
    if (!gamingPackages) return [];
    const term = searchTerm.toLowerCase();
    return gamingPackages
        .filter(p => !p.isAddTimePackage && !p.isRechargePack)
        .filter(p => p.name.toLowerCase().includes(term));
  }, [gamingPackages, searchTerm]);

  const scrollToCategory = (category: string) => {
    setActiveCategory(category);
    const element = document.getElementById(`category-section-${category.replace(/\s+/g, '-')}`);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Updates local bill items state when an item is added
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

  // Updates local bill items state when quantity is adjusted
  const handleUpdateQuantityByIndex = (index: number, newQuantity: number) => {
    setBillItems(prevItems => {
        if (newQuantity <= 0) {
            return prevItems.filter((_, i) => i !== index);
        } else {
            return prevItems.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
        }
    });
  };

  const handleSave = () => {
    if (station) {
      onSaveBill(station.id, billItems, discount);
      toast({
        title: "Session Saved",
        description: `${station.name} tab has been updated successfully.`
      });
      onOpenChange(false);
    }
  };

  // Helper for Sticky Quick Add Bar actions
  const handleQuickAdd = (type: 'time' | 'food', searchKey: string) => {
    if (type === 'time') {
      const pkg = gamingPackages.find(p => 
        !p.isAddTimePackage && 
        !p.isRechargePack && 
        p.name.toLowerCase().includes(searchKey.toLowerCase())
      );
      if (pkg) {
        handleAddItem({ id: pkg.id, name: pkg.name, price: pkg.price });
      } else {
        toast({ variant: 'destructive', title: 'Package Not Found', description: `Could not find any package matching ${searchKey}.` });
      }
    } else {
      const food = foodItems.find(f => 
        f.name.toLowerCase().includes(searchKey.toLowerCase())
      );
      if (food) {
        handleAddItem(food);
      } else {
        toast({ variant: 'destructive', title: 'Product Not Found', description: `Could not find any product matching ${searchKey}.` });
      }
    }
  };

  const foodSubtotal = useMemo(() => {
    return billItems.filter(item => !item.name.startsWith('Time:') && !item.name.startsWith('Buy Recharge:') && !item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);

  const timePackageTotal = useMemo(() => {
    return billItems.filter(item => item.name.startsWith('Time:') || item.name.startsWith('Buy Recharge:') || item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);
  
  const initialPackagePrice = useMemo(() => {
    if (!station || !station.packageName || station.packageName === 'Walk-in Order') return 0;
    
    const hasItemizedSessionItems = billItems.some(i => {
        const nameLower = i.name.toLowerCase();
        const pkgNameLower = station.packageName!.toLowerCase();
        const isGamingPackage = gamingPackages.some(p => p.name.toLowerCase() === nameLower);
        return (
            (station.members || []).some(m => nameLower.includes(`(${m.name.toLowerCase()})`)) ||
            nameLower.startsWith('time:') ||
            nameLower.startsWith('buy recharge:') ||
            nameLower.startsWith('recharge:') ||
            nameLower === pkgNameLower ||
            isGamingPackage
        );
    });

    if (hasItemizedSessionItems) return 0;

    const pureName = station.packageName.replace(/^(Recharge: |Buy Recharge: )/i, '').trim();
    const pkg = gamingPackages.find(p => p.name.toLowerCase() === pureName.toLowerCase());
    if (!pkg) return 0;

    const numberOfPlayers = (station.members || []).length > 0 ? station.members.length : 1;
    const capacity = pkg.playerCapacity || 1;
    return pkg.price * Math.ceil(numberOfPlayers / capacity);
  }, [station, gamingPackages, billItems]);

  const totalBeforeDiscount = foodSubtotal + initialPackagePrice + timePackageTotal;

  // Checkout redirects either to dedicated checkout drawer callback or defaults to confirming cash
  const handleCheckout = () => {
    if (station) {
      onSaveBill(station.id, billItems, discount);
      if (onCheckoutClick) {
        onCheckoutClick(station.id);
        onOpenChange(false);
      } else {
        onConfirmCheckout(station.id, totalBeforeDiscount - discount, billItems, discount, 'cash');
        onOpenChange(false);
      }
    }
  };

  if (!station) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[98vw] md:max-w-7xl h-[92vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
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
                        {(station.members || []).map(m => (
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
                    Review
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
                                    "px-4 py-2.5 text-center border-b-2 transition-all whitespace-nowrap shrink-0",
                                    activeCategory === cat 
                                        ? "border-primary text-primary font-black bg-primary/5" 
                                        : "border-transparent text-muted-foreground font-bold"
                                )}
                            >
                                <span className="text-[13px] md:text-[14px] uppercase tracking-[0.1em]">{cat}</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5 position-relative">
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
                        <span className="text-[15px] md:text-[16px] uppercase tracking-[0.1em] flex items-center gap-2">
                            {cat}
                        </span>
                    </button>
                ))}
            </div>

            <div className={cn("flex-1 flex flex-col min-w-0 overflow-hidden", activeTab === 'review' && "hidden md:flex")}>
                <div className="flex-1 overflow-y-auto overscroll-contain px-3 py-3 md:px-5 md:py-4 scroll-smooth">
                    <div className="space-y-6 pb-16">
                        
                        {/* STICKY QUICK ADD BAR */}
                        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b pb-3 mb-4 shrink-0">
                            <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground mb-1.5 px-1">Quick Add</p>
                            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 px-3.5 rounded-full border-2 border-primary/20 hover:border-primary text-[10px] font-black uppercase tracking-tight shrink-0 gap-1"
                                    onClick={() => handleQuickAdd('time', '1 hour')}
                                >
                                    +1 Hour
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 px-3.5 rounded-full border-2 border-primary/20 hover:border-primary text-[10px] font-black uppercase tracking-tight shrink-0 gap-1"
                                    onClick={() => handleQuickAdd('time', 'half')}
                                >
                                    +30 Min
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 px-3.5 rounded-full border-2 border-primary/20 hover:border-primary text-[10px] font-black uppercase tracking-tight shrink-0 gap-1"
                                    onClick={() => handleQuickAdd('food', 'cold coffee')}
                                >
                                    Cold Coffee
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 px-3.5 rounded-full border-2 border-primary/20 hover:border-primary text-[10px] font-black uppercase tracking-tight shrink-0 gap-1"
                                    onClick={() => handleQuickAdd('food', 'water')}
                                >
                                    Water
                                </Button>
                                <Button 
                                    size="sm" 
                                    variant="outline" 
                                    className="h-9 px-3.5 rounded-full border-2 border-primary/20 hover:border-primary text-[10px] font-black uppercase tracking-tight shrink-0 gap-1"
                                    onClick={() => handleQuickAdd('food', 'fries')}
                                >
                                    Fries
                                </Button>
                            </div>
                        </div>

                        {/* SESSION MASTER CATEGORY */}
                        {filteredGaming.length > 0 && (
                            <div key="SESSION" id="category-section-SESSION" className="space-y-2 md:space-y-3">
                                <h3 className="sticky top-[-1px] z-10 font-headline text-[9px] md:text-xs tracking-widest text-primary bg-background/95 backdrop-blur-sm border-b border-primary/20 py-1.5 uppercase shadow-sm flex items-center gap-2">
                                    <Gamepad2 className="h-3.5 w-3.5" /> SESSION
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                    {filteredGaming.map(pkg => (
                                        <button 
                                            key={pkg.id} 
                                            onClick={() => handleAddItem({ id: pkg.id, name: pkg.name, price: pkg.price })}
                                            className="group p-3 md:p-4 rounded-lg md:rounded-xl border-2 border-primary/20 bg-primary/5 hover:border-primary hover:bg-primary/10 transition-all text-left flex flex-col justify-between h-24 md:h-32 relative overflow-hidden active:scale-95 shadow-sm"
                                        >
                                            <p className="font-black uppercase text-[16px] md:text-[18px] leading-tight tracking-tight pr-8 group-hover:text-primary transition-colors line-clamp-2">{pkg.name}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-bold text-[18px] md:text-[20px]">₹{pkg.price}</span>
                                                <PlusCircle className="h-4 w-4 md:h-6 md:w-6 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* FOOD MASTER CATEGORY */}
                        {menuByMasterCategory.FOOD.length > 0 && (
                            <div key="FOOD" id="category-section-FOOD" className="space-y-2 md:space-y-3">
                                <h3 className="sticky top-[-1px] z-10 font-headline text-[9px] md:text-xs tracking-widest text-muted-foreground bg-background/95 backdrop-blur-sm border-b border-dashed py-1.5 uppercase shadow-sm">
                                    FOOD
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                    {menuByMasterCategory.FOOD.map(item => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => handleAddItem(item)}
                                            className="group p-3 md:p-4 rounded-lg md:rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between h-24 md:h-32 relative overflow-hidden active:scale-95 shadow-sm"
                                        >
                                            <p className="font-black uppercase text-[16px] md:text-[18px] leading-tight tracking-tight pr-8 group-hover:text-primary transition-colors line-clamp-2">{item.name}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-bold text-[18px] md:text-[20px]">₹{item.price}</span>
                                                <PlusCircle className="h-4 w-4 md:h-6 md:w-6 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* BEVERAGES MASTER CATEGORY */}
                        {menuByMasterCategory.BEVERAGES.length > 0 && (
                            <div key="BEVERAGES" id="category-section-BEVERAGES" className="space-y-2 md:space-y-3">
                                <h3 className="sticky top-[-1px] z-10 font-headline text-[9px] md:text-xs tracking-widest text-muted-foreground bg-background/95 backdrop-blur-sm border-b border-dashed py-1.5 uppercase shadow-sm">
                                    BEVERAGES
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                    {menuByMasterCategory.BEVERAGES.map(item => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => handleAddItem(item)}
                                            className="group p-3 md:p-4 rounded-lg md:rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between h-24 md:h-32 relative overflow-hidden active:scale-95 shadow-sm"
                                        >
                                            <p className="font-black uppercase text-[16px] md:text-[18px] leading-tight tracking-tight pr-8 group-hover:text-primary transition-colors line-clamp-2">{item.name}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-bold text-[18px] md:text-[20px]">₹{item.price}</span>
                                                <PlusCircle className="h-4 w-4 md:h-6 md:w-6 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* ADD ONS MASTER CATEGORY */}
                        {menuByMasterCategory['ADD ONS'].length > 0 && (
                            <div key="ADD ONS" id="category-section-ADD-ONS" className="space-y-2 md:space-y-3">
                                <h3 className="sticky top-[-1px] z-10 font-headline text-[9px] md:text-xs tracking-widest text-muted-foreground bg-background/95 backdrop-blur-sm border-b border-dashed py-1.5 uppercase shadow-sm">
                                    ADD ONS
                                </h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5">
                                    {menuByMasterCategory['ADD ONS'].map(item => (
                                        <button 
                                            key={item.id} 
                                            onClick={() => handleAddItem(item)}
                                            className="group p-3 md:p-4 rounded-lg md:rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex flex-col justify-between h-24 md:h-32 relative overflow-hidden active:scale-95 shadow-sm"
                                        >
                                            <p className="font-black uppercase text-[16px] md:text-[18px] leading-tight tracking-tight pr-8 group-hover:text-primary transition-colors line-clamp-2">{item.name}</p>
                                            <div className="flex justify-between items-end">
                                                <span className="font-mono font-bold text-[18px] md:text-[20px]">₹{item.price}</span>
                                                <PlusCircle className="h-4 w-4 md:h-6 md:w-6 text-primary opacity-20 group-hover:opacity-100 transition-opacity" />
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Mobile Floating Cart Indicator */}
            {activeTab === 'menu' && billItems.length > 0 && (
                <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 md:hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <Button 
                        onClick={() => setActiveTab('review')}
                        className="rounded-full shadow-2xl bg-primary text-primary-foreground font-black text-xs px-6 py-5 border-2 border-background flex items-center gap-2 tracking-wide uppercase"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        CURRENT TAB: {billItems.length} Items • ₹{totalBeforeDiscount}
                    </Button>
                </div>
            )}

            {/* Right Panel: CURRENT TAB */}
            <div className={cn(
                "w-full md:w-[380px] bg-card border-t md:border-t-0 md:border-l shrink-0 flex flex-col overflow-hidden shadow-2xl transition-all",
                activeTab === 'menu' && "hidden md:flex"
            )}>
                <div className="p-4 border-b bg-muted/10 shrink-0 flex justify-between items-center">
                    <div>
                        <h3 className="font-black text-xs md:text-sm uppercase tracking-wide flex items-center gap-1.5 text-foreground">
                            <ShoppingBag className="h-4 w-4 text-primary" />
                            CURRENT TAB
                        </h3>
                        <p className="text-[10px] font-black text-primary uppercase mt-0.5 tracking-wider">{station.name}</p>
                    </div>
                    <Badge className="font-mono h-5 px-2 bg-primary text-primary-foreground text-xs">{billItems.length} Items</Badge>
                </div>

                {/* Session Status Timeline Indicator */}
                {station.status === 'in-use' && station.startTime && (
                    <div className="p-3 border-b bg-muted/5 space-y-2 shrink-0">
                        <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground pl-1">SESSION STATUS</p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="p-1.5 rounded-lg bg-card border">
                                <p className="text-[7px] font-black uppercase text-muted-foreground">Started</p>
                                <p className="font-mono font-bold text-[11px] mt-0.5 text-foreground">
                                    {new Date(station.startTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                                </p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-card border">
                                <p className="text-[7px] font-black uppercase text-muted-foreground">Ends</p>
                                <p className="font-mono font-bold text-[11px] mt-0.5 text-foreground">
                                    {station.endTime ? new Date(station.endTime).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : 'Open'}
                                </p>
                            </div>
                            <div className="p-1.5 rounded-lg bg-card border">
                                <p className="text-[7px] font-black uppercase text-muted-foreground">Remaining</p>
                                <p className="font-mono font-bold text-[11px] mt-0.5 text-primary animate-pulse">
                                    {(() => {
                                        if (!station.endTime) return 'Open Play';
                                        const end = new Date(station.endTime).getTime();
                                        const remainingMs = end - currentTime.getTime();
                                        if (remainingMs <= 0) return '0 Min';
                                        const mins = Math.ceil(remainingMs / 60000);
                                        return `${mins} Min`;
                                    })()}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                <ScrollArea className="flex-1 px-3 min-h-0 bg-background/50">
                    <Table>
                        <TableBody>
                            {billItems.length > 0 ? billItems.map((item, idx) => (
                                <TableRow key={`${item.itemId}-${idx}`} className="border-b hover:bg-transparent">
                                    <TableCell className="py-2.5 pl-0">
                                        <p className="font-black text-[13px] md:text-[14px] uppercase leading-tight">{item.name}</p>
                                        <p className="text-[10px] md:text-xs font-bold text-muted-foreground mt-0.5">₹{item.price} x {item.quantity}</p>
                                    </TableCell>
                                    <TableCell className="py-2.5 px-0">
                                        <div className="flex items-center justify-end gap-1.5">
                                            <button onClick={() => handleUpdateQuantityByIndex(idx, item.quantity - 1)} className="text-muted-foreground hover:text-destructive"><MinusCircle className="h-4 w-4" /></button>
                                            <span className="min-w-3 text-center font-black text-xs">{item.quantity}</span>
                                            <button onClick={() => handleAddItem({ id: item.itemId, name: item.name, price: item.price })} className="text-muted-foreground hover:text-green-600"><PlusCircle className="h-4 w-4" /></button>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right py-2.5 pr-0 font-black text-[13px] md:text-[14px] font-mono whitespace-nowrap text-primary">
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

                <div className="p-4 border-t bg-muted/20 space-y-2 shrink-0">
                    {initialPackagePrice > 0 && (
                        <div className="flex justify-between items-center text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                            <span>Initial Package</span>
                            <span className="font-mono">₹{initialPackagePrice.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs font-black uppercase text-foreground">
                        <span>Subtotal</span>
                        <span className="font-mono text-primary text-base">₹{totalBeforeDiscount.toLocaleString()}</span>
                    </div>
                </div>
            </div>
        </div>

        <DialogFooter className="flex flex-col sm:flex-row gap-2 p-2.5 md:p-3 border-t bg-background shrink-0 shadow-[0_-4px_10px_rgba(0,0,0,0.05)]">
          <div className="flex gap-2 w-full sm:flex-1">
            <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="flex-1 font-black uppercase tracking-[0.1em] h-12 md:h-14 border-2 text-[11px] md:text-[12px]">Cancel</Button>
            <Button variant="secondary" size="sm" onClick={handleSave} className="flex-1 font-black uppercase tracking-[0.1em] h-12 md:h-14 border-2 text-[11px] md:text-[12px]"><Save className="mr-1 h-3.5 w-3.5" /> Save</Button>
          </div>
          <Button size="sm" onClick={handleCheckout} className="w-full sm:flex-[2] font-black uppercase tracking-[0.1em] h-12 md:h-14 shadow-lg text-[13px] md:text-[15px] bg-primary text-primary-foreground"><CreditCard className="mr-1.5 h-4 w-4 md:h-5 md:w-5"/> Checkout ₹{totalBeforeDiscount.toLocaleString()}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
