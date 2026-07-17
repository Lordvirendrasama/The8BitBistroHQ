'use client';

import { useState, useMemo } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Employee, Shift, Leave } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { format, getDaysInMonth, startOfMonth, endOfMonth, isWithinInterval, startOfDay, max, min, differenceInDays } from 'date-fns';
import { Calculator, Calendar as CalendarIcon, Clock, DollarSign } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

interface SalaryCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SalaryCalculator({ open, onOpenChange }: SalaryCalculatorProps) {
  const { db } = useFirebase();
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [selectedMonth, setSelectedMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [isWeeklyOffPaid, setIsWeeklyOffPaid] = useState<boolean>(false);

  // Data fetching
  const empQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(empQuery);

  const shiftsQuery = useMemo(() => !db ? null : collection(db, 'shifts'), [db]);
  const { data: allShifts } = useCollection<Shift>(shiftsQuery);

  const leavesQuery = useMemo(() => !db ? null : collection(db, 'leaves'), [db]);
  const { data: allLeaves } = useCollection<Leave>(leavesQuery);

  // Calculation logic
  const calculation = useMemo(() => {
    if (!selectedEmpId || !employees || !allShifts || !allLeaves || !selectedMonth) return null;

    const emp = employees.find(e => e.id === selectedEmpId);
    if (!emp) return null;

    const [year, month] = selectedMonth.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const startOfSelectedMonth = startOfMonth(monthDate);
    const endOfSelectedMonth = endOfMonth(monthDate);
    const daysInMonth = getDaysInMonth(monthDate);
    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // Filter shifts for this employee in this month
    const monthShifts = allShifts.filter(s => {
      const isCorrectEmp = s.staffId === emp.username || (s.employees && s.employees.some(e => e.username === emp.username));
      if (!isCorrectEmp || !s.startTime) return false;
      const shiftDate = new Date(s.startTime);
      if (isNaN(shiftDate.getTime())) return false;
      return isWithinInterval(shiftDate, { start: startOfSelectedMonth, end: endOfSelectedMonth });
    });

    const monthlySalary = emp.salary || 0;
    const weekOffDay = emp.weekOffDay ?? 0; // 0=Sun, 1=Mon, etc.

    // A. Count how many times the weeklyOffDay occurs in that specific month (for denominator working days)
    let totalWeeklyOffsInMonth = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        if (new Date(year, month - 1, i).getDay() === weekOffDay) {
            totalWeeklyOffsInMonth++;
        }
    }

    // B. Calculate workingDays
    const workingDays = isWeeklyOffPaid ? daysInMonth : (daysInMonth - totalWeeklyOffsInMonth);

    // C. Daily rate
    const dailyRate = workingDays > 0 ? (monthlySalary / workingDays) : 0;

    // Track daily status counts
    let presentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;
    let absentCount = 0;
    let weeklyOffCount = 0;
    let paidLeaveCount = 0;
    let unpaidLeaveCount = 0;
    let totalHoursWorked = 0;

    // Iterate through all days of the month to build daily breakdown
    for (let day = 1; day <= daysInMonth; day++) {
      const dayDate = new Date(year, month - 1, day);
      const dateStr = format(dayDate, 'yyyy-MM-dd');

      // Skip future dates
      if (dateStr > todayStr) {
        continue;
      }

      // 1. Find shifts on this date
      const shiftsOnDay = monthShifts.filter(s => s.date === dateStr);

      // 2. Find approved leaves on this date
      const approvedLeave = allLeaves.find(l => {
        const isCorrectEmp = l.employeeId === emp.id || l.employeeName === emp.username || l.employeeName === emp.displayName;
        if (!isCorrectEmp || l.status !== 'approved') return false;
        const lStart = startOfDay(new Date(l.startDate));
        const lEnd = startOfDay(new Date(l.endDate));
        if (isNaN(lStart.getTime()) || isNaN(lEnd.getTime())) return false;
        return dayDate >= lStart && dayDate <= lEnd;
      });

      let status: 'Present' | 'Late' | 'Half Day' | 'Absent' | 'Weekly Off' | 'Paid Leave' | 'Unpaid Leave' | 'Future' = 'Future';

      if (shiftsOnDay.length > 0) {
        const shift = shiftsOnDay[0];
        totalHoursWorked += shift.totalHoursWorked || 0;

        const shStatus = shift.attendanceStatus;
        if (shStatus) {
          status = shStatus;
        } else {
          if (shift.workedOnWeeklyOff) {
            status = 'Present';
          } else if (shift.lateMinutes && shift.lateMinutes > 0) {
            status = 'Late';
          } else {
            status = 'Present';
          }
        }
      } else if (approvedLeave) {
        if (approvedLeave.type === 'unpaid') {
          status = 'Unpaid Leave';
        } else {
          status = 'Paid Leave';
        }
      } else {
        const dayOfWeek = dayDate.getDay();
        const isWeeklyOff = dayOfWeek === weekOffDay;

        if (isWeeklyOff) {
          status = 'Weekly Off';
        } else {
          status = 'Absent';
        }
      }

      // Increment counts
      if (status === 'Present') presentCount++;
      else if (status === 'Late') lateCount++;
      else if (status === 'Half Day') halfDayCount++;
      else if (status === 'Absent') absentCount++;
      else if (status === 'Weekly Off') weeklyOffCount++;
      else if (status === 'Paid Leave') paidLeaveCount++;
      else if (status === 'Unpaid Leave') unpaidLeaveCount++;
    }

    // D. Deductions
    const absentDeduction = (absentCount + unpaidLeaveCount) * dailyRate;
    const halfDayDeduction = halfDayCount * 0.5 * dailyRate;
    const deduction = absentDeduction + halfDayDeduction;

    // E. Final salary
    const finalSalary = Math.max(0, monthlySalary - deduction);

    return {
      emp,
      monthlySalary,
      daysInMonth,
      workingDays,
      dailyRate,
      deduction,
      finalSalary,
      presentCount,
      lateCount,
      halfDayCount,
      absentCount,
      weeklyOffCount,
      paidLeaveCount,
      unpaidLeaveCount,
      totalHoursWorked,
      absentDeduction,
      halfDayDeduction
    };

  }, [selectedEmpId, selectedMonth, employees, allShifts, allLeaves, isWeeklyOffPaid]);

  const monthOptions = useMemo(() => {
    const opts = new Set<string>();
    opts.add(format(new Date(), 'yyyy-MM')); // Always add current month
    if (allShifts) {
      allShifts.forEach(s => {
        if (s.startTime) {
          try {
            const d = new Date(s.startTime);
            if (!isNaN(d.getTime())) {
                opts.add(format(d, 'yyyy-MM'));
            }
          } catch (e) {
              console.error("Invalid date shift", s.id);
          }
        }
      });
    }
    return Array.from(opts).sort().reverse();
  }, [allShifts]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl font-body bg-background border-2 overflow-hidden pl-0 pr-0 pb-0">
        <DialogHeader className="px-6">
          <DialogTitle className="font-headline text-2xl uppercase tracking-wider flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Payroll Engine
          </DialogTitle>
          <DialogDescription className="font-bold text-sm uppercase tracking-normal text-muted-foreground">
            Compute dynamic monthly compensation based on attendance and compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6 bg-muted/10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1">
                <CalendarIcon className="h-3 w-3" /> Target Month
              </Label>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="font-bold uppercase tracking-wider border-2 h-12 bg-background">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map(m => (
                    <SelectItem key={m} value={m} className="font-bold uppercase">
                      {format(new Date(`${m}-01`), 'MMMM yyyy')}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1">
                Target Operator
              </Label>
              <Select value={selectedEmpId} onValueChange={setSelectedEmpId}>
                <SelectTrigger className="font-bold uppercase tracking-wider border-2 h-12 bg-background">
                  <SelectValue placeholder="PICK OPERATOR" />
                </SelectTrigger>
                <SelectContent>
                  {employees?.filter(e => e.isActive).map(e => (
                    <SelectItem key={e.id} value={e.id} className="font-bold uppercase">
                      {e.displayName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-3 bg-muted/20 p-4 rounded-xl border-2">
            <Switch id="paid-offs" checked={isWeeklyOffPaid} onCheckedChange={setIsWeeklyOffPaid} />
            <Label htmlFor="paid-offs" className="text-sm font-bold uppercase tracking-normal cursor-pointer opacity-70">
              Count Weekly Offs As Paid Working Days
            </Label>
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="p-3 border-2 shadow-none bg-background flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold uppercase text-muted-foreground">Base Salary</span>
                  <span className="text-xl font-mono font-bold text-foreground mt-1">₹{calculation.monthlySalary.toLocaleString()}</span>
                </Card>
                <Card className="p-3 border-2 shadow-none bg-background flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold uppercase text-muted-foreground">Daily Rate</span>
                  <span className="text-xl font-mono font-bold text-emerald-600 mt-1">₹{calculation.dailyRate.toFixed(2)}</span>
                </Card>
                <Card className="p-3 border-2 shadow-none bg-primary text-primary-foreground flex flex-col items-center justify-center text-center">
                  <span className="text-sm font-bold uppercase opacity-80">Final Payout</span>
                  <span className="text-2xl font-mono font-bold mt-1">₹{calculation.finalSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </Card>
              </div>

              <div className="bg-background border-2 rounded-xl p-4 space-y-4 shadow-inner">
                <h4 className="text-sm font-bold uppercase tracking-normal text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Formula Diagnostic
                </h4>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm font-mono font-bold">
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Days in Month</span>
                        <span>{calculation.daysInMonth}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Working Days (Base)</span>
                        <span className="text-emerald-600">{calculation.workingDays}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Weekly Offs</span>
                        <span className={isWeeklyOffPaid ? "text-emerald-500" : "text-amber-500"}>
                          {calculation.weeklyOffCount} {isWeeklyOffPaid ? "(PAID)" : "(UNPAID)"}
                        </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Total Hours Worked</span>
                        <span className="text-blue-500">{calculation.totalHoursWorked.toFixed(1)} hrs</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Present Days</span>
                        <span className="text-emerald-500">{calculation.presentCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Late Days</span>
                        <span className="text-yellow-500">{calculation.lateCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Half Day Shifts</span>
                        <span className="text-orange-500">{calculation.halfDayCount}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Absent Days</span>
                        <span className="text-red-500">{calculation.absentCount}</span>
                    </div>
                    {calculation.paidLeaveCount > 0 && (
                      <div className="flex justify-between items-center border-b border-dashed pb-1">
                          <span className="text-muted-foreground">Paid Leaves</span>
                          <span className="text-emerald-500">{calculation.paidLeaveCount}</span>
                      </div>
                    )}
                    {calculation.unpaidLeaveCount > 0 && (
                      <div className="flex justify-between items-center border-b border-dashed pb-1">
                          <span className="text-muted-foreground">Unpaid Leaves</span>
                          <span className="text-red-500">{calculation.unpaidLeaveCount}</span>
                      </div>
                    )}
                </div>

                <Separator className="my-2" />

                <div className="space-y-2 text-sm">
                    <div className="flex justify-between items-center font-bold text-muted-foreground">
                        <span>Absence Deductions</span>
                        <span className="font-mono text-red-500">
                          {calculation.absentCount + calculation.unpaidLeaveCount > 0 
                            ? `-₹${calculation.absentDeduction.toLocaleString(undefined, { maximumFractionDigits: 1 })}` 
                            : '₹0'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center font-bold text-muted-foreground">
                        <span>Half Day Deductions</span>
                        <span className="font-mono text-red-500">
                          {calculation.halfDayCount > 0 
                            ? `-₹${calculation.halfDayDeduction.toLocaleString(undefined, { maximumFractionDigits: 1 })}` 
                            : '₹0'}
                        </span>
                    </div>
                    <div className="flex justify-between items-center text-sm font-bold uppercase text-foreground pt-1 border-t border-dashed">
                        <span>Total Deductions</span>
                        <span className="font-mono text-red-500">-₹{calculation.deduction.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    </div>
                </div>

              </div>

            </div>
          )}

          {!calculation && selectedEmpId && (
              <div className="h-32 flex items-center justify-center border-2 border-dashed rounded-xl">
                  <span className="text-sm font-bold uppercase tracking-normal text-muted-foreground animate-pulse">Running Computations...</span>
              </div>
          )}
        </div>
        <div className="p-4 bg-muted/20 border-t-2 text-center text-sm font-bold uppercase tracking-normal text-muted-foreground">
            Algorithm: FINAL FORMULA
        </div>
      </DialogContent>
    </Dialog>
  );
}
