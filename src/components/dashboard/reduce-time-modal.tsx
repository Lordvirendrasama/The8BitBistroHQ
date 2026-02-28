'use client';
import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { MinusCircle, Clock } from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { Station } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface ReduceTimeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onReduceTime: (minutes: number) => void;
  station: Station | null;
}

export function ReduceTimeModal({ isOpen, onOpenChange, onReduceTime, station }: ReduceTimeModalProps) {
  const [selectedValue, setSelectedValue] = useState('30');
  const [customAmount, setCustomAmount] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      setSelectedValue('30');
      setCustomAmount('');
    }
  }, [isOpen]);

  const handleConfirm = () => {
    const minutes = parseInt(selectedValue === 'custom' ? customAmount : selectedValue, 10);
    if (isNaN(minutes) || minutes <= 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid Amount',
        description: 'Please enter a positive number of minutes to reduce.',
      });
      return;
    }
    onReduceTime(minutes);
    onOpenChange(false);
  };

  const finalAmount = selectedValue === 'custom' ? customAmount : selectedValue;

  const options = [
    { value: '15', label: '15 minutes' },
    { value: '30', label: '30 minutes' },
    { value: '60', label: '60 minutes' },
    { value: 'custom', label: 'Custom Amount' },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reduce Time</DialogTitle>
          <DialogDescription>
            Select or enter an amount of time to remove from {station?.name}. This does not affect the bill.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
            <RadioGroup value={selectedValue} onValueChange={setSelectedValue} className="space-y-2">
                {options.map((opt) => (
                    <Label 
                        key={opt.value}
                        htmlFor={`reduce-${opt.value}`}
                        className={cn(
                            "flex items-center space-x-2 rounded-md border p-3",
                            "cursor-pointer hover:bg-accent has-[[data-state=checked]]:border-destructive has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-destructive/50",
                            selectedValue === opt.value && "bg-destructive/5 border-destructive"
                        )}
                    >
                        <RadioGroupItem value={opt.value} id={`reduce-${opt.value}`} />
                        <div className="flex-1">
                            <p className="font-bold">{opt.label}</p>
                        </div>
                        <Clock className="h-4 w-4 text-muted-foreground opacity-50" />
                    </Label>
                ))}
            </RadioGroup>

            {selectedValue === 'custom' && (
              <div className="pl-6 pt-2 space-y-2 animate-in slide-in-from-top-2 duration-200">
                <Label htmlFor="custom-minutes" className="text-sm font-medium">Minutes to Remove</Label>
                 <Input 
                    id="custom-minutes"
                    type="number"
                    placeholder="e.g., 10"
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    className="focus-visible:ring-destructive"
                 />
              </div>
            )}
        </div>
        <DialogFooter>
          <Button variant="destructive" onClick={handleConfirm} className="w-full" disabled={!finalAmount || parseInt(finalAmount, 10) <= 0}>
            <MinusCircle className="mr-2 h-4 w-4" /> Reduce Time by {finalAmount || 0} min
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
