'use client';

import React from 'react';
import { GamingIntelligenceData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Gamepad2, Clock, AlertTriangle, Trophy, Zap, DollarSign } from 'lucide-react';

interface GamingIntelProps {
  data: GamingIntelligenceData;
}

export function OwnerPulseGamingIntel({ data }: GamingIntelProps) {
  return (
    <Card className="border-2 border-purple-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-purple-500/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Gamepad2 className="h-5 w-5 text-purple-400" />
            Gaming Intelligence & Station Efficiency
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Console Occupancy, Hours Played & Station Rankings
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-purple-500/40 text-purple-400 uppercase">
          CONSOLE PULSE
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-6">
        {/* STATS OVERVIEW */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-purple-400" /> Console Utilization
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.consoleUtilizationPct}%</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-emerald-400" /> Est Hours Played
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.hoursPlayedTotal} hrs</p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5 text-amber-400" /> Idle Capacity
            </p>
            <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.idleHoursTotal} hrs</p>
          </div>

          <div className="p-4 rounded-xl border border-purple-500/30 bg-purple-500/10">
            <p className="text-xs font-bold uppercase tracking-wider text-purple-400 flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5 text-purple-400" /> Revenue per PS5
            </p>
            <p className="text-2xl font-extrabold font-body text-purple-400 mt-1">₹{data.revenuePerPs5.toLocaleString()}</p>
          </div>
        </div>

        {/* ADDITIONAL KPIS */}
        <div className="grid grid-cols-2 gap-3">
           <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
             <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
               <Clock className="h-3.5 w-3.5 text-emerald-400" /> Avg Session Length
             </p>
             <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.avgSessionLengthMinutes} min</p>
           </div>
           
           <div className="p-4 rounded-xl border border-border/60 bg-muted/10">
             <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
               <Zap className="h-3.5 w-3.5 text-yellow-400" /> Potential Gaming Hours
             </p>
             <p className="text-2xl font-extrabold font-body text-foreground mt-1">{data.potentialGamingHours} hrs</p>
           </div>
        </div>

        {/* DETAILS GRID */}
        <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2 border-b border-border/40 pb-2">
            <Trophy className="h-4 w-4 text-yellow-400" /> Station & Gaming Package Rankings
          </h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Top Gaming Package:</span>
              <span className="font-bold text-foreground">{data.mostPopularPackage}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Top Gaming Station:</span>
              <span className="font-bold text-foreground">{data.mostPopularConsole}</span>
            </div>
            <div className="flex justify-between p-2 rounded-lg bg-background/50 border border-border/30">
              <span className="text-muted-foreground font-semibold">Peak Gaming Hour:</span>
              <span className="font-bold text-purple-400">{data.peakGamingHour}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
