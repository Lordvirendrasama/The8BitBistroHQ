
'use client';
import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import type { Debt } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Button } from '@/components/ui/button';
import { FileWarning, CheckCircle2, Phone, User, Clock, IndianRupee, HandCoins, Plus, X, AlignLeft, Smartphone } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { clearDebt, recordDebt } from '@/firebase/firestore/debts';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { format } from 'date-fns';
import { ScrollArea } from '../ui/scroll-area';
import { useAuth } from '@/firebase/auth/use-user';
import { cn } from '@/lib/utils';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';

export function PendingNotifications() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();

  // State for the "Add Record" form
  const [showAddForm, setShowAddForm] = useState(false);
  const [newType, setNewType] = useState<'receivable' | 'payable'>('receivable');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAmount, setNewAmount] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const debtsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'debts'), where('status', '==', 'pending'));
  }, [db]);

  const { data: debts, loading } = useCollection<Debt>(debtsQuery);

  const stats = useMemo(() => {
    if (!debts) return { totalReceivable: 0, totalPayable: 0, count: 0 };
    return debts.reduce((acc, debt) => {
      if (debt.type === 'receivable') acc.totalReceivable += debt.amount;
      else acc.totalPayable += debt.amount;
      acc.count++;
      return acc;
    }, { totalReceivable: 0, totalPayable: 0, count: 0 });
  }, [debts]);

  const handleClear = async (debtId: string) => {
    if (!user) return;
    const success = await clearDebt(debtId, user);
    if (success) {
      toast({ title: 'Debt Cleared', description: 'The record has been updated.' });
    }
  };

  const handleSaveDebt = async () => {
    const amountNum = parseFloat(newAmount);
    if (!newName || !amountNum || amountNum <= 0 || !user) {
      toast({ variant: 'destructive', title: "Missing Info", description: "Name and a valid amount are required." });
      return;
    }

    setIsSubmitting(true);
    const result = await recordDebt({
      type: newType,
      contactName: newName,
      contactPhone: newPhone,
      amount: amountNum,
      originalAmount: amountNum,
      description: newDescription || (newType === 'receivable' ? 'Manual receivable entry' : 'Manual payable entry'),
    }, user);

    if (result) {
      toast({ title: 'Record Saved', description: `Recorded ${newType} for ${newName}.` });
      resetForm();
    } else {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not save record.' });
    }
    setIsSubmitting(false);
  };

  const resetForm = () => {
    setShowAddForm(false);
    setNewName('');
    setNewPhone('');
    setNewAmount('');
    setNewDescription('');
    setNewType('receivable');
  };

  if (loading) {
    return (
        <Button variant="outline" size="icon" className="relative opacity-50 grayscale cursor-default">
            <HandCoins className="h-5 w-5" />
        </Button>
    );
  }

  const hasDebts = debts && debts.length > 0;

  return (
    <Popover onOpenChange={(open) => !open && resetForm()}>
        <PopoverTrigger asChild>
            <Button variant="outline" size="icon" className="relative">
                <HandCoins className={cn("h-5 w-5", stats.totalReceivable > 0 ? "text-destructive" : stats.totalPayable > 0 ? "text-green-600" : "")} />
                {stats.count > 0 && (
                  <Badge variant="destructive" className="absolute -right-2 -top-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] rounded-full">
                      {stats.count}
                  </Badge>
                )}
            </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0 overflow-hidden">
            <div className="p-4 border-b bg-muted/20">
                 <div className="flex justify-between items-center mb-2">
                    <h4 className="font-black text-sm uppercase tracking-widest flex items-center gap-2">
                        <HandCoins className="h-4 w-4" />
                        Outstanding Balance
                    </h4>
                    <Button 
                      variant={showAddForm ? "ghost" : "outline"} 
                      size="sm" 
                      className="h-7 w-7 p-0" 
                      onClick={() => setShowAddForm(!showAddForm)}
                    >
                      {showAddForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    </Button>
                 </div>
                 
                 {!showAddForm && (
                   <div className="flex gap-4">
                      <div className="flex-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Receivable</p>
                          <p className="text-lg font-black text-destructive">₹{stats.totalReceivable.toLocaleString()}</p>
                      </div>
                      <div className="flex-1">
                          <p className="text-[10px] font-bold text-muted-foreground uppercase">Payable</p>
                          <p className="text-lg font-black text-green-600">₹{stats.totalPayable.toLocaleString()}</p>
                      </div>
                   </div>
                 )}
            </div>

            {showAddForm ? (
              <div className="p-4 space-y-4 animate-in slide-in-from-top-2 duration-200">
                <RadioGroup 
                  value={newType} 
                  onValueChange={(v) => setNewType(v as 'receivable' | 'payable')}
                  className="flex gap-4"
                >
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="receivable" id="r1" className="text-destructive border-destructive" />
                    <Label htmlFor="r1" className="text-xs font-bold uppercase text-destructive cursor-pointer">Owes Us</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="payable" id="r2" className="text-green-600 border-green-600" />
                    <Label htmlFor="r2" className="text-xs font-bold uppercase text-green-600 cursor-pointer">We Owe</Label>
                  </div>
                </RadioGroup>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Name</Label>
                    <div className="relative">
                      <User className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        placeholder="John" 
                        value={newName} 
                        onChange={e => setNewName(e.target.value)} 
                        className="h-8 pl-7 text-xs"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[10px] uppercase font-bold text-muted-foreground">Amount (₹)</Label>
                    <div className="relative">
                      <IndianRupee className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                      <Input 
                        type="number" 
                        placeholder="0" 
                        value={newAmount} 
                        onChange={e => setNewAmount(e.target.value)} 
                        className="h-8 pl-7 text-xs font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Phone (Optional)</Label>
                  <div className="relative">
                    <Smartphone className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="9876543210" 
                      value={newPhone} 
                      onChange={e => setNewPhone(e.target.value)} 
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Description</Label>
                  <div className="relative">
                    <AlignLeft className="absolute left-2 top-2 h-3 w-3 text-muted-foreground" />
                    <Input 
                      placeholder="Reason for debt..." 
                      value={newDescription} 
                      onChange={e => setNewDescription(e.target.value)} 
                      className="h-8 pl-7 text-xs"
                    />
                  </div>
                </div>

                <Button 
                  onClick={handleSaveDebt} 
                  disabled={isSubmitting}
                  className={cn(
                    "w-full h-10 font-bold uppercase tracking-widest shadow-lg",
                    newType === 'receivable' ? "bg-destructive hover:bg-destructive/90" : "bg-green-600 hover:bg-green-700"
                  )}
                >
                  <HandCoins className="mr-2 h-4 w-4" />
                  Save Record
                </Button>
              </div>
            ) : (
              <ScrollArea className="max-h-96">
                  <div className="divide-y">
                      {hasDebts ? debts.map((debt) => (
                          <div key={debt.id} className="p-4 bg-background hover:bg-accent/5 transition-colors">
                              <div className="flex justify-between items-start mb-2">
                                  <div className="space-y-0.5">
                                      <div className="flex items-center gap-2">
                                          <p className="font-bold text-sm">{debt.contactName}</p>
                                          <Badge variant={debt.type === 'receivable' ? 'destructive' : 'default'} className="h-4 text-[8px] uppercase px-1.5 bg-opacity-10 text-opacity-100">
                                              {debt.type === 'receivable' ? 'OWES US' : 'WE OWE'}
                                          </Badge>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <Phone className="h-3 w-3" /> {debt.contactPhone || 'No number'}
                                      </p>
                                  </div>
                                  <p className={cn("font-black text-lg", debt.type === 'receivable' ? "text-destructive" : "text-green-600")}>
                                      ₹{debt.amount.toLocaleString()}
                                  </p>
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-2 italic mb-3">"{debt.description}"</p>
                              <div className="flex items-center justify-between gap-2">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 uppercase font-bold">
                                      <Clock className="h-3 w-3" />
                                      {format(new Date(debt.timestamp), 'MMM d, p')}
                                  </span>
                                  <Button 
                                      size="sm" 
                                      variant="outline" 
                                      className="h-7 text-[10px] font-bold uppercase tracking-wider hover:bg-green-600 hover:text-white transition-colors"
                                      onClick={() => handleClear(debt.id)}
                                  >
                                      <CheckCircle2 className="mr-1 h-3 w-3" />
                                      Clear Debt
                                  </Button>
                              </div>
                          </div>
                      )) : (
                        <div className="py-12 px-4 text-center text-muted-foreground italic text-xs">
                          No outstanding balances found.
                        </div>
                      )}
                  </div>
              </ScrollArea>
            )}
        </PopoverContent>
    </Popover>
  );
}
