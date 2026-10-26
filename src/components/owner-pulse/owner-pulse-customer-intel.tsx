'use client';

import React from 'react';
import { CustomerIntelligenceData } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Repeat, Clock, Crown, Heart, DollarSign, Coins, TrendingUp } from 'lucide-react';

interface CustomerIntelProps {
  data: CustomerIntelligenceData;
}

export function OwnerPulseCustomerIntel({ data }: CustomerIntelProps) {
  return (
    <Card className="border-2 border-primary/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Customer Intelligence &amp; Retention Cohorts
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Acquisition, 7/30/90-Day Retention, Member Spend &amp; Loyalty Bits Liability
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary uppercase">
          CRM INTELLIGENCE
        </Badge>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* STATS GRID */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <UserPlus className="h-3.5 w-3.5 text-blue-400" /> New Customers
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.newCustomers}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">First visit recorded today</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-emerald-400" /> Returning Customers
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.returningCustomers}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Known members or repeat guests</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-pink-400" /> Repeat Rate
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.repeatRatePct}%</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Proportion of repeat traffic</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-amber-400" /> Member Lifetime Value
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">₹{data.customerLifetimeValue.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Average spend per member</p>
          </div>
        </div>

        {/* RETENTION COHORTS & LOYALTY BITS (PHASE 4) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Retention Cohorts Card */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" /> Customer Retention Cohorts
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono">REPEAT VISITATION</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-3 rounded-xl bg-background/50 border border-border/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">7-Day</p>
                <p className="text-xl font-extrabold text-foreground mt-1">
                  {data.retentionCohorts.sevenDay.retentionRatePct}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                  {data.retentionCohorts.sevenDay.returnedCustomers}/{data.retentionCohorts.sevenDay.eligibleCustomers} ret.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">30-Day</p>
                <p className="text-xl font-extrabold text-emerald-400 mt-1">
                  {data.retentionCohorts.thirtyDay.retentionRatePct}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                  {data.retentionCohorts.thirtyDay.returnedCustomers}/{data.retentionCohorts.thirtyDay.eligibleCustomers} ret.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-background/50 border border-border/30">
                <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">90-Day</p>
                <p className="text-xl font-extrabold text-blue-400 mt-1">
                  {data.retentionCohorts.ninetyDay.retentionRatePct}%
                </p>
                <p className="text-[9px] text-muted-foreground mt-0.5 font-mono">
                  {data.retentionCohorts.ninetyDay.returnedCustomers}/{data.retentionCohorts.ninetyDay.eligibleCustomers} ret.
                </p>
              </div>
            </div>
          </div>

          {/* Loyalty Bits Tracking */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <div className="flex items-center justify-between border-b border-border/40 pb-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Coins className="h-4 w-4 text-amber-400" /> Loyalty Bits &amp; Rewards Ledger
              </h4>
              <Badge variant="outline" className="text-[10px] font-mono border-amber-500/40 text-amber-400">LIABILITY</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-1">
                <span className="text-muted-foreground">Estimated Bits Earned (Mo):</span>
                <p className="text-lg font-extrabold font-mono text-emerald-400">
                  +{data.loyaltyBits.earnedThisMonth.toLocaleString()} <span className="text-xs font-normal">Bits</span>
                </p>
              </div>
              <div className="p-3 rounded-xl bg-background/50 border border-border/30 space-y-1">
                <span className="text-muted-foreground">Outstanding Liability:</span>
                <p className="text-lg font-extrabold font-mono text-amber-400">
                  {data.loyaltyBits.outstandingLiability.toLocaleString()} <span className="text-xs font-normal">Bits</span>
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* VISIT HABITS */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Clock className="h-4 w-4 text-primary" /> Peak Visit Habits
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Most Popular Time:</span>
                <span className="font-bold text-foreground">{data.mostPopularVisitTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Most Popular Day:</span>
                <span className="font-bold text-foreground">{data.mostPopularDay}</span>
              </div>
            </div>
          </div>

          {/* MEMBER VS WALKIN */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Users className="h-4 w-4 text-primary" /> Channel Mix
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Visits:</span>
                <span className="font-bold text-emerald-400">{data.memberVisits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Walk-in Visits:</span>
                <span className="font-bold text-foreground">{data.walkinVisits}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Customer Spend:</span>
                <span className="font-bold text-foreground">₹{data.avgSpendPerCustomer} <span className="text-muted-foreground text-[10px] ml-1">(n={data.avgSpendSampleSize})</span></span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Avg Revenue / Gamer:</span>
                <span className="font-bold text-purple-400">₹{data.avgRevenuePerGamer}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Member Revenue %:</span>
                <span className="font-bold text-foreground">{data.memberRevenuePct}%</span>
              </div>
            </div>
          </div>

          {/* TOP PERFORMING CUSTOMERS */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
              <Crown className="h-4 w-4 text-yellow-400" /> VIP Champions
            </h4>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Highest Spender:</span>
                <span className="font-bold text-foreground truncate max-w-[140px]">
                  {data.highestSpendingCustomer ? `${data.highestSpendingCustomer.name} (₹${data.highestSpendingCustomer.amount.toLocaleString()})` : 'N/A'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Top Member:</span>
                <span className="font-bold text-foreground truncate max-w-[140px]">
                  {data.highestReturningCustomer ? `${data.highestReturningCustomer.name} (${data.highestReturningCustomer.visits} Packs)` : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
