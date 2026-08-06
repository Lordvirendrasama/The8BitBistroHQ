'use client';

import React from 'react';
import { FinancialIntelligenceData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Wallet, Target, PieChart } from 'lucide-react';

interface FinancialIntelProps {
  data: FinancialIntelligenceData;
}

export function OwnerPulseFinancialIntel({ data }: FinancialIntelProps) {
  const expenseCategories = Object.entries(data.expensesByCategory);

  return (
    <Card className="border-2 border-emerald-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-emerald-500/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Wallet className="h-5 w-5 text-emerald-400" />
            Financial Intelligence & P&L Control Ledger
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Revenue, Net Profit, Logged Expenses & Goal Break-Even Velocity
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-emerald-500/40 text-emerald-400 uppercase">
          P&L PULSE
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {/* TOP P&L METRICS */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Revenue</p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">₹{data.revenue.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Gross Margin Est</p>
            <p className="text-2xl font-extrabold font-body text-emerald-400 mt-1">₹{data.grossProfit.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Net Intake (Less Outflow)</p>
            <p className="text-2xl font-extrabold font-body text-emerald-400 mt-1">₹{data.netProfit.toLocaleString()}</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Logged Outflows</p>
            <p className="text-2xl font-extrabold font-body text-destructive mt-1">₹{data.totalExpenses.toLocaleString()}</p>
          </div>
        </div>

        {/* EXPENSE BREAKDOWN & GOAL PROGRESS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <PieChart className="h-4 w-4 text-emerald-400" /> Fixed Costs & Outflows Breakdown
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Rent Allocation (Daily):</span>
                <span className="font-bold text-foreground">₹{data.rentCostDaily.toLocaleString()}</span>
              </div>
              {expenseCategories.length > 0 ? (
                expenseCategories.map(([cat, amt]) => (
                  <div key={cat} className="flex justify-between">
                    <span className="text-muted-foreground">{cat}:</span>
                    <span className="font-bold text-foreground">₹{amt.toLocaleString()}</span>
                  </div>
                ))
              ) : (
                <p className="text-[11px] italic text-muted-foreground pt-1">No variable expenses logged today.</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Target className="h-4 w-4 text-emerald-400" /> Goal & Break-Even Velocity
            </h4>
            <div className="space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span className="text-muted-foreground">Daily Target Progress (₹{data.survivalTargetDaily.toLocaleString()})</span>
                  <span className="text-emerald-400">{data.breakevenProgressPct}%</span>
                </div>
                <Progress value={data.breakevenProgressPct} className="h-2 bg-muted" />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-xs font-bold uppercase">
                  <span className="text-muted-foreground">Monthly Goal Progress</span>
                  <span className="text-emerald-400">{data.monthlyGoalProgressPct}%</span>
                </div>
                <Progress value={data.monthlyGoalProgressPct} className="h-2 bg-muted" />
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
