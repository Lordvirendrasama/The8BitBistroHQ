'use client';
import { LogTable } from '@/components/logs/log-table';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function SettingsPaymentLogsPage() {
  const pathname = usePathname();
  const subNav = [
    { href: '/settings/logs', label: 'Master Log' },
    { href: '/settings/logs/payments', label: 'Payments' },
    { href: '/settings/logs/xp', label: 'XP' },
    { href: '/settings/logs/rewards', label: 'Rewards' },
    { href: '/settings/logs/admin-activity', label: 'Logins' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {subNav.map(item => (
          <Button key={item.href} asChild variant={pathname === item.href ? 'secondary' : 'outline'} size="sm" className="h-8 text-xs font-bold">
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>
      <LogTable
        title="Payment & Billing Events"
        description="Audit trail for all station checkouts and transactions."
        logTypes={['BILL_PAID', 'BILL_UPDATED', 'BILL_DELETED']}
      />
    </div>
  );
}
