
'use client';

import { useMemo, useState, useEffect, Fragment } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Clock, Calendar as CalendarIcon, TrendingUp, Users, Info, BarChart3, Filter, Globe, ChevronRight, Receipt, ReceiptIndianRupee } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, LineChart, Line } from 'recharts';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableCycles, type CycleMetadata } from '@/firebase/firestore/data-management';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format } from 'date-fns';
import { isBusinessToday } from '@/lib/utils';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function FootfallAnalyticsPage() {
  const { db } = useFirebase();
  const [activeTab, setActiveTab] = useState('heatmap');
  const [selectedPhase, setSelectedPhase] = useState<string>('Launch Live');
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);
  
  // Drill-down State
  const [selectedCell, setSelectedCell] = useState<{ dayIdx: number, hour: number } | null>(null);

  useEffect(() => {
    getAvailableCycles().then(setAvailableCycles);
  }, []);

  const billsQuery = useMemo(() => !db ? null : query(collection(db, 'bills'), orderBy('timestamp', 'desc')), [db]);
  const { data: bills, loading } = useCollection<Bill>(billsQuery);

  const stats = useMemo(() => {
    if (!bills) return null;

    // Filter bills by phase if applicable
    const filteredBills = selectedPhase === 'all_cycles' 
        ? bills 
        : bills.filter(b => b.cycle === selectedPhase);

    // 1. Matrix for Heatmap [Day][Hour]
    const heatmapMatrix: number[][] = Array(7).fill(0).map(() => Array(24).fill(0));
    const dayTotals: Record<string, number> = DAYS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {});
    const dayRevenue: Record<string, number> = DAYS.reduce((acc, d) => ({ ...acc, [d]: 0 }), {});
    const hourTotals: Record<number, number> = HOURS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});
    
    // Growth Trend
    const monthlyMap: Record<string, number> = {};
    const yearlyMap: Record<string, number> = {};
    
    let earliestMs = Date.now();
    let latestMs = 0;

    filteredBills.forEach(bill => {
        const date = new Date(bill.timestamp);
        const time = date.getTime();
        if (time < earliestMs) earliestMs = time;
        if (time > latestMs) latestMs = time;
        
        // Month/Year key
        const monthKey = format(date, 'MMM yyyy');
        const yearKey = format(date, 'yyyy');
        monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + 1;
        yearlyMap[yearKey] = (yearlyMap[yearKey] || 0) + 1;

        // Correct index mapping: getDay() returns 0 for Sunday
        let dayIdx = date.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6; // Sunday to index 6
        
        const hour = date.getHours();
        
        if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
            heatmapMatrix[dayIdx][hour] += 1;
            dayTotals[DAYS[dayIdx]] += 1;
            dayRevenue[DAYS[dayIdx]] += (bill.totalAmount || 0);
            hourTotals[hour] += 1;
        }
    });

    const maxInCell = Math.max(...heatmapMatrix.flat());

    // Formatting for charts
    const dayChartData = DAYS.map(d => ({ name: d, count: dayTotals[d] }));
    const hourChartData = HOURS.map(h => ({ name: `${h}:00`, count: hourTotals[h] }));
    const monthChartData = Object.entries(monthlyMap).map(([name, count]) => ({ name, count }));
    const yearChartData = Object.entries(yearlyMap).map(([name, count]) => ({ name, count }));
    const totalPhaseRevenue = Object.values(dayRevenue).reduce((sum, rev) => sum + rev, 0);
    const durationInWeeks = filteredBills.length > 0 ? Math.max(1, Math.ceil((latestMs - earliestMs) / (1000 * 60 * 60 * 24 * 7))) : 0;

    return { 
        heatmapMatrix, 
        dayChartData,
        dayTotals, 
        dayRevenue,
        totalPhaseRevenue,
        durationInWeeks,
        hourChartData, 
        monthChartData,
        yearChartData,
        maxInCell, 
        totalBills: filteredBills.length,
        filteredBills 
    };
  }, [bills, selectedPhase]);

  // Today's collections — always based on business date, independent of phase filter
  const todayStats = useMemo(() => {
    if (!bills) return { total: 0, count: 0, avg: 0 };
    const todayBills = bills.filter(b => b.timestamp && isBusinessToday(b.timestamp));
    const total = todayBills.reduce((s, b) => s + (b.totalAmount || 0), 0);
    const count = todayBills.length;
    return { total, count, avg: count > 0 ? Math.round(total / count) : 0 };
  }, [bills]);

  const drillDownBills = useMemo(() => {
    if (!selectedCell || !stats) return [];
    return stats.filteredBills.filter(bill => {
        const date = new Date(bill.timestamp);
        let dayIdx = date.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6;
        return dayIdx === selectedCell.dayIdx && date.getHours() === selectedCell.hour;
    });
  }, [selectedCell, stats]);

  const getHeatmapColor = (count: number, max: number) => {
    if (count === 0) return 'bg-muted/30';
    const intensity = count / (max || 1);
    if (intensity > 0.8) return 'bg-primary text-white shadow-inner';
    if (intensity > 0.6) return 'bg-primary/70 text-white';
    if (intensity > 0.4) return 'bg-primary/40 text-foreground';
    if (intensity > 0.2) return 'bg-emerald-500/40 text-foreground';
    return 'bg-emerald-500/10 text-muted-foreground';
  };

  if (loading || !stats) {
    return (
        <div className="flex flex-col h-screen items-center justify-center gap-4 opacity-50">
            <Activity className="h-10 w-10 animate-spin text-primary" />
            <p className="font-headline text-sm tracking-normal uppercase">Analyzing Behavioral Matrix...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Footfall Intelligence</h1>
          <p className="mt-2 text-muted-foreground font-bold uppercase text-sm tracking-normal">Global customer behavior & traffic patterns audit.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="space-y-1">
                <p className="text-sm font-bold uppercase text-muted-foreground tracking-normal text-right px-1">Select Analysis Phase</p>
                <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger className="h-10 w-[240px] border-2 font-bold uppercase text-sm tracking-tight bg-background">
                        <Filter className="mr-2 h-3.5 w-3.5 text-primary" />
                        <SelectValue placeholder="All Cycles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_cycles" className="font-bold uppercase text-sm">
                            <span className="flex items-center gap-2"><Globe className="h-3 w-3" /> Global History</span>
                        </SelectItem>
                        {availableCycles.map(c => (
                            <SelectItem key={c.name} value={c.name} className="font-bold uppercase text-sm">
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Badge variant="outline" className="h-10 px-4 border-2 font-bold uppercase text-sm bg-background shadow-sm">
                {stats.totalBills.toLocaleString()} SESSIONS OVER {stats.durationInWeeks} WEEK{stats.durationInWeeks !== 1 ? 'S' : ''}
            </Badge>
        </div>
      </div>

      {/* ── TODAY'S COLLECTIONS BANNER ── */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Total collected today */}
        <div className="sm:col-span-1 flex flex-col justify-between p-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-500/5 shadow-sm relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
          <div className="flex items-center gap-2 mb-2">
            <ReceiptIndianRupee className="h-4 w-4 text-emerald-600" />
            <p className="text-sm font-bold uppercase tracking-normal text-emerald-700/70">Today&apos;s Collections</p>
          </div>
          <p className="text-4xl font-bold font-mono text-emerald-600 tracking-tight leading-none">
            ₹{todayStats.total.toLocaleString()}
          </p>
          <p className="text-sm font-bold uppercase text-emerald-700/50 mt-2">Settled bills for current business day</p>
        </div>

        {/* Sessions today */}
        <div className="flex flex-col justify-between p-5 rounded-2xl border-2 border-primary/20 bg-primary/5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="h-4 w-4 text-primary" />
            <p className="text-sm font-bold uppercase tracking-normal text-primary/70">Sessions Today</p>
          </div>
          <p className="text-4xl font-bold font-mono text-primary tracking-tight leading-none">
            {todayStats.count}
          </p>
          <p className="text-sm font-bold uppercase text-primary/50 mt-2">Bills closed this business day</p>
        </div>

        {/* Avg per session */}
        <div className="flex flex-col justify-between p-5 rounded-2xl border-2 border-amber-500/20 bg-amber-500/5 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-4 w-4 text-amber-600" />
            <p className="text-sm font-bold uppercase tracking-normal text-amber-700/70">Avg per Session</p>
          </div>
          <p className="text-4xl font-bold font-mono text-amber-600 tracking-tight leading-none">
            ₹{todayStats.avg.toLocaleString()}
          </p>
          <p className="text-sm font-bold uppercase text-amber-700/50 mt-2">Average bill value today</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/20 p-1 h-12 rounded-xl border-2 border-dashed mb-8">
            <TabsTrigger value="heatmap" className="px-6 font-bold uppercase text-sm tracking-normal data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                <Clock className="h-3.5 w-3.5" />
                Behavioral Heatmap
            </TabsTrigger>
            <TabsTrigger value="charts" className="px-6 font-bold uppercase text-sm tracking-normal data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Traffic Distribution
            </TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="animate-in fade-in slide-in-from-left-2 duration-300">
            <Card className="border-2 shadow-2xl overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Global Intensity Matrix
                    </CardTitle>
                    <CardDescription className="text-sm font-bold uppercase tracking-normal">
                        {selectedPhase === 'all_cycles' ? 'Visualizing trends across entire business history.' : `Analyzing traffic specific to phase: ${selectedPhase}.`}
                        <br/>
                        <span className="text-primary font-bold">TIP: Click any cell to audit specific bills from that time window.</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden">
                    <ScrollArea className="w-full">
                        <div className="p-6 min-w-[900px]">
                            <div className="grid grid-cols-[80px_repeat(24,1fr)_240px] gap-1">
                                {/* Header: Hours */}
                                <div className="h-8" />
                                {HOURS.map(h => (
                                    <div key={`hour-head-${h}`} className="h-8 flex items-center justify-center text-sm font-bold uppercase text-muted-foreground border-b border-dashed">
                                        {h}
                                    </div>
                                ))}
                                {/* Revenue column header */}
                                <div className="h-8 flex items-center justify-center text-sm font-bold uppercase text-emerald-600 border-b border-dashed border-emerald-500/30">
                                    Revenue
                                </div>

                                {/* Rows: Days */}
                                {DAYS.map((day, dIdx) => (
                                    <Fragment key={`heatmap-row-${day}`}>
                                        <div className="h-12 flex items-center pr-4 font-bold uppercase text-sm text-muted-foreground border-r border-dashed">
                                            {day}
                                        </div>
                                        {HOURS.map(h => {
                                            const count = stats.heatmapMatrix[dIdx][h];
                                            return (
                                                <div 
                                                    key={`${day}-${h}`} 
                                                    onClick={() => count > 0 && setSelectedCell({ dayIdx: dIdx, hour: h })}
                                                    className={cn(
                                                        "h-12 rounded-md transition-all flex items-center justify-center text-sm font-bold",
                                                        getHeatmapColor(count, stats.maxInCell),
                                                        count > 0 ? "cursor-pointer hover:scale-110 hover:z-10 shadow-sm" : ""
                                                    )}
                                                    title={`${day} @ ${h}:00 - ${count} sessions`}
                                                >
                                                    {count > 0 ? count : ''}
                                                </div>
                                            );
                                        })}
                                        {/* Per-day total revenue cell */}
                                        <div className="h-12 flex flex-col items-center justify-center rounded-md bg-emerald-500/10 border border-emerald-500/20 px-1 relative overflow-hidden">
                                            <div 
                                                className="absolute left-0 bottom-0 top-0 bg-emerald-500/10 z-0" 
                                                style={{ width: `${stats.totalPhaseRevenue > 0 ? (stats.dayRevenue[day] / stats.totalPhaseRevenue) * 100 : 0}%` }}
                                            />
                                            <span className="text-base font-bold text-emerald-600 font-mono leading-none z-10 relative">
                                                ₹{(stats.dayRevenue[day] >= 1000
                                                    ? `${(stats.dayRevenue[day] / 1000).toFixed(1)}k`
                                                    : stats.dayRevenue[day].toLocaleString()
                                                )}
                                            </span>
                                            <span className="text-sm font-bold text-emerald-700/60 leading-none mt-1 flex items-center justify-center gap-2 z-10 relative">
                                                <span>{stats.dayTotals[day]} BILLS</span>
                                                <span className="opacity-50">•</span>
                                                <span>₹{stats.dayTotals[day] > 0 ? Math.round(stats.dayRevenue[day] / stats.dayTotals[day]).toLocaleString() : 0} AVG</span>
                                                <span className="opacity-50">•</span>
                                                <span>{stats.totalPhaseRevenue > 0 ? ((stats.dayRevenue[day] / stats.totalPhaseRevenue) * 100).toFixed(1) : 0}%</span>
                                            </span>
                                        </div>
                                    </Fragment>
                                ))}
                            </div>
                        </div>
                        <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                </CardContent>
                <div className="p-4 bg-muted/5 border-t border-dashed flex justify-center gap-6">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-muted/30" />
                        <span className="text-sm font-bold uppercase opacity-50">Zero Activity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500/10" />
                        <span className="text-sm font-bold uppercase opacity-50">Light Traffic</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-primary/40" />
                        <span className="text-sm font-bold uppercase opacity-50">Moderate Flow</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-primary shadow-lg" />
                        <span className="text-sm font-bold uppercase opacity-50">Peak Intensity</span>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <Card className="border-2 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-normal text-primary flex items-center gap-2">
                            <Info className="h-4 w-4" /> Strategic Insight
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm font-bold uppercase leading-relaxed text-foreground/80">
                            Based on historical footfall, your "Power Window" is consistently identified. Use this data to staff up or run targeted promos.
                        </p>
                        <div className="p-3 bg-background rounded-lg border-2 border-dashed flex items-center justify-between">
                            <span className="text-sm font-bold uppercase text-muted-foreground">Highest Single Window:</span>
                            <Badge className="font-mono bg-primary text-white">Peak Window Detected</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-bold uppercase tracking-normal text-emerald-600 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Throughput Efficiency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-sm font-bold uppercase leading-relaxed text-foreground/80">
                            Sessions analyzed from every operational cycle across the entire database to provide a true longitudinal traffic report.
                        </p>
                        <div className="p-3 bg-background rounded-lg border-2 border-dashed flex items-center justify-between">
                            <span className="text-sm font-bold uppercase text-muted-foreground">Historical Stability:</span>
                            <Badge className="font-mono bg-emerald-600 text-white uppercase">High Confidence</Badge>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>

        <TabsContent value="charts" className="space-y-8 animate-in fade-in slide-in-from-right-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <Card className="border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-primary" />
                            Weekly Distribution
                        </CardTitle>
                        <CardDescription className="text-sm font-bold uppercase tracking-normal">Total bill volume grouped by day.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.dayChartData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Hourly Velocity
                        </CardTitle>
                        <CardDescription className="text-sm font-bold uppercase tracking-normal">Average footfall intensity throughout the 24h clock.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.hourChartData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 8, fontWeight: 'bold' }} interval={2} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]}>
                                    {stats.hourChartData.map((entry, index) => {
                                        const hour = parseInt(entry.name);
                                        return <Cell key={`bar-${index}`} fill={hour >= 18 || hour <= 2 ? 'hsl(var(--primary))' : 'hsl(var(--primary)/0.4)'} />;
                                    })}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                            <TrendingUp className="h-5 w-5 text-emerald-600" />
                            Monthly Trend
                        </CardTitle>
                        <CardDescription className="text-sm font-bold uppercase tracking-normal">Longitudinal traffic volume by month.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={stats.monthChartData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Line type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={4} dot={{ r: 6, fill: 'hsl(var(--primary))' }} activeDot={{ r: 8 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>

                <Card className="border-2 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg font-bold uppercase flex items-center gap-2">
                            <Globe className="h-5 w-5 text-blue-600" />
                            Year-on-Year Capacity
                        </CardTitle>
                        <CardDescription className="text-sm font-bold uppercase tracking-normal">Macro-level annual throughput.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.yearChartData}>
                                <CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.1} />
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fontWeight: 'bold' }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10 }} />
                                <Tooltip 
                                    cursor={{ fill: 'rgba(0,0,0,0.05)' }}
                                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 25px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                </Card>
            </div>
        </TabsContent>
      </Tabs>

      {/* DRILL DOWN MODAL */}
      <Dialog open={!!selectedCell} onOpenChange={(open) => !open && setSelectedCell(null)}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col p-0 overflow-hidden border-none shadow-2xl font-body">
            <DialogHeader className="p-6 bg-muted/10 border-b shrink-0">
                <DialogTitle className="font-headline text-xl flex items-center gap-3">
                    <Receipt className="text-primary h-6 w-6" />
                    Bill Audit: {selectedCell ? `${DAYS[selectedCell.dayIdx]} @ ${selectedCell.hour}:00` : ''}
                </DialogTitle>
                <DialogDescription className="font-bold text-sm uppercase tracking-normal">
                    Showing {drillDownBills.length} records contributing to this intensity slot.
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
                                <TableHead className="text-right font-bold uppercase text-sm">Amount</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {drillDownBills.map((bill) => (
                                <TableRow key={bill.id} className="hover:bg-muted/5 group">
                                    <TableCell className="font-mono font-bold text-sm">
                                        {format(new Date(bill.timestamp), 'p')}
                                    </TableCell>
                                    <TableCell className="font-bold uppercase text-sm">
                                        {bill.stationName}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-wrap gap-1">
                                            {bill.members.map(m => (
                                                <Badge key={m.id} variant="outline" className="text-sm h-4 uppercase font-bold px-1.5">{m.name}</Badge>
                                            ))}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right font-mono font-bold text-sm text-primary">
                                        ₹{bill.totalAmount.toLocaleString()}
                                    </TableCell>
                                </TableRow>
                            ))}
                            {drillDownBills.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-48 text-center opacity-30 italic font-bold uppercase text-sm tracking-normal">No detailed records found for this slot.</TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                </div>
            </ScrollArea>
            <div className="p-4 bg-muted/5 border-t">
                <div className="flex justify-between items-center px-4">
                    <span className="text-sm font-bold uppercase text-muted-foreground">Slot Cumulative Revenue</span>
                    <span className="text-2xl font-bold font-mono text-primary">₹{drillDownBills.reduce((s, b) => s + b.totalAmount, 0).toLocaleString()}</span>
                </div>
            </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
