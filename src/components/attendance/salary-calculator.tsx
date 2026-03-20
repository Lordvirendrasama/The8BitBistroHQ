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

    // Filter shifts for this employee in this month
    const monthShifts = allShifts.filter(s => {
      const isCorrectEmp = s.staffId === emp.username || (s.employees && s.employees.some(e => e.username === emp.username));
      if (!isCorrectEmp || !s.startTime) return false;
      const shiftDate = new Date(s.startTime);
      if (isNaN(shiftDate.getTime())) return false;
      return isWithinInterval(shiftDate, { start: startOfSelectedMonth, end: endOfSelectedMonth });
    });

    // Filter leaves for this employee in this month
    // Simplified: Just counting days that fall inside the month
    let leavesTaken = 0;
    allLeaves.filter(l => l.employeeId === emp.id || l.employeeName === emp.username || l.employeeName === emp.displayName).forEach(l => {
      if (l.type !== 'unpaid') return;

      const lStart = startOfDay(new Date(l.startDate));
      const lEnd = startOfDay(new Date(l.endDate));
      if (isNaN(lStart.getTime()) || isNaN(lEnd.getTime())) return;
      
      const overlapStart = max([lStart, startOfSelectedMonth]);
      const overlapEnd = min([lEnd, endOfSelectedMonth]);
      
      if (overlapStart <= overlapEnd) {
        leavesTaken += differenceInDays(overlapEnd, overlapStart) + 1;
      }
    });

    // Extract constants
    const monthlySalary = emp.salary || 0;
    const weekOffDay = emp.weekOffDay ?? 0; // 0=Sun, 1=Mon, etc.

    // A. Count how many times the weeklyOffDay occurs in that specific month
    let weeklyOffCount = 0;
    for (let i = 1; i <= daysInMonth; i++) {
        if (new Date(year, month - 1, i).getDay() === weekOffDay) {
            weeklyOffCount++;
        }
    }

    // B. Calculate workingDays
    const workingDays = isWeeklyOffPaid ? daysInMonth : (daysInMonth - weeklyOffCount);

    // C. Daily rate
    const dailyRate = workingDays > 0 ? (monthlySalary / workingDays) : 0;

    // D. Deduction
    const deduction = leavesTaken * dailyRate;

    // E. Final salary
    const finalSalary = monthlySalary - deduction;

    return {
      emp,
      monthlySalary,
      daysInMonth,
      weeklyOffCount,
      workingDays,
      dailyRate,
      deduction,
      finalSalary,
      leavesTaken
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
          <DialogDescription className="font-bold text-xs uppercase tracking-widest text-muted-foreground">
            Compute dynamic monthly compensation based on attendance and compliance.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 py-4 space-y-6 bg-muted/10">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
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
              <Label className="text-[10px] font-black uppercase text-muted-foreground flex items-center gap-1">
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
            <Label htmlFor="paid-offs" className="text-[10px] font-black uppercase tracking-widest cursor-pointer opacity-70">
              Count Weekly Offs As Paid Working Days
            </Label>
          </div>

          {calculation && (
            <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Card className="p-3 border-2 shadow-none bg-background flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">Base Salary</span>
                  <span className="text-xl font-mono font-black text-foreground mt-1">₹{calculation.monthlySalary.toLocaleString()}</span>
                </Card>
                <Card className="p-3 border-2 shadow-none bg-background flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-black uppercase text-muted-foreground">Daily Rate</span>
                  <span className="text-xl font-mono font-black text-emerald-600 mt-1">₹{calculation.dailyRate.toFixed(2)}</span>
                </Card>
                <Card className="p-3 border-2 shadow-none bg-primary text-primary-foreground flex flex-col items-center justify-center text-center">
                  <span className="text-[9px] font-black uppercase opacity-80">Final Payout</span>
                  <span className="text-2xl font-mono font-black mt-1">₹{calculation.finalSalary.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                </Card>
              </div>

              <div className="bg-background border-2 rounded-xl p-4 space-y-4 shadow-inner">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                  <Clock className="h-3 w-3" /> Formula Diagnostic
                </h4>
                
                <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-xs font-mono font-bold">
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Days in Month</span>
                        <span>{calculation.daysInMonth}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Weekly Off Count</span>
                        <span className={isWeeklyOffPaid ? "text-emerald-500" : "text-amber-500"}>
                          {isWeeklyOffPaid ? "PAID" : `-${calculation.weeklyOffCount}`}
                        </span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-muted-foreground">Unpaid Leaves</span>
                        <span className="text-red-500">-{calculation.leavesTaken}</span>
                    </div>
                    <div className="flex justify-between items-center border-b border-dashed pb-1">
                        <span className="text-emerald-600">Working Days (Base)</span>
                        <span className="text-emerald-600">{calculation.workingDays}</span>
                    </div>

                </div>

                <Separator className="my-2" />

                <div className="space-y-2">
                    <div className="flex justify-between items-center text-sm font-black uppercase text-muted-foreground">
                        <span>Leave Deductions</span>
                        <span className="font-mono text-red-500">-₹{calculation.deduction.toLocaleString(undefined, { maximumFractionDigits: 1 })}</span>
                    </div>
                </div>

              </div>

            </div>
          )}

          {!calculation && selectedEmpId && (
              <div className="h-32 flex items-center justify-center border-2 border-dashed rounded-xl">
                  <span className="text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Running Computations...</span>
              </div>
          )}
        </div>
        <div className="p-4 bg-muted/20 border-t-2 text-center text-[9px] font-black uppercase tracking-widest text-muted-foreground">
            Algorithm: FINAL FORMULA
        </div>
      </DialogContent>
    </Dialog>
  );
}
