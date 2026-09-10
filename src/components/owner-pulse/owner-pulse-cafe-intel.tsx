'use client';

import React from 'react';
import { CafeIntelligenceData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Utensils, Flame, TrendingUp, AlertTriangle } from 'lucide-react';

interface CafeIntelProps {
  data: CafeIntelligenceData;
}

export function OwnerPulseCafeIntel({ data }: CafeIntelProps) {
  return (
    <Card className="border-2 border-orange-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-orange-500/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Utensils className="h-5 w-5 text-orange-400" />
            Café Intelligence & Real Sales Product Performers
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Top Performing Items, Sales Velocity & Unit Volume Analytics
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-orange-500/40 text-orange-400 uppercase">
          REAL SALES DATA
        </Badge>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 flex flex-col justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
              <Flame className="h-4 w-4" /> Best Seller Today
            </p>
            {data.bestSeller ? (
              <div className="mt-2">
                <p className="text-xl font-extrabold font-body text-foreground truncate">
                  {data.bestSeller.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1 font-bold">
                  {data.bestSeller.count} Sold &bull; ₹{data.bestSeller.revenue.toLocaleString()} Revenue
                </p>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground mt-2">No Item Sales Recorded Today</p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4" /> Fastest Growing Item
            </p>
            {data.fastestGrowingProduct ? (
              <div className="mt-2">
                <p className="text-xl font-extrabold font-body text-foreground truncate">
                  {data.fastestGrowingProduct.name}
                </p>
                <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                  {data.fastestGrowingProduct.currentCount} Sold Today (vs {data.fastestGrowingProduct.prevCount} Yesterday)
                </p>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground mt-2">Insufficient Historical Baseline</p>
            )}
          </div>

          <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col justify-between">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" /> Lowest Volume Item
            </p>
            {data.slowestSellingProduct ? (
              <div className="mt-2">
                <p className="text-xl font-extrabold font-body text-foreground truncate">
                  {data.slowestSellingProduct.name}
                </p>
                <p className="text-xs text-muted-foreground font-mono mt-1 font-bold">
                  {data.slowestSellingProduct.count} Units Sold Today
                </p>
              </div>
            ) : (
              <p className="text-xs italic text-muted-foreground mt-2">No Low-Volume Alert</p>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
          {/* Top 5 Products List */}
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2 mb-3">
              <TrendingUp className="h-4 w-4 text-emerald-400" /> Top 5 Revenue Products
            </h4>
            <div className="space-y-2 text-xs">
              {data.top5Products?.length > 0 ? data.top5Products.map((p, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
                  <span className="font-medium text-foreground truncate max-w-[200px]">{i+1}. {p.name}</span>
                  <span className="font-bold text-emerald-400">₹{p.revenue.toLocaleString()}</span>
                </div>
              )) : (
                <p className="text-muted-foreground italic">No products sold yet</p>
              )}
            </div>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
             <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
               <Utensils className="h-4 w-4 text-orange-400" /> Cafe Dynamics
             </h4>
             <div className="space-y-3 text-xs">
               <div className="flex justify-between items-center p-2 rounded-lg bg-background/50 border border-border/30">
                 <span className="text-muted-foreground font-semibold">Food Attachment Rate:</span>
                 <span className="font-bold text-orange-400 text-sm">{data.foodAttachmentRatePct}%</span>
               </div>
               <div className="flex justify-between items-center p-2 rounded-lg bg-background/50 border border-border/30">
                 <span className="text-muted-foreground font-semibold">Coffee Attachment Rate:</span>
                 <span className="font-bold text-amber-500 text-sm">{data.coffeeAttachmentRatePct}%</span>
               </div>
               <div className="flex justify-between items-center p-2 rounded-lg bg-background/50 border border-border/30">
                 <span className="text-muted-foreground font-semibold">Peak Food Ordering Hour:</span>
                 <span className="font-bold text-foreground text-sm">{data.peakFoodHour}</span>
               </div>
             </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
