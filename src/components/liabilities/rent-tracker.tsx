
'use client';

import { useMemo, useState, useEffect } from 'react';
import { useFirebase } from '@/firebase/provider';
import type { LiabilityState } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, History, TrendingDown, Clock, AlertTriangle, IndianRupee, Zap, Info, Landmark } from 'lucide-react';
import { format, differenceInCalendarMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { LiabilityPaymentModal } from './payment-modal';
import { LiabilityConfigModal } from './config-modal';
import { getLiabilityState, processLiabilityCycles } from '@/firebase/firestore/liabilities';
import { useAuth } from '@/firebase/auth/use-user';

export function RentTracker() {
  const { user } = useAuth();
  const [state, setState] = useState<LiabilityState | null>(null);
  const [isProcessing, setIsProcessing] = useState(true);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [isConfigModalOpen, setIsConfigModalOpen] = useState(false);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(Math.round(val));
  };

  const loadData = async () => {
    if (!user) return;
    setIsProcessing(true);
    await processLiabilityCycles(user);
    const s = await getLiabilityState();
    setState(s);
    setIsProcessing(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  if (isProcessing || !state) {
    return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Accessing Lease Ledger...</div>;
  }

  const monthsBehind = Math.ceil(state.rentBalance / (state.monthlyRent || 1));

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
            <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground">Lease Arrears & Arrears</h2>
            <div className="flex items-center gap-3">
                <Calendar className="h-8 w-8 text-amber-600" />
                <h1 className="text-4xl font-headline tracking-tighter text-amber-600">{formatCurrency(state.rentBalance)}</h1>
                <Badge variant="outline" className="border-amber-500/20 text-amber-600 font-black uppercase text-[10px]">Unpaid Arrears</Badge>
            </div>
        </div>
        <div className="flex gap-3">
            <Button variant="outline" size="icon" onClick={() => setIsConfigModalOpen(true)} className="h-14 w-14 border-2">
                <Clock className="h-6 w-6" />
            </Button>
            <Button onClick={() => setIsPayModalOpen(true)} className="h-14 px-10 font-black uppercase tracking-widest shadow-xl bg-amber-600 text-white hover:bg-amber-700">
                <Zap className="mr-2 h-5 w-5 fill-current" />
                Settle Rent
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 shadow-xl bg-card">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Landmark className="h-4 w-4" /> Standard Lease
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{formatCurrency(state.monthlyRent)}<span className="text-xs opacity-40 ml-1">/MO</span></div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">The baseline monthly rent obligation.</p>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-amber-500/5 border-amber-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-amber-600 flex items-center gap-2">
                    <History className="h-4 w-4" /> Months Behind
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-amber-600">{monthsBehind} <span className="text-xs opacity-60">MONTHS</span></div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Total unpaid duration including backlog.</p>
            </CardContent>
        </Card>

        <Card className="border-2 shadow-xl bg-emerald-500/5 border-emerald-500/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                    <TrendingDown className="h-4 w-4" /> Total Rent Paid
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-emerald-600">{formatCurrency(state.totalRentPaid)}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Total lease capital paid since tracking.</p>
            </CardContent>
        </Card>
      </div>

      <Card className="border-4 border-dashed border-amber-500/20 bg-amber-500/[0.02] shadow-2xl">
        <CardContent className="p-8 space-y-6">
            <div className="flex flex-col sm:flex-row items-center gap-6 text-center sm:text-left">
                <div className="h-20 w-20 rounded-2xl bg-amber-500 flex items-center justify-center text-white shadow-lg shrink-0">
                    <AlertTriangle className="h-10 w-10" />
                </div>
                <div className="space-y-2">
                    <h3 className="text-2xl font-headline tracking-tight uppercase text-amber-700">Audit Insight</h3>
                    <p className="text-sm font-medium text-muted-foreground max-w-2xl leading-relaxed">
                        Your rent backlog currently stands at <strong>{formatCurrency(state.rentBalance)}</strong>. 
                        Every month, this balance increases by <strong>{formatCurrency(state.monthlyRent)}</strong> unless a manual payment is recorded. 
                        To reach a clean slate by 2030, your daily surplus must account for both the standard lease and a portion of this backlog.
                    </p>
                </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                <div className="p-4 rounded-xl border-2 bg-card">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Daily Rent Burden</p>
                    <p className="text-2xl font-black font-mono text-amber-600">{formatCurrency(state.monthlyRent / 30)}</p>
                </div>
                <div className="p-4 rounded-xl border-2 bg-card">
                    <p className="text-[9px] font-black uppercase text-muted-foreground tracking-widest mb-1">Backlog Daily Share</p>
                    <p className="text-2xl font-black font-mono text-amber-600">{formatCurrency(state.rentBalance / 60 / 30)}</p>
                    <p className="text-[8px] font-bold opacity-40 uppercase mt-1">Calculated over 60-month recovery window</p>
                </div>
            </div>
        </CardContent>
      </Card>

      <div className="p-6 bg-muted/5 border-2 rounded-2xl flex items-start gap-4">
        <div className="bg-muted p-2 rounded-lg"><Info className="text-muted-foreground h-5 w-5" /></div>
        <div className="space-y-1">
            <h4 className="text-xs font-black uppercase tracking-tight">How automated rent works</h4>
            <p className="text-[10px] text-muted-foreground font-medium leading-relaxed">
                The system uses a virtual clock to apply monthly rent cycles. On the 1st of every month at 5 AM, the lease engine automatically 
                increments your "Unpaid Arrears" by the monthly rent amount configured in your settings. This ensures your liabilities are 
                always reflecting the most current reality.
            </p>
        </div>
      </div>

      <LiabilityPaymentModal isOpen={isPayModalOpen} onOpenChange={setIsPayModalOpen} onSuccess={loadData} />
      <LiabilityConfigModal isOpen={isConfigModalOpen} onOpenChange={setIsConfigModalOpen} state={state} onSuccess={loadData} />
    </div>
  );
}
