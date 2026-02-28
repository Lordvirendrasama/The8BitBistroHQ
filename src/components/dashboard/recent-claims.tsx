'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, doc, deleteDoc } from 'firebase/firestore';
import type { RecentRewardClaim } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, Gift } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { logDataAction } from '@/firebase/firestore/logs';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import Image from 'next/image';

export function RecentClaims() {
  const { db } = useFirebase();
  const { toast } = useToast();

  const recentClaimsQuery = useMemo(() => {
    if (!db) return null;
    return collection(db, 'recentRewardClaims');
  }, [db]);

  const { data: claims, loading } = useCollection<RecentRewardClaim>(recentClaimsQuery);

  const handleDismiss = async (claimId: string) => {
    if (!db) return;
    
    const claimRef = doc(db, 'recentRewardClaims', claimId);
    await deleteDoc(claimRef);
    
    logDataAction('Dismissed recent reward claim notification', { claimId });
    toast({
      title: 'Notification Dismissed',
    });
  };

  if (loading || !claims || claims.length === 0) {
    return null;
  }

  return (
    <div className="fixed top-24 right-8 z-50 w-full max-w-sm space-y-4">
      {claims.map((claim) => (
        <Card key={claim.id} className="shadow-lg animate-in fade-in-0 slide-in-from-right-8">
          <CardHeader className="flex flex-row items-start gap-4 p-4">
             <Avatar className="h-12 w-12 border-2 border-primary/50">
                <Image src={claim.memberAvatarUrl} alt={claim.memberName} width={48} height={48} />
                <AvatarFallback>{claim.memberName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Gift className="text-primary"/>
                    Reward Claimed!
                </CardTitle>
                <CardDescription className="text-sm">
                  <strong>{claim.memberName}</strong> redeemed "<strong>{claim.rewardName}</strong>" for {claim.pointsCost.toLocaleString()} points.
                </CardDescription>
            </div>
          </CardHeader>
           <CardFooter className="p-2 border-t">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => handleDismiss(claim.id)}>
                <X className="mr-2 h-4 w-4" />
                Dismiss
              </Button>
            </CardFooter>
        </Card>
      ))}
    </div>
  );
}
