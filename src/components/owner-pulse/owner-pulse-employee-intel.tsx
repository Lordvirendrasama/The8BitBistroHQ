'use client';

import React, { useState, useMemo } from 'react';
import { EmployeeIntelScorecard } from '@/lib/business-rules';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Users, Clock, ShieldCheck, Calendar, Edit, PlusCircle, RotateCcw, Utensils, Eye, EyeOff, Sparkles, Banknote, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { updateEmployee, addEmployee } from '@/firebase/firestore/employees';
import type { Employee } from '@/lib/types';
import { cn } from '@/lib/utils';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function getCycleInfo(joinDateStr?: string) {
  if (!joinDateStr) {
    const now = new Date();
    const cycleStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const cycleEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
    return {
      joinDay: 1,
      ordinalDay: '1st',
      joinDateFormatted: 'N/A',
      nextResetFormatted: '1st of next month',
      daysLeft: 0,
      isToday: false,
      currentCycleKey: `${cycleStart.toISOString().slice(0, 10)}_to_${cycleEnd.toISOString().slice(0, 10)}`,
      cycleStartDate: cycleStart,
      cycleEndDate: cycleEnd,
    };
  }

  const cleanStr = joinDateStr.slice(0, 10);
  const parts = cleanStr.split('-');
  let d: Date;
  if (parts.length === 3) {
    d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  } else {
    d = new Date(joinDateStr);
  }

  const joinDay = isNaN(d.getDate()) ? 1 : d.getDate();

  const ordinal = (n: number) => {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  };

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const daysInCurrentMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const targetDayThisMonth = Math.min(joinDay, daysInCurrentMonth);
  const resetThisMonth = new Date(currentYear, currentMonth, targetDayThisMonth);
  resetThisMonth.setHours(0, 0, 0, 0);

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);

  let nextReset: Date;
  if (resetThisMonth.getTime() >= todayStart.getTime()) {
    nextReset = resetThisMonth;
  } else {
    const nextMonth = currentMonth + 1;
    const daysInNextMonth = new Date(currentYear, nextMonth + 1, 0).getDate();
    const targetDayNextMonth = Math.min(joinDay, daysInNextMonth);
    nextReset = new Date(currentYear, nextMonth, targetDayNextMonth);
  }

  const diffMs = nextReset.getTime() - todayStart.getTime();
  const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
  const isToday = resetThisMonth.getTime() === todayStart.getTime();

  // Determine current salary/quota cycle window:
  // If nextReset > todayStart, the current cycle started exactly 1 month prior to nextReset.
  // If today is salary day (daysLeft === 0 / isToday), a new cycle starts today!
  const cycleEnd = new Date(nextReset);
  cycleEnd.setHours(23, 59, 59, 999);

  const cycleStart = new Date(nextReset);
  cycleStart.setMonth(cycleStart.getMonth() - 1);
  // Guard day bounds for previous month length
  const daysInPrevMonth = new Date(cycleStart.getFullYear(), cycleStart.getMonth() + 1, 0).getDate();
  cycleStart.setDate(Math.min(joinDay, daysInPrevMonth));
  cycleStart.setHours(0, 0, 0, 0);

  // If today is the reset day, current cycle started today and ends next month!
  let effectiveCycleStart = cycleStart;
  let effectiveCycleEnd = cycleEnd;
  let currentCycleKey = `${effectiveCycleStart.toISOString().slice(0, 10)}_to_${effectiveCycleEnd.toISOString().slice(0, 10)}`;

  if (isToday) {
    effectiveCycleStart = new Date(todayStart);
    const followingMonth = new Date(now.getFullYear(), now.getMonth() + 1, Math.min(joinDay, new Date(now.getFullYear(), now.getMonth() + 2, 0).getDate()));
    followingMonth.setHours(23, 59, 59, 999);
    effectiveCycleEnd = followingMonth;
    currentCycleKey = `${effectiveCycleStart.toISOString().slice(0, 10)}_to_${effectiveCycleEnd.toISOString().slice(0, 10)}`;
  }

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const joinDateFormatted = isNaN(d.getTime()) ? joinDateStr : `${String(d.getDate()).padStart(2, '0')}-${months[d.getMonth()]}-${d.getFullYear()}`;
  const nextResetFormatted = `${String(nextReset.getDate()).padStart(2, '0')}-${months[nextReset.getMonth()]}-${nextReset.getFullYear()}`;

  return {
    joinDay,
    ordinalDay: ordinal(joinDay),
    joinDateFormatted,
    nextResetFormatted,
    daysLeft,
    isToday,
    currentCycleKey,
    cycleStartDate: effectiveCycleStart,
    cycleEndDate: effectiveCycleEnd,
  };
}

interface EmployeeIntelProps {
  employees: EmployeeIntelScorecard[];
}

interface UpcomingResetItem {
  empName: string;
  daysLeft: number;
  dateStr: string;
  ordinalDay: string;
}

export function OwnerPulseEmployeeIntel({ employees }: EmployeeIntelProps) {
  const { toast } = useToast();
  const [editingEmp, setEditingEmp] = useState<EmployeeIntelScorecard | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Edit/Add Form State
  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    role: 'staff' as 'admin' | 'staff' | 'guest',
    salary: 6000,
    salaryType: 'monthly' as 'monthly' | 'hourly',
    weekOffDay: 5,
    joinDate: new Date().toISOString().slice(0, 10),
    pin: '1234',
    workStartTime: '11:00',
    workEndTime: '23:00',
    workingDaysPerWeek: 6,
    overtimeMultiplier: 1.5,
    isActive: true,
    gracePeriod: 5,
    assignedShift: 'closing',
    foodAllowanceBalance: 1000,
  });

  const handleOpenEdit = (emp: EmployeeIntelScorecard) => {
    setEditingEmp(emp);
    setShowPin(false);
    setFormData({
      username: emp.username,
      displayName: emp.displayName,
      role: emp.role || 'staff',
      salary: emp.salary ?? 6000,
      salaryType: emp.salaryType || 'monthly',
      weekOffDay: emp.weekOffDay ?? 5,
      joinDate: emp.joinDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      pin: emp.pin || '1234',
      workStartTime: emp.workStartTime || '11:00',
      workEndTime: emp.workEndTime || '23:00',
      workingDaysPerWeek: emp.workingDaysPerWeek ?? 6,
      overtimeMultiplier: emp.overtimeMultiplier ?? 1.5,
      isActive: emp.isActive ?? true,
      gracePeriod: emp.gracePeriod ?? 5,
      assignedShift: emp.assignedShift || 'closing',
      foodAllowanceBalance: emp.foodAllowanceBalance ?? 1000,
    });
  };

  const handleSaveProfile = async () => {
    if (!formData.username.trim() || !formData.displayName.trim() || !formData.pin.trim()) {
      toast({ variant: 'destructive', title: 'Incomplete Profile', description: 'Display Name, Username, and PIN are required.' });
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();
    setIsSubmitting(true);

    try {
      if (editingEmp && editingEmp.id) {
        await updateEmployee(editingEmp.id, {
          ...formData,
          username: cleanUsername,
        }, {
          username: editingEmp.username,
          pin: editingEmp.pin,
        });
        toast({
          title: 'Operator Profile Saved',
          description: `Updated @${cleanUsername}. Salary & Meal Quota reset cycle updated to ${formData.joinDate}.`,
        });
        setEditingEmp(null);
      } else if (isAddModalOpen) {
        await addEmployee({
          ...formData,
          username: cleanUsername,
        });
        toast({
          title: 'New Operator Added',
          description: `Created @${cleanUsername}. Salary & Quota reset set to the ${new Date(formData.joinDate).getDate()}th of every month.`,
        });
        setIsAddModalOpen(false);
      }
    } catch (err: any) {
      console.error(err);
      toast({
        variant: 'destructive',
        title: 'Save Failed',
        description: err.message || 'Could not update employee document.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Summary Metrics across all active staff
  const summaryMetrics = useMemo(() => {
    let totalPayroll = 0;
    let totalQuotaPool = 0;
    let upcomingReset: UpcomingResetItem | null = null;

    employees.forEach((emp) => {
      totalPayroll += emp.salary || 0;
      totalQuotaPool += emp.foodAllowanceBalance ?? 1000;

      const cycle = getCycleInfo(emp.joinDate);
      if (!upcomingReset || cycle.daysLeft < (upcomingReset as UpcomingResetItem).daysLeft) {
        upcomingReset = {
          empName: emp.displayName,
          daysLeft: cycle.daysLeft,
          dateStr: cycle.nextResetFormatted,
          ordinalDay: cycle.ordinalDay,
        };
      }
    });

    return {
      activeCount: employees.length,
      totalPayroll,
      totalQuotaPool,
      upcomingReset: upcomingReset as UpcomingResetItem | null,
    };
  }, [employees]);

  return (
    <Card className="border-2 border-indigo-500/20 bg-card/90 backdrop-blur-md shadow-xl overflow-hidden font-body">
      <CardHeader className="p-5 pb-3 border-b border-border/40 bg-indigo-500/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <CardTitle className="text-lg font-bold uppercase tracking-tight flex items-center gap-2 text-foreground">
            <ShieldCheck className="h-5 w-5 text-indigo-400" />
            Staff Intelligence &amp; Payroll Management
          </CardTitle>
          <CardDescription className="text-xs uppercase font-semibold tracking-wider text-muted-foreground">
            Salary Days, Meal Quota Reset Cycles &amp; Performance Scorecards
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              setEditingEmp(null);
              setFormData({
                username: '',
                displayName: '',
                role: 'staff',
                salary: 6000,
                salaryType: 'monthly',
                weekOffDay: 5,
                joinDate: new Date().toISOString().slice(0, 10),
                pin: '1234',
                workStartTime: '11:00',
                workEndTime: '23:00',
                workingDaysPerWeek: 6,
                overtimeMultiplier: 1.5,
                isActive: true,
                gracePeriod: 5,
                assignedShift: 'closing',
                foodAllowanceBalance: 1000,
              });
              setIsAddModalOpen(true);
            }}
            className="h-9 px-3 font-bold uppercase text-xs tracking-normal gap-1.5 shadow-md bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <PlusCircle className="h-4 w-4" /> Add Operator
          </Button>
          <Badge variant="outline" className="text-xs font-mono border-indigo-500/40 text-indigo-400 uppercase">
            {summaryMetrics.activeCount} ACTIVE OPERATORS
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-6">
        {/* TOP PAYROLL & QUOTA RESET SUMMARY BANNER */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 rounded-xl bg-indigo-500/5 border-2 border-indigo-500/20 shadow-inner">
          <div className="flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold uppercase text-indigo-400 tracking-wider flex items-center gap-1">
              <Banknote className="h-3 w-3" /> Monthly Payroll Outflow
            </span>
            <span className="text-xl font-extrabold font-mono text-foreground">
              ₹{summaryMetrics.totalPayroll.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Base Salary Commitment</span>
          </div>

          <div className="flex flex-col justify-center space-y-1">
            <span className="text-[10px] font-bold uppercase text-amber-500 tracking-wider flex items-center gap-1">
              <Utensils className="h-3 w-3" /> Meal Allowance Pool
            </span>
            <span className="text-xl font-extrabold font-mono text-amber-500">
              ₹{summaryMetrics.totalQuotaPool.toLocaleString()}
            </span>
            <span className="text-[10px] text-muted-foreground uppercase font-medium">Active Staff Allowance Quota</span>
          </div>

          <div className="flex flex-col justify-center space-y-1 bg-background/60 p-2.5 rounded-lg border border-border/40">
            <span className="text-[10px] font-bold uppercase text-emerald-400 tracking-wider flex items-center gap-1">
              <RotateCcw className="h-3 w-3" /> Next Cycle Reset
            </span>
            {summaryMetrics.upcomingReset ? (
              <div className="space-y-0.5">
                <span className="text-sm font-bold text-foreground truncate block">
                  {summaryMetrics.upcomingReset.empName} ({summaryMetrics.upcomingReset.ordinalDay})
                </span>
                <span className="text-xs font-mono font-bold text-emerald-400">
                  {summaryMetrics.upcomingReset.daysLeft === 0
                    ? 'Refreshes Today!'
                    : `In ${summaryMetrics.upcomingReset.daysLeft} Days (${summaryMetrics.upcomingReset.dateStr})`}
                </span>
              </div>
            ) : (
              <span className="text-xs font-bold text-muted-foreground">No active operators</span>
            )}
          </div>
        </div>

        {/* PER-EMPLOYEE CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {employees.map((emp, idx) => {
            const cycle = getCycleInfo(emp.joinDate);
            const remainingQuota = emp.foodAllowanceBalance ?? 1000;

            return (
              <div
                key={`${emp.username}-${idx}`}
                className="p-4 rounded-xl border-2 border-border/60 bg-muted/10 hover:border-indigo-500/40 transition-all space-y-4 shadow-sm"
              >
                {/* Employee Header */}
                <div className="flex items-center justify-between border-b border-border/40 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center font-extrabold text-base text-indigo-400 shadow-sm">
                      {emp.displayName[0]}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-sm text-foreground uppercase tracking-tight">{emp.displayName}</h4>
                        <Badge variant="outline" className="text-[10px] font-bold uppercase h-4 px-1.5 border-indigo-500/30 text-indigo-400">
                          {emp.role || 'staff'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">@{emp.username}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs font-mono font-bold">
                      {emp.attendancePct}% Attendance
                    </Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleOpenEdit(emp)}
                      className="h-8 px-2.5 font-bold uppercase text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                      title="Edit Operator Profile, Salary & Quota Reset Day"
                    >
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </Button>
                  </div>
                </div>

                {/* JOIN DATE & SALARY / QUOTA RESET CYCLE PANEL */}
                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20 space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-bold uppercase text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" />
                      Join Date: <strong className="text-foreground ml-1">{cycle.joinDateFormatted}</strong>
                    </span>
                    <Badge className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5", cycle.isToday ? "bg-emerald-500 text-white animate-pulse" : "bg-indigo-500/20 text-indigo-400 border-indigo-500/30")}>
                      Cycle Day: {cycle.ordinalDay} of month
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center text-xs pt-1 border-t border-indigo-500/10">
                    <span className="font-bold uppercase text-muted-foreground">Salary &amp; Quota Reset:</span>
                    <span className={cn("font-mono font-bold", cycle.isToday ? "text-emerald-400" : "text-foreground")}>
                      {cycle.isToday ? "Refreshes Today!" : `Next: ${cycle.nextResetFormatted} (${cycle.daysLeft}d left)`}
                    </span>
                  </div>
                </div>

                {/* SALARY & MEAL ALLOWANCE QUOTA */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30 flex flex-col justify-between">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1">
                      <Banknote className="h-3 w-3 text-indigo-400" /> Base Salary
                    </span>
                    <div className="mt-1">
                      <span className="text-base font-mono font-extrabold text-foreground">₹{(emp.salary || 6000).toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase block">/{emp.salaryType || 'monthly'}</span>
                    </div>
                  </div>

                  <div className="p-2.5 rounded-lg bg-background/50 border border-border/30 flex flex-col justify-between">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold flex items-center gap-1">
                      <Utensils className="h-3 w-3 text-amber-500" /> Meal Quota
                    </span>
                    <div className="mt-1">
                      <span className="text-base font-mono font-extrabold text-amber-500">₹{remainingQuota.toLocaleString()}</span>
                      <span className="text-[10px] text-muted-foreground font-semibold uppercase block">Resets on {cycle.ordinalDay}</span>
                    </div>
                  </div>
                </div>

                {/* PERFORMANCE STATS */}
                <div className="grid grid-cols-2 gap-3 text-xs font-medium pt-1 border-t border-border/40">
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold block">Revenue Billed</span>
                    <span className="text-sm font-extrabold text-foreground font-mono">₹{emp.revenueGenerated.toLocaleString()}</span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-muted-foreground text-[10px] uppercase font-bold block">Orders Processed</span>
                    <span className="text-sm font-extrabold text-foreground">{emp.ordersServed} orders</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-[11px] font-medium pt-1 text-muted-foreground">
                  <span>Shifts Worked: <strong className="text-foreground">{emp.shiftsWorked}</strong></span>
                  <span>Late Arrivals: <strong className={emp.lateArrivalsCount > 0 ? 'text-destructive font-bold' : 'text-emerald-400 font-bold'}>{emp.lateArrivalsCount}</strong></span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>

      {/* EDIT / ADD OPERATOR MODAL */}
      <Dialog
        open={!!editingEmp || isAddModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setEditingEmp(null);
            setIsAddModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto font-body border-2 shadow-2xl p-0">
          <DialogHeader className="p-5 pb-3 bg-muted/20 border-b">
            <DialogTitle className="font-headline text-lg uppercase tracking-tight flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              {editingEmp ? 'Edit Operator & Reset Cycle' : 'Add New Operator'}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              {editingEmp
                ? `Update profile, salary, and reset day for @${editingEmp.username}`
                : 'Create a new operator account and set their salary/quota refresh cycle.'}
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* Display Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Display Name</Label>
                <Input
                  value={formData.displayName}
                  onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                  placeholder="e.g. Eshaan"
                  className="h-10 text-xs font-bold uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Username</Label>
                <Input
                  value={formData.username}
                  onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                  placeholder="e.g. eshaan"
                  className="h-10 text-xs font-mono font-bold lowercase"
                />
              </div>
            </div>

            {/* Terminal PIN & Access Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Terminal PIN (4-Digit)</Label>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    maxLength={6}
                    placeholder="••••"
                    className="h-10 text-xs font-mono font-bold tracking-widest pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Access Role</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as any })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>

            {/* Shift Starts & Ends */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Shift Starts
                </Label>
                <Input
                  type="time"
                  value={formData.workStartTime}
                  onChange={(e) => setFormData({ ...formData, workStartTime: e.target.value })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Shift Ends
                </Label>
                <Input
                  type="time"
                  value={formData.workEndTime}
                  onChange={(e) => setFormData({ ...formData, workEndTime: e.target.value })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Salary Amount & Salary Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Salary Amount (₹)</Label>
                <Input
                  type="number"
                  value={formData.salary}
                  onChange={(e) => setFormData({ ...formData, salary: parseFloat(e.target.value) || 0 })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Salary Type</Label>
                <select
                  value={formData.salaryType}
                  onChange={(e) => setFormData({ ...formData, salaryType: e.target.value as any })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="monthly">Monthly Fixed</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>
            </div>

            {/* Working Days & Overtime Multiplier */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Working Days / Week</Label>
                <Input
                  type="number"
                  value={formData.workingDaysPerWeek}
                  onChange={(e) => setFormData({ ...formData, workingDaysPerWeek: parseInt(e.target.value, 10) || 6 })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Overtime Multiplier</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={formData.overtimeMultiplier}
                  onChange={(e) => setFormData({ ...formData, overtimeMultiplier: parseFloat(e.target.value) || 1.5 })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Weekly Off Day & JOIN DATE (Determines Salary & Quota Reset Day!) */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Weekly Off Day</Label>
                <select
                  value={formData.weekOffDay}
                  onChange={(e) => setFormData({ ...formData, weekOffDay: parseInt(e.target.value, 10) })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  {DAYS.map((day, i) => (
                    <option key={day} value={i}>{day}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1 text-indigo-400">
                  <Calendar className="h-3 w-3" /> Join Date (Salary &amp; Quota Reset)
                </Label>
                <Input
                  type="date"
                  value={formData.joinDate}
                  onChange={(e) => setFormData({ ...formData, joinDate: e.target.value })}
                  className="h-10 text-xs font-mono font-bold border-indigo-500/30"
                />
                <span className="text-[10px] text-muted-foreground font-semibold block">
                  Determines monthly salary &amp; quota reset day ({new Date(formData.joinDate || Date.now()).getDate()}th of every month).
                </span>
              </div>
            </div>

            {/* Assigned Shift & Grace Period */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Assigned Shift</Label>
                <select
                  value={formData.assignedShift}
                  onChange={(e) => setFormData({ ...formData, assignedShift: e.target.value })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Grace Period (Mins)</Label>
                <Input
                  type="number"
                  value={formData.gracePeriod}
                  onChange={(e) => setFormData({ ...formData, gracePeriod: parseInt(e.target.value, 10) || 5 })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Status & Meal Allowance Quota */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Status</Label>
                <select
                  value={formData.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setFormData({ ...formData, isActive: e.target.value === 'active' })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase text-amber-500">Meal Allowance Quota (₹)</Label>
                <Input
                  type="number"
                  value={formData.foodAllowanceBalance}
                  onChange={(e) => setFormData({ ...formData, foodAllowanceBalance: parseFloat(e.target.value) || 0 })}
                  className="h-10 text-xs font-mono font-bold border-amber-500/30"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setEditingEmp(null);
                setIsAddModalOpen(false);
              }}
              className="h-11 font-bold uppercase text-xs border-2 flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveProfile}
              disabled={isSubmitting}
              className="h-11 font-bold uppercase text-xs tracking-wider flex-[2] bg-destructive hover:bg-destructive/90 text-white shadow-xl"
            >
              APPLY PROFILE CHANGES
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
