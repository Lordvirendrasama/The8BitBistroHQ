
'use client';
import { useSearchParams } from 'next/navigation';
import { ClaimReward } from '@/components/claim-rewards/claim-reward';

export default function ClaimRewardsPage() {
  const searchParams = useSearchParams();
  const memberId = searchParams.get('memberId');

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Claim Rewards
        </h1>
        <p className="mt-2 text-muted-foreground">
          Redeem points for rewards on behalf of your members.
        </p>
      </div>

      <ClaimReward initialMemberId={memberId} />
      
    </div>
  );
}
