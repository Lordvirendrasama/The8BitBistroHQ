
'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Bill, GamingPackage } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductSalesChartProps {
  bills: Bill[];
  gamingPackages: GamingPackage[];
}

// SURGICAL COLORS: Primary Red, Emerald Green, Bright Blue
const COLORS = [
  '#ef0035', // Gaming (Red)
  '#10b981', // Food (Emerald)
  '#3b82f6', // Beverages (Blue)
];

export function ProductSalesChart({ bills, gamingPackages }: ProductSalesChartProps) {
  const chartData = useMemo(() => {
    const categoryRevenue: Record<string, number> = {
        'Gaming': 0,
        'Food': 0,
        'Beverages': 0
    };
    
    const gamingPkgIds = new Set(gamingPackages?.map(p => p.id) || []);
    
    bills.forEach(bill => {
      // Gaming revenue from initial package
      categoryRevenue['Gaming'] += (bill.initialPackagePrice || 0);

      bill.items.forEach(item => {
        const nameLower = item.name.toLowerCase();
        
        // BETTER DETECTION: Check if it's a Gaming item
        const isGaming = 
            gamingPkgIds.has(item.itemId) || 
            item.name.startsWith('Time:') || 
            item.name.startsWith('Buy Recharge:') || 
            item.name.startsWith('Recharge:') ||
            nameLower.includes('hour') || 
            nameLower.includes('offer') ||
            nameLower.includes('package') ||
            nameLower.includes('pass');

        if (isGaming) {
            categoryRevenue['Gaming'] += (item.price * item.quantity);
        } else {
            const isDrink = nameLower.includes('coffee') || 
                            nameLower.includes('tea') || 
                            nameLower.includes('latte') ||
                            nameLower.includes('soda') ||
                            nameLower.includes('mojito') ||
                            nameLower.includes('shake');
            
            const cat = isDrink ? 'Beverages' : 'Food';
            categoryRevenue[cat] += (item.price * item.quantity);
        }
      });
    });

    return Object.entries(categoryRevenue)
        .filter(([, value]) => value > 0)
        .map(([name, value]) => ({ name, value }));
  }, [bills, gamingPackages]);

  return (
    <Card className="flex flex-col border-2 shadow-xl">
      <CardHeader className="items-center pb-0 bg-muted/10 border-b">
        <CardTitle className="font-headline tracking-widest text-2xl uppercase">REVENUE BY CATEGORY</CardTitle>
        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Distribution of income across bistro services.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 pb-6 pt-10">
        <div className="h-[350px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={80}
                outerRadius={110}
                paddingAngle={8}
                dataKey="value"
                stroke="none"
              >
                {chartData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={COLORS[index % COLORS.length]} 
                    className="hover:opacity-80 transition-all cursor-pointer outline-none"
                  />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `₹${value.toLocaleString()}`}
                contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
                    backgroundColor: '#1a1a1a',
                    color: '#fff',
                    fontWeight: 'bold',
                    textTransform: 'uppercase',
                    fontSize: '10px'
                }}
              />
              <Legend 
                verticalAlign="bottom" 
                height={36} 
                iconType="circle"
                formatter={(value) => <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
