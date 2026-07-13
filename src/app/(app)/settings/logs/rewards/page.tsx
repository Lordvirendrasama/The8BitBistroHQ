'use client';
import { LogTable } from '@/components/logs/log-table';

export default function SettingsRewardLogsPage() {
  return (
    <LogTable
      title="Reward Activity Logs"
      description="History of reward creation, edits, and member redemptions."
      logTypes={['REWARD_CREATED', 'REWARD_UPDATED', 'REWARD_DELETED', 'REWARD_CLAIMED']}
    />
  );
}
