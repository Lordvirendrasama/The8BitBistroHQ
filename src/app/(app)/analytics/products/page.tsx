
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill, FoodItem, Reward, GamingPackage, DateRange } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ProductSalesChart } from '@/components/analytics/product-sales-chart';
import { RewardRedemptionChart } from '@/components/analytics/reward-redemption-chart';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Utensils, Gift, TrendingUp, IndianRupee, Gamepad2, Pizza, Coffee, CalendarIcon, Clock, FilterX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { format, startOfDay, endOfDay, isWithinInterval } from "date-fns";
import { cn } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function ProductAnalyticsPage() {
  const { db } = useFirebase();

  // Filters State
  const [dateRange, setDateRange] = useState<DateRange>({
    from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    to: endOfDay(new Date()),
  });
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 23 });

  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'bills'), orderBy('timestamp', 'desc')), [db]);
  const { data: bills, loading: billsLoading } = useCollection<Bill>(billsQuery);

  const rewardsQuery = useMemo(() => !db ? null : collection(db, 'rewards'), [db]);
  const { data: rewards } = useCollection<Reward>(rewardsQuery);

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const resetFilters = () => {
    setDateRange({
      from: startOfDay(new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      to: endOfDay(new Date()),
    });
    setSelectedDays([]);
    setTimeRange({ start: 0, end: 23 });
  };

  // Aggregated data processing with filters
  const stats = useMemo(() => {
    if (!bills) return { menu: [], packages: [], summary: {}, filteredBillsCount: 0, filteredBills: [] };
    
    const filtered = bills.filter(bill => {
        const billDate = new Date(bill.timestamp);
        
        // Date Range
        if (dateRange.from && billDate < dateRange.from) return false;
        if (dateRange.to && billDate > dateRange.to) return false;

        // Day of week
        const dayName = format(billDate, 'EEE');
        if (selectedDays.length > 0 && !selectedDays.includes(dayName)) return false;

        // Time range
        const hour = billDate.getHours();
        if (hour < timeRange.start || hour > timeRange.end) return false;

        return true;
    });

    const menuMap: Record<string, { name: string, quantity: number, revenue: number, type: 'food' | 'drink' }> = {};
    const packageMap: Record<string, { name: string, quantity: number, revenue: number }> = {};
    const categoryRevenue: Record<string, number> = { 'Food': 0, 'Beverages': 0, 'Gaming': 0 };

    filtered.forEach(bill => {
      // 1. Process Initial Package
      if (bill.packageName && bill.initialPackagePrice > 0) {
          const pkgName = bill.packageName;
          if (!packageMap[pkgName]) {
              packageMap[pkgName] = { name: pkgName, quantity: 0, revenue: 0 };
          }
          const qty = bill.members.length || 1;
          packageMap[pkgName].quantity += qty;
          packageMap[pkgName].revenue += bill.initialPackagePrice;
          categoryRevenue['Gaming'] += bill.initialPackagePrice;
      }

      // 2. Process Bill Items
      bill.items.forEach(item => {
        if (item.name.startsWith('Time:')) {
            const pkgName = item.name.replace('Time: ', '');
            if (!packageMap[pkgName]) {
                packageMap[pkgName] = { name: pkgName, quantity: 0, revenue: 0 };
            }
            packageMap[pkgName].quantity += item.quantity;
            packageMap[pkgName].revenue += (item.price * item.quantity);
            categoryRevenue['Gaming'] += (item.price * item.quantity);
        } else {
            const isDrink = item.name.toLowerCase().includes('coffee') || 
                            item.name.toLowerCase().includes('tea') || 
                            item.name.toLowerCase().includes('latte') ||
                            item.name.toLowerCase().includes('soda');
            
            const cat = isDrink ? 'Beverages' : 'Food';
            
            if (!menuMap[item.itemId]) {
                menuMap[item.itemId] = { 
                    name: item.name, 
                    quantity: 0, 
                    revenue: 0, 
                    type: isDrink ? 'drink' : 'food' 
                };
            }
            menuMap[item.itemId].quantity += item.quantity;
            menuMap[item.itemId].revenue += (item.price * item.quantity);
            categoryRevenue[cat] += (item.price * item.quantity);
        }
      });
    });

    return {
        menu: Object.values(menuMap).sort((a, b) => b.revenue - a.revenue),
        packages: Object.values(packageMap).sort((a, b) => b.revenue - a.revenue),
        summary: categoryRevenue,
        filteredBillsCount: filtered.length,
        filteredBills: filtered
    };
  }, [bills, dateRange, selectedDays, timeRange]);

  if (billsLoading) {
    return <div className="flex h-screen items-center justify-center">Loading product analytics...</div>;
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">
            SALES & REWARDS
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track the performance of your menu and loyalty perks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters}>
          <FilterX className="mr-2 h-4 w-4" /> Reset Filters
        </Button>
      </div>

      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Custom Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[260px] justify-start text-left font-normal",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>{format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}</>
                      ) : (format(dateRange.from, "LLL dd, y"))
                    ) : (<span>Pick a date range</span>)}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    initialFocus
                    mode="range"
                    selected={{ from: dateRange.from, to: dateRange.to }}
                    onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Day of Week</Label>
              <div className="flex bg-background border rounded-md p-1 h-10">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={cn(
                      "px-2 text-[10px] font-bold rounded transition-colors uppercase",
                      selectedDays.includes(day) 
                        ? "bg-primary text-primary-foreground" 
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Time Range</Label>
              <div className="flex items-center gap-2 h-10 px-3 bg-background border rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={String(timeRange.start)} onValueChange={(v) => setTimeRange(p => ({ ...p, start: Number(v) }))}>
                  <SelectTrigger className="w-[70px] h-7 border-none shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => <SelectItem key={i} value={String(i)}>{i}:00</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-xs font-bold">to</span>
                <Select value={String(timeRange.end)} onValueChange={(v) => setTimeRange(p => ({ ...p, end: Number(v) }))}>
                  <SelectTrigger className="w-[70px] h-7 border-none shadow-none focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => <SelectItem key={i} value={String(i)}>{i}:00</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center h-10">
                <Badge variant="secondary" className="font-mono text-xs">
                    {stats.filteredBillsCount} Bills Found
                </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8">
          <TabsTrigger value="menu" className="flex items-center gap-2"><Utensils className="h-4 w-4" /> Menu Items</TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-2"><Gamepad2 className="h-4 w-4" /> Gaming Packages</TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2"><Gift className="h-4 w-4" /> Loyalty Rewards</TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ProductSalesChart bills={stats.filteredBills} />
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <TrendingUp className="text-primary" />
                            Top Selling Menu Items
                        </CardTitle>
                        <CardDescription>Performance based on selected filters.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Item</TableHead>
                                    <TableHead className="text-center">Sold</TableHead>
                                    <TableHead className="text-right">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.menu.slice(0, 8).map((item, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-medium flex items-center gap-2">
                                            {item.type === 'drink' ? <Coffee className="h-3 w-3 opacity-50" /> : <Pizza className="h-3 w-3 opacity-50" />}
                                            {item.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline">{item.quantity}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-bold">₹{item.revenue.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {stats.menu.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No sales data matches these filters.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="packages" className="space-y-8">
            <div className="grid grid-cols-1 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gamepad2 className="text-primary" />
                            Gaming Package Performance
                        </CardTitle>
                        <CardDescription>Popularity of session offers in the selected period.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                            {stats.packages.slice(0, 4).map(pkg => (
                                <div key={pkg.name} className="p-4 rounded-lg border bg-card shadow-sm">
                                    <p className="text-xs text-muted-foreground uppercase font-bold tracking-tight">{pkg.name}</p>
                                    <div className="flex justify-between items-end mt-2">
                                        <span className="text-2xl font-black">₹{pkg.revenue.toLocaleString()}</span>
                                        <Badge className="bg-primary/10 text-primary border-primary/20">{pkg.quantity} sold</Badge>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Package Name</TableHead>
                                    <TableHead className="text-center">Units Sold</TableHead>
                                    <TableHead className="text-right">Total Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.packages.map((pkg, idx) => (
                                    <TableRow key={idx}>
                                        <TableCell className="font-bold">{pkg.name}</TableCell>
                                        <TableCell className="text-center">{pkg.quantity}</TableCell>
                                        <TableCell className="text-right font-mono text-lg font-black text-primary">₹{pkg.revenue.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {stats.packages.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground italic">No package data found for these filters.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <RewardRedemptionChart />
                </div>
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Gift className="text-yellow-500" />
                            Catalog Status
                        </CardTitle>
                        <CardDescription>Available rewards for members.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {rewards?.map(reward => (
                                <div key={reward.id} className="flex items-center justify-between p-3 border rounded-md bg-muted/20">
                                    <div>
                                        <p className="font-bold text-sm">{reward.name}</p>
                                        <p className="text-xs text-muted-foreground">Req. Level {reward.levelRequired}</p>
                                    </div>
                                    <Badge variant="outline" className="text-yellow-600 border-yellow-600/30">
                                        {reward.pointsCost} Pts
                                    </Badge>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
