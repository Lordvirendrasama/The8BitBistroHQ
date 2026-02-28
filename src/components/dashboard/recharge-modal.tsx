
'use client';

import { useState, useMemo } from 'react';
import type { Member, GamingPackage } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { rechargeMember } from '@/firebase/firestore/members';
import { useToast } from '@/hooks/use-toast';
import { Clock, IndianRupee, Zap, Calendar, Banknote, Smartphone } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ScrollArea } from '../ui/scroll-area';

interface RechargeModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  member: Member;
}

export function RechargeModal({ isOpen, onOpenChange, member }: RechargeModalProps) {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [selectedPkgId, setSelectedPkgId] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Specifically fetch packages marked as 'Recharge Pack'
  const packagesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'gamingPackages'), where('isRechargePack', '==', true));
  }, [db]);
  
  const { data: packages, loading } = useCollection<GamingPackage>(packagesQuery);

  const handleRecharge = async () => {
    const pkg = packages?.find(p => p.id === selectedPkgId);
    if (!pkg) return;

    setIsSubmitting(true);
    const result = await rechargeMember(member.id, pkg, paymentMethod);
    
    if (result) {
      toast({ title: "Recharge Successful", description: `${pkg.name} added to ${member.name}'s account.` });
      onOpenChange(false);
    } else {
      toast({ variant: 'destructive', title: "Recharge Failed", description: "Could not process payment." });
    }
    setIsSubmitting(false);
  };

  const formatDuration = (sec: number) => {
    const hours = Math.floor(sec / 3600);
    const mins = Math.floor((sec % 3600) / 60);
    if (hours > 0) return `${hours}h ${mins > 0 ? mins + 'm' : ''}`;
    return `${mins}m`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="text-yellow-500 h-5 w-5" />
            Recharge: {member.name}
          </DialogTitle>
          <DialogDescription>Select a prepaid time package to add to this member's balance.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 space-y-6">
          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Available Packs</Label>
            <ScrollArea className="h-64 border rounded-xl bg-muted/5 p-2">
              {loading ? (
                <div className="h-full flex items-center justify-center font-bold uppercase text-[10px] animate-pulse">Loading Inventory...</div>
              ) : (
                <RadioGroup value={selectedPkgId || ''} onValueChange={setSelectedPkgId} className="space-y-2">
                  {packages?.map(pkg => (
                    <Label 
                      key={pkg.id} 
                      className={cn(
                        "flex items-center justify-between p-4 rounded-xl border-2 transition-all cursor-pointer bg-card",
                        selectedPkgId === pkg.id ? "border-primary ring-2 ring-primary/10 shadow-md" : "hover:border-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <RadioGroupItem value={pkg.id} id={pkg.id} />
                        <div className="space-y-0.5">
                          <p className="font-black text-sm uppercase leading-none">{pkg.name}</p>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(pkg.duration)}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {pkg.validity} Days</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-black text-lg text-primary">₹{pkg.price}</span>
                    </Label>
                  ))}
                  {(!packages || packages.length === 0) && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-30">
                        <Zap className="h-8 w-8 mb-2" />
                        <p className="text-[10px] font-black uppercase">No Recharge Packs Configured</p>
                        <p className="text-[8px] font-bold">Add them in Settings > Recharge Packs</p>
                    </div>
                  )}
                </RadioGroup>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={paymentMethod === 'cash' ? 'default' : 'outline'} 
                className="h-12 font-black uppercase tracking-tight"
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote className="mr-2 h-4 w-4" /> Cash
              </Button>
              <Button 
                variant={paymentMethod === 'upi' ? 'default' : 'outline'} 
                className="h-12 font-black uppercase tracking-tight"
                onClick={() => setPaymentMethod('upi')}
              >
                <Smartphone className="mr-2 h-4 w-4" /> UPI
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter className="p-6 border-t bg-muted/10">
          <Button 
            disabled={!selectedPkgId || isSubmitting} 
            onClick={handleRecharge}
            className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl"
          >
            {isSubmitting ? "Processing..." : "Confirm & Recharge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
