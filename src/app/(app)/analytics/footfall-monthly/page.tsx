'use client';

import { useMemo, useState, useEffect, Fragment } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Activity, 
  Clock, 
  Calendar as CalendarIcon, 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Info, 
  BarChart3, 
  Filter, 
  Globe, 
  Receipt, 
  ReceiptIndianRupee, 
  Sparkles,
  CalendarDays,
  Utensils,
  Gamepad2,
  CalendarRange
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line, Legend } from 'recharts';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function MonthlyFootfallPage() {
  const { db } = useFirebase();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [activeTab, setActiveTab] = useState('calendar');

  // Drill-down State for selected calendar day
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'bills'), orderBy('timestamp', 'desc')), [db]);
  const { data: bills, loading } = useCollection<Bill>(billsQuery);

  // Determine available years from bills data
  const availableYears = useMemo(() => {
    if (!bills || bills.length === 0) return [new Date().getFullYear()];
    const years = new Set<number>();
    bills.forEach(b => {
      if (b.timestamp) {
        const y = new Date(b.timestamp).getFullYear();
        if (!isNaN(y)) years.add(y);
      }
    });
    return Array.from(years).sort((a, b) => b - a);
  }, [bills]);

  // Filter bills for current selected month
  const monthlyBills = useMemo(() => {
    if (!bills) return [];
    return bills.filter(bill => {
      if (!bill.timestamp) return false;
      const date = new Date(bill.timestamp);
      return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
    });
  }, [bills, selectedMonth, selectedYear]);

  // Filter bills for previous month (for MoM calculations)
  const prevMonthlyBills = useMemo(() => {
    if (!bills) return [];
    let prevMonth = selectedMonth - 1;
    let prevYear = selectedYear;
    if (prevMonth === -1) {
      prevMonth = 11;
      prevYear = selectedYear - 1;
    }
    return bills.filter(bill => {
      if (!bill.timestamp) return false;
      const date = new Date(bill.timestamp);
      return date.getMonth() === prevMonth && date.getFullYear() === prevYear;
    });
  }, [bills, selectedMonth, selectedYear]);

  // Compute Statistics for selected month
  const stats = useMemo(() => {
    const totalSessions = monthlyBills.length;
    
    // Unique Visitors
    const uniqueMembers = new Set<string>();
    monthlyBills.forEach(bill => {
      bill.members?.forEach(m => uniqueMembers.add(m.id));
    });

    // Number of days in the month
    const numDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Grouping by Calendar Day of Month (1 to N)
    const dailyCounts = Array(numDays + 1).fill(0);
    const dailyRevenue = Array(numDays + 1).fill(0);

    // Grouping by Hour of Day (0 to 23)
    const hourlyCounts = Array(24).fill(0);
    const hourlyRevenue = Array(24).fill(0);

    // Grouping by Day of Week (0: Mon, ..., 6: Sun)
    const dowCounts = Array(7).fill(0);
    const dowRevenue = Array(7).fill(0);

    // Grouping by Station type (e.g. PS5, Board Game, Food, etc.)
    const stationDataMap: Record<string, { count: number; revenue: number }> = {};

    monthlyBills.forEach(bill => {
      if (!bill.timestamp) return;
      const date = new Date(bill.timestamp);
      
      // Calendar day (1-indexed)
      const day = date.getDate();
      if (day >= 1 && day <= numDays) {
        dailyCounts[day] += 1;
        dailyRevenue[day] += (bill.totalAmount || 0);
      }

      // Hour of day (0-23)
      const hour = date.getHours();
      if (hour >= 0 && hour < 24) {
        hourlyCounts[hour] += 1;
        hourlyRevenue[hour] += (bill.totalAmount || 0);
      }

      // Day of week mapping (Mon to Sun)
      let dayIdx = date.getDay() - 1;
      if (dayIdx === -1) dayIdx = 6;
      if (dayIdx >= 0 && dayIdx < 7) {
        dowCounts[dayIdx] += 1;
        dowRevenue[dayIdx] += (bill.totalAmount || 0);
      }

      // Station
      const station = bill.stationName || 'Walk-in / Recharge';
      if (!stationDataMap[station]) {
        stationDataMap[station] = { count: 0, revenue: 0 };
      }
      stationDataMap[station].count += 1;
      stationDataMap[station].revenue += (bill.totalAmount || 0);
    });

    // Peak footfall day
    let peakDay = 1;
    let peakCount = 0;
    for (let d = 1; d <= numDays; d++) {
      if (dailyCounts[d] > peakCount) {
        peakCount = dailyCounts[d];
        peakDay = d;
      }
    }

    const maxDailyCount = Math.max(...dailyCounts);
    const dailyAverage = totalSessions / numDays;
    const totalRevenue = monthlyBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);

    // Prepare chart data
    const dailyChartData = Array.from({ length: numDays }, (_, i) => ({
      name: `${i + 1}`,
      sessions: dailyCounts[i + 1],
      revenue: Math.round(dailyRevenue[i + 1])
    }));

    const hourlyChartData = HOURS.map(h => ({
      name: `${h}:00`,
      sessions: hourlyCounts[h],
      revenue: Math.round(hourlyRevenue[h])
    }));

    const dowChartData = DAYS_OF_WEEK.map((name, idx) => ({
      name,
      sessions: dowCounts[idx],
      revenue: Math.round(dowRevenue[idx])
    }));

    const stationChartData = Object.entries(stationDataMap).map(([name, val]) => ({
      name,
      sessions: val.count,
      revenue: Math.round(val.revenue)
    })).sort((a, b) => b.sessions - a.sessions);

    // MoM calculations
    const prevTotalSessions = prevMonthlyBills.length;
    let growthRate: number | null = null;
    if (prevTotalSessions > 0) {
      growthRate = ((totalSessions - prevTotalSessions) / prevTotalSessions) * 100;
    }

    const prevTotalRevenue = prevMonthlyBills.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
    let revenueGrowthRate: number | null = null;
    if (prevTotalRevenue > 0) {
      revenueGrowthRate = ((totalRevenue - prevTotalRevenue) / prevTotalRevenue) * 100;
    }

    return {
      totalSessions,
      uniqueVisitors: uniqueMembers.size,
      peakDay,
      peakCount,
      dailyAverage,
      totalRevenue,
      maxDailyCount,
      growthRate,
      revenueGrowthRate,
      dailyChartData,
      hourlyChartData,
      dowChartData,
      stationChartData,
      dailyCounts,
      dailyRevenue
    };
  }, [monthlyBills, prevMonthlyBills, selectedMonth, selectedYear]);

  // Compute Calendar Slots
  const calendarSlots = useMemo(() => {
    // 1st day of the selected month
    const firstDayDate = new Date(selectedYear, selectedMonth, 1);
    let startDayOfWeek = firstDayDate.getDay(); // 0 is Sun, 1 is Mon, etc.
    
    // Align with Monday as column 0, Sunday as column 6
    let dayOfWeekIndex = startDayOfWeek - 1;
    if (dayOfWeekIndex === -1) dayOfWeekIndex = 6;

    const numDays = new Date(selectedYear, selectedMonth + 1, 0).getDate();

    // Padding slots at start
    const slots: (number | null)[] = Array(dayOfWeekIndex).fill(null);

    // Month days
    for (let d = 1; d <= numDays; d++) {
      slots.push(d);
    }

    // Padding slots at end to make it complete full weeks
    const totalCells = Math.ceil(slots.length / 7) * 7;
    const paddingAtEnd = totalCells - slots.length;
    for (let p = 0; p < paddingAtEnd; p++) {
      slots.push(null);
    }

    return slots;
  }, [selectedMonth, selectedYear]);

  // Retrieve bills for selected drill-down calendar day
  const drillDownBills = useMemo(() => {
    if (selectedDay === null) return [];
    return monthlyBills.filter(bill => {
      if (!bill.timestamp) return false;
      const d = new Date(bill.timestamp);
      return d.getDate() === selectedDay;
    });
  }, [selectedDay, monthlyBills]);

  // Dynamic Intensity Color Function for Calendar Days
  const getCellColor = (count: number, max: number) => {
    if (count === 0) return 'bg-muted/10 border-border/30 opacity-40 hover:opacity-100';
    const intensity = count / (max || 1);
    if (intensity > 0.8) return 'bg-primary border-primary text-white shadow-lg shadow-primary/20 scale-95';
    if (intensity > 0.6) return 'bg-primary/70 border-primary/60 text-white shadow-md shadow-primary/10';
    if (intensity > 0.4) return 'bg-primary/40 border-primary/30 text-foreground';
    if (intensity > 0.2) return 'bg-accent/40 border-accent/30 text-foreground';
    return 'bg-accent/10 border-accent/20 text-accent';
  };

  const renderGrowthBadge = (rate: number | null) => {
    if (rate === null) return <Badge variant="outline" className="text-muted-foreground border-dashed text-sm">MoM N/A</Badge>;
    const isPositive = rate >= 0;
    return (
      <Badge className={cn(
        "font-semibold text-sm gap-1 px-3 py-1",
        isPositive 
          ? "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border border-emerald-500/20" 
          : "bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/20"
      )}>
        {isPositive ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
        {isPositive ? '+' : ''}{rate.toFixed(1)}%
      </Badge>
    );
  };

  if (loading || !stats) {
    return (
      <div className="flex flex-col h-screen items-center justify-center gap-4 opacity-50">
        <Activity className="h-10 w-10 animate-spin text-primary" />
        <p className="font-headline text-sm tracking-normal uppercase">Synthesizing Monthly Footfall Matrices...</p>
      </div>
    );
  }

  const selectedMonthLabel = `${MONTH_NAMES[selectedMonth]} ${selectedYear}`;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body pb-20">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <CalendarDays className="h-9 w-9 text-primary" />
            Monthly Footfall
          </h1>
          <p className="mt-2 text-base text-muted-foreground">
            Calendar Heatmaps & Long-term Customer Volume Analysis
          </p>
        </div>

        {/* Month/Year Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Year</span>
            <Select value={String(selectedYear)} onValueChange={(val) => setSelectedYear(Number(val))}>
              <SelectTrigger className="h-11 w-[120px] bg-card text-sm font-medium">
                <SelectValue placeholder="Year" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={String(y)} className="text-sm">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-sm font-medium text-muted-foreground">Month</span>
            <Select value={String(selectedMonth)} onValueChange={(val) => setSelectedMonth(Number(val))}>
              <SelectTrigger className="h-11 w-[160px] bg-card text-sm font-medium">
                <SelectValue placeholder="Month" />
              </SelectTrigger>
              <SelectContent>
                {MONTH_NAMES.map((name, idx) => (
                  <SelectItem key={idx} value={String(idx)} className="text-sm">{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* KPI METRIC CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Sessions */}
        <div className="p-8 rounded-2xl border bg-card flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-primary/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Total Sessions</p>
            {renderGrowthBadge(stats.growthRate)}
          </div>
          <div>
            <p className="text-4xl font-bold text-primary tracking-tight leading-none">
              {stats.totalSessions}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Closed bills in {selectedMonthLabel}</p>
          </div>
        </div>

        {/* Unique Visitors */}
        <div className="p-8 rounded-2xl border bg-card flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-accent/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Unique Members</p>
            <Users className="h-5 w-5 text-accent" />
          </div>
          <div>
            <p className="text-4xl font-bold text-accent tracking-tight leading-none">
              {stats.uniqueVisitors}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Active accounts this month</p>
          </div>
        </div>

        {/* Peak Traffic */}
        <div className="p-8 rounded-2xl border bg-card flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-amber-500/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Month Peak Day</p>
            <Sparkles className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <p className="text-4xl font-bold text-amber-500 tracking-tight leading-none flex items-baseline gap-2">
              {stats.peakCount > 0 ? `${stats.peakCount}` : '0'}
              <span className="text-sm font-semibold text-muted-foreground">sessions</span>
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {stats.peakCount > 0 ? `Detected on ${MONTH_NAMES[selectedMonth]} ${stats.peakDay}` : 'No bills recorded'}
            </p>
          </div>
        </div>

        {/* Daily Average */}
        <div className="p-8 rounded-2xl border bg-card flex flex-col justify-between shadow-sm relative overflow-hidden hover:border-blue-500/50 transition-all">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-muted-foreground">Daily Average</p>
            <Activity className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <p className="text-4xl font-bold text-blue-500 tracking-tight leading-none">
              {stats.dailyAverage.toFixed(1)}
            </p>
            <p className="text-sm text-muted-foreground mt-2">Average sessions per day</p>
          </div>
        </div>
      </div>

      {/* REVENUE COMPARISON CORNER */}
      <div className="p-8 rounded-2xl border bg-card flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <ReceiptIndianRupee className="h-6 w-6 text-accent" />
            <p className="text-sm font-semibold text-muted-foreground">Monthly Combined Settlement</p>
          </div>
          <p className="text-4xl font-bold text-accent tracking-tight mt-1">
            ₹{stats.totalRevenue.toLocaleString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <p className="text-sm font-semibold text-muted-foreground">MoM Financial Growth</p>
          <div className="flex items-center gap-3">
            {stats.revenueGrowthRate !== null ? (
              <span className={cn(
                "text-2xl font-bold",
                stats.revenueGrowthRate >= 0 ? "text-emerald-500" : "text-destructive"
              )}>
                {stats.revenueGrowthRate >= 0 ? '+' : ''}{stats.revenueGrowthRate.toFixed(1)}%
              </span>
            ) : (
              <span className="text-base font-bold text-muted-foreground">MoM N/A</span>
            )}
            {renderGrowthBadge(stats.revenueGrowthRate)}
          </div>
        </div>
      </div>

      {/* VIEW SWITCHER TABS */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/30 p-1 h-14 rounded-xl border mb-8">
          <TabsTrigger value="calendar" className="px-6 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <CalendarIcon className="h-4 w-4" />
            Calendar Heatmap
          </TabsTrigger>
          <TabsTrigger value="distribution" className="px-6 text-sm font-medium data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
            <BarChart3 className="h-4 w-4" />
            Month Distribution
          </TabsTrigger>
        </TabsList>

        {/* TAB 1: CALENDAR HEATMAP */}
        <TabsContent value="calendar" className="animate-in fade-in duration-300">
          <Card className="shadow-md overflow-hidden">
            <CardHeader className="bg-muted/30 border-b p-6">
              <CardTitle className="text-xl font-semibold flex items-center gap-3">
                <CalendarRange className="h-5 w-5 text-primary" />
                {selectedMonthLabel} Matrix
              </CardTitle>
              <CardDescription className="text-sm font-medium text-muted-foreground mt-2">
                Daily traffic volume represented in calendar matrix form.
                <br/>
                <span className="text-primary font-semibold mt-2 inline-block">TIP: Click any highlighted day cell to audit daily bills.</span>
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {/* Calendar Grid Container */}
              <div className="grid grid-cols-7 gap-2 max-w-5xl mx-auto">
                {/* Weekday Headers */}
                {DAYS_OF_WEEK.map(day => (
                  <div key={day} className="h-10 flex items-center justify-center text-sm font-semibold text-muted-foreground border-b border-border/50">
                    {day}
                  </div>
                ))}

                {/* Calendar Days */}
                {calendarSlots.map((dayNum, idx) => {
                  if (dayNum === null) {
                    return (
                      <div 
                        key={`empty-${idx}`} 
                        className="h-20 bg-muted/5 opacity-20 rounded-xl border border-dashed border-border/20" 
                      />
                    );
                  }

                  const count = stats.dailyCounts[dayNum];
                  const revenue = stats.dailyRevenue[dayNum];
                  const isInteractive = count > 0;

                  return (
                    <div
                      key={`day-${dayNum}`}
                      onClick={() => isInteractive && setSelectedDay(dayNum)}
                      className={cn(
                        "h-20 rounded-xl border transition-all flex flex-col justify-between p-2 select-none relative",
                        getCellColor(count, stats.maxDailyCount),
                        isInteractive ? "cursor-pointer hover:scale-105 hover:z-10 shadow-sm" : ""
                      )}
                    >
                      {/* Day Number */}
                      <span className="text-sm font-semibold self-start opacity-70">
                        {dayNum}
                      </span>

                      {/* Sessions Count */}
                      {count > 0 && (
                        <div className="flex flex-col items-center justify-center flex-1">
                          <span className="text-xl font-bold leading-none">{count}</span>
                          <span className="text-sm font-medium opacity-70 mt-1">sessions</span>
                        </div>
                      )}

                      {/* Revenue Amount */}
                      {revenue > 0 && (
                        <span className="text-sm font-semibold self-end opacity-90 truncate max-w-full">
                          ₹{revenue >= 1000 ? `${(revenue / 1000).toFixed(1)}k` : Math.round(revenue)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Heatmap Legend */}
              <div className="mt-8 pt-6 border-t border-border/50 flex justify-center gap-6 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-muted/10 border border-border/30 opacity-40" />
                  <span className="text-sm font-medium opacity-70">Zero Footfall</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-accent/10 border border-accent/20" />
                  <span className="text-sm font-medium opacity-70">Light Activity</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-accent/40 border border-accent/30" />
                  <span className="text-sm font-medium opacity-70">Moderate Traffic</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-primary/40 border border-primary/30" />
                  <span className="text-sm font-medium opacity-70">Busy</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-primary/70 border border-primary/60 text-white" />
                  <span className="text-sm font-medium opacity-70">Dense Flow</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-md bg-primary border-primary shadow-sm" />
                  <span className="text-sm font-medium opacity-70">Peak Spike</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* TAB 2: DETAILED CHARTS */}
        <TabsContent value="distribution" className="space-y-8 animate-in fade-in duration-300">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Daily Traffic Timeline */}
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase flex items-center gap-2">
                  <CalendarIcon className="h-4 w-4 text-primary" />
                  Daily Timeline ({MONTH_NAMES[selectedMonth]})
                </CardTitle>
                <CardDescription className="text-sm font-bold uppercase tracking-normal">
                  Daily fluctuations in sessions and revenue.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={stats.dailyChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} />
                    <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}
                    />
                    <Legend wrapperStyle={{ fontSize: 9, textTransform: 'uppercase', fontWeight: 'bold' }} />
                    <Line yAxisId="left" type="monotone" name="Sessions" dataKey="sessions" stroke="hsl(var(--primary))" strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 5 }} />
                    <Line yAxisId="right" type="monotone" name="Revenue (₹)" dataKey="revenue" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Weekly Days Distribution */}
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  Day-of-Week Weights
                </CardTitle>
                <CardDescription className="text-sm font-bold uppercase tracking-normal">
                  Aggregated footfall count by operational weekdays.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.dowChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}
                    />
                    <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" radius={[5, 5, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Hourly Distribution in Month */}
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  Hourly Activity Profile
                </CardTitle>
                <CardDescription className="text-sm font-bold uppercase tracking-normal">
                  Footfall frequency over the 24-hour cycle.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.hourlyChartData}>
                    <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} interval={2} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                    <Tooltip 
                      cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}
                    />
                    <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                      {stats.hourlyChartData.map((entry, index) => {
                        const hr = parseInt(entry.name);
                        return <Cell key={`hr-cell-${index}`} fill={hr >= 18 || hr <= 2 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.3)'} />;
                      })}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Station / Category Weights */}
            <Card className="border-2 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-bold uppercase flex items-center gap-2">
                  <Gamepad2 className="h-4 w-4 text-primary" />
                  Station Activity Weights
                </CardTitle>
                <CardDescription className="text-sm font-bold uppercase tracking-normal">
                  Sessions distributed across game consoles and tables.
                </CardDescription>
              </CardHeader>
              <CardContent className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart layout="vertical" data={stats.stationChartData}>
                    <CartesianGrid horizontal={false} strokeDasharray="3 3" opacity={0.1} />
                    <XAxis type="number" axisLine={false} tickLine={false} tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 9, fontWeight: 'bold' }} width={120} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.15)' }}
                    />
                    <Bar dataKey="sessions" name="Sessions" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

          </div>
        </TabsContent>
      </Tabs>

      {/* DRILL DOWN DETAILED AUDIT DIALOG */}
      <Dialog open={selectedDay !== null} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
          <DialogHeader className="p-6 bg-muted/10 border-b shrink-0">
            <DialogTitle className="font-headline text-xl flex items-center gap-3">
              <Receipt className="text-primary h-6 w-6" />
              Day Audit: {selectedDay !== null ? `${MONTH_NAMES[selectedMonth]} ${selectedDay}, ${selectedYear}` : ''}
            </DialogTitle>
            <DialogDescription className="font-bold text-sm uppercase tracking-normal">
              Detailed breakdown of {drillDownBills.length} sessions contribution to traffic on this day.
            </DialogDescription>
          </DialogHeader>
          
          <ScrollArea className="flex-1 bg-background">
            <div className="p-4">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/20">
                    <TableHead className="font-bold uppercase text-sm">Time</TableHead>
                    <TableHead className="font-bold uppercase text-sm">Station</TableHead>
                    <TableHead className="font-bold uppercase text-sm">Members</TableHead>
                    <TableHead className="text-right font-bold uppercase text-sm">Payment</TableHead>
                    <TableHead className="text-right font-bold uppercase text-sm">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drillDownBills.map((bill) => (
                    <TableRow key={bill.id} className="hover:bg-muted/5 group">
                      <TableCell className="font-mono font-bold text-sm">
                        {bill.timestamp ? format(new Date(bill.timestamp), 'p') : 'N/A'}
                      </TableCell>
                      <TableCell className="font-bold uppercase text-sm">
                        {bill.stationName || 'Walk-in'}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-1">
                          {bill.members?.map(m => (
                            <Badge key={m.id} variant="outline" className="text-sm h-4 uppercase font-bold px-1.5">{m.name}</Badge>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline" className="text-sm font-bold uppercase px-1 border-dashed">
                          {bill.paymentMethod}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono font-bold text-sm text-primary">
                        ₹{bill.totalAmount?.toLocaleString()}
                      </TableCell>
                    </TableRow>
                  ))}
                  {drillDownBills.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="h-48 text-center opacity-30 italic font-bold uppercase text-sm tracking-normal">
                        No transactions registered for this date.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </ScrollArea>
          
          <div className="p-5 bg-muted/5 border-t shrink-0 flex justify-between items-center">
            <span className="text-sm font-bold uppercase text-muted-foreground">Cumulative Day Settlement</span>
            <span className="text-2xl font-bold font-mono text-accent">
              ₹{drillDownBills.reduce((s, b) => s + (b.totalAmount || 0), 0).toLocaleString()}
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
