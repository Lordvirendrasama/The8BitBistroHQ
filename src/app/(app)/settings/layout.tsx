
'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

const settingsNav = [
  { href: '/settings', label: 'Loyalty Config' },
  { href: '/settings/rewards', label: 'Rewards' },
  { href: '/settings/menu', label: 'Food Menu' },
  { href: '/settings/categories', label: 'Categories' },
  { href: '/settings/packages', label: 'Gaming Packages' },
  { href: '/settings/recharge-packs', label: 'Recharge Packs' },
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
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Settings & Admin
        </h1>
        <p className="mt-2 text-muted-foreground">
          Central management for loyalty mechanics, menu, rewards, and audit logs.
        </p>
      </div>

      <div className="flex items-center gap-2 border-b pb-2 overflow-x-auto no-scrollbar">
        {settingsNav.map((item) => (
          <Button
            key={item.href}
            asChild
            variant={pathname.startsWith(item.href) && (item.href !== '/settings' || pathname === '/settings') ? 'secondary' : 'ghost'}
            className={cn(
              'font-bold shrink-0',
              (pathname.startsWith(item.href) && (item.href !== '/settings' || pathname === '/settings')) &&
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
