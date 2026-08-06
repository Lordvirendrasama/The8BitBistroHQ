'use client';

import React from 'react';
import { RevenueIntelligenceData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { PieChart, Flame, AlertCircle } from 'lucide-react';

interface RevenueIntelProps {
  data: RevenueIntelligenceData;
}

export function OwnerPulseRevenueIntel({ data }: RevenueIntelProps) {
  return (
    <Card className="border-2 border-primary/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <PieChart className="h-5 w-5 text-primary" />
            Revenue Intelligence & Channel Breakdown
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Real Channel Intake, Contribution % & Average Order Values
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary uppercase">
          8 CATEGORIES
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {/* HIGHLIGHT CARDS FOR TOP & WORST PERFORMERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/20 rounded-lg text-emerald-400">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Highest Intake Category</p>
                <p className="text-xl font-extrabold font-body text-foreground">{data.topGrowthCategory}</p>
              </div>
            </div>
            <Badge className="bg-emerald-500 text-black font-extrabold text-xs">LEADER</Badge>
          </div>

          <div className="p-4 rounded-xl border-2 border-amber-500/30 bg-amber-500/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/20 rounded-lg text-amber-400">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-400">Lowest Intake Category</p>
                <p className="text-xl font-extrabold font-body text-foreground">{data.worstPerformingCategory}</p>
              </div>
            </div>
            <Badge variant="outline" className="border-amber-500/50 text-amber-400 font-bold text-xs">NEEDS BOOST</Badge>
          </div>
        </div>

        {/* CATEGORY TABLE / CARDS */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {data.categories.map((cat) => (
            <div
              key={cat.category}
              className="p-4 rounded-xl border border-border/60 bg-muted/10 hover:border-primary/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2">
                <span className="font-bold text-sm uppercase text-foreground">{cat.category}</span>
                <Badge variant="secondary" className="text-[10px] font-mono font-bold bg-primary/10 text-primary">
                  {cat.contributionPct}% Contrib
                </Badge>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-baseline">
                  <span className="text-xs text-muted-foreground uppercase font-bold">Revenue</span>
                  <span className="text-lg font-extrabold font-body text-foreground">₹{cat.revenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-muted-foreground uppercase font-medium">Orders / Units</span>
                  <span className="font-mono font-bold text-foreground">{cat.ordersCount}</span>
                </div>
                <div className="flex justify-between items-baseline text-xs">
                  <span className="text-muted-foreground uppercase font-medium">Avg Order Value</span>
                  <span className="font-mono font-bold text-foreground">₹{cat.aov}</span>
                </div>
              </div>

              <Progress value={cat.contributionPct} className="h-1.5 bg-muted" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
