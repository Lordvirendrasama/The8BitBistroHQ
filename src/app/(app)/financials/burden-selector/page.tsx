
'use client';

import { useState, useEffect } from 'react';
import { useFirebase } from '@/firebase/provider';
import { doc, onSnapshot } from 'firebase/firestore';
import { updateSettings } from '@/firebase/firestore/settings';
import type { Settings } from '@/lib/types';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ShieldCheck, Wallet, Landmark, Calendar, History, Info, AlertCircle, TrendingUp, Percent, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export default function BurdenSelectorPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  // SECURITY: Only Viren can manage burdens
  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (snap) => {
      if (snap.exists()) {
        setSettings(snap.data() as Settings);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [db]);

  const handleToggle = async (key: keyof Settings, value: boolean) => {
    if (user?.username !== 'Viren') {
        toast({ variant: 'destructive', title: "Access Denied", description: "Only the owner can calibrate the strategy engine." });
        return;
    }
    const success = await updateSettings({ [key]: value });
    if (success) {
        toast({ 
            title: "Strategy Calibrated", 
            description: `Math engine updated for ${key.replace('include', '')}.` 
        });
    }
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Syncing Strategy Engine...</div>;
  }

  const isViren = user?.username === 'Viren';

  return (
    <div className="space-y-8 max-w-4xl mx-auto font-body">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-4xl tracking-wider text-foreground flex items-center gap-4 uppercase">
          <ShieldCheck className="h-10 w-10 text-primary" />
          Burden Selection
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs pl-1">
          Calibrate the Profit & Loss engine by selecting active financial liabilities.
        </p>
      </div>

      {!isViren && (
        <Card className="border-destructive bg-destructive/5">
            <CardContent className="p-4 flex items-center gap-3">
                <AlertCircle className="text-destructive h-5 w-5" />
                <p className="text-xs font-bold text-destructive uppercase">VIEW-ONLY MODE: Only Viren can modify these strategic toggles.</p>
            </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-6">
        <Card className="border-2 shadow-xl overflow-hidden">
            <CardHeader className="bg-muted/10 border-b">
                <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    Strategy Configuration
                </CardTitle>
                <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Select which costs are factored into your "Survival Target".</CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-8">
                
                {/* 1. FIXED BILLS */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-blue-500/10 rounded-xl">
                            <Wallet className="h-6 w-6 text-blue-600" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase">Fixed Overheads</Label>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Electricity, Internet, Water, and regular bistro bills.</p>
                        </div>
                    </div>
                    <Switch 
                        checked={settings?.includeFixed ?? true} 
                        onCheckedChange={(v) => handleToggle('includeFixed', v)}
                        disabled={!isViren}
                    />
                </div>

                {/* 2. LOAN INTEREST */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Percent className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase text-primary">Loan Interest Maintenance</Label>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Bare minimum daily intake to prevent debt growth (Interest only).</p>
                        </div>
                    </div>
                    <Switch 
                        checked={settings?.includeLoanInterest ?? true} 
                        onCheckedChange={(v) => handleToggle('includeLoanInterest', v)}
                        disabled={!isViren}
                    />
                </div>

                {/* 3. LOAN PRINCIPAL */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-xl">
                            <Zap className="h-6 w-6 text-primary" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase text-primary">Loan Principal Recovery</Label>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">The required daily share to clear the principal by the 2030 deadline.</p>
                        </div>
                    </div>
                    <Switch 
                        checked={settings?.includeLoanPrincipal ?? true} 
                        onCheckedChange={(v) => handleToggle('includeLoanPrincipal', v)}
                        disabled={!isViren}
                    />
                </div>

                {/* 4. MONTHLY RENT */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-emerald-500/10 rounded-xl">
                            <Calendar className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase text-emerald-600">Active Lease (Rent)</Label>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">The standard daily portion of your current monthly rent.</p>
                        </div>
                    </div>
                    <Switch 
                        checked={settings?.includeRent ?? true} 
                        onCheckedChange={(v) => handleToggle('includeRent', v)}
                        disabled={!isViren}
                    />
                </div>

                {/* 5. RENT BACKLOG */}
                <div className="flex items-center justify-between p-4 rounded-xl border-2 bg-card hover:bg-muted/5 transition-all">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-amber-500/10 rounded-xl">
                            <History className="h-6 w-6 text-amber-600" />
                        </div>
                        <div className="space-y-0.5">
                            <Label className="text-sm font-black uppercase text-amber-600">Backlog Recovery</Label>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight">Daily repayment share of unpaid arrears spread until 2030.</p>
                        </div>
                    </div>
                    <Switch 
                        checked={settings?.includeBacklog ?? true} 
                        onCheckedChange={(v) => handleToggle('includeBacklog', v)}
                        disabled={!isViren}
                    />
                </div>

            </CardContent>
        </Card>

        <div className="p-6 rounded-2xl bg-blue-500/5 border-2 border-blue-500/20 flex flex-col sm:flex-row items-center gap-6">
            <div className="bg-blue-500 p-4 rounded-2xl shadow-lg shrink-0">
                <Info className="text-white h-8 w-8" />
            </div>
            <div className="text-center sm:text-left">
                <h4 className="font-black uppercase tracking-tight text-lg">Impact Notice</h4>
                <p className="text-sm text-muted-foreground max-w-2xl font-medium mt-1">
                    Selections made on this page update the <strong>Survival Threshold</strong> globally. This affects the daily goals on the Owner Pulse, Profit Dashboard, and the "Making It" requirements in your Financial Audits. Splitting your loan into <strong>Interest</strong> and <strong>Principal</strong> allows you to manage cashflow during lean periods.
                </p>
            </div>
        </div>
      </div>
    </div>
  );
}
