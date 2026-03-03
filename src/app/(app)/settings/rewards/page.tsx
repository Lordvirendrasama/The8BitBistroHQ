'use client';
import { RewardsTable } from '@/components/rewards/rewards-table';

export default function SettingsRewardsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Reward Catalog</h2>
        <p className="text-muted-foreground">
          Manage the items members can redeem using their loyalty points.
        </p>
      </div>
      <RewardsTable />
    </div>
  );
}
