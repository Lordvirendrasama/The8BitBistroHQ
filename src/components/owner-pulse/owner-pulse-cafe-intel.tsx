'use client';

import React, { useState } from 'react';
import { CafeIntelligenceData } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Utensils, Flame, TrendingUp, AlertTriangle, AlertCircle, Sparkles, HelpCircle, PackageX, Layers } from 'lucide-react';

interface CafeIntelProps {
  data: CafeIntelligenceData;
}

export function OwnerPulseCafeIntel({ data }: CafeIntelProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'matrix' | 'stockouts'>('overview');

  const getBcgBadge = (cls: string) => {
    switch (cls) {
      case 'Star':
        return <Badge className="bg-emerald-500 text-black font-extrabold text-[10px]">STAR (High Vol + Margin)</Badge>;
      case 'Plowhorse':
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/40 text-[10px]">PLOWHORSE (High Vol, Low Margin)</Badge>;
      case 'Puzzle':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/40 text-[10px]">PUZZLE (Low Vol, High Margin)</Badge>;
      default:
        return <Badge variant="outline" className="border-destructive/40 text-destructive text-[10px]">DOG (Review Recipe)</Badge>;
    }
  };

  return (
    <Card className="border-2 border-orange-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-orange-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Utensils className="h-5 w-5 text-orange-400" />
            Café Intelligence &amp; Contribution Profitability
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Volume Leaders, Revenue Rankings, Menu Engineering Matrix &amp; Inventory Alerts
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {data.missingCostCount > 0 ? (
            <Badge variant="outline" className="text-xs font-mono border-amber-500/40 text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> {data.missingCostCount} Missing Costs
            </Badge>
          ) : (
            <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/40 text-xs font-mono">
              COSTS RECORDED
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* NAV TABS */}
        <div className="flex items-center gap-2 border-b border-border/40 pb-3 overflow-x-auto text-xs font-bold uppercase no-scrollbar">
          <Button
            size="sm"
            variant={activeTab === 'overview' ? 'default' : 'outline'}
            onClick={() => setActiveTab('overview')}
            className="h-8 gap-1.5"
          >
            <Flame className="h-3.5 w-3.5" /> Product Rankings &amp; Dynamics
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'matrix' ? 'default' : 'outline'}
            onClick={() => setActiveTab('matrix')}
            className="h-8 gap-1.5"
          >
            <Layers className="h-3.5 w-3.5" /> Menu Matrix &amp; Margins ({data.productContributions.length})
          </Button>
          <Button
            size="sm"
            variant={activeTab === 'stockouts' ? 'default' : 'outline'}
            onClick={() => setActiveTab('stockouts')}
            className="h-8 gap-1.5"
          >
            <PackageX className="h-3.5 w-3.5" /> Stock-out Alerts ({data.stockOutAlerts.length})
          </Button>
        </div>

        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Best Seller by Volume */}
              <div className="p-4 rounded-xl border border-orange-500/30 bg-orange-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-orange-400 flex items-center gap-1.5">
                      <Flame className="h-4 w-4" /> Best Seller (Volume)
                    </p>
                    <Badge variant="outline" className="text-[10px] font-mono border-orange-500/40 text-orange-400">UNITS</Badge>
                  </div>
                  {data.bestSellerVolume ? (
                    <div className="mt-2">
                      <p className="text-lg font-extrabold font-body text-foreground truncate">
                        {data.bestSellerVolume.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1 font-bold">
                        {data.bestSellerVolume.count} Units Sold &bull; ₹{data.bestSellerVolume.revenue.toLocaleString()} Intake
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground mt-2">No Item Sales Recorded</p>
                  )}
                </div>
              </div>

              {/* Best Seller by Revenue */}
              <div className="p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                      <TrendingUp className="h-4 w-4" /> Top Revenue Item
                    </p>
                    <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 text-emerald-400">VALUE</Badge>
                  </div>
                  {data.bestSellerRevenue ? (
                    <div className="mt-2">
                      <p className="text-lg font-extrabold font-body text-foreground truncate">
                        {data.bestSellerRevenue.name}
                      </p>
                      <p className="text-xs text-emerald-400 font-mono font-bold mt-1">
                        ₹{data.bestSellerRevenue.revenue.toLocaleString()} Revenue ({data.bestSellerRevenue.count} Units)
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground mt-2">No Item Sales Recorded</p>
                  )}
                </div>
              </div>

              {/* Lowest Volume Item */}
              <div className="p-4 rounded-xl border border-amber-500/30 bg-amber-500/10 flex flex-col justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" /> Lowest Volume Item
                  </p>
                  {data.slowestSellingProduct ? (
                    <div className="mt-2">
                      <p className="text-lg font-extrabold font-body text-foreground truncate">
                        {data.slowestSellingProduct.name}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono mt-1 font-bold">
                        {data.slowestSellingProduct.count} Units Sold
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs italic text-muted-foreground mt-2">No Low-Volume Alert</p>
                  )}
                </div>
              </div>
            </div>

            {/* TOP 5 REVENUE RANKINGS & DYNAMICS */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between border-b border-border/40 pb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-emerald-400" /> Top 5 Revenue Products
                  </h4>
                  <Badge variant="outline" className="text-[10px] font-mono">SORTED BY REVENUE</Badge>
                </div>
                <div className="space-y-2 text-xs">
                  {data.top5RevenueProducts?.length > 0 ? (
                    data.top5RevenueProducts.map((p, i) => (
                      <div key={i} className="flex justify-between items-center py-1 border-b border-border/20 last:border-0">
                        <div className="truncate max-w-[220px]">
                          <span className="font-bold text-muted-foreground mr-1.5">{i + 1}.</span>
                          <span className="font-semibold text-foreground">{p.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-2">({p.unitsSold} sold)</span>
                        </div>
                        <span className="font-bold font-mono text-emerald-400">₹{p.revenue.toLocaleString()}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground italic">No products recorded yet</p>
                  )}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
                  <Utensils className="h-4 w-4 text-orange-400" /> Café Dynamics
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
          </div>
        )}

        {/* 2. MENU MATRIX & MARGINS TAB */}
        {activeTab === 'matrix' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Product Contribution Margin &amp; Menu Classification
              </h4>
              <span className="text-xs text-muted-foreground font-mono">
                {data.missingCostCount > 0 ? `(${data.missingCostCount} items lack raw material cost)` : 'All costs synced'}
              </span>
            </div>

            <div className="rounded-xl border border-border/60 overflow-hidden">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="text-xs font-bold uppercase">Product</TableHead>
                    <TableHead className="text-xs font-bold uppercase">Category</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Units</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Revenue</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Unit Cost</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Margin (₹)</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-right">Margin (%)</TableHead>
                    <TableHead className="text-xs font-bold uppercase text-center">Matrix Classification</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.productContributions.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-xs text-muted-foreground py-6">
                        No product sales recorded in current scope.
                      </TableCell>
                    </TableRow>
                  ) : (
                    data.productContributions.map((item, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="font-bold text-xs text-foreground">{item.name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{item.category}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{item.unitsSold}</TableCell>
                        <TableCell className="text-xs font-mono font-bold text-right text-foreground">
                          ₹{item.revenue.toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs font-mono text-right">
                          {item.hasCostRecorded ? `₹${item.costPerUnit}` : <span className="text-amber-400 italic">Missing</span>}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold text-right text-emerald-400">
                          {item.hasCostRecorded ? `₹${item.contributionMarginRupees.toLocaleString()}` : '—'}
                        </TableCell>
                        <TableCell className="text-xs font-mono font-bold text-right">
                          {item.hasCostRecorded ? `${item.contributionMarginPct}%` : '—'}
                        </TableCell>
                        <TableCell className="text-center">
                          {getBcgBadge(item.classification)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        )}

        {/* 3. STOCK-OUT ALERTS TAB */}
        {activeTab === 'stockouts' && (
          <div className="space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Inventory Safety Buffer &amp; Stock-Out Monitoring
            </h4>
            {data.stockOutAlerts.length === 0 ? (
              <div className="p-8 rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 text-center space-y-2">
                <Sparkles className="h-8 w-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-bold text-foreground">All Stock Levels Healthy</p>
                <p className="text-xs text-muted-foreground">
                  No tracked menu items or raw materials are currently below safety thresholds.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.stockOutAlerts.map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl border-2 border-destructive/30 bg-destructive/10 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.name}</p>
                      <p className="text-[11px] text-destructive font-mono mt-0.5">
                        Current: <strong>{item.stock}</strong> &bull; Threshold: {item.threshold}
                      </p>
                    </div>
                    <Badge className="bg-destructive text-white text-[10px] font-bold">REORDER</Badge>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
