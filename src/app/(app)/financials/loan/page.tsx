
'use client';
import { LoanTracker } from '@/components/liabilities/loan-tracker';
import { useAuth } from '@/firebase/auth/use-user';
import { ShieldAlert, Landmark } from 'lucide-react';

export default function LoanPage() {
  const { user } = useAuth();

  // ONLY Viren can see this page
  if (user?.username !== 'Viren') {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center space-y-4 text-center">
        <ShieldAlert className="h-16 w-16 text-destructive" />
        <h1 className="text-4xl font-headline uppercase tracking-tighter">Access Denied</h1>
        <p className="text-muted-foreground max-w-md font-medium">
          Strategic debt data is restricted to the Owner (Viren).
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-headline text-4xl sm:text-5xl tracking-wider text-foreground flex items-center gap-4 uppercase">
          <Landmark className="h-10 w-10 sm:h-12 sm:w-12 text-primary" />
          LOAN PROTOCOL
        </h1>
        <p className="text-muted-foreground font-black uppercase tracking-[0.2em] text-xs sm:text-sm pl-1">
          STRATEGIC DEBT TRACKING, INTEREST MODELLING & REPAYMENT VELOCITY.
        </p>
      </div>

      <LoanTracker />
    </div>
  );
}
