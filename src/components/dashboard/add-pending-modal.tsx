
'use client';

import { useState } from 'react';
import type { Member } from '@/lib/types';

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
import { FileWarning } from 'lucide-react';
import { logUserAction } from '@/firebase/firestore/logs';

interface AddPendingModalProps {
  member: Member;
  onAddPending: (memberId: string, amount: number) => void;
}

export function AddPendingModal({ member, onAddPending }: AddPendingModalProps) {
  const [amount, setAmount] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { toast } = useToast();

  const handleSave = () => {
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      toast({
        title: 'Invalid Amount',
        description: 'Please enter a valid pending amount.',
        variant: 'destructive',
      });
      return;
    }
    
    onAddPending(member.id, parsedAmount);
    
    logUserAction(`Added pending amount of ₹${parsedAmount} to ${member.name}.`, {
        memberId: member.id,
        memberName: member.name,
        amount: parsedAmount,
    });

    setAmount('');
    setIsOpen(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
            variant="destructive"
            className="font-bold tracking-wider"
            onClick={() => logUserAction(`Opened Add Pending modal for ${member.name}.`)}
        >
          <FileWarning className="mr-2 h-4 w-4" />
          Add Pending
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="font-headline tracking-wide text-2xl">Add Pending Amount</DialogTitle>
          <DialogDescription>
            Add an outstanding balance for <strong>{member.name}</strong>. The card will be marked red.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Amount (₹)
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="col-span-3"
              placeholder="e.g., 150"
            />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSave} className="w-full font-bold" variant="destructive">
            Confirm & Add Pending
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
