'use client';
import { LogTable } from '@/components/logs/log-table';

export default function SettingsXpLogsPage() {
  return (
    <LogTable
      title="XP Distribution Logs"
      description="Record of all experience points awarded to members."
      logTypes={['XP_GAINED', 'REFERRAL_BONUS']}
    />
  );
}
