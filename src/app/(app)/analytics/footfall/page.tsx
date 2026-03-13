'use client';

import { useMemo, useState, useEffect, Fragment } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Bill } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Activity, Clock, Calendar as CalendarIcon, TrendingUp, Users, Info, BarChart3, Filter, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { getAvailableCycles, type CycleMetadata } from '@/firebase/firestore/data-management';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export default function FootfallAnalyticsPage() {
  const { db } = useFirebase();
  const [activeTab, setActiveTab] = useState('heatmap');
  const [selectedPhase, setSelectedPhase] = useState<string>('all_cycles');
  const [availableCycles, setAvailableCycles] = useState<CycleMetadata[]>([]);

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
    const hourTotals: Record<number, number> = HOURS.reduce((acc, h) => ({ ...acc, [h]: 0 }), {});

    filteredBills.forEach(bill => {
        const date = new Date(bill.timestamp);
        // Correct index mapping: getDay() returns 0 for Sunday
        let dayIdx = date.getDay() - 1;
        if (dayIdx === -1) dayIdx = 6; // Sunday to index 6
        
        const hour = date.getHours();
        
        if (dayIdx >= 0 && dayIdx < 7 && hour >= 0 && hour < 24) {
            heatmapMatrix[dayIdx][hour] += 1;
            dayTotals[DAYS[dayIdx]] += 1;
            hourTotals[hour] += 1;
        }
    });

    const maxInCell = Math.max(...heatmapMatrix.flat());

    // Formatting for charts
    const dayChartData = DAYS.map(d => ({ name: d, count: dayTotals[d] }));
    const hourChartData = HOURS.map(h => ({ name: `${h}:00`, count: hourTotals[h] }));

    return { heatmapMatrix, dayChartData, hourChartData, maxInCell, totalBills: filteredBills.length };
  }, [bills, selectedPhase]);

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
            <p className="font-headline text-[10px] tracking-widest uppercase">Analyzing Behavioral Matrix...</p>
        </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body pb-20">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Footfall Intelligence</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">Global customer behavior & traffic patterns audit.</p>
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-3">
            <div className="space-y-1">
                <p className="text-[8px] font-black uppercase text-muted-foreground tracking-widest text-right px-1">Select Analysis Phase</p>
                <Select value={selectedPhase} onValueChange={setSelectedPhase}>
                    <SelectTrigger className="h-10 w-[240px] border-2 font-black uppercase text-[10px] tracking-tight bg-background">
                        <Filter className="mr-2 h-3.5 w-3.5 text-primary" />
                        <SelectValue placeholder="All Cycles" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all_cycles" className="font-bold uppercase text-[10px]">
                            <span className="flex items-center gap-2"><Globe className="h-3 w-3" /> Global History</span>
                        </SelectItem>
                        {availableCycles.map(c => (
                            <SelectItem key={c.name} value={c.name} className="font-bold uppercase text-[10px]">
                                {c.name}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Badge variant="outline" className="h-10 px-4 border-2 font-black uppercase text-[10px] bg-background shadow-sm">
                {stats.totalBills.toLocaleString()} SESSIONS ANALYZED
            </Badge>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-muted/20 p-1 h-12 rounded-xl border-2 border-dashed mb-8">
            <TabsTrigger value="heatmap" className="px-6 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                <Clock className="h-3.5 w-3.5" />
                Behavioral Heatmap
            </TabsTrigger>
            <TabsTrigger value="charts" className="px-6 font-black uppercase text-[10px] tracking-widest data-[state=active]:bg-background data-[state=active]:shadow-sm gap-2">
                <BarChart3 className="h-3.5 w-3.5" />
                Traffic Distribution
            </TabsTrigger>
        </TabsList>

        <TabsContent value="heatmap" className="animate-in fade-in slide-in-from-left-2 duration-300">
            <Card className="border-2 shadow-2xl overflow-hidden">
                <CardHeader className="bg-muted/10 border-b">
                    <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                        <Activity className="h-5 w-5 text-primary" />
                        Global Intensity Matrix
                    </CardTitle>
                    <CardDescription className="text-[10px] font-bold uppercase tracking-widest">
                        {selectedPhase === 'all_cycles' ? 'Visualizing trends across entire business history.' : `Analyzing traffic specific to phase: ${selectedPhase}.`}
                    </CardDescription>
                </CardHeader>
                <CardContent className="p-0 overflow-hidden">
                    <ScrollArea className="w-full">
                        <div className="p-6 min-w-[800px]">
                            <div className="grid grid-cols-[80px_repeat(24,1fr)] gap-1">
                                {/* Header: Hours */}
                                <div className="h-8" />
                                {HOURS.map(h => (
                                    <div key={`hour-head-${h}`} className="h-8 flex items-center justify-center text-[8px] font-black uppercase text-muted-foreground border-b border-dashed">
                                        {h}
                                    </div>
                                ))}

                                {/* Rows: Days */}
                                {DAYS.map((day, dIdx) => (
                                    <Fragment key={`heatmap-row-${day}`}>
                                        <div className="h-10 flex items-center pr-4 font-black uppercase text-[10px] text-muted-foreground border-r border-dashed">
                                            {day}
                                        </div>
                                        {HOURS.map(h => {
                                            const count = stats.heatmapMatrix[dIdx][h];
                                            return (
                                                <div 
                                                    key={`${day}-${h}`} 
                                                    className={cn(
                                                        "h-10 rounded-md transition-all flex items-center justify-center text-[9px] font-bold",
                                                        getHeatmapColor(count, stats.maxInCell)
                                                    )}
                                                    title={`${day} @ ${h}:00 - ${count} sessions`}
                                                >
                                                    {count > 0 ? count : ''}
                                                </div>
                                            );
                                        })}
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
                        <span className="text-[8px] font-black uppercase opacity-50">Zero Activity</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-emerald-500/10" />
                        <span className="text-[8px] font-black uppercase opacity-50">Light Traffic</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-primary/40" />
                        <span className="text-[8px] font-black uppercase opacity-50">Moderate Flow</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-sm bg-primary shadow-lg" />
                        <span className="text-[8px] font-black uppercase opacity-50">Peak Intensity</span>
                    </div>
                </div>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                <Card className="border-2 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                            <Info className="h-4 w-4" /> Strategic Insight
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs font-bold uppercase leading-relaxed text-foreground/80">
                            Based on historical footfall, your "Power Window" is consistently identified. Use this data to staff up or run targeted promos.
                        </p>
                        <div className="p-3 bg-background rounded-lg border-2 border-dashed flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Highest Single Window:</span>
                            <Badge className="font-mono bg-primary text-white">Peak Window Detected</Badge>
                        </div>
                    </CardContent>
                </Card>

                <Card className="border-2 bg-emerald-500/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-[10px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4" /> Throughput Efficiency
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                        <p className="text-xs font-bold uppercase leading-relaxed text-foreground/80">
                            Sessions analyzed from every operational cycle across the entire database to provide a true longitudinal traffic report.
                        </p>
                        <div className="p-3 bg-background rounded-lg border-2 border-dashed flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase text-muted-foreground">Historical Stability:</span>
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
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <CalendarIcon className="h-5 w-5 text-primary" />
                            Weekly Distribution
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Total bill volume grouped by day.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
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
                        <CardTitle className="text-lg font-black uppercase flex items-center gap-2">
                            <Clock className="h-5 w-5 text-primary" />
                            Hourly Velocity
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Average footfall intensity throughout the 24h clock.</CardDescription>
                    </CardHeader>
                    <CardContent className="h-[350px]">
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
            </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
