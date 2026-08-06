'use client';

import React from 'react';
import { PeriodBenchmarks } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Sparkles, Trophy, AlertTriangle, CalendarDays, LineChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GrowthCentreProps {
  benchmarks: PeriodBenchmarks;
}

export function OwnerPulseGrowthCentre({ benchmarks }: GrowthCentreProps) {
  const renderGrowthRow = (
    label: string,
    current: number,
    previous: number,
    pct: number,
    prefix: string = '₹'
  ) => {
    const isPositive = pct >= 0;

    return (
      <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/10 hover:bg-muted/20 transition-all">
        <div className="space-y-0.5">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
          <div className="flex items-center gap-3">
            <span className="text-lg font-extrabold font-body text-foreground">
              {prefix}{current.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground font-mono">
              vs {prefix}{previous.toLocaleString()}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {isPositive ? (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 font-mono font-bold text-xs">
              <TrendingUp className="h-3 w-3 mr-1" /> +{pct}%
            </Badge>
          ) : (
            <Badge className="bg-destructive/20 text-destructive border-destructive/30 font-mono font-bold text-xs">
              <TrendingDown className="h-3 w-3 mr-1" /> {pct}%
            </Badge>
          )}
        </div>
      </div>
    );
  };

  // Build SVG sparkline path for last 30 days trend
  const sparklineData = benchmarks.last30DaysTrend || [];
  const maxVal = Math.max(1, ...sparklineData);
  const minVal = Math.min(...sparklineData);
  const range = Math.max(1, maxVal - minVal);
  const svgWidth = 300;
  const svgHeight = 60;

  const points = sparklineData
    .map((val, idx) => {
      const x = (idx / Math.max(1, sparklineData.length - 1)) * svgWidth;
      const y = svgHeight - ((val - minVal) / range) * (svgHeight - 10) - 5;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <Card className="border-2 border-primary/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Sparkles className="h-5 w-5 text-primary" />
            Growth Centre & Period Benchmarks
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Multi-Period Comparative Growth Intelligence
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary uppercase">
          PERIOD COMPARATOR
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {/* GROWTH COMPARISONS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {renderGrowthRow("Today vs Yesterday", benchmarks.todayVsYesterday.current, benchmarks.todayVsYesterday.previous, benchmarks.todayVsYesterday.pct)}
          {renderGrowthRow("Today vs Same Weekday Last Wk", benchmarks.todayVsSameWeekdayLastWeek.current, benchmarks.todayVsSameWeekdayLastWeek.previous, benchmarks.todayVsSameWeekdayLastWeek.pct)}
          {renderGrowthRow("This Week vs Last Week", benchmarks.thisWeekVsLastWeek.current, benchmarks.thisWeekVsLastWeek.previous, benchmarks.thisWeekVsLastWeek.pct)}
          {renderGrowthRow("This Month vs Last Month", benchmarks.thisMonthVsLastMonth.current, benchmarks.thisMonthVsLastMonth.previous, benchmarks.thisMonthVsLastMonth.pct)}
          {renderGrowthRow("This Month vs Same Month Last Yr", benchmarks.thisMonthVsSameMonthLastYear.current, benchmarks.thisMonthVsSameMonthLastYear.previous, benchmarks.thisMonthVsSameMonthLastYear.pct)}
        </div>

        {/* 30-DAY TREND SPARKLINE & LIFETIME EXTREMES */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
          {/* SPARKLINE CARD */}
          <div className="lg:col-span-2 p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <LineChart className="h-4 w-4 text-primary" />
                30-Day Revenue Trend Curve
              </span>
              <span className="text-xs font-mono font-bold text-foreground">
                Peak: ₹{maxVal.toLocaleString()}
              </span>
            </div>
            <div className="w-full overflow-hidden py-2">
              <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-16 stroke-primary fill-none stroke-[2.5] overflow-visible">
                <polyline points={points} strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>

          {/* LIFETIME EXTREMES */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="p-3.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-1">
                  <Trophy className="h-3 w-3" /> Lifetime Best
                </p>
                <p className="text-xl font-extrabold font-body text-foreground mt-0.5">
                  ₹{benchmarks.lifetimeBest.amount.toLocaleString()}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400">
                {benchmarks.lifetimeBest.date}
              </Badge>
            </div>

            <div className="p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-400 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" /> Lifetime Low
                </p>
                <p className="text-xl font-extrabold font-body text-foreground mt-0.5">
                  ₹{benchmarks.lifetimeWorst.amount.toLocaleString()}
                </p>
              </div>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400">
                {benchmarks.lifetimeWorst.date}
              </Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
