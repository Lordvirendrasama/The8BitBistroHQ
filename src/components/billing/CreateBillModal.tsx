
'use client';
import { useState, useMemo, useEffect } from 'react';
import type { Bill, BillItem, FoodItem, GamingPackage, PaymentMethod, Station } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableRow } from '@/components/ui/table';
import { PlusCircle, MinusCircle, Save, Ticket, ShoppingBag, Utensils, Tag, Search, Gamepad2, Banknote, Smartphone, Layers, FileWarning, MapPin, FilePlus2, Monitor, Pencil } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface CreateBillModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  foodItems: FoodItem[];
  gamingPackages: GamingPackage[];
  stations: Station[];
  onSave: (bill: Omit<Bill, 'id' | 'shiftId'>) => Promise<void>;
}

export function CreateBillModal({ isOpen, onOpenChange, foodItems, gamingPackages, stations, onSave }: CreateBillModalProps) {
  const [billItems, setBillItems] = useState<BillItem[]>([]);
  const [discount, setDiscount] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [cashAmount, setCashAmount] = useState<string>('0');
  const [upiAmount, setUpiAmount] = useState<string>('0');
  const [selectedStationId, setSelectedStationId] = useState<string>('');
  const [customStationName, setCustomStationName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Custom item entry
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');

  useEffect(() => {
    if (isOpen) {
      setBillItems([]);
      setDiscount(0);
      setSearchTerm('');
      setPaymentMethod('cash');
      setCashAmount('0');
      setUpiAmount('0');
      setSelectedStationId('');
      setCustomStationName('');
      setCustomItemName('');
      setCustomItemPrice('');
    }
  }, [isOpen]);

  const selectedStation = useMemo(() => stations.find(s => s.id === selectedStationId), [stations, selectedStationId]);
  const stationDisplayName = selectedStation?.name || customStationName || 'Manual Entry';

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
    setBillItems(prev => {
      const existingIndex = prev.findIndex(bi => bi.itemId === id && bi.name === name);
      if (existingIndex > -1) {
        return prev.map((bi, i) => i === existingIndex ? { ...bi, quantity: bi.quantity + 1 } : bi);
      }
      return [...prev, { itemId: id, name, price, quantity: 1, addedAt: new Date().toISOString() }];
    });
  };

  const handleAddCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(price) || price <= 0) return;
    handleAddItem(`custom-${Date.now()}`, customItemName.trim(), price);
    setCustomItemName('');
    setCustomItemPrice('');
  };

  const handleUpdateQuantityByIndex = (index: number, newQuantity: number) => {
    setBillItems(prev => {
      if (newQuantity <= 0) return prev.filter((_, i) => i !== index);
      return prev.map((item, i) => i === index ? { ...item, quantity: newQuantity } : item);
    });
  };

  const subtotal = useMemo(() =>
    billItems.reduce((total, item) => total + item.price * item.quantity, 0),
  [billItems]);

  const totalDiscountValue = Math.min(subtotal, discount);
  const total = subtotal - totalDiscountValue;

  const splitTotal = (parseFloat(cashAmount) || 0) + (parseFloat(upiAmount) || 0);
  const isSplitValid = paymentMethod !== 'split' || Math.abs(splitTotal - total) < 0.1;

  const canSave = billItems.length > 0 && (selectedStationId || customStationName.trim()) && isSplitValid;

  const handleSave = async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const billData: Omit<Bill, 'id' | 'shiftId'> = {
        stationId: selectedStationId || 'manual',
        stationName: stationDisplayName,
        packageName: 'Manual Entry',
        members: [],
        items: billItems,
        initialPackagePrice: 0,
        foodSubtotal: subtotal,
        discount: totalDiscountValue,
        totalAmount: total,
        timestamp: new Date().toISOString(),
        paymentMethod,
        cashAmount: paymentMethod === 'split' ? parseFloat(cashAmount) || 0 : paymentMethod === 'cash' ? total : 0,
        upiAmount: paymentMethod === 'split' ? parseFloat(upiAmount) || 0 : paymentMethod === 'upi' ? total : 0,
      };
      await onSave(billData);
      onOpenChange(false);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] md:max-w-6xl h-[95vh] md:h-[88vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-4 md:p-6 bg-muted/10 border-b shrink-0">
          <DialogTitle className="font-headline text-lg md:text-2xl text-primary tracking-tight flex items-center gap-3">
            <FilePlus2 className="h-6 w-6" />
            Manual Bill Entry
          </DialogTitle>
          <DialogDescription className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            Create a backdated or off-session bill record for the audit ledger.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-muted/5">

          {/* LEFT: MENU */}
          <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r overflow-hidden">
            <div className="p-3 bg-muted/20 border-b space-y-3">
              <div className="flex items-center gap-2">
                <Utensils className="h-4 w-4 text-primary" />
                <h3 className="font-black text-[10px] uppercase tracking-widest">Select Items</h3>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="SEARCH MENU OR PACKAGES..."
                  className="pl-8 h-9 bg-background border-2 font-black uppercase text-[10px] tracking-tight"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              {/* Custom item entry */}
              <div className="flex gap-2 items-center p-2 bg-background border-2 border-dashed rounded-lg">
                <Pencil className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <Input
                  placeholder="Custom item name..."
                  className="h-7 flex-1 text-[10px] font-bold border-0 bg-transparent p-0 focus-visible:ring-0 shadow-none"
                  value={customItemName}
                  onChange={e => setCustomItemName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCustomItem()}
                />
                <Input
                  type="number"
                  placeholder="₹0"
                  className="h-7 w-20 text-[10px] font-mono font-bold border-0 bg-transparent p-0 text-right focus-visible:ring-0 shadow-none"
                  value={customItemPrice}
                  onChange={e => setCustomItemPrice(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddCustomItem()}
                />
                <Button size="sm" variant="ghost" className="h-7 px-2 text-primary" onClick={handleAddCustomItem}>
                  <PlusCircle className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 px-4 py-2">
              <div className="space-y-8 pb-8">
                {filteredGamingPackages.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-black text-[10px] text-primary uppercase border-b border-primary/20 py-1 tracking-widest sticky top-0 bg-background/95 backdrop-blur-sm z-10 flex items-center gap-2">
                      <Gamepad2 className="h-3 w-3" /> Gaming Packages
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {filteredGamingPackages.map(pkg => (
                        <button
                          key={pkg.id}
                          onClick={() => handleAddItem(pkg.id, pkg.name, pkg.price)}
                          className="group p-3 rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex justify-between items-center h-14 active:scale-95 shadow-sm"
                        >
                          <div className="min-w-0 pr-2">
                            <p className="font-bold text-[11px] uppercase truncate group-hover:text-primary transition-colors">{pkg.name}</p>
                            <p className="text-[8px] font-bold text-muted-foreground uppercase">{pkg.validity} Day Validity</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-xs">₹{pkg.price}</span>
                            <PlusCircle className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {Object.entries(menuByCategory).map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h4 className="font-black text-[10px] text-muted-foreground uppercase border-b border-dashed py-1 tracking-widest sticky top-0 bg-background/95 backdrop-blur-sm z-10">{category}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(item => (
                        <button
                          key={item.id}
                          onClick={() => handleAddItem(item.id, item.name, item.price)}
                          className="group p-3 rounded-xl border-2 bg-card hover:border-primary hover:bg-primary/5 transition-all text-left flex justify-between items-center h-14 active:scale-95 shadow-sm"
                        >
                          <span className="font-bold text-[11px] uppercase truncate pr-2 group-hover:text-primary transition-colors">{item.name}</span>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="font-mono font-black text-xs">₹{item.price}</span>
                            <PlusCircle className="h-4 w-4 text-primary opacity-20 group-hover:opacity-100" />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}

                {filteredGamingPackages.length === 0 && Object.keys(menuByCategory).length === 0 && (
                  <div className="py-20 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">
                    No items match your search
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* RIGHT: BILL SUMMARY */}
          <div className="w-full md:w-[420px] flex flex-col bg-card overflow-hidden">
            <div className="p-3 bg-muted/20 border-b flex justify-between items-center">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-primary" />
                <h3 className="font-black text-[10px] uppercase tracking-widest">Bill</h3>
              </div>
              <span className="font-mono font-black text-[10px] bg-primary text-primary-foreground px-2 py-0.5 rounded-full">{billItems.length} ITEMS</span>
            </div>

            {/* Station selector */}
            <div className="p-3 border-b bg-muted/10 space-y-2">
              <Label className="text-[9px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
                <Monitor className="h-3 w-3" /> Station
              </Label>
              <Select value={selectedStationId} onValueChange={setSelectedStationId}>
                <SelectTrigger className="h-9 text-[10px] font-bold uppercase border-2">
                  <SelectValue placeholder="Select a station..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="manual-custom" className="text-[10px] font-bold uppercase italic">Custom Name</SelectItem>
                  {stations.map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-[10px] font-bold uppercase">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {(selectedStationId === 'manual-custom' || !selectedStationId) && (
                <Input
                  placeholder="e.g. PS5 1, Board Game 2..."
                  className="h-8 text-[10px] font-bold uppercase border-2"
                  value={customStationName}
                  onChange={e => setCustomStationName(e.target.value)}
                />
              )}
            </div>

            <ScrollArea className="flex-1 px-3">
              <Table>
                <TableBody>
                  {billItems.length > 0 ? billItems.map((item, idx) => (
                    <TableRow key={`${item.itemId}-${idx}`} className="hover:bg-transparent border-b">
                      <TableCell className="py-3 px-0">
                        <p className="font-black text-[10px] uppercase leading-tight">{item.name}</p>
                        <p className="text-[9px] font-bold text-muted-foreground mt-0.5">₹{item.price} / unit</p>
                      </TableCell>
                      <TableCell className="py-3 px-2">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleUpdateQuantityByIndex(idx, item.quantity - 1)} className="text-muted-foreground hover:text-destructive transition-colors">
                            <MinusCircle className="h-4 w-4" />
                          </button>
                          <span className="min-w-4 text-center font-black text-xs font-mono">{item.quantity}</span>
                          <button onClick={() => handleAddItem(item.itemId, item.name, item.price)} className="text-muted-foreground hover:text-emerald-600 transition-colors">
                            <PlusCircle className="h-4 w-4" />
                          </button>
                        </div>
                      </TableCell>
                      <TableCell className="text-right py-3 pr-0 font-black text-[11px] font-mono text-primary">
                        ₹{(item.price * item.quantity).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  )) : (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center py-16 text-[10px] italic font-bold text-muted-foreground uppercase opacity-40">
                        Add items from the left panel
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="p-4 bg-muted/20 border-t space-y-4 shrink-0">
              <div className="space-y-2">
                <h4 className="font-black text-[9px] uppercase tracking-widest text-muted-foreground/60 border-b pb-1">Payment Method</h4>
                <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)} className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'cash', label: 'Cash', icon: Banknote, active: 'bg-emerald-500/10 border-emerald-500 text-emerald-700' },
                    { value: 'upi', label: 'UPI', icon: Smartphone, active: 'bg-primary/10 border-primary text-primary' },
                    { value: 'split', label: 'Split', icon: Layers, active: 'bg-amber-500/10 border-amber-500 text-amber-700' },
                    { value: 'district-dinein', label: 'District', icon: MapPin, active: 'bg-amber-500/10 border-amber-500 text-amber-700' },
                    { value: 'pending', label: 'Pending', icon: FileWarning, active: 'bg-destructive/10 border-destructive text-destructive' },
                  ].map(({ value, label, icon: Icon, active }) => (
                    <Label key={value} className={cn('flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-all', paymentMethod === value ? active : 'bg-background border-muted')}>
                      <RadioGroupItem value={value} className="sr-only" />
                      <Icon className="h-3 w-3" />
                      <span className="text-[9px] font-black uppercase">{label}</span>
                    </Label>
                  ))}
                </RadioGroup>

                {paymentMethod === 'split' && (
                  <div className="grid grid-cols-2 gap-2 p-2 bg-background border-2 border-dashed rounded-lg animate-in slide-in-from-top-2 duration-200">
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground opacity-60">Cash Amt (₹)</Label>
                      <Input type="number" value={cashAmount} onChange={e => setCashAmount(e.target.value)} className="h-7 text-[10px] font-mono font-bold" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[8px] font-black uppercase text-muted-foreground opacity-60">UPI Amt (₹)</Label>
                      <Input type="number" value={upiAmount} onChange={e => setUpiAmount(e.target.value)} className="h-7 text-[10px] font-mono font-bold" />
                    </div>
                    {!isSplitValid && (
                      <p className="col-span-2 text-[8px] font-black text-destructive uppercase text-center mt-1">Warning: Split amounts don't match total (Sum: ₹{splitTotal})</p>
                    )}
                  </div>
                )}

                <Separator className="my-2 opacity-50" />

                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest flex items-center gap-1">
                      <Tag className="h-3 w-3 text-destructive" /> Discount
                    </Label>
                    <Input
                      type="number"
                      value={discount || ''}
                      onChange={e => setDiscount(Math.max(0, Math.min(subtotal, Number(e.target.value))))}
                      className="w-16 h-7 text-right font-mono font-bold text-[10px] border-destructive/20 bg-background"
                      placeholder="0"
                    />
                  </div>
                  <span className="font-mono font-bold text-destructive text-xs">- ₹{totalDiscountValue.toLocaleString()}</span>
                </div>
              </div>

              <Separator className="bg-primary/20" />

              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Grand Total</span>
                <span className="text-2xl font-black text-primary font-mono tracking-tighter">₹{total.toLocaleString()}</span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-background border-t shrink-0 flex flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:flex-1 font-black uppercase text-[10px] h-12 border-2 tracking-widest">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="w-full sm:flex-[2] font-black uppercase text-[10px] h-12 shadow-xl tracking-widest"
          >
            <Save className="mr-2 h-4 w-4" />
            {isSaving ? 'Creating Bill...' : 'Create & Archive Bill'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
