'use client';
import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, where } from 'firebase/firestore';
import type { LogEntry, LogEntryType } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Star, Gift, Edit, Trash2, Settings, Database, Shield, History, Filter, CreditCard, MousePointerClick } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ScrollArea } from '@/components/ui/scroll-area';

const logTypes: LogEntryType[] = [
    'MEMBER_JOINED', 
    'XP_GAINED', 
    'REWARD_CLAIMED',
    'MEMBER_UPDATED',
    'MEMBER_DELETED',
    'REWARD_CREATED',
    'REWARD_UPDATED',
    'REWARD_DELETED',
    'SETTINGS_UPDATED',
    'DATA_ACTION',
    'DATA_BACKFILLED',
    'UI_ACTION',
    'USER_LOGIN',
    'BILL_PAID',
    'EXPENSE_ADDED',
    'DEBT_RECORDED'
];

const getLogIcon = (type: LogEntryType) => {
  switch (type) {
    case 'MEMBER_JOINED': return <UserPlus className="h-5 w-5 text-blue-500" />;
    case 'XP_GAINED': return <Star className="h-5 w-5 text-primary" />;
    case 'REWARD_CLAIMED': return <Gift className="h-5 w-5 text-yellow-500" />;
    case 'MEMBER_UPDATED':
    case 'REWARD_UPDATED': return <Edit className="h-5 w-5 text-orange-500" />;
    case 'SETTINGS_UPDATED': return <Settings className="h-5 w-5 text-slate-500" />
    case 'MEMBER_DELETED':
    case 'REWARD_DELETED': return <Trash2 className="h-5 w-5 text-destructive" />;
    case 'REWARD_CREATED': return <Gift className="h-5 w-5 text-green-500" />;
    case 'USER_LOGIN': return <Shield className="h-5 w-5 text-purple-500" />;
    case 'BILL_PAID': return <CreditCard className="h-5 w-5 text-emerald-500" />;
    default: return <History className="h-5 w-5 text-muted-foreground" />;
  }
};

const getLogBadgeVariant = (type: LogEntryType) => {
    switch (type) {
        case 'MEMBER_JOINED': return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
        case 'XP_GAINED': return 'bg-pink-500/20 text-pink-500 border-pink-500/50';
        case 'REWARD_CLAIMED': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
        case 'BILL_PAID': return 'bg-emerald-500/20 text-emerald-500 border-emerald-500/50';
        case 'USER_LOGIN': return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
        default: return 'outline';
    }
}

export default function SettingsLogsPage() {
  const { db } = useFirebase();
  const pathname = usePathname();
  const [selectedLogTypes, setSelectedLogTypes] = useState<LogEntryType[]>([]);

  const logsQuery = useMemo(() => {
    if (!db) return null;
    const logsCollection = collection(db, 'logs');
    if (selectedLogTypes.length > 0) {
      return query(logsCollection, where('type', 'in', selectedLogTypes));
    }
    return query(logsCollection, orderBy('timestamp', 'desc'));
  }, [db, selectedLogTypes]);

  const { data: logs, loading } = useCollection<LogEntry>(logsQuery);

  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    if (selectedLogTypes.length > 0) {
        return [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return logs;
  }, [logs, selectedLogTypes]);

  const handleFilterChange = (logType: LogEntryType) => {
    setSelectedLogTypes(prev => 
      prev.includes(logType) ? prev.filter(t => t !== logType) : [...prev, logType]
    );
  };

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

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>Master System Log</CardTitle>
                <CardDescription>Real-time audit of all system interactions.</CardDescription>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter Types
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuLabel>Event Categories</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <ScrollArea className="h-72">
                        {logTypes.map(logType => (
                            <DropdownMenuCheckboxItem
                                key={logType}
                                checked={selectedLogTypes.includes(logType)}
                                onCheckedChange={() => handleFilterChange(logType)}
                                onSelect={(e) => e.preventDefault()}
                            >
                                {logType.replace(/_/g, ' ')}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </ScrollArea>
                </DropdownMenuContent>
            </DropdownMenu>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Event</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow><TableCell colSpan={4} className="text-center py-10">Loading logs...</TableCell></TableRow>
              ) : sortedLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getLogIcon(log.type)}
                      <Badge variant="outline" className={cn("font-bold text-[10px]", getLogBadgeVariant(log.type))}>
                        {log.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm" dangerouslySetInnerHTML={{ __html: log.description }} />
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                      {log.user?.displayName || 'System'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground text-xs">
                    {format(new Date(log.timestamp), 'PPpp')}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
