'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from 'recharts';
import type { Member, MemberTier } from '@/lib/types';
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

const tierColors: Record<MemberTier, string> = {
  Red: 'hsl(var(--chart-5))',
  Green: 'hsl(var(--chart-2))',
  Gold: 'hsl(var(--chart-4))',
};

export function TierDistributionChart() {
  const { db } = useFirebase();
  const membersCollection = useMemo(() => {
    if (!db) return null;
    return collection(db, 'members');
  }, [db]);
  const { data: members, loading, error } = useCollection<Member>(membersCollection);

  const chartData = useMemo(() => {
    if (!members) return [];
    const tierCounts = members.reduce(
      (acc, member) => {
        acc[member.tier] = (acc[member.tier] || 0) + 1;
        return acc;
      },
      {} as Record<MemberTier, number>
    );

    return (['Red', 'Green', 'Gold'] as MemberTier[]).map(tier => ({
      tier,
      count: tierCounts[tier] || 0,
      fill: tierColors[tier],
    }));
  }, [members]);

  const chartConfig = {
    count: {
      label: 'Members',
    },
  };

  if (loading) return <Card><CardHeader><CardTitle>Tier Distribution</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;
  if (error) return <Card><CardHeader><CardTitle>Tier Distribution</CardTitle></CardHeader><CardContent>Error loading chart.</CardContent></Card>;


  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline tracking-wide text-2xl">Tier Distribution</CardTitle>
        <CardDescription>Number of members in each tier.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
            <ResponsiveContainer width="100%" height={250}>
                <BarChart data={chartData} margin={{ top: 20, right: 20, left: -10, bottom: 0 }}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                    dataKey="tier"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    />
                    <YAxis 
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        allowDecimals={false}
                    />
                    <ChartTooltip
                        cursor={false}
                        content={<ChartTooltipContent />}
                    />
                    <Bar dataKey="count" radius={8} />
                </BarChart>
            </ResponsiveContainer>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
