'use client';

import React, { useState } from 'react';
import { ExecutiveSummaryKPIs, MetricComparison, HealthScoreBreakdown } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { 
  TrendingUp, 
  TrendingDown, 
  IndianRupee, 
  Users, 
  Gamepad2, 
  Activity, 
  Crown,
  Minus,
  Info,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExecutiveSummaryProps {
  kpis: ExecutiveSummaryKPIs;
  healthBreakdown: HealthScoreBreakdown;
  todayStr: string;
}

export function OwnerPulseExecutiveSummary({ kpis, healthBreakdown, todayStr }: ExecutiveSummaryProps) {
  const [showHealthExplanation, setShowHealthExplanation] = useState(false);
  const [activeDrilldownKpi, setActiveDrilldownKpi] = useState<{
    title: string;
    metric: MetricComparison;
    prefix: string;
    suffix: string;
  } | null>(null);

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
      case 'No Data':
        return 'bg-zinc-800 text-zinc-400 border-zinc-700';
      case 'Stale':
        return 'bg-amber-900/40 text-amber-300 border-amber-700';
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
      <Card
        onClick={() => setActiveDrilldownKpi({ title, metric, prefix, suffix })}
        className="border-2 bg-card/80 backdrop-blur-sm shadow-md hover:border-primary/50 cursor-pointer transition-all flex flex-col justify-between group"
      >
        <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 group-hover:text-foreground">
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
              {metric.hasData ? `${prefix}${metric.current.toLocaleString()}${suffix}` : '—'}
            </div>
            {metric.hasData && metric.pctDiff !== null && (
              <div className="flex items-center gap-1 text-xs font-bold font-mono">
                {renderTrendIcon(metric.trend)}
                <span className={metric.pctDiff >= 0 ? "text-emerald-400" : "text-destructive"}>
                  {metric.pctDiff > 0 ? `+${metric.pctDiff}%` : `${metric.pctDiff}%`}
                </span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 gap-1 text-[11px] font-medium pt-2 border-t border-border/40 text-muted-foreground">
            <div className="flex justify-between items-center">
              <div>
                <span className="opacity-70">Yesterday:</span>{' '}
                <span className="font-bold text-foreground">
                  {metric.previous > 0 ? `${prefix}${metric.previous.toLocaleString()}${suffix}` : 'No Prior Base'}
                </span>
                {metric.pctDiff !== null && (
                  <span className={cn("ml-1 font-mono text-[10px]", metric.pctDiff >= 0 ? "text-emerald-400" : "text-destructive")}>
                    ({metric.pctDiff > 0 ? '+' : ''}{metric.pctDiff}%)
                  </span>
                )}
              </div>
              {metric.target !== undefined && (
                <div>
                  <span className="opacity-70">Target:</span>{' '}
                  <span className="font-bold text-foreground">{prefix}{(metric.target || 0).toLocaleString()}{suffix}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  const healthScore = healthBreakdown.totalScore;
  const isHealthy = healthBreakdown.isDataSufficient;
  const healthColor = !isHealthy
    ? 'from-zinc-800 to-zinc-900 border-zinc-700'
    : healthScore >= 80
    ? 'from-emerald-600 to-teal-700 border-emerald-500/40'
    : healthScore >= 60
    ? 'from-amber-600 to-orange-700 border-amber-500/40'
    : 'from-destructive to-red-800 border-red-500/40';

  return (
    <div className="space-y-6">
      {/* CEO COMMAND BANNER */}
      <div className={cn(
        "w-full p-6 rounded-2xl bg-gradient-to-r text-white shadow-2xl border-2 flex flex-col md:flex-row items-center justify-between gap-6 transition-all duration-500 relative",
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
              {isHealthy ? (
                <>
                  10-Second Executive Pulse: Business vitality is at <span className="font-bold underline">{healthScore >= 80 ? 'PEAK PERFORMANCE' : healthScore >= 60 ? 'STABLE BASELINE' : 'CRITICAL ATTENTION REQUIRED'}</span> calculated strictly from verifiable database intake.
                </>
              ) : (
                'Notice: Insufficient transactions recorded for this business day. Score is paused until live intake begins.'
              )}
            </p>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setShowHealthExplanation(!showHealthExplanation)}
              className="h-6 text-[11px] font-bold uppercase tracking-wider p-0 mt-2 text-white hover:text-yellow-300 gap-1"
            >
              <Info className="h-3 w-3" />
              {showHealthExplanation ? 'Hide Methodology Breakdown' : 'Explain Inputs & Weights'}
              {showHealthExplanation ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-6 shrink-0 bg-black/20 p-4 rounded-xl border border-white/10">
          <div className="text-center">
            <p className="text-xs uppercase font-bold tracking-widest opacity-80">Health Score</p>
            <p className="text-4xl md:text-5xl font-black font-mono tracking-tighter">
              {isHealthy ? healthScore : '—'}
              <span className="text-xl font-normal opacity-70">/100</span>
            </p>
          </div>
          <div className="w-28 space-y-1.5 hidden sm:block">
            <div className="flex justify-between text-[10px] font-bold uppercase opacity-80">
              <span>Goal</span>
              <span>85+</span>
            </div>
            <Progress value={isHealthy ? healthScore : 0} className="h-2 bg-white/20" />
          </div>
        </div>
      </div>

      {/* EXPANDABLE TRANSPARENT HEALTH SCORE METHODOLOGY */}
      {showHealthExplanation && (
        <Card className="border-2 border-primary/30 bg-card/95 backdrop-blur-md p-5 space-y-4 animate-in fade-in-50 duration-300">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
              <Info className="h-4 w-4 text-primary" /> Transparent Health Score Calculation Framework
            </h4>
            <Badge variant="outline" className="text-[10px] font-mono">DETERMINISTIC &bull; 0-100</Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {healthBreakdown.explanation}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {healthBreakdown.scoringRules.map((rule, idx) => (
              <div key={idx} className="p-3 rounded-xl bg-muted/20 border border-border/40 space-y-1 text-xs">
                <div className="flex justify-between items-center">
                  <span className="font-bold text-foreground">{rule.label}</span>
                  <Badge variant="secondary" className="font-mono text-[10px] font-bold">
                    {rule.score} / {rule.max} pts
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground leading-tight pt-1">
                  {rule.description}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* 5 REAL EXECUTIVE KPI CARDS WITH INTERACTIVE DRILLDOWN */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {renderKpiCard("Revenue Today", <IndianRupee className="h-4 w-4 text-primary" />, kpis.revenueToday, "₹")}
        {renderKpiCard("Profit Today", <Activity className="h-4 w-4 text-emerald-400" />, kpis.profitToday, "₹")}
        {renderKpiCard("Customers Today", <Users className="h-4 w-4 text-blue-400" />, kpis.customersToday)}
        {renderKpiCard("Average Bill", <IndianRupee className="h-4 w-4 text-amber-400" />, kpis.averageBill, "₹")}
        {renderKpiCard("Gaming Occupancy", <Gamepad2 className="h-4 w-4 text-purple-400" />, kpis.gamingOccupancy, "", "%")}
      </div>

      {/* KPI DRILLDOWN MODAL */}
      <Dialog open={!!activeDrilldownKpi} onOpenChange={(open) => !open && setActiveDrilldownKpi(null)}>
        <DialogContent className="max-w-md border-2 bg-card text-foreground font-body">
          <DialogHeader>
            <DialogTitle className="text-base font-extrabold uppercase tracking-tight flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              {activeDrilldownKpi?.title} Drilldown
            </DialogTitle>
            <DialogDescription className="text-xs uppercase font-semibold text-muted-foreground">
              Period Context &amp; Verified Metric Lineage &bull; {todayStr}
            </DialogDescription>
          </DialogHeader>

          {activeDrilldownKpi && (
            <div className="space-y-4 pt-2 text-xs">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/60 flex items-baseline justify-between">
                <span className="font-bold uppercase text-muted-foreground">Selected Day Actual:</span>
                <span className="text-2xl font-extrabold font-mono text-primary">
                  {activeDrilldownKpi.prefix}{activeDrilldownKpi.metric.current.toLocaleString()}{activeDrilldownKpi.suffix}
                </span>
              </div>

              <div className="space-y-2 border-t border-border/40 pt-3">
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Yesterday Baseline:</span>
                  <span className="font-mono font-bold">
                    {activeDrilldownKpi.prefix}{activeDrilldownKpi.metric.previous.toLocaleString()}{activeDrilldownKpi.suffix}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-muted-foreground">Day-over-Day Variance:</span>
                  <span className={cn("font-mono font-bold", (activeDrilldownKpi.metric.pctDiff ?? 0) >= 0 ? "text-emerald-400" : "text-destructive")}>
                    {activeDrilldownKpi.metric.pctDiff !== null ? `${activeDrilldownKpi.metric.pctDiff > 0 ? '+' : ''}${activeDrilldownKpi.metric.pctDiff}%` : 'No Prior Base'}
                  </span>
                </div>
                {activeDrilldownKpi.metric.target !== undefined && (
                  <div className="flex justify-between items-center py-1 border-t border-border/20 pt-2">
                    <span className="text-muted-foreground">Target Threshold:</span>
                    <span className="font-mono font-bold">
                      {activeDrilldownKpi.prefix}{activeDrilldownKpi.metric.target.toLocaleString()}{activeDrilldownKpi.suffix}
                    </span>
                  </div>
                )}
                {activeDrilldownKpi.metric.targetProgressPct !== undefined && (
                  <div className="flex justify-between items-center py-1">
                    <span className="text-muted-foreground">Target Progress:</span>
                    <span className="font-mono font-bold text-primary">
                      {activeDrilldownKpi.metric.targetProgressPct}%
                    </span>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-lg bg-background/50 border border-border/30 text-[11px] text-muted-foreground leading-relaxed">
                <strong>Audit Note:</strong> All figures are strictly calculated from bills where <code className="text-primary font-mono">getBusinessDate(timestamp) === selectedDate</code> in timezone <code className="text-primary font-mono">Asia/Kolkata</code>.
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
