
'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { recordLiabilityPayment } from '@/firebase/firestore/liabilities';
import { cn } from '@/lib/utils';
import { Banknote, Wallet, Calendar, Zap, AlignLeft, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';

interface LiabilityPaymentModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function LiabilityPaymentModal({ isOpen, onOpenChange, onSuccess }: LiabilityPaymentModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [target, setTarget] = useState<'loan' | 'rent'>('loan');
  const [type, setType] = useState<'payment' | 'drawdown'>('payment');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePay = async () => {
    const numAmt = parseFloat(amount);
    if (isNaN(numAmt) || numAmt <= 0 || !user) {
      toast({ variant: 'destructive', title: "Invalid Amount" });
      return;
    }

    setIsSubmitting(true);
    const success = await recordLiabilityPayment({
      amount: numAmt,
      target,
      type,
      date: new Date(date).toISOString(),
      note: note.trim() || undefined
    }, user);

    if (success) {
      toast({ title: type === 'drawdown' ? "Funds Drawn" : "Repayment Recorded", description: `Updated ${target} balance successfully.` });
      setAmount('');
      setNote('');
      onSuccess();
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: "Transaction Failed" });
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md font-body">
        <DialogHeader>
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            <Banknote className="text-primary" />
            Record Transaction
          </DialogTitle>
          <DialogDescription className="text-xs uppercase font-bold tracking-widest text-muted-foreground">Adjust your liability balances by recording movements.</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Transaction Type</Label>
            <RadioGroup value={type} onValueChange={(v: any) => setType(v)} className="grid grid-cols-2 gap-3">
              <Label 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer bg-card",
                  type === 'payment' ? "border-emerald-500 bg-emerald-500/5 ring-2 ring-emerald-500/10 shadow-md" : "hover:border-primary/20 border-muted opacity-60"
                )}
              >
                <RadioGroupItem value="payment" className="sr-only" />
                <ArrowDownCircle className={cn("h-5 w-5", type === 'payment' ? "text-emerald-600" : "")} />
                <div className="flex flex-col">
                    <span className="font-black uppercase text-[10px]">Repayment</span>
                    <span className="text-[7px] font-bold opacity-60">LOAN DOWN</span>
                </div>
              </Label>
              <Label 
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer bg-card",
                  type === 'drawdown' ? "border-destructive bg-destructive/5 ring-2 ring-destructive/10 shadow-md" : "hover:border-primary/20 border-muted opacity-60"
                )}
              >
                <RadioGroupItem value="drawdown" className="sr-only" />
                <ArrowUpCircle className={cn("h-5 w-5", type === 'drawdown' ? "text-destructive" : "")} />
                <div className="flex flex-col">
                    <span className="font-black uppercase text-[10px]">Drawdown</span>
                    <span className="text-[7px] font-bold opacity-60">LOAN UP</span>
                </div>
              </Label>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Target Account</Label>
            <RadioGroup value={target} onValueChange={(v: any) => setTarget(v)} className="grid grid-cols-2 gap-3">
              <Label 
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer bg-card",
                  target === 'loan' ? "border-primary bg-primary/5 ring-2 ring-primary/10" : "hover:border-primary/20 border-muted opacity-60"
                )}
              >
                <RadioGroupItem value="loan" className="sr-only" />
                <Zap className={cn("h-5 w-5 mb-1.5", target === 'loan' ? "text-primary fill-current" : "")} />
                <span className="font-black uppercase text-[10px]">Business Loan</span>
              </Label>
              <Label 
                className={cn(
                  "flex flex-col items-center justify-center p-4 rounded-xl border-2 transition-all cursor-pointer bg-card",
                  target === 'rent' ? "border-amber-500 bg-amber-500/5 ring-2 ring-amber-500/10" : "hover:border-amber-500/20 border-muted opacity-60"
                )}
              >
                <RadioGroupItem value="rent" className="sr-only" />
                <Calendar className={cn("h-5 w-5 mb-1.5", target === 'rent' ? "text-amber-600" : "")} />
                <span className="font-black uppercase text-[10px]">Backlog Rent</span>
              </Label>
            </RadioGroup>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 pl-1">Amount (₹)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono font-bold text-muted-foreground">₹</span>
                <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="pl-7 h-12 font-mono font-black text-xl border-2" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 pl-1">Effective Date</Label>
              <Input type="date" value={date} onChange={e => setDate(e.target.value)} className="h-12 font-bold" />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 pl-1">Internal Note</Label>
            <div className="relative">
              <AlignLeft className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
              <Input value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. ADDITIONAL DRAWDOWN" className="pl-10 h-11 font-bold uppercase text-xs border-2" />
            </div>
          </div>
        </div>

        <DialogFooter className="pt-2">
          <Button disabled={isSubmitting || !amount} onClick={handlePay} className={cn(
              "w-full h-14 font-black uppercase tracking-widest shadow-xl text-lg",
              type === 'drawdown' ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"
          )}>
            {isSubmitting ? "Processing..." : type === 'drawdown' ? "Confirm Drawdown" : "Confirm Payment"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
