'use client';
import { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, Clock, IndianRupee, Minus, Sparkles } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { GamingPackage, Station, BillItem } from '@/lib/types';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';

interface AddTimeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onAddTime: (pkg: GamingPackage, quantity: number) => void;
  gamingPackages: GamingPackage[];
  station: Station | null;
}

const formatPackageDuration = (totalSeconds: number) => {
    if (!totalSeconds || totalSeconds < 0) return '0m';
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const parts = [];
    if (minutes > 0) parts.push(`${minutes}m`);
    if (seconds > 0) parts.push(`${seconds}s`);
    return parts.length > 0 ? parts.join(' ') : '0m';
};


export function AddTimeModal({ isOpen, onOpenChange, onAddTime, gamingPackages, station }: AddTimeModalProps) {
  const [selectedPackageId, setSelectedPackageId] = useState<string | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [customMinutes, setCustomMinutes] = useState('');
  const [customPrice, setCustomPrice] = useState('');

  const addTimePackages = useMemo(() => {
    return gamingPackages.filter(p => p.isAddTimePackage);
  }, [gamingPackages]);

  const selectedPackage = useMemo(() => {
    return addTimePackages.find(p => p.id === selectedPackageId);
  }, [addTimePackages, selectedPackageId]);

  useEffect(() => {
    if (isOpen) {
      setSelectedPackageId(null);
      setQuantity(1);
      setCustomMinutes('');
      setCustomPrice('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    if (selectedPackageId === 'custom') {
        const mins = parseInt(customMinutes, 10);
        const price = parseInt(customPrice, 10) || 0;
        if (mins > 0) {
            onAddTime({
                id: 'custom-' + Date.now(),
                name: `Custom (${mins}m)`,
                duration: mins * 60,
                price: price,
                validity: 1,
                isAddTimePackage: true
            }, quantity);
        }
    } else if (selectedPackage && quantity > 0) {
        onAddTime(selectedPackage, quantity);
    }
    onOpenChange(false);
  };
  
  const maxQuantity = station?.members.length || 1;

  const canConfirm = selectedPackageId === 'custom' 
    ? (parseInt(customMinutes, 10) > 0)
    : (!!selectedPackageId && addTimePackages.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Time</DialogTitle>
          <DialogDescription>
            Select a package or enter custom time to extend the session.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <RadioGroup value={selectedPackageId || ''} onValueChange={setSelectedPackageId} className="space-y-2">
                <ScrollArea className="h-64 pr-3">
                    {addTimePackages.map(pkg => (
                        <Label 
                            key={pkg.id}
                            htmlFor={pkg.id}
                            className={cn(
                                "flex items-center space-x-2 rounded-md border p-3 mb-2",
                                "cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary",
                                selectedPackageId === pkg.id && "bg-primary/10"
                            )}
                        >
                            <RadioGroupItem value={pkg.id} id={pkg.id} />
                            <div className="flex-1">
                                <p className="font-bold">{pkg.name}</p>
                                <div className="flex justify-between text-sm text-muted-foreground">
                                    <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatPackageDuration(pkg.duration)}</span>
                                    <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3" /> {pkg.price}</span>
                                </div>
                            </div>
                        </Label>
                    ))}

                    <Label 
                        htmlFor="custom-option"
                        className={cn(
                            "flex items-center space-x-2 rounded-md border p-3 mb-2",
                            "cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary",
                            selectedPackageId === 'custom' && "bg-primary/10 border-primary"
                        )}
                    >
                        <RadioGroupItem value="custom" id="custom-option" />
                        <div className="flex-1">
                            <p className="font-bold flex items-center gap-2"><Sparkles className="h-4 w-4 text-yellow-500"/> Custom Time Adjustment</p>
                            <p className="text-xs text-muted-foreground">Add any duration and set a price.</p>
                        </div>
                    </Label>

                    {selectedPackageId === 'custom' && (
                        <div className="p-3 border rounded-md bg-muted/20 space-y-3 mt-2 animate-in fade-in zoom-in-95 duration-200">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label htmlFor="custom-min" className="text-xs">Minutes to Add</Label>
                                    <Input 
                                        id="custom-min" 
                                        type="number" 
                                        value={customMinutes} 
                                        onChange={e => setCustomMinutes(e.target.value)} 
                                        placeholder="e.g. 15" 
                                        className="h-8"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <Label htmlFor="custom-price" className="text-xs">Price per Player (₹)</Label>
                                    <Input 
                                        id="custom-price" 
                                        type="number" 
                                        value={customPrice} 
                                        onChange={e => setCustomPrice(e.target.value)} 
                                        placeholder="e.g. 50" 
                                        className="h-8"
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </ScrollArea>
            </RadioGroup>

            {(selectedPackageId) && (
              <div className="space-y-3 pt-4 border-t">
                <Label htmlFor="quantity-input" className="font-semibold">Number of Players Affected</Label>
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setQuantity(q => Math.max(1, q - 1))} disabled={quantity <= 1}>
                            <Minus className="h-4 w-4" />
                        </Button>
                        <span id="quantity-input" className="text-xl font-bold w-10 text-center">{quantity}</span>
                        <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setQuantity(q => Math.min(maxQuantity, q + 1))} disabled={quantity >= maxQuantity}>
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                    <div className="text-right">
                        {selectedPackageId === 'custom' ? (
                            <p className="text-lg font-bold">Total: ₹{((parseInt(customPrice, 10) || 0) * quantity).toLocaleString()}</p>
                        ) : (
                            selectedPackage && <p className="text-lg font-bold">Total: ₹{(selectedPackage.price * quantity).toLocaleString()}</p>
                        )}
                        <p className="text-xs text-muted-foreground">{station?.members.length || 0} players in session</p>
                    </div>
                </div>
              </div>
            )}
        </div>
        <DialogFooter>
          <Button onClick={handleConfirm} className="w-full" disabled={!canConfirm}>
            <Plus className="mr-2 h-4 w-4" /> {selectedPackageId === 'custom' ? 'Add Custom Time' : 'Add Package'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
