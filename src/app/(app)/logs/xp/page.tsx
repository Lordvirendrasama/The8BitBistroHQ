
'use client';
import { LogTable } from '@/components/logs/log-table';

export default function XpLogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          XP Logs
        </h1>
        <p className="mt-2 text-muted-foreground">
          A log of all experience points granted to members.
        </p>
      </div>

      <LogTable
        title="XP Gain Events"
        description="Showing all logs related to members earning XP."
        logTypes={['XP_GAINED']}
      />
    </div>
  );
}
