
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutGrid } from 'lucide-react';

const settingsNav = [
  { href: '/settings', label: 'Hub' },
  { href: '/settings/loyalty', label: 'Loyalty Config' },
  { href: '/settings/rewards', label: 'Rewards' },
  { href: '/settings/menu', label: 'Food Menu' },
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/packages', label: 'Gaming Packages' },
  { href: '/settings/recharge-packs', label: 'Recharge Packs' },
  { href: '/settings/employees', label: 'Employees' },
  { href: '/settings/leaves', label: 'Staff Leaves' },
  { href: '/settings/tasks', label: 'Shift Tasks' },
  { href: '/settings/logs', label: 'Logs' },
  { href: '/settings/data', label: 'Data' },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">
            Settings & Admin
          </h1>
          <p className="mt-2 text-muted-foreground font-bold uppercase text-[10px] tracking-widest">
            Central management for loyalty mechanics, menu, rewards, and workforce.
          </p>
        </div>
        <Button asChild variant="outline" className="h-10 border-2 font-black uppercase text-[10px] tracking-widest">
            <Link href="/settings">
                <LayoutGrid className="mr-2 h-4 w-4" />
                Back to Hub
            </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto no-scrollbar">
        {settingsNav.map((item) => (
          <Button
            key={item.href}
            asChild
            variant={pathname === item.href ? 'secondary' : 'ghost'}
            className={cn(
              'font-bold shrink-0 text-xs uppercase h-9',
              pathname === item.href &&
                'bg-primary/10 text-primary hover:bg-primary/20'
            )}
          >
            <Link href={item.href}>{item.label}</Link>
          </Button>
        ))}
      </div>

      <div>{children}</div>
    </div>
  );
}
