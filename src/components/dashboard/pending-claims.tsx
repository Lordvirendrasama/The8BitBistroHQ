'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { PendingXpClaim, Member } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logDataAction } from '@/firebase/firestore/logs';
import { recordTransaction } from '@/firebase/firestore/members';

interface PendingClaimsProps {
  onGrantXp: (memberId: string, baseXp: number, billAmount: number) => void;
}

export function PendingClaims({ onGrantXp }: PendingClaimsProps) {
  const { db } = useFirebase();
  const { toast } = useToast();

  const pendingClaimsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'pendingXpClaims');
  }, [db]);

  const { data: claims, loading } = useCollection<PendingXpClaim>(pendingClaimsQuery);

  const handleAccept = async (claim: PendingXpClaim) => {
    if (!db) return;
    
    // Use the onGrantXp function passed from the dashboard
    onGrantXp(claim.memberId, claim.baseXp, claim.amount);

    // Delete the pending claim
    const claimRef = doc(db, 'pendingXpClaims', claim.id);
    await deleteDoc(claimRef);

    logDataAction('Accepted XP claim', { claimId: claim.id, memberId: claim.memberId });
    toast({
      title: 'XP Claim Accepted',
      description: `${claim.xpToGrant} XP granted to ${claim.memberName}.`,
    });
  };

  const handleReject = async (claim: PendingXpClaim) => {
    if (!db) return;
    
    const claimRef = doc(db, 'pendingXpClaims', claim.id);
    await deleteDoc(claimRef);
    
    logDataAction('Rejected XP claim', { claimId: claim.id, memberId: claim.memberId });
    toast({
      variant: 'destructive',
      title: 'XP Claim Rejected',
      description: `Claim for ${claim.memberName} has been rejected.`,
    });
  };

  if (loading || !claims || claims.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-24 right-8 z-50 w-full max-w-sm space-y-4">
      {claims.map((claim) => (
        <Card key={claim.id} className="shadow-lg animate-in fade-in-0 slide-in-from-right-8">
          <CardHeader>
            <CardTitle className="text-lg">Pending XP Claim</CardTitle>
            <CardDescription>
              <strong>{claim.memberName}</strong> requested XP for a bill of <strong>₹{claim.amount.toLocaleString()}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p>XP to grant: <span className="font-bold text-primary">{claim.xpToGrant.toLocaleString()} XP</span></p>
            <p className="text-xs text-muted-foreground">
                ({claim.baseXp} base XP &times; {claim.tierMultiplier}x multiplier)
            </p>
          </CardContent>
          <CardFooter className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => handleReject(claim)}>
              <X className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button size="sm" onClick={() => handleAccept(claim)} className="bg-green-600 hover:bg-green-700">
              <Check className="mr-1 h-4 w-4" /> Accept
            </Button>
          </CardFooter>
        </Card>
      ))}
    </div>
  );
}
