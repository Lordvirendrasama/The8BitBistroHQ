
'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, collectionGroup } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { ClaimedReward, Reward } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';

export function RewardRedemptionChart() {
  const { db } = useFirebase();
  
  // Aggregate claimed rewards from all members
  const claimsQuery = useMemo(() => !db ? null : collectionGroup(db, 'claimedRewards'), [db]);
  const { data: claims, loading } = useCollection<ClaimedReward>(claimsQuery);

  const chartData = useMemo(() => {
    if (!claims) return [];
    
    const redemptionCounts: Record<string, number> = {};
    claims.forEach(claim => {
      redemptionCounts[claim.rewardName] = (redemptionCounts[claim.rewardName] || 0) + 1;
    });

    return Object.entries(redemptionCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [claims]);

  const chartConfig = {
    count: {
      label: 'Redemptions',
      color: 'hsl(var(--chart-2))',
    },
  };

  if (loading) return <Card><CardHeader><CardTitle>Reward Redemptions</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-headline tracking-wide text-2xl">Reward Popularity</CardTitle>
        <CardDescription>Most frequently redeemed loyalty rewards.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 40, right: 20 }}>
              <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.2} />
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                width={120} 
                tick={{ fontSize: 12 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip 
                cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                contentStyle={{ borderRadius: '8px' }}
              />
              <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        {chartData.length === 0 && (
          <div className="text-center py-12 text-muted-foreground italic">
            No rewards have been claimed yet.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
