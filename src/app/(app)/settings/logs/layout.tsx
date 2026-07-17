'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function LogsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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
      {/* Sleek nested subnav */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-2 border-b border-white/5 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
        {subNav.map(item => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-1.5 rounded-lg text-sm uppercase tracking-wider font-bold transition-all shrink-0 active:scale-95 border",
                isActive
                  ? "bg-primary/10 text-primary border-primary/25 shadow-[0_0_10px_rgba(239,0,53,0.1)] font-extrabold"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5 border-transparent"
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
      <div>{children}</div>
    </div>
  );
}
