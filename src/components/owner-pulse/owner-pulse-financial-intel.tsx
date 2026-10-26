'use client';

import React from 'react';
import { FinancialIntelligenceData } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Wallet, Target, PieChart, TrendingUp, Calendar, Info, ArrowUpRight } from 'lucide-react';
import Link from 'next/link';

interface FinancialIntelProps {
  data: FinancialIntelligenceData;
}

export function OwnerPulseFinancialIntel({ data }: FinancialIntelProps) {
  const expenseCategories = Object.entries(data.expensesByCategory);

  return (
    <Card className="border-2 border-emerald-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-emerald-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5 text-emerald-400" />
            Financial Intelligence &amp; Cash-Flow Obligations
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Revenue, Net Intake, Fixed Overhead Allocation, Break-Even &amp; 7-Day Liquidity Run Rate
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-400 uppercase">
            P&amp;L LEDGER
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* TOP P&L METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Revenue</p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">₹{data.revenue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Realized bill intake</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Margin Est ({data.grossMarginPct}%)</p>
            <p className="text-2xl font-extrabold font-body text-emerald-400 mt-1">₹{data.grossProfit.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Estimated gross contribution</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Intake (Less Outflow)</p>
            <p className="text-2xl font-extrabold font-body text-emerald-400 mt-1">₹{data.netProfit.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Revenue minus daily outflows</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logged Outflows</p>
            <p className="text-2xl font-extrabold font-body text-destructive mt-1">₹{data.totalExpenses.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Fixed: ₹{data.fixedExpensesDaily.toLocaleString()} &bull; Var: ₹{data.variableExpensesDaily.toLocaleString()}
            </p>
          </div>
        </div>

        {/* EXPENSE BREAKDOWN & GOAL PROGRESS */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Fixed Costs Breakdown */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3 flex flex-col justify-between">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                <PieChart className="h-4 w-4 text-emerald-400" /> Fixed Costs Allocation (Daily)
              </h4>
              <div className="space-y-2 text-xs mt-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Rent Allocation (Daily):</span>
                  <span className="font-bold text-foreground font-mono">₹{data.rentCostDaily.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Loan Burden (Daily):</span>
                  <span className="font-bold text-foreground font-mono">₹{data.loanCostDaily.toLocaleString()}</span>
                </div>
                {expenseCategories.length > 0 ? (
                  expenseCategories.map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center border-t border-border/20 pt-1">
                      <span className="text-muted-foreground">{cat}:</span>
                      <span className="font-bold text-foreground font-mono">₹{amt.toLocaleString()}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] italic text-muted-foreground pt-1">No additional variable expenses logged today.</p>
                )}
              </div>
            </div>

            <Button asChild variant="outline" size="sm" className="w-full text-xs font-bold uppercase mt-3">
              <Link href="/financials">
                Adjust Burden Selector <ArrowUpRight className="h-3 w-3 ml-1" />
              </Link>
            </Button>
          </div>

          {/* Goal & Break-Even Velocity */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Target className="h-4 w-4 text-emerald-400" /> Goal &amp; Break-Even Velocity
            </h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold uppercase mb-1">
                  <span className="text-muted-foreground">Daily Survival Target (₹{data.survivalTargetDaily.toLocaleString()})</span>
                  <span className={data.breakevenProgressPct >= 100 ? "text-emerald-400" : "text-amber-400"}>
                    {data.breakevenProgressPct}%
                  </span>
                </div>
                <Progress value={data.breakevenProgressPct} className="h-2 bg-muted" />
                <p className="text-[10px] text-muted-foreground text-right mt-1">
                  {data.revenueNeededToday > 0 ? `Need ₹${data.revenueNeededToday.toLocaleString()} more today` : 'Daily survival goal met!'}
                </p>
              </div>

              <div className="space-y-1 mt-4">
                <div className="flex justify-between text-xs font-bold uppercase mb-1">
                  <span className="text-muted-foreground">Monthly Goal Progress</span>
                  <span className="text-emerald-400">{data.monthlyGoalProgressPct}%</span>
                </div>
                <Progress value={data.monthlyGoalProgressPct} className="h-2 bg-muted" />
              </div>
            </div>
          </div>

          {/* Cash Flow Forecast (Phase 3) */}
          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 space-y-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-emerald-400" /> 7-Day Cash Flow Forecast
                </h4>
                <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400">PROJECTION</Badge>
              </div>
              <div className="space-y-3 text-xs mt-3">
                <div className="flex justify-between items-center bg-background/50 p-2 rounded-lg">
                  <span className="text-muted-foreground">Projected 7-Day Inflow:</span>
                  <span className="font-bold text-foreground font-mono">₹{data.cashFlowForecast.projectedInflowNext7Days.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center bg-background/50 p-2 rounded-lg">
                  <span className="text-muted-foreground">Upcoming 7-Day Obligations:</span>
                  <span className="font-bold text-destructive font-mono">₹{data.cashFlowForecast.upcomingObligationsNext7Days.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center bg-background/70 p-2 rounded-lg border border-emerald-500/30">
                  <span className="text-emerald-400 font-bold uppercase">Net Projected Position:</span>
                  <span className="font-black text-emerald-400 text-sm font-mono">
                    ₹{data.cashFlowForecast.netProjectedPositionNext7Days.toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-[10px] text-emerald-400/80 italic leading-tight">
              *Forecast assumes current monthly velocity and scheduled rent/loan amortizations.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
