
'use client';
import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, collectionGroup } from 'firebase/firestore';
import type { Member, Transaction, Period, DateRange } from '@/lib/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { IndianRupee, Star, Users } from 'lucide-react';
import { useFirebase } from '@/firebase/provider';
import { startOfDay, startOfWeek, startOfMonth, isWithinInterval, subDays, endOfDay, format } from 'date-fns';

interface StatsCardsProps {
    period: Period;
    customRange?: DateRange;
    selectedDays?: string[];
    timeRange?: { start: number; end: number };
}

export function StatsCards({ period, customRange, selectedDays = [], timeRange = { start: 0, end: 23 } }: StatsCardsProps) {
  const { db } = useFirebase();
  const membersCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'members');
  }, [db]);
  const transactionsCollection = useMemo(() => {
    if (!db) return null;
    return collectionGroup(db, 'transactions');
  }, [db]);

  const { data: members, loading: membersLoading } = useCollection<Member>(membersCollection);
  const { data: transactions, loading: transactionsLoading } = useCollection<Transaction>(transactionsCollection);

  const loading = membersLoading || transactionsLoading;

  const { periodXp, periodSpent } = useMemo(() => {
    if (!transactions) return { periodXp: 0, periodSpent: 0 };
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);

    switch(period) {
        case 'daily':
            startDate = startOfDay(now);
            break;
        case 'weekly':
            startDate = startOfWeek(now);
            break;
        case 'monthly':
            startDate = startOfMonth(now);
            break;
        case 'custom':
            if (customRange?.from) {
              startDate = startOfDay(customRange.from);
              endDate = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from);
            } else {
              startDate = subDays(now, 30);
            }
            break;
        default:
             startDate = subDays(now, 30);
    }
    
    const filteredTransactions = transactions.filter(tx => {
        const txDate = new Date(tx.date);
        
        // 1. Date Interval
        const inDate = isWithinInterval(txDate, { start: startDate, end: endDate });
        if (!inDate) return false;

        // 2. Day of Week
        const dayName = format(txDate, 'EEE');
        if (selectedDays.length > 0 && !selectedDays.includes(dayName)) return false;

        // 3. Time of Day
        const hour = txDate.getHours();
        if (hour < timeRange.start || hour > timeRange.end) return false;

        return true;
    });
    
    const periodXp = filteredTransactions.reduce((sum, tx) => sum + tx.xpGained, 0);
    const periodSpent = filteredTransactions.reduce((sum, tx) => sum + tx.amount, 0);

    return { periodXp, periodSpent };
  }, [transactions, period, customRange, selectedDays, timeRange]);

  const totalMembers = useMemo(() => members?.length || 0, [members]);
  
  const getTitle = (baseTitle: string) => {
    switch(period) {
        case 'daily': return `${baseTitle} (Today)`;
        case 'weekly': return `${baseTitle} (This Week)`;
        case 'monthly': return `${baseTitle} (This Month)`;
        case 'custom': return `${baseTitle} (Filtered)`;
        default: return baseTitle;
    }
  }

  const stats = [
    {
      title: getTitle('XP Distributed'),
      value: periodXp.toLocaleString(),
      icon: Star,
      description: 'Based on your filters',
      color: 'text-primary'
    },
    {
      title: getTitle('Revenue Tracked'),
      value: `₹${periodSpent.toLocaleString()}`,
      icon: IndianRupee,
      description: 'Based on your filters',
      color: 'text-green-500'
    },
    {
      title: 'Total Enrolled Members',
      value: totalMembers,
      icon: Users,
      description: 'Lifetime total members',
      color: 'text-blue-500'
    },
  ];

  if (loading) {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
                <Card key={i} className="animate-pulse">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-4 w-4 bg-muted rounded-full" />
                    </CardHeader>
                    <CardContent>
                        <div className="h-8 w-32 bg-muted rounded mb-2" />
                        <div className="h-3 w-48 bg-muted rounded" />
                    </CardContent>
                </Card>
            ))}
        </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {stats.map((stat, index) => (
        <Card key={index}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
            <stat.icon className={cn("h-4 w-4", stat.color)} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stat.value}</div>
            <p className="text-xs text-muted-foreground">{stat.description}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
