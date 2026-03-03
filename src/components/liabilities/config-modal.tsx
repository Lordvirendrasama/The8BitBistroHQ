
'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/firebase/auth/use-user';
import { useToast } from '@/hooks/use-toast';
import { updateLiabilityConfig } from '@/firebase/firestore/liabilities';
import type { LiabilityState } from '@/lib/types';
import { Settings2, Save, AlertTriangle, ShieldCheck, RefreshCcw } from 'lucide-react';

interface LiabilityConfigModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  state: LiabilityState;
  onSuccess: () => void;
}

export function LiabilityConfigModal({ isOpen, onOpenChange, state, onSuccess }: LiabilityConfigModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [formData, setFormData] = useState<Partial<LiabilityState>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
        setFormData({
            loanPrincipalStart: state.loanPrincipalStart,
            loanBalance: Math.round(state.loanBalance),
            annualInterestRate: state.annualInterestRate,
            loanStartDate: state.loanStartDate.slice(0, 10),
            monthlyRent: state.monthlyRent,
            rentBalance: Math.round(state.rentBalance)
        });
    }
  }, [isOpen, state]);

  const handleSave = async () => {
    if (!user) return;
    setIsSubmitting(true);
    
    const success = await updateLiabilityConfig({
        ...formData,
        loanStartDate: new Date(formData.loanStartDate as string).toISOString()
    }, user);

    if (success) {
      toast({ title: "Configuration Updated", description: "Liability parameters have been calibrated." });
      onSuccess();
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: "Update Failed" });
    }
    setIsSubmitting(false);
  };

  const resetToPrincipal = () => {
    setFormData(prev => ({ ...prev, loanBalance: prev.loanPrincipalStart }));
    toast({ title: "Balance Reset", description: "Current debt matches the starting principal." });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl font-body p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-muted/10 border-b">
          <DialogTitle className="font-headline text-xl flex items-center gap-2">
            <Settings2 className="text-primary" />
            ENGINE CALIBRATION
          </DialogTitle>
          <DialogDescription className="font-black text-[9px] uppercase tracking-widest text-muted-foreground mt-1">Configure your core liability parameters.</DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-8">
          <div className="bg-primary/5 border-2 border-dashed border-primary/20 p-4 rounded-xl flex items-start gap-4">
            <ShieldCheck className="text-primary h-6 w-6 shrink-0 mt-1" />
            <div className="space-y-1">
                <p className="font-black uppercase text-[10px] text-primary">Simple Setup</p>
                <p className="text-xs font-medium text-foreground/80 leading-relaxed">
                    Adjust the <strong>Current Debt</strong> or <strong>Unpaid Rent</strong> if you've made manual payments that aren't logged. 
                    The system compounds interest and adds rent backlog automatically based on the Start Date.
                </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* LOAN SECTION */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2 border-b pb-2">
                    Business Loan
                </h4>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Starting Principal (₹)</Label>
                        <Input type="number" value={formData.loanPrincipalStart} onChange={e => setFormData(p => ({...p, loanPrincipalStart: Number(e.target.value)}))} className="font-mono font-bold" />
                    </div>
                    <div className="space-y-1">
                        <div className="flex justify-between items-center mb-1">
                            <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Current Debt Balance (₹)</Label>
                            <button onClick={resetToPrincipal} className="text-[8px] font-black text-primary hover:underline flex items-center gap-1">
                                <RefreshCcw className="h-2 w-2" /> RESET TO PRINCIPAL
                            </button>
                        </div>
                        <Input type="number" value={formData.loanBalance} onChange={e => setFormData(p => ({...p, loanBalance: Number(e.target.value)}))} className="font-mono font-black border-primary/20 text-primary bg-primary/5" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Int. Rate (%)</Label>
                            <Input type="number" value={formData.annualInterestRate} onChange={e => setFormData(p => ({...p, annualInterestRate: Number(e.target.value)}))} className="font-bold" />
                        </div>
                        <div className="space-y-1">
                            <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Loan Start Date</Label>
                            <Input type="date" value={formData.loanStartDate} onChange={e => setFormData(p => ({...p, loanStartDate: e.target.value}))} className="font-bold h-10 text-xs" />
                        </div>
                    </div>
                </div>
            </div>

            {/* RENT SECTION */}
            <div className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2 border-b pb-2">
                    Rent Backlog
                </h4>
                <div className="space-y-3">
                    <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Monthly Rent Cost (₹)</Label>
                        <Input type="number" value={formData.monthlyRent} onChange={e => setFormData(p => ({...p, monthlyRent: Number(e.target.value)}))} className="font-mono font-bold" />
                    </div>
                    <div className="space-y-1">
                        <Label className="text-[9px] font-bold uppercase opacity-50 pl-1">Current Unpaid Rent (₹)</Label>
                        <Input type="number" value={formData.rentBalance} onChange={e => setFormData(p => ({...p, rentBalance: Number(e.target.value)}))} className="font-mono font-black border-amber-500/20 text-amber-600 bg-amber-500/5" />
                    </div>
                </div>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 bg-muted/5 border-t">
          <Button disabled={isSubmitting} onClick={handleSave} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-lg gap-3">
            <Save className="h-5 w-5" />
            Update Mission Control
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
