
'use client';

import { useMemo } from 'react';
import { Pie, PieChart, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import type { Bill, GamingPackage } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface ProductSalesChartProps {
  bills: Bill[];
  gamingPackages: GamingPackage[];
}

// STRATEGIC PALETTE: Explicitly mapped to business pillars
const COLORS = {
  Gaming: '#ef0035',    // Red (Primary)
  Food: '#10b981',      // Emerald
  Beverages: '#3b82f6', // Blue
};

export function ProductSalesChart({ bills, gamingPackages }: ProductSalesChartProps) {
  const chartData = useMemo(() => {
    const categoryRevenue: Record<string, number> = {
        'Gaming': 0,
        'Food': 0,
        'Beverages': 0
    };
    
    const gamingPkgIds = new Set(gamingPackages?.map(p => p.id) || []);
    const gamingNames = new Set(gamingPackages?.map(p => p.name.toLowerCase()) || []);
    
    bills.forEach(bill => {
      // 1. Capture Initial Package Revenue
      categoryRevenue['Gaming'] += (bill.initialPackagePrice || 0);

      // 2. Scan Bill Items with Surgical Keywords
      bill.items.forEach(item => {
        const nameLower = item.name.toLowerCase();
        
        // SURGICAL DIFFERENTIATION - Including "rent" keyword check
        const isGaming = 
            gamingPkgIds.has(item.itemId) || 
            gamingNames.has(nameLower) ||
            item.name.startsWith('Time:') || 
            item.name.startsWith('Buy Recharge:') || 
            item.name.startsWith('Recharge:') ||
            nameLower.includes('hour') || 
            nameLower.includes('offer') ||
            nameLower.includes('package') ||
            nameLower.includes('pass') ||
            nameLower.includes('rent');

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
        <CardTitle className="font-headline tracking-widest text-2xl uppercase">REVENUE BY PILLAR</CardTitle>
        <CardDescription className="font-bold text-[10px] uppercase tracking-widest">Distribution of income across bistro channels.</CardDescription>
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
                {chartData.map((entry, index) => {
                  let color = COLORS.Gaming;
                  if (entry.name === 'Food') color = COLORS.Food;
                  if (entry.name === 'Beverages') color = COLORS.Beverages;
                  
                  return (
                    <Cell 
                      key={`cell-${index}`} 
                      fill={color} 
                      className="hover:opacity-80 transition-all cursor-pointer outline-none"
                    />
                  );
                })}
              </Pie>
              <Tooltip 
                formatter={(value: number) => `₹${value.toLocaleString()}`}
                contentStyle={{ 
                    borderRadius: '12px', 
                    border: 'none', 
                    boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
                    backgroundColor: '#1a1a1a',
                    padding: '12px'
                }}
                itemStyle={{
                    color: '#ffffff',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    fontSize: '12px',
                    fontFamily: 'monospace'
                }}
                labelStyle={{ display: 'none' }}
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
