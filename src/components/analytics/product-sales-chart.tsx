
'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Bill } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductSalesChartProps {
  bills: Bill[];
}

const COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
];

export function ProductSalesChart({ bills }: ProductSalesChartProps) {
  const chartData = useMemo(() => {
    const categoryRevenue: Record<string, number> = {
        'Food': 0,
        'Beverages': 0,
        'Gaming': 0
    };
    
    bills.forEach(bill => {
      // Gaming revenue from initial package
      categoryRevenue['Gaming'] += (bill.initialPackagePrice || 0);

      bill.items.forEach(item => {
        if (item.name.startsWith('Time:')) {
            categoryRevenue['Gaming'] += (item.price * item.quantity);
        } else {
            const isDrink = item.name.toLowerCase().includes('coffee') || 
                            item.name.toLowerCase().includes('tea') || 
                            item.name.toLowerCase().includes('latte') ||
                            item.name.toLowerCase().includes('soda');
            
            const cat = isDrink ? 'Beverages' : 'Food';
            categoryRevenue[cat] += (item.price * item.quantity);
        }
      });
    });

    return Object.entries(categoryRevenue)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
  }, [bills]);

  return (
    <Card className="flex flex-col">
      <CardHeader className="items-center pb-0">
        <CardTitle className="font-headline tracking-wide text-2xl">REVENUE BY CATEGORY</CardTitle>
        <CardDescription>Distribution of income across bistro services.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-0">
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
              >
                {chartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `₹${value.toLocaleString()}`}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
              />
              <Legend verticalAlign="bottom" height={36}/>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
