'use client';

import React from 'react';
import { GamingIntelligenceData } from '@/lib/metrics-layer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Clock, AlertTriangle, Trophy, Zap, DollarSign, Utensils, Coffee, Percent, Info } from 'lucide-react';

interface GamingIntelProps {
  data: GamingIntelligenceData;
}

export function OwnerPulseGamingIntel({ data }: GamingIntelProps) {
  return (
    <Card className="border-2 border-purple-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-purple-500/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Gamepad2 className="h-5 w-5 text-purple-400" />
            Gaming Intelligence &amp; Station Yield Dynamics
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Console Occupancy, Bookable Capacity, Hourly Yields &amp; F&amp;B Attachment
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-mono border-purple-500/40 text-purple-400 uppercase">
            {data.totalBookableStations} CONSOLES
          </Badge>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40 text-xs font-mono">
            ACTUAL REALIZED
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-purple-400" /> Paid Occupancy
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">
              {data.paidGamingOccupancyPct}%
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Denominator: {data.potentialGamingHours} bookable hrs
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-400" /> Hours Played
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">
              {data.hoursPlayedTotal} <span className="text-xs font-normal opacity-70">hrs</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Avg Session: {data.avgSessionLengthMinutes} min
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Idle Station-Hours
            </p>
            <p className="text-2xl font-extrabold font-body text-amber-400 mt-1">
              {data.idleHoursTotal} <span className="text-xs font-normal opacity-70">hrs</span>
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Unoccupied capacity today
            </p>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-purple-400" /> Rev / PS5 Station
            </p>
            <p className="text-2xl font-extrabold font-body text-purple-400 mt-1">
              ₹{data.revenuePerPs5.toLocaleString()}
            </p>
            <p className="text-[10px] text-purple-300/70 mt-0.5">
              Realized gaming intake
            </p>
          </div>
        </div>

        {/* HOURLY YIELD & ATTACHMENT METRICS (PHASE 3) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5 text-emerald-400" /> Rev / Occupied Hour
              </span>
              <p className="text-xl font-extrabold text-foreground mt-1">
                ₹{data.revPerOccupiedGamingHour.toLocaleString()}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/30 pt-1">
              Actual realized rate per session-hour
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Percent className="h-3.5 w-3.5 text-cyan-400" /> RevPASH (Avail. Hour)
              </span>
              <p className="text-xl font-extrabold text-foreground mt-1">
                ₹{data.revPerAvailableStationHour.toLocaleString()}
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/30 pt-1">
              Total yield across all active stations
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Utensils className="h-3.5 w-3.5 text-orange-400" /> Gaming &rarr; Food Attach
              </span>
              <p className="text-xl font-extrabold text-orange-400 mt-1">
                {data.gamingToFoodAttachmentRatePct}%
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/30 pt-1">
              Gamers who purchased snacks/food
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Coffee className="h-3.5 w-3.5 text-amber-500" /> Gaming &rarr; Coffee Attach
              </span>
              <p className="text-xl font-extrabold text-amber-500 mt-1">
                {data.gamingToCoffeeAttachmentRatePct}%
              </p>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 border-t border-border/30 pt-1">
              Gamers who ordered hot/cold brew
            </p>
          </div>
        </div>

        {/* DETAILS GRID */}
        <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
            <Trophy className="h-4 w-4 text-yellow-400" /> Console Session Intelligence
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Top Gaming Package:</span>
              <span className="font-bold text-foreground">{data.mostPopularPackage}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Top Gaming Station:</span>
              <span className="font-bold text-foreground">{data.mostPopularConsole}</span>
            </div>
            <div className="flex justify-between p-2.5 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Peak Gaming Hour:</span>
              <span className="font-bold text-purple-400">{data.peakGamingHour}</span>
            </div>
          </div>
        </div>

        {/* DATA LABELS / ESTIMATES FOOTER */}
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/30 text-[11px] text-muted-foreground">
          <Info className="h-3.5 w-3.5 text-primary shrink-0" />
          <span>
            <strong>Data Integrity:</strong> Actual figures derive from verified bill timestamps and station session logs. Bookable capacity is strictly bounded by active consoles during operating hours (11 AM – 11 PM IST).
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
