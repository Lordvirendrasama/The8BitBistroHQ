
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Shift } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, Clock, Wallet, IndianRupee, ShoppingCart, User, AlertCircle, Timer, Coffee, Zap, Moon } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';

export default function ShiftReportsPage() {
  const { db } = useFirebase();
  const [staffFilter, setStaffFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');

  const shiftsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'shifts'), orderBy('startTime', 'desc'));
  }, [db]);

  const { data: allShifts, loading, error } = useCollection<Shift>(shiftsQuery);

  const staffOptions = useMemo(() => {
    if (!allShifts) return [];
    const staff = new Map<string, string>(); // username -> display name
    allShifts.forEach(s => {
        if (s.staffId) {
            staff.set(s.staffId.toLowerCase(), s.staffId);
        }
        s.employees?.forEach(e => {
            staff.set(e.username.toLowerCase(), e.displayName || e.username);
        });
    });
    return Array.from(staff.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allShifts]);

  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(shift => {
        const date = new Date(shift.startTime);
        
        const matchesStaff = staffFilter === 'all' || 
                             shift.staffId?.toLowerCase() === staffFilter.toLowerCase() || 
                             shift.employees?.some(e => e.username.toLowerCase() === staffFilter.toLowerCase());
        
        const matchesMonth = monthFilter === 'all' || format(date, 'yyyy-MM') === monthFilter;
        return matchesStaff && matchesMonth;
    });
  }, [allShifts, staffFilter, monthFilter]);

  const monthOptions = useMemo(() => {
    if (!allShifts) return [];
    const months = new Set<string>();
    allShifts.forEach(s => months.add(format(new Date(s.startTime), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [allShifts]);

  const formatShiftDuration = (start: string, end?: string) => {
    if (!end) return "Ongoing";
    const s = new Date(start);
    const e = new Date(end);
    const hours = differenceInHours(e, s);
    const mins = differenceInMinutes(e, s) % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateTotalBreak = (breaks: any[] = []) => {
    const totalSeconds = breaks.reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
    const mins = Math.floor(totalSeconds / 60);
    return `${mins}m`;
  };

  if (loading) {
    return <div className="flex h-screen items-center justify-center font-headline text-sm animate-pulse">Syncing Attendance Records...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="font-headline text-4xl tracking-wider text-foreground">Attendance Registry</h1>
        <p className="mt-2 text-muted-foreground font-bold uppercase text-sm tracking-[0.2em]">Official Shift Tracking & Punctuality Audit</p>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase tracking-normal text-muted-foreground">Filter by Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                    <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-sm">
                        <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ALL STAFF</SelectItem>
                        {staffOptions.map(([username, displayName]) => (
                            <SelectItem key={username} value={username}>{displayName.toUpperCase()}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase tracking-normal text-muted-foreground">Filter by Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-sm">
                        <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ALL HISTORY</SelectItem>
                        {monthOptions.map(m => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), 'MMMM yyyy').toUpperCase()}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <Badge variant="outline" className="h-10 px-4 border-2 font-bold uppercase text-sm ml-auto bg-background shadow-sm">
                {filteredShifts.length} RECORDS FOUND
            </Badge>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg font-bold uppercase tracking-tight">Shift Master Table</CardTitle>
          <CardDescription className="text-sm font-bold uppercase tracking-normal">Audit trail for logins, logouts, punctuality and work hours.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/20">
              <TableRow>
                <TableHead className="font-bold uppercase text-sm">Date</TableHead>
                <TableHead className="font-bold uppercase text-sm">Staff</TableHead>
                <TableHead className="font-bold uppercase text-sm">Login/Logout</TableHead>
                <TableHead className="font-bold uppercase text-sm">Duration</TableHead>
                <TableHead className="font-bold uppercase text-sm text-center">Alerts</TableHead>
                <TableHead className="font-bold uppercase text-sm text-right">Accounting</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredShifts.map((shift) => (
                <TableRow key={shift.id} className="group hover:bg-muted/5 transition-colors">
                  <TableCell>
                    <p className="font-bold text-sm uppercase">{format(new Date(shift.startTime), 'MMM dd, yyyy')}</p>
                    <p className="text-sm font-bold text-muted-foreground uppercase">{format(new Date(shift.startTime), 'EEEE')}</p>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                        <Avatar className="h-7 w-7 border-2 border-primary/10">
                            <AvatarFallback className="text-sm font-bold">{shift.staffId?.charAt(0) || 'S'}</AvatarFallback>
                        </Avatar>
                        <span className="font-bold uppercase text-sm">{shift.staffId || 'Unknown'}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-emerald-600">
                            <Zap className="h-3 w-3 text-emerald-500 fill-current" />
                            {format(new Date(shift.startTime), 'p')}
                        </div>
                        {shift.endTime ? (
                            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-muted-foreground">
                                <Moon className="h-3 w-3" />
                                {format(new Date(shift.endTime), 'p')}
                            </div>
                        ) : (
                            <Badge variant="outline" className="w-fit h-4 text-sm animate-pulse uppercase border-emerald-500 text-emerald-600 bg-emerald-500/5">Active</Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5 text-sm font-bold uppercase tracking-tight">
                            <Timer className="h-3 w-3 opacity-40" />
                            {formatShiftDuration(shift.startTime, shift.endTime)}
                        </div>
                        {shift.breaks?.length > 0 && (
                            <div className="flex items-center gap-1.5 text-sm font-bold uppercase text-amber-600">
                                <Coffee className="h-2.5 w-2.5" />
                                {calculateTotalBreak(shift.breaks)} Break Total
                            </div>
                        )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-center gap-1">
                        {shift.lateMinutes ? (
                            <Badge variant="destructive" className="h-4 text-sm uppercase font-bold tracking-normal">
                                Late ({shift.lateMinutes}m)
                            </Badge>
                        ) : <Badge variant="outline" className="h-4 text-sm uppercase font-bold tracking-normal text-emerald-600 border-emerald-600/30">On Time</Badge>}
                        
                        {shift.overtimeMinutes ? (
                            <Badge className="h-4 text-sm uppercase font-bold bg-blue-600 tracking-normal">
                                OT ({shift.overtimeMinutes}m)
                            </Badge>
                        ) : shift.earlyLeaveMinutes ? (
                            <Badge variant="secondary" className="h-4 text-sm uppercase font-bold tracking-normal">
                                Early Exit ({shift.earlyLeaveMinutes}m)
                            </Badge>
                        ) : null}

                        {shift.workedOnWeeklyOff && (
                            <Badge className="h-4 text-sm uppercase font-bold bg-purple-600 tracking-normal">
                                Worked On Off Day
                            </Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-col items-end">
                        <span className="font-mono font-bold text-sm text-primary">₹{((shift.cashTotal || 0) + (shift.upiTotal || 0)).toLocaleString()}</span>
                        <span className="text-sm font-bold text-muted-foreground uppercase">Shift Total</span>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {filteredShifts.length === 0 && (
                <TableRow>
                    <TableCell colSpan={6} className="h-64 text-center">
                        <div className="flex flex-col items-center justify-center opacity-30">
                            <Clock className="h-12 w-12 mb-2" />
                            <p className="font-headline text-sm tracking-normal uppercase">No attendance records found</p>
                        </div>
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
