'use client';

import React from 'react';
import { EmployeeIntelScorecard } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, ShieldCheck } from 'lucide-react';

interface EmployeeIntelProps {
  employees: EmployeeIntelScorecard[];
}

export function OwnerPulseEmployeeIntel({ employees }: EmployeeIntelProps) {
  return (
    <Card className="border-2 border-indigo-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-indigo-500/5 flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <Users className="h-5 w-5 text-indigo-400" />
            Employee Intelligence & Shift Productivity Scorecards
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Real Intake Generated, Orders Billed, Shifts Logged & Attendance
          </CardDescription>
        </div>
        <Badge variant="outline" className="text-xs font-mono border-indigo-500/40 text-indigo-400 uppercase">
          REAL STAFF RECORDS
        </Badge>
      </CardHeader>
      <CardContent className="p-5 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp) => (
            <div
              key={emp.username}
              className="p-4 rounded-xl border border-border/60 bg-muted/10 hover:border-indigo-500/40 transition-all space-y-3"
            >
              <div className="flex items-center justify-between border-b border-border/40 pb-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-extrabold text-sm text-indigo-400">
                    {emp.displayName[0]}
                  </div>
                  <div>
                    <h4 className="font-bold text-sm text-foreground uppercase">{emp.displayName}</h4>
                    <p className="text-[11px] text-muted-foreground font-mono">@{emp.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono font-bold">
                    {emp.attendancePct}% Attendance
                  </Badge>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-medium">
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Revenue Billed</span>
                  <span className="text-base font-extrabold text-foreground">₹{emp.revenueGenerated.toLocaleString()}</span>
                </div>
                <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                  <span className="text-muted-foreground text-[10px] uppercase font-bold block">Orders Processed</span>
                  <span className="text-base font-extrabold text-foreground">{emp.ordersServed} orders</span>
                </div>
              </div>

              <div className="flex justify-between items-center text-[11px] font-medium pt-1 text-muted-foreground">
                <span>Shifts Worked: <strong className="text-foreground">{emp.shiftsWorked}</strong></span>
                <span>Late Arrivals: <strong className={emp.lateArrivalsCount > 0 ? "text-destructive font-bold" : "text-emerald-400 font-bold"}>{emp.lateArrivalsCount}</strong></span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
