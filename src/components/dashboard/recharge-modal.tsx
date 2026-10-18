
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
import { playCoinSound } from '@/lib/audio/chiptune';
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

  const [categoryFilter, setCategoryFilter] = useState<'all' | 'ps5' | 'ps4' | 'board' | 'retro' | 'bulk'>('all');

  const filteredPackages = useMemo(() => {
    if (!packages) return [];
    if (categoryFilter === 'all') return packages;
    return packages.filter(pkg => {
      const nameUpper = pkg.name.toUpperCase();
      if (categoryFilter === 'ps5') return (pkg.stationType === 'ps5' || nameUpper.includes('PS5')) && !(pkg.validity && pkg.validity > 1);
      if (categoryFilter === 'ps4') return pkg.stationType === 'ps4' || nameUpper.includes('PS4');
      if (categoryFilter === 'board') return pkg.stationType === 'boardgame' || pkg.isBoardGamePass || nameUpper.includes('BOARD');
      if (categoryFilter === 'retro') return pkg.stationType === 'retrogaming' || pkg.isRetroGamePass || nameUpper.includes('RETRO');
      if (categoryFilter === 'bulk') return (pkg.validity && pkg.validity > 1) || pkg.duration >= 18000;
      return true;
    });
  }, [packages, categoryFilter]);

  const handleRecharge = async () => {
    const pkg = packages?.find(p => p.id === selectedPkgId);
    if (!pkg) return;

    setIsSubmitting(true);
    const result = await rechargeMember(member.id, pkg, paymentMethod);
    
    if (result) {
      playCoinSound();
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
      <DialogContent className="w-[98vw] max-w-[98vw] sm:max-w-md h-[90vh] sm:max-h-[90vh] flex flex-col p-0 overflow-hidden border-2 border-yellow-500/30 shadow-2xl rounded-xl">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Zap className="text-yellow-500 h-5 w-5 fill-current" />
            Recharge: {member.name}
          </DialogTitle>
          <DialogDescription>Select a prepaid time package to add to this member's balance.</DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col px-6 py-4 space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold uppercase tracking-normal text-muted-foreground pl-1">Available Packs</Label>
              <span className="text-xs font-mono text-muted-foreground">{filteredPackages.length} options</span>
            </div>

            {/* Quick Category Chips */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
              {[
                { id: 'all', label: 'All' },
                { id: 'ps5', label: 'PS5' },
                { id: 'ps4', label: 'PS4' },
                { id: 'board', label: 'Board' },
                { id: 'retro', label: 'Retro' },
                { id: 'bulk', label: 'Bulk' },
              ].map(cat => (
                <Button
                  key={cat.id}
                  type="button"
                  size="sm"
                  variant={categoryFilter === cat.id ? 'default' : 'outline'}
                  className={cn(
                    "h-7 px-2.5 text-xs font-bold uppercase rounded-lg border",
                    categoryFilter === cat.id 
                      ? "bg-yellow-500 text-black hover:bg-yellow-600 border-yellow-500 shadow-sm" 
                      : "border-muted-foreground/30 hover:border-yellow-500/50"
                  )}
                  onClick={() => setCategoryFilter(cat.id as any)}
                >
                  {cat.label}
                </Button>
              ))}
            </div>

            <ScrollArea className="h-64 border rounded-xl bg-muted/5 p-2">
              {loading ? (
                <div className="h-full flex items-center justify-center font-bold uppercase text-sm animate-pulse">Loading Inventory...</div>
              ) : (
                <RadioGroup value={selectedPkgId || ''} onValueChange={setSelectedPkgId} className="space-y-2">
                  {filteredPackages.map(pkg => (
                    <Label 
                      key={pkg.id} 
                      className={cn(
                        "flex items-center justify-between p-3.5 rounded-xl border-2 transition-all cursor-pointer bg-card",
                        selectedPkgId === pkg.id ? "border-yellow-500 ring-2 ring-yellow-500/20 shadow-md bg-yellow-500/5" : "hover:border-primary/20"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <RadioGroupItem value={pkg.id} id={pkg.id} />
                        <div className="space-y-0.5 min-w-0">
                          <p className="font-bold text-sm uppercase leading-none truncate">{pkg.name}</p>
                          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase">
                            <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {formatDuration(pkg.duration)}</span>
                            <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {pkg.validity || 1} {pkg.validity === 1 ? 'Day (24h)' : 'Days'}</span>
                          </div>
                        </div>
                      </div>
                      <span className="font-bold text-base text-yellow-600 dark:text-yellow-400 font-mono shrink-0 ml-2">₹{pkg.price}</span>
                    </Label>
                  ))}
                  {filteredPackages.length === 0 && (
                    <div className="h-full flex flex-col items-center justify-center text-center p-8 opacity-40">
                        <Zap className="h-8 w-8 mb-2" />
                        <p className="text-xs font-bold uppercase">No Recharge Packs in this category</p>
                    </div>
                  )}
                </RadioGroup>
              )}
            </ScrollArea>
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-bold uppercase tracking-normal text-muted-foreground pl-1">Payment Method</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button 
                variant={paymentMethod === 'cash' ? 'default' : 'outline'} 
                className="h-12 font-bold uppercase tracking-tight"
                onClick={() => setPaymentMethod('cash')}
              >
                <Banknote className="mr-2 h-4 w-4" /> Cash
              </Button>
              <Button 
                variant={paymentMethod === 'upi' ? 'default' : 'outline'} 
                className="h-12 font-bold uppercase tracking-tight"
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
            className="w-full h-14 font-bold uppercase tracking-normal text-lg shadow-xl"
          >
            {isSubmitting ? "Processing..." : "Confirm & Recharge"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
