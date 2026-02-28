
'use client';

import * as React from 'react';
import {
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  useSidebar,
  SidebarMenuSub,
  SidebarMenuSubButton,
} from '@/components/ui/sidebar';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';

import { useAuth } from '@/firebase/auth/use-user';
import { UsersIcon } from '@/components/icons/users-icon';
import { ChartIcon } from '@/components/icons/chart-icon';
import { SettingsIcon } from '@/components/icons/settings-icon';
import { Ticket, Users, History, Gem, Utensils, Gamepad2, Database, ListChecks, Receipt, FileBarChart, PieChart, ShieldCheck, ReceiptIndianRupee, Zap } from 'lucide-react';
import { APP_VERSION } from '@/lib/version';

const allNavItems = [
  { href: '/dashboard', icon: UsersIcon, label: 'Dashboard' },
  { href: '/recharges', icon: Zap, label: 'Recharge Hub' },
  { href: '/owner-tasks', icon: ShieldCheck, label: 'Owner Tasks', ownerOnly: true },
  { href: '/staff', icon: ListChecks, label: 'Daily Checklist' },
  { href: '/shift-reports', icon: FileBarChart, label: 'Shift Reports' },
  { href: '/users', icon: Users, label: 'User Registry' },
  { href: '/billing-history', icon: Receipt, label: 'Billing Audit' },
  { 
    href: '/analytics', 
    icon: ChartIcon, 
    label: 'Analytics',
    subItems: [
        { href: '/analytics', label: 'Overview', icon: ChartIcon },
        { href: '/analytics/products', label: 'Sales & Rewards', icon: PieChart },
        { href: '/analytics/accounting', label: 'Financial Audit', icon: ReceiptIndianRupee },
    ]
  },
  { href: '/claim-rewards', icon: Ticket, label: 'Claim Rewards' },
  { 
    href: '/settings', 
    icon: SettingsIcon, 
    label: 'Settings & Admin',
    subItems: [
        { href: '/settings', label: 'Loyalty Config', icon: Gem },
        { href: '/settings/rewards', label: 'Reward Catalog', icon: PieChart },
        { href: '/settings/menu', label: 'Food Menu', icon: Utensils },
        { href: '/settings/packages', label: 'Gaming Packages', icon: Gamepad2 },
        { href: '/settings/tasks', label: 'Shift Tasks', icon: ListChecks },
        { href: '/settings/logs', label: 'System Logs', icon: History },
        { href: '/settings/data', label: 'Data Management', icon: Database },
    ]
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { user } = useAuth();
  const { state } = useSidebar();

  const navItems = React.useMemo(() => {
    if (!user) return [];
    
    let filtered = allNavItems;

    if (user.username !== 'Viren') {
      filtered = filtered.filter(item => !item.ownerOnly);
    }

    if (user.role === 'admin') {
      return filtered;
    }
    
    const restrictedHrefs = ['/users', '/analytics', '/settings', '/shift-reports'];
    
    // Guest now has the exact same navigation as Staff (Abbas)
    if (user.role === 'staff' || user.role === 'guest') {
      return filtered.filter(item => !restrictedHrefs.includes(item.href));
    }
    
    return [];
  }, [user]);

  const [openSubMenus, setOpenSubMenus] = React.useState<Record<string, boolean>>(() => {
    const activeSubMenu = navItems.find(item => item.subItems && (pathname.startsWith(item.href) || item.subItems.some(sub => pathname === sub.href)));
    return activeSubMenu ? { [activeSubMenu.href]: true } : {};
  });

  const toggleSubMenu = (href: string) => {
    setOpenSubMenus(prev => ({ ...prev, [href]: !prev[href] }));
  };

  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar className="border-r-2 font-body">
      <SidebarHeader className="border-b bg-muted/5">
        <div className="flex flex-col items-center justify-center p-4">
          <Image src="/logo.png" alt="The 8 Bit Bistro" width={80} height={80} className="drop-shadow-md" />
          {!isCollapsed && (
            <span className="text-[10px] font-mono mt-2 opacity-40 uppercase tracking-tighter">Build v{APP_VERSION}</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent className="p-3">
        <SidebarMenu className="gap-1.5">
          {navItems.map((item) => (
            <SidebarMenuItem key={item.href}>
              {item.subItems ? (
                 <>
                    <SidebarMenuButton
                        onClick={() => toggleSubMenu(item.href)}
                        isActive={pathname.startsWith(item.href)}
                        tooltip={item.label}
                        data-state={openSubMenus[item.href] ? 'open' : 'closed'}
                        className="h-11 text-xs uppercase tracking-tight px-4 hover:bg-primary/5 hover:text-primary transition-all rounded-lg"
                    >
                        <item.icon className="h-5 w-5 shrink-0" />
                        <span className="font-bold">{item.label}</span>
                    </SidebarMenuButton>
                    {openSubMenus[item.href] && !isCollapsed && (
                        <SidebarMenuSub className="ml-6 mt-1 border-l-2 border-primary/10 pl-2 gap-1">
                            {item.subItems.map(subItem => (
                                <li key={subItem.href}>
                                  <SidebarMenuSubButton asChild isActive={pathname === subItem.href} className="h-9 px-3 rounded-md transition-all font-bold text-[10px] uppercase hover:bg-muted/50">
                                    <Link href={subItem.href} className="flex items-center gap-2">
                                      <subItem.icon className="h-3.5 w-3.5 opacity-60" />
                                      <span>{subItem.label}</span>
                                    </Link>
                                  </SidebarMenuSubButton>
                                </li>
                            ))}
                        </SidebarMenuSub>
                    )}
                 </>
              ) : (
                <Link href={item.href}>
                    <SidebarMenuButton
                    isActive={pathname === item.href}
                    tooltip={item.label}
                    className="h-11 text-xs uppercase tracking-tight px-4 hover:bg-primary/5 hover:text-primary transition-all rounded-lg"
                    >
                    <item.icon className="h-5 w-5 shrink-0" />
                    <span className="font-bold">{item.label}</span>
                    </SidebarMenuButton>
                </Link>
              )}
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
    </Sidebar>
  );
}
