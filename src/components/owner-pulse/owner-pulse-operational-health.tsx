'use client';

import React from 'react';
import { OperationalHealthData } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Activity, Gamepad2, Clock, Users, ShieldCheck } from 'lucide-react';

interface OperationalHealthProps {
  data: OperationalHealthData;
}

export function OwnerPulseOperationalHealth({ data }: OperationalHealthProps) {
  return (
    <Card className="border-2 border-blue-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-blue-500/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Activity className="h-5 w-5 text-blue-400" />
            Operational Health & Real-Time Live Status
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Active Gaming Stations, Active Shifts & Unpaid Bills Diagnostic
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-blue-500/40 text-blue-400 uppercase">
          LIVE HARDWARE STATUS
        </Badge>
      </CardHeader>
      <CardContent className="p-5">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Gamepad2 className="h-4 w-4 text-purple-400" /> Active Gaming Stations
            </p>
            <p className="text-3xl font-extrabold font-body text-foreground">
              {data.openGamingSessionsCount} <span className="text-xs font-normal opacity-60 text-muted-foreground">/ {data.totalStationsCount} total</span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Users className="h-4 w-4 text-emerald-400" /> Active Staff Logged In
            </p>
            <p className="text-3xl font-extrabold font-body text-foreground">
              {data.activeStaffCount} <span className="text-xs font-normal opacity-60 text-muted-foreground">shifts active</span>
            </p>
          </div>

          <div className="p-4 rounded-xl border border-border/60 bg-muted/10 space-y-1">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-4 w-4 text-amber-400" /> Unpaid / Pending Bills
            </p>
            <p className="text-3xl font-extrabold font-body text-foreground">
              {data.pendingOrdersCount} <span className="text-xs font-normal opacity-60 text-muted-foreground">awaiting settlement</span>
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
