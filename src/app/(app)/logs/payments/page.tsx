
'use client';
import { LogTable } from '@/components/logs/log-table';

export default function PaymentLogsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Payment Logs
        </h1>
        <p className="mt-2 text-muted-foreground">
          A log of all bill payments recorded in the system.
        </p>
      </div>

      <LogTable
        title="Payment Events"
        description="Showing all logs related to bill payments and XP gained from them."
        logTypes={['XP_GAINED']}
      />
    </div>
  );
}
