
'use client';

import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  Gem, 
  PieChart, 
  Utensils, 
  Tag, 
  Gamepad2, 
  Zap, 
  Users, 
  CalendarDays, 
  ListChecks, 
  History, 
  Database,
  ArrowRight,
  ChevronRight
} from 'lucide-react';
import { cn } from '@/lib/utils';

const settingGroups = [
  {
    title: "Loyalty & Config",
    description: "Points, XP rules, and active cycles.",
    items: [
      { href: '/settings/loyalty', label: 'Loyalty Config', icon: Gem, color: 'text-primary' },
      { href: '/settings/rewards', label: 'Reward Catalog', icon: PieChart, color: 'text-emerald-600' },
    ]
  },
  {
    title: "Bistro & Menu",
    description: "Manage food items and categories.",
    items: [
      { href: '/settings/menu', label: 'Food Menu', icon: Utensils, color: 'text-orange-600' },
      { href: '/settings/categories', label: 'Categories', icon: Tag, color: 'text-blue-600' },
    ]
  },
  {
    title: "Gaming Packages",
    description: "Session rates and prepaid packs.",
    items: [
      { href: '/settings/packages', label: 'Gaming Packages', icon: Gamepad2, color: 'text-primary' },
      { href: '/settings/recharge-packs', label: 'Recharge Packs', icon: Zap, color: 'text-yellow-500' },
    ]
  },
  {
    title: "Workforce",
    description: "Staff management and scheduling.",
    items: [
      { href: '/settings/employees', label: 'Employees', icon: Users, color: 'text-indigo-600' },
      { href: '/settings/leaves', label: 'Staff Leaves', icon: CalendarDays, color: 'text-pink-600' },
      { href: '/settings/tasks', label: 'Shift Tasks', icon: ListChecks, color: 'text-emerald-600' },
    ]
  },
  {
    title: "System Audit",
    description: "Data backups and action logs.",
    items: [
      { href: '/settings/logs', label: 'System Logs', icon: History, color: 'text-slate-600' },
      { href: '/settings/data', label: 'Data Management', icon: Database, color: 'text-primary' },
    ]
  }
];

export default function SettingsHubPage() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {settingGroups.map((group, gIdx) => (
        <div key={gIdx} className="space-y-4">
          <div className="px-1">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">{group.title}</h3>
            <p className="text-[10px] font-bold text-muted-foreground opacity-60 uppercase">{group.description}</p>
          </div>
          <div className="space-y-2">
            {group.items.map((item, iIdx) => (
              <Link key={iIdx} href={item.href} className="block">
                <Card className="group hover:border-primary/50 transition-all border-2 border-muted bg-card active:scale-[0.98]">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={cn("p-2 rounded-lg bg-muted group-hover:bg-primary/10 transition-colors", item.color)}>
                        <item.icon className="h-5 w-5" />
                      </div>
                      <span className="font-black uppercase text-xs tracking-tight group-hover:text-primary transition-colors">{item.label}</span>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-20 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
