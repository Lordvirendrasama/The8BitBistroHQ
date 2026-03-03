
'use client';

import { useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Expense } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay } from 'date-fns';
import { IndianRupee, ShoppingCart, TrendingDown, Users, Calendar } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer, Tooltip as RechartsTooltip } from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { Badge } from '@/components/ui/badge';

export function ExpenseDashboard() {
  const { db } = useFirebase();
  
  const expensesQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'expenses'), orderBy('timestamp', 'desc'));
  }, [db]);

  const { data: expenses, loading } = useCollection<Expense>(expensesQuery);

  const stats = useMemo(() => {
    if (!expenses) return { monthlyTotal: 0, dailyData: [], currentMonthExpenses: [] };

    const now = new Date();
    const start = startOfMonth(now);
    const end = endOfMonth(now);

    const currentMonthExpenses = expenses.filter(e => {
      const date = new Date(e.timestamp);
      return date >= start && date <= end;
    });

    const monthlyTotal = currentMonthExpenses.reduce((sum, e) => sum + e.amount, 0);

    const days = eachDayOfInterval({ start, end: now });
    const dailyData = days.map(day => {
      const dayTotal = currentMonthExpenses
        .filter(e => isSameDay(new Date(e.timestamp), day))
        .reduce((sum, e) => sum + e.amount, 0);
      
      return {
        date: format(day, 'MMM d'),
        amount: dayTotal
      };
    });

    return { monthlyTotal, dailyData, currentMonthExpenses };
  }, [expenses]);

  if (loading) return <div className="p-8 text-center">Loading Financial Data...</div>;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-destructive/5 border-destructive/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-destructive" />
              Monthly Spend
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black text-destructive">₹{stats.monthlyTotal.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Total expenses for {format(new Date(), 'MMMM yyyy')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <ShoppingCart className="h-4 w-4" />
              Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-black">{stats.currentMonthExpenses.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Records added this month</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
              <Users className="h-4 w-4" />
              Contributors
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex -space-x-2 overflow-hidden py-1">
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Viren</Badge>
              <Badge variant="outline" className="bg-secondary text-secondary-foreground">Abbas</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Staff & Owner records combined</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Daily Expense Breakdown
            </CardTitle>
            <CardDescription>Visual trend of spending throughout the current month.</CardDescription>
          </CardHeader>
          <CardContent className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.dailyData}>
                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                <XAxis 
                  dataKey="date" 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10 }}
                  interval={Math.floor(stats.dailyData.length / 6)}
                />
                <YAxis 
                  tickLine={false} 
                  axisLine={false} 
                  tick={{ fontSize: 10 }}
                  tickFormatter={(val) => `₹${val}`}
                />
                <RechartsTooltip 
                  cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-card border rounded-lg p-2 shadow-xl text-xs font-bold">
                          <p className="text-muted-foreground">{payload[0].payload.date}</p>
                          <p className="text-primary text-sm">₹{payload[0].value?.toLocaleString()}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-lg font-black uppercase tracking-tight">Recent Audit</CardTitle>
            <CardDescription>Latest unified expenses.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableBody>
                {stats.currentMonthExpenses.slice(0, 6).map((e) => (
                  <TableRow key={e.id} className="hover:bg-transparent">
                    <TableCell className="py-3">
                      <div className="space-y-0.5">
                        <p className="text-sm font-bold leading-none">{e.description}</p>
                        <p className="text-[10px] text-muted-foreground uppercase font-black">
                          {format(new Date(e.timestamp), 'MMM d')} • By {e.addedBy.displayName}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className="text-right py-3 font-mono font-black text-destructive">
                      ₹{e.amount.toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
                {stats.currentMonthExpenses.length === 0 && (
                  <TableRow>
                    <TableCell className="text-center py-12 text-muted-foreground italic text-xs">No records this month.</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
