
'use client';
import { LogTable } from '@/components/logs/log-table';

export default function RewardLogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Reward Logs
        </h1>
        <p className="mt-2 text-muted-foreground">
          A log of all reward-related activities.
        </p>
      </div>

      <LogTable
        title="Reward Events"
        description="Showing all logs for reward creation, updates, deletions, and claims."
        logTypes={['REWARD_CREATED', 'REWARD_UPDATED', 'REWARD_DELETED', 'REWARD_CLAIMED']}
      />
    </div>
  );
}
