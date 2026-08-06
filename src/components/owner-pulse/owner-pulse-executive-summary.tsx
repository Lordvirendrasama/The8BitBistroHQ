'use client';

import React from 'react';
import { ExecutiveSummaryKPIs, MetricComparison, HealthScoreBreakdown } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Users, 
  Gamepad2, 
  Activity, 
  Crown,
  Minus
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveSummaryProps {
  kpis: ExecutiveSummaryKPIs;
  healthBreakdown: HealthScoreBreakdown;
  todayStr: string;
}

export function OwnerPulseExecutiveSummary({ kpis, healthBreakdown, todayStr }: ExecutiveSummaryProps) {
  const getBadgeColor = (status: MetricComparison['status']) => {
    switch (status) {
      case 'Growing':
        return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'Healthy':
        return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'Monitor':
        return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
      case 'Needs Attention':
        return 'bg-destructive/20 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const renderTrendIcon = (trend: MetricComparison['trend']) => {
    if (trend === 'up') return <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />;
    if (trend === 'down') return <TrendingDown className="h-3.5 w-3.5 text-destructive" />;
    return <Minus className="h-3.5 w-3.5 text-muted-foreground" />;
  };

  const renderKpiCard = (
    title: string,
    icon: React.ReactNode,
    metric: MetricComparison,
    prefix: string = '',
    suffix: string = ''
  ) => {
    return (
      <Card className="border-2 bg-card/80 backdrop-blur-sm shadow-md hover:border-primary/40 transition-all flex flex-col justify-between">
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            {icon}
            {title}
          </CardTitle>
          <Badge variant="outline" className={cn("text-[10px] uppercase font-bold px-2 py-0.5", getBadgeColor(metric.status))}>
            {metric.status}
          </Badge>
        </CardHeader>
        <CardContent className="p-4 pt-0 space-y-3">
          <div className="flex items-baseline justify-between">
            <div className="text-3xl xl:text-4xl font-extrabold font-body tracking-tight text-foreground">
              {prefix}{metric.current.toLocaleString()}{suffix}
            </div>
            <div className="flex items-center gap-1 text-xs font-bold font-mono">
              {renderTrendIcon(metric.trend)}
              <span className={metric.pctDiff >= 0 ? "text-emerald-400" : "text-destructive"}>
                {metric.pctDiff > 0 ? `+${metric.pctDiff}%` : `${metric.pctDiff}%`}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-[11px] font-medium pt-2 border-t border-border/40 text-muted-foreground">
            <div>
              <span className="opacity-70">Yesterday:</span>{' '}
              <span className="font-bold text-foreground">{prefix}{metric.previous.toLocaleString()}{suffix}</span>
            </div>
            <div>
              <span className="opacity-70">Target:</span>{' '}
              <span className="font-bold text-foreground">{prefix}{(metric.target || 0).toLocaleString()}{suffix}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const healthScore = healthBreakdown.totalScore;
  const healthColor = healthScore >= 80 ? 'from-emerald-600 to-teal-700' : healthScore >= 60 ? 'from-amber-600 to-orange-700' : 'from-destructive to-red-800';

  return (
    <div className="space-y-6">
      {/* CEO COMMAND BANNER */}
      <div className={cn(
        "w-full p-6 rounded-2xl bg-gradient-to-r text-white shadow-2xl border-2 border-white/10 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500",
        healthColor
      )}>
        <div className="flex items-center gap-5">
          <div className="h-16 w-16 rounded-2xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
            <Crown className="h-10 w-10 text-yellow-300 fill-yellow-300/30" />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl md:text-2xl font-black tracking-tight uppercase font-body">BUSINESS HEALTH SCORE</h2>
              <Badge variant="outline" className="bg-white/20 border-white/40 text-white font-mono font-bold text-xs uppercase px-2.5 py-0.5">
                CYCLE: {todayStr}
              </Badge>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider opacity-90 mt-1 max-w-xl">
              10-Second Executive Pulse: Business is operating at <span className="font-bold underline">{healthScore >= 80 ? 'PEAK PERFORMANCE' : healthScore >= 60 ? 'STABLE BASELINE' : 'CRITICAL ATTENTION REQUIRED'}</span> calculated strictly from live database intake.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0 bg-black/20 p-4 rounded-xl border border-white/10">
          <div className="text-center">
            <p className="text-xs uppercase font-bold tracking-widest opacity-80">Health Score</p>
            <p className="text-4xl md:text-5xl font-black font-mono tracking-tighter">{healthScore}<span className="text-xl font-normal opacity-70">/100</span></p>
          </div>
          <div className="w-28 space-y-1.5 hidden sm:block">
            <div className="flex justify-between text-[10px] font-bold uppercase opacity-80">
              <span>Goal</span>
              <span>85+</span>
            </div>
            <Progress value={healthScore} className="h-2 bg-white/20" />
          </div>
        </div>
      </div>

      {/* 5 REAL EXECUTIVE KPI CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {renderKpiCard("Revenue Today", <IndianRupee className="h-4 w-4 text-primary" />, kpis.revenueToday, "₹")}
        {renderKpiCard("Profit Today", <Activity className="h-4 w-4 text-emerald-400" />, kpis.profitToday, "₹")}
        {renderKpiCard("Customers Today", <Users className="h-4 w-4 text-blue-400" />, kpis.customersToday)}
        {renderKpiCard("Average Bill", <IndianRupee className="h-4 w-4 text-amber-400" />, kpis.averageBill, "₹")}
        {renderKpiCard("Gaming Occupancy", <Gamepad2 className="h-4 w-4 text-purple-400" />, kpis.gamingOccupancy, "", "%")}
      </div>
    </div>
  );
}
