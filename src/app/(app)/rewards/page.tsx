import { RewardsTable } from '@/components/rewards/rewards-table';

export default function RewardsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Rewards
        </h1>
        <p className="mt-2 text-muted-foreground">
          Define the perks and unlocks for each member level.
        </p>
      </div>

      <RewardsTable />
      
    </div>
  );
}
