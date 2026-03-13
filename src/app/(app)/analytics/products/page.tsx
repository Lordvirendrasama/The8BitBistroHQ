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
import { Utensils, Gift, TrendingUp, Gamepad2, Pizza, Coffee, CalendarIcon, Clock, FilterX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from '@/components/ui/label';
import { format, startOfDay, endOfDay } from "date-fns";
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

  const packagesQuery = useMemo(() => !db ? null : collection(db, 'gamingPackages'), [db]);
  const { data: gamingPackages } = useCollection<GamingPackage>(packagesQuery);

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
    
    const gamingPkgIds = new Set(gamingPackages?.map(p => p.id) || []);

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
    const categoryRevenue: Record<string, number> = { 'Gaming': 0, 'Food': 0, 'Beverages': 0 };

    filtered.forEach(bill => {
      // 1. Process Initial Package
      if (bill.packageName && bill.initialPackagePrice > 0) {
          const pkgName = bill.packageName;
          const pureName = pkgName.replace(/^(Time: |Buy Recharge: |Recharge: )/i, '').split('(')[0].trim();
          
          if (!packageMap[pureName]) {
              packageMap[pureName] = { name: pureName, quantity: 0, revenue: 0 };
          }
          const qty = bill.members?.length || 1;
          packageMap[pureName].quantity += qty;
          packageMap[pureName].revenue += bill.initialPackagePrice;
          categoryRevenue['Gaming'] += bill.initialPackagePrice;
      }

      // 2. Process Bill Items
      bill.items.forEach(item => {
        const nameLower = item.name.toLowerCase();
        
        // SURGICAL DIFFERENTIATION
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
            const pkgName = item.name.replace(/^(Time: |Buy Recharge: |Recharge: )/i, '').split('(')[0].trim();
            if (!packageMap[pkgName]) {
                packageMap[pkgName] = { name: pkgName, quantity: 0, revenue: 0 };
            }
            packageMap[pkgName].quantity += item.quantity;
            packageMap[pkgName].revenue += (item.price * item.quantity);
            categoryRevenue['Gaming'] += (item.price * item.quantity);
        } else {
            const isDrink = nameLower.includes('coffee') || 
                            nameLower.includes('tea') || 
                            nameLower.includes('latte') ||
                            nameLower.includes('soda') ||
                            nameLower.includes('mojito') ||
                            nameLower.includes('shake');
            
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
  }, [bills, dateRange, selectedDays, timeRange, gamingPackages]);

  if (billsLoading) {
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Syncing Sales Metrics...</div>;
  }

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">
            SALES & REWARDS
          </h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-[10px] tracking-widest">
            Track performance across menu items, gaming packages, and perks.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetFilters} className="font-black uppercase text-[10px] border-2">
          <FilterX className="mr-2 h-4 w-4" /> Reset Filters
        </Button>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Custom Date Range</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-[260px] h-10 justify-start text-left font-black uppercase text-[10px] border-2 bg-background",
                      !dateRange && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
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
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Day of Week</Label>
              <div className="flex bg-background border-2 rounded-md p-1 h-10">
                {DAYS.map(day => (
                  <button
                    key={day}
                    onClick={() => handleDayToggle(day)}
                    className={cn(
                      "px-2 text-[10px] font-black rounded transition-colors uppercase",
                      selectedDays.includes(day) 
                        ? "bg-primary text-white shadow-sm" 
                        : "hover:bg-muted text-muted-foreground"
                    )}
                  >
                    {day[0]}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Time Range</Label>
              <div className="flex items-center gap-2 h-10 px-3 bg-background border-2 rounded-md">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Select value={String(timeRange.start)} onValueChange={(v) => setTimeRange(p => ({ ...p, start: Number(v) }))}>
                  <SelectTrigger className="w-[70px] h-7 border-none shadow-none focus:ring-0 font-bold text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => <SelectItem key={i} value={String(i)} className="text-xs font-bold">{i}:00</SelectItem>)}
                  </SelectContent>
                </Select>
                <span className="text-[10px] font-black uppercase opacity-40">to</span>
                <Select value={String(timeRange.end)} onValueChange={(v) => setTimeRange(p => ({ ...p, end: Number(v) }))}>
                  <SelectTrigger className="w-[70px] h-7 border-none shadow-none focus:ring-0 font-bold text-[10px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 24 }).map((_, i) => <SelectItem key={i} value={String(i)} className="text-xs font-bold">{i}:00</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="flex items-center h-10">
                <Badge variant="secondary" className="font-mono text-[10px] h-6 px-3 border uppercase font-black">
                    {stats.filteredBillsCount} Transactions
                </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="menu" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12 bg-muted/20 p-1 border-2 border-dashed rounded-xl">
          <TabsTrigger value="menu" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Utensils className="h-3.5 w-3.5" /> Bistro Orders
          </TabsTrigger>
          <TabsTrigger value="packages" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Gamepad2 className="h-3.5 w-3.5" /> Gaming Sessions
          </TabsTrigger>
          <TabsTrigger value="rewards" className="flex items-center gap-2 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm">
            <Gift className="h-3.5 w-3.5" /> Loyalty Rewards
          </TabsTrigger>
        </TabsList>

        <TabsContent value="menu" className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <ProductSalesChart bills={stats.filteredBills} gamingPackages={gamingPackages || []} />
                <Card className="border-2 shadow-xl">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <TrendingUp className="text-primary h-5 w-5" />
                            Top Selling Menu Items
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Performance based on selected filters.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                        <Table>
                            <TableHeader>
                                <TableRow className="bg-muted/20">
                                    <TableHead className="font-black uppercase text-[10px] pl-6">Item</TableHead>
                                    <TableHead className="text-center font-black uppercase text-[10px]">Sold</TableHead>
                                    <TableHead className="text-right font-black uppercase text-[10px] pr-6">Revenue</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stats.menu.slice(0, 10).map((item, idx) => (
                                    <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                                        <TableCell className="font-bold text-xs uppercase pl-6 py-4 flex items-center gap-3">
                                            {item.type === 'drink' ? <Coffee className="h-4 w-4 text-blue-500" /> : <Pizza className="h-4 w-4 text-orange-500" />}
                                            {item.name}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Badge variant="outline" className="font-mono text-xs h-6">{item.quantity}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right font-mono font-black text-sm pr-6 text-primary">₹{item.revenue.toLocaleString()}</TableCell>
                                    </TableRow>
                                ))}
                                {stats.menu.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={3} className="h-64 text-center py-8 text-muted-foreground italic uppercase font-bold text-[10px] opacity-30 tracking-widest">No bistro sales found.</TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="packages" className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <Card className="border-2 shadow-xl">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <Gamepad2 className="text-primary h-5 w-5" />
                        Gaming Package Performance
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Popularity of session offers in the selected period.</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        {stats.packages.slice(0, 4).map(pkg => (
                            <div key={pkg.name} className="p-5 rounded-2xl border-2 bg-card shadow-sm group hover:border-primary/30 transition-all">
                                <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest">{pkg.name}</p>
                                <div className="flex justify-between items-end mt-3">
                                    <span className="text-3xl font-black font-mono tracking-tighter">₹{pkg.revenue.toLocaleString()}</span>
                                    <Badge className="bg-primary/10 text-primary border-primary/20 font-black text-[9px] h-5">{pkg.quantity} SOLD</Badge>
                                </div>
                            </div>
                        ))}
                    </div>
                    <Table className="border rounded-xl overflow-hidden">
                        <TableHeader>
                            <TableRow className="bg-muted/20">
                                <TableHead className="font-black uppercase text-[10px] pl-6 py-4">Package Name</TableHead>
                                <TableHead className="text-center font-black uppercase text-[10px]">Units Sold</TableHead>
                                <TableHead className="text-right font-black uppercase text-[10px] pr-6">Total Revenue</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {stats.packages.map((pkg, idx) => (
                                <TableRow key={idx} className="hover:bg-muted/5 transition-colors">
                                    <TableCell className="font-black uppercase text-xs pl-6 py-4">{pkg.name}</TableCell>
                                    <TableCell className="text-center font-mono font-bold text-xs">{pkg.quantity}</TableCell>
                                    <TableCell className="text-right font-mono text-lg font-black text-primary pr-6">₹{pkg.revenue.toLocaleString()}</TableCell>
                                </TableRow>
                            ))}
                            {stats.packages.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={3} className="h-64 text-center py-8 text-muted-foreground italic uppercase font-bold text-[10px] opacity-30">No package data found.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </TabsContent>

        <TabsContent value="rewards" className="space-y-8 animate-in fade-in duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                    <RewardRedemptionChart />
                </div>
                <Card className="border-2 shadow-xl h-fit">
                    <CardHeader className="bg-muted/10 border-b">
                        <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                            <Gift className="text-yellow-500 h-5 w-5" />
                            Catalog Status
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Available rewards for members.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                        {rewards?.map(reward => (
                            <div key={reward.id} className="flex items-center justify-between p-3 border-2 border-dashed rounded-xl bg-card hover:bg-muted/5 transition-colors">
                                <div>
                                    <p className="font-black text-xs uppercase tracking-tight">{reward.name}</p>
                                    <p className="text-[9px] font-bold text-muted-foreground uppercase">Min. Level {reward.levelRequired}</p>
                                </div>
                                <Badge variant="outline" className="text-yellow-600 border-yellow-600/30 bg-yellow-500/5 font-mono font-black text-[10px]">
                                    {reward.pointsCost} PTS
                                </Badge>
                            </div>
                        ))}
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
