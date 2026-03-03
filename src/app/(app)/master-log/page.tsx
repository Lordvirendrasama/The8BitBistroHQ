
'use client';
import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy, where, WhereFilterOp } from 'firebase/firestore';
import type { LogEntry, LogEntryType } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Star, Gift, Edit, Trash2, Save, MousePointerClick, History, Filter, Settings, Database, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';

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
    'USER_LOGIN'
];

const getLogIcon = (type: LogEntryType) => {
  switch (type) {
    case 'MEMBER_JOINED':
      return <UserPlus className="h-5 w-5 text-blue-500" />;
    case 'XP_GAINED':
      return <Star className="h-5 w-5 text-primary" />;
    case 'REWARD_CLAIMED':
      return <Gift className="h-5 w-5 text-yellow-500" />;
    case 'MEMBER_UPDATED':
    case 'REWARD_UPDATED':
      return <Edit className="h-5 w-5 text-orange-500" />;
    case 'SETTINGS_UPDATED':
        return <Settings className="h-5 w-5 text-slate-500" />
    case 'MEMBER_DELETED':
    case 'REWARD_DELETED':
        return <Trash2 className="h-5 w-5 text-destructive" />;
    case 'REWARD_CREATED':
        return <Gift className="h-5 w-5 text-green-500" />;
    case 'UI_ACTION':
        return <MousePointerClick className="h-5 w-5 text-indigo-500" />;
    case 'DATA_ACTION':
        return <Database className="h-5 w-5 text-cyan-500" />;
    case 'DATA_BACKFILLED':
        return <History className="h-5 w-5 text-gray-500" />
    case 'USER_LOGIN':
        return <Shield className="h-5 w-5 text-purple-500" />;
    default:
      return null;
  }
};

const getLogBadgeVariant = (type: LogEntryType) => {
    switch (type) {
        case 'MEMBER_JOINED':
            return 'bg-blue-500/20 text-blue-500 border-blue-500/50';
        case 'XP_GAINED':
            return 'bg-pink-500/20 text-pink-500 border-pink-500/50';
        case 'REWARD_CLAIMED':
            return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50';
        case 'MEMBER_UPDATED':
        case 'REWARD_UPDATED':
            return 'bg-orange-500/20 text-orange-500 border-orange-500/50';
        case 'SETTINGS_UPDATED':
             return 'bg-slate-500/20 text-slate-500 border-slate-500/50';
        case 'MEMBER_DELETED':
        case 'REWARD_DELETED':
            return 'bg-red-500/20 text-red-500 border-red-500/50';
        case 'REWARD_CREATED':
            return 'bg-green-500/20 text-green-500 border-green-500/50';
        case 'UI_ACTION':
            return 'bg-indigo-500/20 text-indigo-500 border-indigo-500/50';
        case 'DATA_ACTION':
            return 'bg-cyan-500/20 text-cyan-500 border-cyan-500/50';
        case 'DATA_BACKFILLED':
            return 'bg-gray-500/20 text-gray-500 border-gray-500/50';
        case 'USER_LOGIN':
            return 'bg-purple-500/20 text-purple-500 border-purple-500/50';
        default:
            return 'outline';
    }
}


export default function MasterLogPage() {
  const { db } = useFirebase();
  const [selectedLogTypes, setSelectedLogTypes] = useState<LogEntryType[]>([]);

  const logsQuery = useMemo(() => {
    if (!db) return null;
    const logsCollection = collection(db, 'logs');

    if (selectedLogTypes.length > 0) {
      // The query requires an index. Removing orderBy to avoid this. Sorting will be done client-side.
      return query(logsCollection, where('type', 'in', selectedLogTypes));
    }

    return query(logsCollection, orderBy('timestamp', 'desc'));
  }, [db, selectedLogTypes]);

  const { data: logs, loading, error } = useCollection<LogEntry>(logsQuery);

  const sortedLogs = useMemo(() => {
    if (!logs) return [];
    // Sort client-side if we couldn't sort on the server
    if (selectedLogTypes.length > 0) {
        return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    }
    return logs;
  }, [logs, selectedLogTypes]);

  const handleFilterChange = (logType: LogEntryType) => {
    setSelectedLogTypes(prev => 
      prev.includes(logType) 
        ? prev.filter(t => t !== logType) 
        : [...prev, logType]
    );
  };


  if (loading) {
    return <div>Loading master log...</div>;
  }

  if (error) {
    return <div>Error loading master log.</div>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">
          Master Log
        </h1>
        <p className="mt-2 text-muted-foreground">
          A real-time stream of all activity in the loyalty program.
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
            <div>
                <CardTitle>All Events</CardTitle>
                <CardDescription>
                    Showing the most recent events from across the system.
                </CardDescription>
            </div>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline">
                        <Filter className="mr-2 h-4 w-4" />
                        Filter by type
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                    <DropdownMenuLabel>Log Types</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {logTypes.map(logType => (
                        <DropdownMenuCheckboxItem
                            key={logType}
                            checked={selectedLogTypes.includes(logType)}
                            onSelect={(e) => e.preventDefault()}
                            onCheckedChange={() => handleFilterChange(logType)}
                        >
                            {logType.replace(/_/g, ' ')}
                        </DropdownMenuCheckboxItem>
                    ))}
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
              {(sortedLogs || []).map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      {getLogIcon(log.type)}
                      <Badge variant="outline" className={cn("font-bold", getLogBadgeVariant(log.type))}>
                        {log.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span
                      dangerouslySetInnerHTML={{ __html: log.description }}
                    />
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                      {log.user?.displayName || 'System'}
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">
                    {format(new Date(log.timestamp), 'PPpp')}
                  </TableCell>
                </TableRow>
              ))}
               {(!sortedLogs || sortedLogs.length === 0) && (
                <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                        No log entries found for the selected filters.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
