
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Shift, Settings, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Users, Clock, Timer, IndianRupee, TrendingUp, Calendar, ArrowRight, UserCheck, Banknote } from 'lucide-react';
import { format, startOfMonth, endOfMonth, differenceInHours, differenceInMinutes } from 'date-fns';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function PayrollPage() {
  const { db } = useFirebase();
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'yyyy-MM'));

  const settingsQuery = useMemo(() => !db ? null : collection(db, 'settings'), [db]);
  const { data: settingsList } = useCollection<Settings>(settingsQuery);
  const settings = settingsList?.[0] || { hourlySalaryRate: 100 };

  const empsQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(empsQuery);

  const shiftsQuery = useMemo(() => !db ? null : query(collection(db, 'shifts'), orderBy('startTime', 'desc')), [db]);
  const { data: allShifts, loading } = useCollection<Shift>(shiftsQuery);

  const stats = useMemo(() => {
    if (!employees) return [];

    const start = startOfMonth(new Date(selectedMonth + "-01"));
    const end = endOfMonth(start);

    const monthShifts = allShifts?.filter(s => {
        const date = new Date(s.startTime);
        return date >= start && date <= end && s.status === 'completed';
    }) || [];

    const staffMap: Record<string, {
        displayName: string,
        daysWorked: number,
        totalSeconds: number,
        totalEarnings: number,
        lastActive: string | null,
        lateInstances: number,
        salaryType: string,
        baseRate: number
    }> = {};

    // 1. Initialize with all active employees
    employees.filter(e => e.isActive).forEach(emp => {
        staffMap[emp.username] = {
            displayName: emp.displayName || emp.username,
            daysWorked: 0,
            totalSeconds: 0,
            totalEarnings: 0,
            lastActive: null,
            lateInstances: 0,
            salaryType: emp.salaryType || 'hourly',
            baseRate: emp.salary || (settings.hourlySalaryRate || 100)
        };
    });

    // 2. Aggregate shift data
    monthShifts.forEach(s => {
        s.employees.forEach(shiftEmp => {
            if (staffMap[shiftEmp.username]) {
                const staff = staffMap[shiftEmp.username];
                staff.daysWorked += 1;
                if (s.lateMinutes) staff.lateInstances += 1;
                
                if (s.endTime) {
                    const durationMs = new Date(s.endTime).getTime() - new Date(s.startTime).getTime();
                    const durationSec = Math.floor(durationMs / 1000);
                    staff.totalSeconds += durationSec;
                    
                    if (staff.salaryType === 'monthly') {
                        // Monthly structure: Flat day rate (monthly/30) per worked day
                        staff.totalEarnings += (staff.baseRate / 30);
                    } else {
                        // Hourly structure
                        const hours = durationSec / 3600;
                        staff.totalEarnings += hours * staff.baseRate;
                    }
                }
                
                if (!staff.lastActive || new Date(s.startTime) > new Date(staff.lastActive)) {
                    staff.lastActive = s.startTime;
                }
            }
        });
    });

    return Object.entries(staffMap).map(([id, data]) => ({ id, ...data })).sort((a, b) => b.totalEarnings - a.totalEarnings);
  }, [allShifts, selectedMonth, settings, employees]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    // Always include current month
    months.add(format(new Date(), 'yyyy-MM'));
    
    if (allShifts) {
        allShifts.forEach(s => months.add(format(new Date(s.startTime), 'yyyy-MM')));
    }
    return Array.from(months).sort().reverse();
  }, [allShifts]);

  if (loading) return <div className="p-12 text-center font-headline text-xs animate-pulse opacity-50">Syncing Workforce Data...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">STAFF PAYROLL</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">WAGE CALCULATION BASED ON INDIVIDUAL EMPLOYEE SALARIES & ATTENDANCE</p>
        </div>
        <div className="flex gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[200px] h-12 font-black uppercase text-[10px] border-2">
                    <SelectValue />
                </SelectTrigger>
                <SelectContent>
                    {monthOptions.map(m => (
                        <SelectItem key={m} value={m} className="font-bold uppercase text-[10px]">
                            {format(new Date(m + "-01"), 'MMMM yyyy').toUpperCase()}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <IndianRupee className="h-4 w-4" /> Global Default Rate
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">₹{settings.hourlySalaryRate || 100}<span className="text-xs ml-1 opacity-40">/HR</span></div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Used if individual salary is unset</p>
            </CardContent>
        </Card>

        <Card className="border-2 bg-muted/5">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <UserCheck className="h-4 w-4" /> Registered Staff
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black">{stats.length} <span className="text-xs ml-1 opacity-40">OPERATORS</span></div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Total workforce tracked</p>
            </CardContent>
        </Card>

        <Card className="border-2 bg-primary/5 border-primary/20">
            <CardHeader className="pb-2">
                <CardTitle className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-2">
                    <TrendingUp className="h-4 w-4" /> Monthly Burden
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-3xl font-black text-primary">₹{Math.floor(stats.reduce((s, st) => s + st.totalEarnings, 0)).toLocaleString()}</div>
                <p className="text-[9px] font-bold text-muted-foreground uppercase mt-1">Total estimated wages for selected period</p>
            </CardContent>
        </Card>
      </div>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" /> Wage Master Sheet
            </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="font-black uppercase text-[10px] pl-6">Operator</TableHead>
                        <TableHead className="font-black uppercase text-[10px] text-center">Structure</TableHead>
                        <TableHead className="font-black uppercase text-[10px] text-center">Days / Hours</TableHead>
                        <TableHead className="font-black uppercase text-[10px] text-center">Late Logs</TableHead>
                        <TableHead className="text-right font-black uppercase text-[10px] pr-6">Earned Salary</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {stats.map((staff) => {
                        const totalHours = staff.totalSeconds / 3600;
                        const h = Math.floor(totalHours);
                        const m = Math.floor((staff.totalSeconds % 3600) / 60);

                        return (
                            <TableRow key={staff.id} className="hover:bg-muted/5">
                                <TableCell className="pl-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-8 w-8 border-2 border-primary/10">
                                            <AvatarFallback className="text-[10px] font-black">{staff.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="font-black uppercase text-xs">{staff.displayName}</span>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">@{staff.id}</span>
                                        </div>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    <Badge variant="outline" className="h-4 text-[7px] font-black uppercase border-emerald-500/20 text-emerald-600">
                                        {staff.salaryType} (₹{staff.baseRate.toLocaleString()})
                                    </Badge>
                                </TableCell>
                                <TableCell className="text-center">
                                    <div className="flex flex-col items-center justify-center font-mono text-[10px] font-bold">
                                        <span className="flex items-center gap-1"><Calendar className="h-2 w-2"/> {staff.daysWorked} DAYS</span>
                                        <span className="flex items-center gap-1 opacity-50"><Timer className="h-2 w-2"/> {h}H {m}M</span>
                                    </div>
                                </TableCell>
                                <TableCell className="text-center">
                                    {staff.lateInstances > 0 ? (
                                        <Badge variant="destructive" className="h-4 text-[8px] font-black uppercase">{staff.lateInstances} TIMES</Badge>
                                    ) : <Badge variant="outline" className="h-4 text-[8px] font-black uppercase text-emerald-600 border-emerald-500/20">PERFECT</Badge>}
                                </TableCell>
                                <TableCell className="text-right pr-6">
                                    <span className="font-mono font-black text-lg text-primary">₹{Math.floor(staff.totalEarnings).toLocaleString()}</span>
                                </TableCell>
                            </TableRow>
                        );
                    })}
                    {stats.length === 0 && (
                        <TableRow>
                            <TableCell colSpan={5} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No staff operators found in database.</TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </CardContent>
      </Card>
    </div>
  );
}
