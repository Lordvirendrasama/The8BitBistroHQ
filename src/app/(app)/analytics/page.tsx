
'use client';
import { useState, useMemo } from 'react';
import { Leaderboard } from '@/components/analytics/leaderboard';
import { StatsCards } from '@/components/analytics/stats-cards';
import { TierDistributionChart } from '@/components/analytics/tier-distribution-chart';
import { MemberGrowthChart } from '@/components/analytics/member-growth-chart';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { CalendarIcon, Clock, FilterX, Info } from "lucide-react"
import { format, startOfDay, endOfDay } from "date-fns"
import type { Period, DateRange } from '@/lib/types';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<Period>('monthly');
  const [dateRange, setDateRange] = useState<DateRange>({
    from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
    to: new Date(),
  });
  
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [timeRange, setTimeRange] = useState({ start: 0, end: 23 });

  const handleDayToggle = (day: string) => {
    setSelectedDays(prev => 
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const resetFilters = () => {
    setPeriod('monthly');
    setDateRange({
      from: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
      to: new Date(),
    });
    setSelectedDays([]);
    setTimeRange({ start: 0, end: 23 });
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">
            Analytics
          </h1>
          <p className="mt-2 text-muted-foreground">
            Track engagement and identify your most loyal members.
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
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Period & Date</Label>
              <div className="flex gap-2">
                <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue placeholder="Period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="custom">Custom Range</SelectItem>
                  </SelectContent>
                </Select>

                {period === 'custom' && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant={"outline"}
                        className={cn(
                          "w-[240px] justify-start text-left font-normal",
                          !dateRange && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {dateRange?.from ? (
                          dateRange.to ? (
                            <>{format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd")}</>
                          ) : (format(dateRange.from, "LLL dd, y"))
                        ) : (<span>Pick a date</span>)}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                      <Calendar
                        initialFocus
                        mode="range"
                        selected={{ from: dateRange.from, to: dateRange.to }}
                        onSelect={(range: any) => setDateRange(range || { from: undefined, to: undefined })}
                        numberOfMonths={2}
                      />
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter by Day</Label>
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
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Filter by Hour</Label>
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
          </div>
        </CardContent>
      </Card>
      
      <StatsCards 
        period={period} 
        customRange={dateRange} 
        selectedDays={selectedDays} 
        timeRange={timeRange} 
      />

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <TierDistributionChart />
        <MemberGrowthChart period={period} customRange={dateRange} />
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-1">
        <Leaderboard />
      </div>

    </div>
  );
}
