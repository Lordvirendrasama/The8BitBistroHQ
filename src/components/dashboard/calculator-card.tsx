
'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calculator } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '../ui/button';

export function CalculatorCard() {
  const [billAmount, setBillAmount] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [change, setChange] = useState(0);

  useEffect(() => {
    const bill = parseFloat(billAmount);
    const paid = parseFloat(amountPaid);

    if (!isNaN(bill) && !isNaN(paid) && paid >= bill) {
      setChange(paid - bill);
    } else {
      setChange(0);
    }
  }, [billAmount, amountPaid]);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Calculator className="h-4 w-4 mr-2" />
          Show Calculator
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-headline tracking-wide text-xl">
                <Calculator className="h-5 w-5" />
                Calculate Change
            </DialogTitle>
            <DialogDescription>Enter bill and amount paid.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
            <div className="space-y-1">
                <Label htmlFor="billAmount">Bill Amount (₹)</Label>
                <Input
                id="billAmount"
                type="number"
                placeholder="e.g., 850"
                value={billAmount}
                onChange={(e) => setBillAmount(e.target.value)}
                className="text-lg h-12"
                />
            </div>
            <div className="space-y-1">
                <Label htmlFor="amountPaid">Amount Paid (₹)</Label>
                <Input
                id="amountPaid"
                type="number"
                placeholder="e.g., 1000"
                value={amountPaid}
                onChange={(e) => setAmountPaid(e.target.value)}
                className="text-lg h-12"
                />
            </div>
            <div className="mt-2 rounded-md border bg-muted p-2 text-center">
                <p className="text-sm text-muted-foreground">Change to Give</p>
                <p className="text-3xl font-bold text-primary">
                ₹{change.toFixed(2)}
                </p>
            </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
