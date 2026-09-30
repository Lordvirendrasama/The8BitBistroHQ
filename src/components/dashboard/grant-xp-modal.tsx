'use client';

import { useState } from 'react';
import type { Member, MemberTier } from '@/lib/types';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { GiftIcon } from 'lucide-react';
import { Badge } from '../ui/badge';
import { logUserAction } from '@/firebase/firestore/logs';
import { playLevelUpSound } from '@/lib/audio/chiptune';

interface GrantXpModalProps {
  member: Member;
  onGrantXp: (memberId: string, xpGained: number, billAmount: number) => void;
}

const tierMultipliers: Record<MemberTier, number> = {
  Red: 1,
  Green: 1.5,
  Gold: 2,
};

const tierColors: Record<MemberTier, string> = {
    Red: 'bg-red-500',
    Green: 'bg-green-500',
    Gold: 'bg-yellow-500',
}

export function GrantXpModal({ member, onGrantXp }: GrantXpModalProps) {
  const [billAmount, setBillAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const parsedBillAmount = parseFloat(billAmount);
  const multiplier = tierMultipliers[member.tier] || 1;
  const finalBitsToGrant = parsedBillAmount > 0 ? Math.floor((parsedBillAmount / 10) * multiplier) : 0;

  const handleGrantXp = () => {
    if (!parsedBillAmount || parsedBillAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid bill amount.',
        variant: 'destructive',
      });
      return;
    }
    
    playLevelUpSound();
    onGrantXp(member.id, finalBitsToGrant, parsedBillAmount);
    
    logUserAction(`Granted ${finalBitsToGrant} Bits to ${member.name} for a bill of ₹${parsedBillAmount}.`, {
        memberId: member.id,
        memberName: member.name,
        billAmount: parsedBillAmount,
        finalBitsToGrant
    });

    toast({
      title: 'Bits Granted!',
      description: `${finalBitsToGrant} Bits have been awarded to ${member.name}.`,
    });
    setBillAmount('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
            className="w-full font-bold tracking-wider"
            onClick={() => logUserAction(`Opened Grant Bits modal for ${member.name}.`)}
        >
          <GiftIcon className="mr-2 h-4 w-4" />
          Grant Bits
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">Grant Bits to {member.name}</DialogTitle>
          <DialogDescription>
            Enter the bill amount to automatically calculate and award Bits based on their tier.
            <Badge className={`${tierColors[member.tier]} text-white ml-2`}>{member.tier} Tier ({multiplier}x)</Badge>
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="billAmount" className="text-right">
              Bill (₹)
            </Label>
            <Input
              id="billAmount"
              type="number"
              value={billAmount}
              onChange={(e) => setBillAmount(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 1000"
            />
          </div>
          <div className="mt-4 rounded-md border bg-muted p-4 text-center">
            <p className="text-sm text-muted-foreground">Bits to be Awarded</p>
            <p className="text-3xl font-bold text-primary">
              {finalBitsToGrant} Bits
            </p>
            <p className="text-sm text-muted-foreground">
              (₹{parsedBillAmount || 0} / 10 x {multiplier}x tier multiplier)
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleGrantXp} className="w-full font-bold">
            Confirm & Grant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
