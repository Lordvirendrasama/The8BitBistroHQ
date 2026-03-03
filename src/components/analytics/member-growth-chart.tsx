
'use client';

import { useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import { subDays, format, eachDayOfInterval, startOfDay, startOfWeek, startOfMonth, endOfDay, isWithinInterval } from 'date-fns';
import type { Member, Period, DateRange } from '@/lib/types';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from '@/components/ui/chart';

interface MemberGrowthChartProps {
    period: Period;
    customRange?: DateRange;
}

export function MemberGrowthChart({ period, customRange }: MemberGrowthChartProps) {
  const { db } = useFirebase();
  const membersCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'members');
  }, [db]);
  const { data: members, loading, error } = useCollection<Member>(membersCollection);

  const { chartData, description } = useMemo(() => {
    if (!members) return { chartData: [], description: '' };
    
    const now = new Date();
    let startDate: Date;
    let endDate = endOfDay(now);
    let description = '';
    let dateFormat = 'MMM d';

    switch(period) {
        case 'daily':
            startDate = startOfDay(now);
            description = 'New member sign-ups today.';
            dateFormat = 'HH:00';
            break;
        case 'weekly':
            startDate = startOfWeek(now);
            description = 'New member sign-ups this week.';
            dateFormat = 'EEE';
            break;
        case 'custom':
            if (customRange?.from) {
              startDate = startOfDay(customRange.from);
              endDate = customRange.to ? endOfDay(customRange.to) : endOfDay(customRange.from);
              description = `Member growth from ${format(startDate, 'PP')} to ${format(endDate, 'PP')}`;
            } else {
              startDate = subDays(now, 30);
              description = 'Recent member sign-ups.';
            }
            break;
        case 'monthly':
        default:
            startDate = startOfMonth(now);
            description = 'New member sign-ups this month.';
            dateFormat = 'MMM d';
            break;
    }
    
    const daysInInterval = eachDayOfInterval({ start: startDate, end: endDate });

    const dailySignups = daysInInterval.reduce((acc, date) => {
        acc[format(date, dateFormat)] = 0;
        return acc;
    }, {} as Record<string, number>);


    members.forEach(member => {
      const joinDate = new Date(member.joinDate);
      if (isWithinInterval(joinDate, { start: startDate, end: endDate })) {
        const dateKey = format(joinDate, dateFormat);
        if(dailySignups[dateKey] !== undefined) {
            dailySignups[dateKey]++;
        }
      }
    });

    const chartData = Object.keys(dailySignups).map(date => ({
      date,
      signups: dailySignups[date],
    }));

    return { chartData, description };

  }, [members, period, customRange]);

  const chartConfig = {
    signups: {
      label: 'New Members',
      color: 'hsl(var(--chart-1))',
    },
  };

  if (loading) return <Card><CardHeader><CardTitle>Member Growth</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Member Growth</CardTitle></CardHeader><CardContent>Error loading chart.</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline tracking-wide text-2xl">Member Growth</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig}>
            <ResponsiveContainer width="100%" height={250}>
                <AreaChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                        <linearGradient id="colorSignups" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={chartConfig.signups.color} stopOpacity={0.8}/>
                        <stop offset="95%" stopColor={chartConfig.signups.color} stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid vertical={false} />
                    <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        tickFormatter={(value, index) => chartData.length > 10 && index % Math.floor(chartData.length / 5) !== 0 ? '' : value}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        allowDecimals={false}
                    />
                    <ChartTooltip
                        cursor={true}
                        content={<ChartTooltipContent />}
                    />
                    <Area
                        dataKey="signups"
                        type="monotone"
                        fill="url(#colorSignups)"
                        stroke={chartConfig.signups.color}
                        stackId="1"
                    />
                </AreaChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
