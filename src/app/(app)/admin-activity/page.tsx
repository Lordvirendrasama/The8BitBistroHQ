
'use client';
import { LogTable } from '@/components/logs/log-table';

export default function AdminActivityPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          User Login Activity
        </h1>
        <p className="mt-2 text-muted-foreground">
          A log of all user login events.
        </p>
      </div>

      <LogTable
        title="Login Events"
        description="Showing all user login activity."
        logTypes={['USER_LOGIN']}
      />
    </div>
  );
}
