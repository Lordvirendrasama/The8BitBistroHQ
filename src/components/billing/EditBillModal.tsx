
'use client';
import { useState, useEffect, useMemo } from 'react';
import type { Bill, BillItem, FoodItem, GamingPackage, PaymentMethod, Station } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Save, Ticket, ShoppingBag, Utensils, Tag, Search, Gamepad2, Banknote, Smartphone, Layers, FileWarning, MapPin, Calendar as CalendarIcon, Clock, Monitor, User, Plus, Trash2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';

interface EditBillModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  bill: Bill | null;
  foodItems: FoodItem[];
  gamingPackages: GamingPackage[];
  stations?: Station[];
  onSave: (billId: string, updates: Partial<Bill>) => void;
}

export function EditBillModal({ isOpen, onOpenChange, bill, foodItems, gamingPackages, stations, onSave }: EditBillModalProps) {
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [upiAmount, setUpiAmount] = useState<string>('0');

  // Order Metadata controls
  const [stationName, setStationName] = useState<string>('');
  const [memberName, setMemberName] = useState<string>('');
  const [initialPackagePrice, setInitialPackagePrice] = useState<number>(0);
  const [packageName, setPackageName] = useState<string>('');
  const [orderDate, setOrderDate] = useState<Date>(new Date());
  const [orderTime, setOrderTime] = useState<string>('12:00:00');

  // Custom Item entry
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  useEffect(() => {
    if (bill) {
      setBillItems(bill.items ? bill.items.map(item => ({ ...item })) : []);
      setDiscount(bill.discount || 0);
      setPaymentMethod(bill.paymentMethod || 'cash');
      setCashAmount(String(bill.cashAmount || 0));
      setUpiAmount(String(bill.upiAmount || 0));
      setStationName(bill.stationName || '');
      
      const primaryMember = bill.members && bill.members.length > 0 ? bill.members[0].name : '';
      setMemberName(primaryMember);
      setInitialPackagePrice(bill.initialPackagePrice || 0);
      setPackageName(bill.packageName || '');

      const dateObj = bill.timestamp ? new Date(bill.timestamp) : new Date();
      const validDate = isNaN(dateObj.getTime()) ? new Date() : dateObj;
      setOrderDate(validDate);

      const hh = String(validDate.getHours()).padStart(2, '0');
      const mm = String(validDate.getMinutes()).padStart(2, '0');
      const ss = String(validDate.getSeconds()).padStart(2, '0');
      setOrderTime(`${hh}:${mm}:${ss}`);
    }
    if (isOpen) {
      setSearchTerm('');
      setCustomItemName('');
      setCustomItemPrice('');
    }
  }, [bill, isOpen]);

  const filteredGamingPackages = useMemo(() => {
    if (!searchTerm) return gamingPackages;
    return gamingPackages.filter(pkg => pkg.name.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [gamingPackages, searchTerm]);

  const menuByCategory = useMemo(() => {
    const filteredFood = searchTerm 
      ? foodItems.filter(item => item.name.toLowerCase().includes(searchTerm.toLowerCase()))
      : foodItems;

    return filteredFood.reduce((acc, item) => {
      (acc[item.category] = acc[item.category] || []).push(item);
      return acc;
    }, {} as Record<string, FoodItem[]>);
  }, [foodItems, searchTerm]);

  const handleAddItem = (id: string, name: string, price: number) => {
    setBillItems(prevItems => {
      const existingItemIndex = prevItems.findIndex(bi => bi.itemId === id && bi.name === name);
      if (existingItemIndex > -1) {
        return prevItems.map((bi, i) => i === existingItemIndex ? { ...bi, quantity: bi.quantity + 1 } : bi);
      } else {
        return [...prevItems, { itemId: id, name: name, price: price, quantity: 1, addedAt: new Date().toISOString() }];
      }
    });
  };

  const handleAddCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(price) || price < 0) return;
    setBillItems(prev => [...prev, {
      itemId: `custom-${Date.now()}`,
      name: customItemName.trim(),
      price: price,
      quantity: 1,
      addedAt: new Date().toISOString()
    }]);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const handleUpdateQuantityByIndex = (index: number, newQuantity: number) => {
    setBillItems(prevItems => {
        if (newQuantity <= 0) {
            return prevItems.filter((_, i) => i !== index);
        }
        return prevItems.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
    });
  };

  const handleUpdateItemPrice = (index: number, newPrice: number) => {
    setBillItems(prev => prev.map((item, i) => i === index ? { ...item, price: Math.max(0, newPrice) } : item));
  };

  const handleUpdateItemName = (index: number, newName: string) => {
    setBillItems(prev => prev.map((item, i) => i === index ? { ...item, name: newName } : item));
  };

  const foodSubtotal = useMemo(() => {
    return billItems.filter(item => !item.name.startsWith('Time:') && !item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);

  const timePackageTotal = useMemo(() => {
    return billItems.filter(item => item.name.startsWith('Time:') || item.name.startsWith('Recharge:')).reduce((total, item) => total + (item.price * item.quantity), 0);
  }, [billItems]);
  
  const totalDiscountValue = Math.min(foodSubtotal, discount);
  const total = foodSubtotal - totalDiscountValue + initialPackagePrice + timePackageTotal;

  const handleSave = () => {
    if (bill) {
      let finalTimestamp = bill.timestamp;
      if (orderDate) {
        const d = new Date(orderDate);
        const parts = orderTime.split(':').map(Number);
        const hh = parts[0] || 0;
        const mm = parts[1] || 0;
        const ss = parts[2] || 0;
        d.setHours(hh, mm, ss, 0);
        finalTimestamp = d.toISOString();
      }

      const updates: Partial<Bill> = {
        items: billItems,
        discount: discount,
        foodSubtotal: foodSubtotal,
        totalAmount: total,
        paymentMethod: paymentMethod,
        cashAmount: paymentMethod === 'split' ? parseFloat(cashAmount) || 0 : (paymentMethod === 'cash' ? total : 0),
        upiAmount: paymentMethod === 'split' ? parseFloat(upiAmount) || 0 : (paymentMethod === 'upi' ? total : 0),
        timestamp: finalTimestamp,
        stationName: stationName.trim() || bill.stationName,
        initialPackagePrice: initialPackagePrice,
        packageName: packageName.trim() || undefined,
        members: bill.members && bill.members.length > 0 
          ? bill.members.map((m, idx) => idx === 0 ? { ...m, name: memberName.trim() || m.name } : m)
          : memberName.trim() ? [{ id: 'guest', name: memberName.trim(), avatarUrl: '' }] : [],
      };
      onSave(bill.id, updates);
    }
  };

  if (!bill) return null;

  const splitTotal = (parseFloat(cashAmount) || 0) + (parseFloat(upiAmount) || 0);
  const isSplitValid = Math.abs(splitTotal - total) < 0.1;

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[95vh] md:h-[90vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 md:p-5 bg-muted/10 border-b shrink-0">
          <DialogTitle className="font-headline text-lg md:text-2xl text-primary tracking-tight">
            Edit Order: {stationName || bill.stationName}
          </DialogTitle>
          <div className="space-y-1">
            <DialogDescription className="text-xs md:text-sm font-bold uppercase tracking-normal text-muted-foreground">
              Full Order Audit: Adjust Date, Time, Station, Customer, Menu Items, Prices, Fees, Discount, and Payment.
            </DialogDescription>
            <p className="text-xs font-bold text-amber-600 uppercase flex items-center gap-1.5">
              Note: Historical audit update. Member stats (XP, total spent) are preserved.
            </p>
          </div>
        </DialogHeader>

        {/* ORDER METADATA CONTROL BAR */}
        <div className="p-3 bg-muted/20 border-b shrink-0 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
          {/* DATE PICKER */}
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <CalendarIcon className="h-3 w-3 text-primary" /> Order Date
            </Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full h-8 text-xs font-bold uppercase justify-start text-left bg-background border-2">
                  <CalendarIcon className="mr-1.5 h-3.5 w-3.5 text-primary shrink-0" />
                  {orderDate ? format(orderDate, "MMM dd, yyyy") : "Pick Date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" selected={orderDate} onSelect={(d) => d && setOrderDate(d)} initialFocus />
              </PopoverContent>
            </Popover>
          </div>

          {/* TIME PICKER */}
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Clock className="h-3 w-3 text-primary" /> Order Time
            </Label>
            <Input
              type="time"
              step="1"
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              className="h-8 text-xs font-mono font-bold bg-background border-2"
            />
          </div>

          {/* STATION / AREA NAME */}
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Monitor className="h-3 w-3 text-primary" /> Station / Area
            </Label>
            {stations && stations.length > 0 ? (
              <Select value={stationName} onValueChange={(val) => setStationName(val)}>
                <SelectTrigger className="h-8 text-xs font-bold uppercase bg-background border-2">
                  <SelectValue placeholder="Select Station" />
                </SelectTrigger>
                <SelectContent>
                  {stations.map(s => (
                    <SelectItem key={s.id} value={s.name} className="text-xs font-bold uppercase">{s.name}</SelectItem>
                  ))}
                  <SelectItem value={stationName || "Custom"} className="text-xs font-bold uppercase italic">Custom Station</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Input
                value={stationName}
                onChange={(e) => setStationName(e.target.value)}
                placeholder="e.g. PS5 1"
                className="h-8 text-xs font-bold uppercase bg-background border-2"
              />
            )}
          </div>

          {/* CUSTOMER / MEMBER NAME */}
          <div className="space-y-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3 text-primary" /> Customer Name
            </Label>
            <Input
              value={memberName}
              onChange={(e) => setMemberName(e.target.value)}
              placeholder="Guest / Member"
              className="h-8 text-xs font-bold uppercase bg-background border-2"
            />
          </div>

          {/* INITIAL PACKAGE / SESSION FEE */}
          <div className="space-y-1 col-span-2 sm:col-span-1">
            <Label className="text-xs font-bold uppercase text-muted-foreground flex items-center gap-1">
              <Ticket className="h-3 w-3 text-primary" /> Session Fee (₹)
            </Label>
            <Input
              type="number"
              value={initialPackagePrice || ''}
              onChange={(e) => setInitialPackagePrice(Number(e.target.value) || 0)}
              placeholder="0"
              className="h-8 text-xs font-mono font-bold bg-background border-2"
            />
          </div>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5">
          {/* MENU SELECTION AREA */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r overflow-hidden">
            <div className="p-3 bg-muted/20 border-b space-y-2">
              <div className="flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-normal">Bistro Menu & Add Items</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="SEARCH MENU ITEMS OR PACKAGES..." 
                  className="pl-8 h-9 bg-background border-2 font-bold uppercase text-sm tracking-tight"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>

              {/* Custom Item Row */}
              <div className="flex items-center gap-2 pt-1">
                <Input
                  placeholder="CUSTOM ITEM NAME..."
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  className="h-8 text-xs font-bold uppercase bg-background border-2 flex-1"
                />
                <Input
                  type="number"
                  placeholder="₹ PRICE"
                  value={customItemPrice}
                  onChange={e => setCustomItemPrice(e.target.value)}
                  className="h-8 w-24 text-xs font-mono font-bold bg-background border-2"
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddCustomItem}
                  disabled={!customItemName.trim() || !customItemPrice}
                  className="h-8 px-2.5 font-bold uppercase text-xs shrink-0"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Custom
                </Button>
              </div>
            </div>
            
            <ScrollArea className="flex-1 px-4 py-2">
              <div className="space-y-8 pb-8">
                {/* GAMING PACKAGES SECTION */}
                {filteredGamingPackages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-bold text-sm text-primary uppercase border-b border-primary/20 py-1 tracking-normal sticky top-0 bg-background/95 backdrop-blur-sm z-10 flex items-center gap-2">
                      <Gamepad2 className="h-3 w-3" />
                      Gaming Packages
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredGamingPackages.map(pkg => (
                        <button 
                          key={pkg.id} 
                          onClick={() => handleAddItem(pkg.id, pkg.name, pkg.price)} 
                          className="group p-3 rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex justify-between items-center h-14 active:scale-95 shadow-sm"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-sm uppercase truncate group-hover:text-primary transition-colors">{pkg.name}</p>
                            <p className="text-sm font-bold text-muted-foreground uppercase">{pkg.validity} Day Validity</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-sm">₹{pkg.price}</span>
                            <PlusCircle className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* FOOD CATEGORIES */}
                {Object.entries(menuByCategory).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="font-bold text-sm text-muted-foreground uppercase border-b border-dashed py-1 tracking-normal sticky top-0 bg-background/95 backdrop-blur-sm z-10">{category}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(item => (
                        <button 
                          key={item.id} 
                          onClick={() => handleAddItem(item.id, item.name, item.price)} 
                          className="group p-3 rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex justify-between items-center h-14 active:scale-95 shadow-sm"
                        >
                          <span className="font-bold text-sm uppercase truncate pr-2 group-hover:text-primary transition-colors">{item.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-bold text-sm">₹{item.price}</span>
                            <PlusCircle className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredGamingPackages.length === 0 && Object.keys(menuByCategory).length === 0 && (
                  <div className="py-20 text-center opacity-30 italic font-bold uppercase text-sm tracking-normal">
                    No menu items match your search
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>
          
          {/* BILL AUDIT AREA */}
          <div className="w-full md:w-[460px] flex flex-col bg-card overflow-hidden">
            <div className="p-3 bg-muted/20 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="font-bold text-sm uppercase tracking-normal">Order Line Items</h3>
              </div>
              <span className="font-mono font-bold text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{billItems.length} ITEMS</span>
            </div>

            <ScrollArea className="flex-1 px-3">
              <Table>
                <TableBody>
                  {billItems.length > 0 ? billItems.map((item, idx) => (
                    <TableRow key={`${item.itemId}-${idx}`} className="hover:bg-transparent border-b">
                      <TableCell className="py-2.5 px-0 max-w-[160px]">
                        <Input
                          value={item.name}
                          onChange={(e) => handleUpdateItemName(idx, e.target.value)}
                          className="h-6 text-xs font-bold uppercase bg-transparent border-none focus-visible:ring-1 focus-visible:ring-primary p-0 leading-tight"
                        />
                        <div className="flex items-center gap-1 mt-1">
                          <span className="text-xs font-bold text-muted-foreground">₹</span>
                          <Input
                            type="number"
                            value={item.price}
                            onChange={(e) => handleUpdateItemPrice(idx, Number(e.target.value))}
                            className="h-5 w-16 text-xs font-mono font-bold bg-background border px-1 py-0"
                          />
                          <span className="text-[10px] font-bold text-muted-foreground uppercase">/ unit</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-2.5 px-1">
                        <div className="flex items-center justify-center gap-1.5">
                          <button onClick={() => handleUpdateQuantityByIndex(idx, item.quantity - 1)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <MinusCircle className="h-4 w-4" />
                          </button>
                          <span className="min-w-4 text-center font-bold text-xs font-mono">{item.quantity}</span>
                          <button onClick={() => handleAddItem(item.itemId, item.name, item.price)} className="text-muted-foreground hover:text-emerald-600 transition-colors">
                            <PlusCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-2.5 pr-0 font-bold text-xs font-mono text-primary">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </TableCell>
                      <TableCell className="py-2.5 pl-1 pr-0 text-right w-6">
                        <button onClick={() => handleUpdateQuantityByIndex(idx, 0)} className="text-muted-foreground hover:text-destructive transition-colors opacity-50 hover:opacity-100">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-16 text-xs italic font-bold text-muted-foreground uppercase opacity-40">No items in bill</TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="p-4 bg-muted/20 border-t space-y-3 shrink-0">
                <div className="space-y-2">
                    <h4 className="font-bold text-xs uppercase tracking-normal text-muted-foreground/70 border-b pb-1">Payment Method & Adjustments</h4>
                    
                    <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-1.5">
                        <Label className={cn("flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all", paymentMethod === 'cash' ? "bg-emerald-500/10 border-emerald-500 text-emerald-700" : "bg-background border-muted")}>
                            <RadioGroupItem value="cash" className="sr-only" />
                            <Banknote className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase">Cash</span>
                        </Label>
                        <Label className={cn("flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all", paymentMethod === 'upi' ? "bg-primary/10 border-primary text-primary" : "bg-background border-muted")}>
                            <RadioGroupItem value="upi" className="sr-only" />
                            <Smartphone className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase">UPI</span>
                        </Label>
                        <Label className={cn("flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all", paymentMethod === 'split' ? "bg-amber-500/10 border-amber-500 text-amber-700" : "bg-background border-muted")}>
                            <RadioGroupItem value="split" className="sr-only" />
                            <Layers className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase">Split</span>
                        </Label>
                        <Label className={cn("flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all", paymentMethod === 'district-dinein' ? "bg-amber-500/10 border-amber-500 text-amber-700" : "bg-background border-muted")}>
                            <RadioGroupItem value="district-dinein" className="sr-only" />
                            <MapPin className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase">District</span>
                        </Label>
                        <Label className={cn("flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-all col-span-2", paymentMethod === 'pending' ? "bg-destructive/10 border-destructive text-destructive" : "bg-background border-muted")}>
                            <RadioGroupItem value="pending" className="sr-only" />
                            <FileWarning className="h-3 w-3" />
                            <span className="text-xs font-bold uppercase">Pending</span>
                        </Label>
                    </RadioGroup>

                    {paymentMethod === 'split' && (
                        <div className="grid grid-cols-2 gap-2 p-2 bg-background border-2 border-dashed rounded-lg animate-in slide-in-from-top-2 duration-200">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold uppercase text-muted-foreground opacity-70">Cash Amt (₹)</Label>
                                <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="h-7 text-xs font-mono font-bold" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold uppercase text-muted-foreground opacity-70">UPI Amt (₹)</Label>
                                <Input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} className="h-7 text-xs font-mono font-bold" />
                            </div>
                            {!isSplitValid && (
                                <p className="col-span-2 text-xs font-bold text-destructive uppercase text-center mt-0.5">Warning: Totals do not match (Sum: ₹{splitTotal})</p>
                            )}
                        </div>
                    )}

                    <Separator className="my-1.5 opacity-50" />

                    {initialPackagePrice > 0 && (
                        <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground tracking-normal">
                            <span className="flex items-center gap-1.5"><Ticket className="h-3 w-3 text-primary" /> Session Fee</span>
                            <span className="font-mono">₹{initialPackagePrice.toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex justify-between items-center text-xs font-bold uppercase text-muted-foreground tracking-normal">
                        <span>Items Subtotal</span>
                        <span className="font-mono">₹{(foodSubtotal + timePackageTotal).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <Label htmlFor="discount-edit" className="text-xs font-bold uppercase tracking-normal flex items-center gap-1"><Tag className="h-3 w-3 text-destructive"/> Discount</Label>
                            <Input 
                                id="discount-edit"
                                type="number"
                                value={discount || ''}
                                onChange={e => setDiscount(Math.max(0, Math.min(foodSubtotal, Number(e.target.value))))}
                                className="w-16 h-7 text-right font-mono font-bold text-xs border-destructive/20 bg-background"
                                placeholder="0"
                            />
                        </div>
                        <span className="font-mono font-bold text-destructive text-xs">- ₹{totalDiscountValue.toLocaleString()}</span>
                    </div>
                </div>
                
                <Separator className="bg-primary/20" />
                
                <div className="flex justify-between items-center">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Final Grand Total</span>
                    <span className="text-xl font-bold text-primary font-mono tracking-tight">₹{total.toLocaleString()}</span>
                </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-3 md:p-4 bg-background border-t shrink-0 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1 font-bold uppercase text-xs md:text-sm h-11 border-2 tracking-normal">Cancel</Button>
          <Button onClick={handleSave} disabled={paymentMethod === 'split' && !isSplitValid} className="w-full sm:flex-[2] font-bold uppercase text-xs md:text-sm h-11 shadow-xl tracking-normal">
            <Save className="mr-2 h-4 w-4"/> Save Audit Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialo