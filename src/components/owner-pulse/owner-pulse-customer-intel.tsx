'use client';

import React from 'react';
import { CustomerIntelligenceData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, UserPlus, Repeat, Clock, Crown, Heart, DollarSign } from 'lucide-react';

interface CustomerIntelProps {
  data: CustomerIntelligenceData;
}

export function OwnerPulseCustomerIntel({ data }: CustomerIntelProps) {
  return (
    <Card className="border-2 border-primary/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-muted/20 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-primary" />
            Customer Intelligence & Loyalty Dynamics
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Acquisition, Retention, Member Spend & Visit Behavior
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-primary/30 text-primary uppercase">
          CUSTOMER PULSE
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
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Repeat className="h-3.5 w-3.5 text-emerald-400" /> Returning Customers
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.returningCustomers}</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Heart className="h-3.5 w-3.5 text-pink-400" /> Repeat Rate
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.repeatRatePct}%</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-amber-400" /> Member Lifetime Value
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">₹{data.customerLifetimeValue.toLocaleString()}</p>
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
                <span className="font-bold text-foreground">₹{data.avgSpendPerCustomer}</span>
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
