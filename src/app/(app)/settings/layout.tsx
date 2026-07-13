'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { 
  LayoutGrid, 
  Gem, 
  Utensils, 
  Zap, 
  Users, 
  ListChecks, 
  History, 
  Database 
} from 'lucide-react';
import { useAuth } from '@/firebase/auth/use-user';

const settingsNav = [
  { href: '/settings', label: 'Hub', icon: LayoutGrid },
  { href: '/settings/loyalty', label: 'Loyalty & Rewards', icon: Gem },
  { href: '/settings/menu', label: 'Menu & Packages', icon: Utensils },
  { href: '/settings/recharge-packs', label: 'Recharge Packs', icon: Zap },
  { href: '/settings/employees', label: 'Employees', icon: Users },
  { href: '/settings/tasks', label: 'Shift Tasks', icon: ListChecks },
  { href: '/settings/logs', label: 'Logs', icon: History },
  { href: '/settings/data', label: 'Data', icon: Database },
];

export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const { user } = useAuth();

  const dynamicNav = [
    ...settingsNav,
  ];

  const isHub = pathname === '/settings';

  return (
    <div className="space-y-6 md:space-y-8 max-w-7xl mx-auto px-4 sm:px-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <h1 className="font-headline text-3xl md:text-4xl tracking-wider text-foreground">
            Settings & Admin
          </h1>
          <p className="mt-2 text-muted-foreground font-bold uppercase text-[10px] tracking-widest opacity-80">
            Central management for loyalty mechanics, menu, rewards, and workforce.
          </p>
        </div>
        {!isHub && (
          <Button asChild variant="outline" className="h-10 border-2 font-black uppercase text-[10px] tracking-widest hover:bg-primary/10 hover:text-primary transition-all self-start md:self-auto">
            <Link href="/settings">
              <LayoutGrid className="mr-2 h-4 w-4" />
              Back to Hub
            </Link>
          </Button>
        )}
      </div>

      {/* Modern Glassmorphic Nav Bar */}
      <div className="relative w-full overflow-hidden rounded-xl border border-white/5 bg-[#141414]/40 backdrop-blur-md p-1 shadow-lg">
        {/* Mobile Edge Gradients for scrolling cue */}
        <div className="absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-[#000000] to-transparent pointer-events-none z-10 md:hidden" />
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#000000] to-transparent pointer-events-none z-10 md:hidden" />

        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth w-full px-2 py-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
          {dynamicNav.map((item) => {
            const isActive = item.href === '/settings' 
              ? pathname === '/settings' 
              : pathname.startsWith(item.href);
            const Icon = item.icon;
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-4 py-2.5 rounded-lg text-[10px] md:text-xs uppercase tracking-wider transition-all duration-300 shrink-0 font-bold active:scale-95",
                  isActive 
                    ? "bg-primary text-white shadow-[0_0_15px_rgba(239,0,53,0.35)] border border-primary/20" 
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                )}
              >
                <Icon className={cn("h-4 w-4", isActive ? "text-white" : "text-muted-foreground")} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </div>

      <div className="pt-2">{children}</div>
    </div>
  );
}
