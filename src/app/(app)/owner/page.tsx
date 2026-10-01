'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import type { Employee, Station, FoodItem, Shift, Member, SalaryAdjustment } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { 
  Crown, Sparkles, UserCheck, Utensils, Wallet, PackageCheck, 
  Layers, AlertTriangle, ShieldCheck, DollarSign, CheckCircle2, 
  Plus, Minus, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, 
  Calendar, FileSpreadsheet, Eye, TrendingDown, Clock, Building, Users,
  Pencil, Trash2, History, Receipt, ArrowDownCircle, ArrowUpCircle, EyeOff,
  UserX, Check
} from 'lucide-react';
import { AppUpdatesDropdown } from '@/components/owner/app-updates-dropdown';
import { ExecutiveExpensesHub } from '@/components/owner/executive-expenses-hub';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GuestLoginWizardModal } from '@/components/dashboard/guest-login-wizard-modal';
import { useToast } from '@/hooks/use-toast';
import { updateEmployee } from '@/firebase/firestore/employees';
import { updateStation } from '@/firebase/firestore/stations';
import { getSyncedDate } from '@/lib/synced-time';
import { PlaceHolderImages } from '@/lib/placeholder-images';
import { getCycleInfo } from '@/components/owner-pulse/owner-pulse-employee-intel';
import { cn } from '@/lib/utils';

export default function OwnerMainPage() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const router = useRouter();
  const { toast } = useToast();

  // Protect route so ONLY Viren (Owner) can access
  useEffect(() => {
    if (user && user.username !== 'Viren') {
      router.push('/dashboard');
    }
  }, [user, router]);

  // Firestore Subscriptions
  const employeesQuery = useMemo(() => (!db ? null : query(collection(db, 'employees'), where('isActive', '==', true))), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const stationsQuery = useMemo(() => (!db ? null : collection(db, 'stations')), [db]);
  const { data: stations } = useCollection<Station>(stationsQuery);

  const foodItemsQuery = useMemo(() => (!db ? null : collection(db, 'foodItems')), [db]);
  const { data: foodItems } = useCollection<FoodItem>(foodItemsQuery);

  const shiftsQuery = useMemo(() => (!db ? null : collection(db, 'shifts')), [db]);
  const { data: shifts } = useCollection<Shift>(shiftsQuery);

  // Automatically check and reset 1,000 food quota whenever an employee's salary cycle resets
  useEffect(() => {
    if (!employees || !db) return;

    employees.forEach(async (emp) => {
      if (!emp.id || !emp.username || emp.username.toLowerCase() === 'viren') return;
      const cycle = getCycleInfo(emp.joinDate);
      if (emp.lastQuotaResetCycle !== cycle.currentCycleKey) {
        try {
          await updateEmployee(emp.id, {
            foodAllowanceBalance: 1000,
            lastQuotaResetCycle: cycle.currentCycleKey,
          });

          await addDoc(collection(db, 'logs'), {
            type: 'STAFF_FOOD_ORDER',
            description: `Auto-refreshed monthly meal quota to <strong>₹1,000</strong> for <strong>${emp.displayName}</strong> linked to salary cycle (${cycle.currentCycleKey}).`,
            timestamp: new Date().toISOString(),
            user: { uid: 'system', displayName: 'System Auto-Cycle' }
          });
        } catch (e) {
          console.warn("Could not auto-refresh employee meal quota cycle on owner page:", e);
        }
      }
    });
  }, [employees, db]);

  // Modals & Dialog State
  const [isGuestWizardOpen, setIsGuestWizardOpen] = useState(false);
  
  // Employee Action Modals
  const [quotaEmployee, setQuotaEmployee] = useState<Employee | null>(null);
  const [quotaAmount, setQuotaAmount] = useState('1000');
  
  const [salaryEmployee, setSalaryEmployee] = useState<Employee | null>(null);
  const [salaryNote, setSalaryNote] = useState('');
  const [settleAdjustmentsWithSalary, setSettleAdjustmentsWithSalary] = useState(true);

  // Edit Employee State
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [showEditPin, setShowEditPin] = useState(false);
  const [isSavingEmployee, setIsSavingEmployee] = useState(false);
  const [editEmployeeForm, setEditEmployeeForm] = useState({
    displayName: '',
    username: '',
    role: 'staff' as 'admin' | 'staff' | 'guest',
    salary: 0,
    salaryType: 'monthly' as 'monthly' | 'hourly',
    foodAllowanceBalance: 1000,
    pin: '',
    workStartTime: '11:00',
    workEndTime: '23:00',
    weekOffDay: 5,
    joinDate: '',
    assignedShift: 'opening',
    isActive: true,
  });

  // Salary Adjustment / Advances / Deductions State
  const [adjustingEmployee, setAdjustingEmployee] = useState<Employee | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<'advance' | 'meal_overage' | 'deduction' | 'bonus'>('advance');
  const [adjustmentAmount, setAdjustmentAmount] = useState('');
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState(false);
  const [viewLedgerOnly, setViewLedgerOnly] = useState(false);
  const [editingAdjustment, setEditingAdjustment] = useState<SalaryAdjustment | null>(null);
  const [editAdjustmentAmount, setEditAdjustmentAmount] = useState('');
  const [editAdjustmentReason, setEditAdjustmentReason] = useState('');
  const [editAdjustmentType, setEditAdjustmentType] = useState<'advance' | 'meal_overage' | 'deduction' | 'bonus'>('advance');
  const [editAdjustmentStatus, setEditAdjustmentStatus] = useState<'active' | 'settled'>('active');
  const [isUpdatingAdjustment, setIsUpdatingAdjustment] = useState(false);

  // Attendance & Absent Tracking State
  const [attendanceEmployee, setAttendanceEmployee] = useState<Employee | null>(null);
  const [attendanceDate, setAttendanceDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [absentReason, setAbsentReason] = useState('Unexcused / Absent for shift');
  const [autoDeductAbsentSalary, setAutoDeductAbsentSalary] = useState(true);
  const [isMarkingAttendance, setIsMarkingAttendance] = useState(false);

  // Inventory Dialog State
  const [activeInventoryAction, setActiveInventoryAction] = useState<string | null>(null);
  const [inventoryItemName, setInventoryItemName] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('Food');
  const [inventoryQty, setInventoryQty] = useState('10');
  const [inventoryCost, setInventoryCost] = useState('500');
  const [inventoryReason, setInventoryReason] = useState('Regular Intake');

  // Payroll Dialog State
  const [activePayrollAction, setActivePayrollAction] = useState<string | null>(null);
  const [payrollEmpId, setPayrollEmpId] = useState('');
  const [payrollAmount, setPayrollAmount] = useState('500');
  const [payrollNote, setPayrollNote] = useState('');
  const [payrollResultView, setPayrollResultView] = useState<any>(null);

  if (!user || user.username !== 'Viren') {
    return (
      <div className="flex h-[70vh] flex-col items-center justify-center space-y-4 text-center font-body">
        <div className="h-10 w-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="font-headline text-sm uppercase tracking-[0.2em] text-muted-foreground animate-pulse">
          Authenticating Owner Access...
        </p>
      </div>
    );
  }

  // Handle Guest Wizard Station Assignment
  const handleAssignStationFromWizard = (
    station: Station,
    guestInfo: { name: string; phone: string; groupSize: string; member: Member | null; experience: string }
  ) => {
    const player = {
      id: guestInfo.member?.id || `guest-${Date.now()}`,
      name: guestInfo.name || guestInfo.member?.name || 'Walk-in Guest',
      avatarUrl: guestInfo.member?.avatarUrl || PlaceHolderImages.find(img => img.id === 'avatar-6')?.imageUrl || 'https://picsum.photos/seed/guest/100/100',
      status: 'active' as const,
      startTime: getSyncedDate().toISOString(),
      endTime: null,
    };

    updateStation(station.id, {
      status: 'in-use',
      members: [player],
      startTime: getSyncedDate().toISOString(),
      endTime: null,
      packageName: 'Guest Walk-in Session',
      currentBill: [],
      discount: 0,
    });

    setIsGuestWizardOpen(false);
    toast({
      title: "Guest Checked In",
      description: `Assigned ${player.name} (${guestInfo.groupSize} Guests) to ${station.name}.`,
    });
  };

  // 1. Employee Meal Quota Refresh
  const handleRefreshMealQuota = async () => {
    if (!quotaEmployee) return;
    const addedAmount = parseInt(quotaAmount, 10) || 1000;
    const newBalance = (quotaEmployee.foodAllowanceBalance || 0) + addedAmount;

    try {
      await updateEmployee(quotaEmployee.id, { foodAllowanceBalance: newBalance });
      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'STAFF_FOOD_ORDER',
          description: `Viren added ₹${addedAmount.toLocaleString()} meal quota for <strong>${quotaEmployee.displayName}</strong>. New balance: ₹${newBalance.toLocaleString()}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: "Meal Quota Refreshed",
        description: `Added ₹${addedAmount.toLocaleString()} to ${quotaEmployee.displayName}'s balance. New total: ₹${newBalance.toLocaleString()}.`,
      });
      setQuotaEmployee(null);
    } catch (err) {
      toast({ variant: 'destructive', title: "Quota Update Failed" });
    }
  };

  // Open Employee Edit Modal
  const handleOpenEdit = (emp: Employee) => {
    setEditingEmployee(emp);
    setShowEditPin(false);
    setEditEmployeeForm({
      displayName: emp.displayName || '',
      username: emp.username || '',
      role: emp.role || 'staff',
      salary: emp.salary || 0,
      salaryType: emp.salaryType || 'monthly',
      foodAllowanceBalance: emp.foodAllowanceBalance ?? 1000,
      pin: emp.pin || '1234',
      workStartTime: emp.workStartTime || '11:00',
      workEndTime: emp.workEndTime || '23:00',
      weekOffDay: emp.weekOffDay ?? 5,
      joinDate: emp.joinDate ? emp.joinDate.split('T')[0] : new Date().toISOString().split('T')[0],
      assignedShift: emp.assignedShift || 'opening',
      isActive: emp.isActive ?? true,
    });
  };

  // Save Employee Edit
  const handleSaveEmployeeEdit = async () => {
    if (!editingEmployee) return;
    if (!editEmployeeForm.displayName.trim() || !editEmployeeForm.username.trim() || !editEmployeeForm.pin.trim()) {
      toast({ variant: 'destructive', title: 'Missing required fields', description: 'Name, username and PIN are required.' });
      return;
    }

    setIsSavingEmployee(true);
    try {
      await updateEmployee(
        editingEmployee.id,
        {
          displayName: editEmployeeForm.displayName.trim(),
          username: editEmployeeForm.username.trim().toLowerCase(),
          role: editEmployeeForm.role,
          salary: Number(editEmployeeForm.salary) || 0,
          salaryType: editEmployeeForm.salaryType,
          foodAllowanceBalance: Number(editEmployeeForm.foodAllowanceBalance) || 0,
          pin: editEmployeeForm.pin.trim(),
          workStartTime: editEmployeeForm.workStartTime,
          workEndTime: editEmployeeForm.workEndTime,
          weekOffDay: editEmployeeForm.weekOffDay,
          joinDate: editEmployeeForm.joinDate,
          assignedShift: editEmployeeForm.assignedShift,
          isActive: editEmployeeForm.isActive,
        },
        {
          username: editingEmployee.username,
          pin: editingEmployee.pin,
        }
      );

      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'EMPLOYEE_UPDATED',
          description: `Viren updated details for employee <strong>${editEmployeeForm.displayName}</strong> (@${editEmployeeForm.username}). Salary: ₹${Number(editEmployeeForm.salary).toLocaleString()}, Quota: ₹${Number(editEmployeeForm.foodAllowanceBalance).toLocaleString()}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: 'Employee Updated',
        description: `Successfully updated ${editEmployeeForm.displayName}.`,
      });
      setEditingEmployee(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message || 'Could not update employee.' });
    } finally {
      setIsSavingEmployee(false);
    }
  };

  // Add Salary Adjustment (Advance / Meal Overage / Deduction / Bonus)
  const handleAddSalaryAdjustment = async () => {
    if (!adjustingEmployee) return;
    const amount = parseFloat(adjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }

    setIsSavingAdjustment(true);
    try {
      const newAdjustment: SalaryAdjustment = {
        id: `adj-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: adjustmentType,
        amount,
        reason: adjustmentReason.trim() || (adjustmentType === 'meal_overage' ? 'Meal quota exhausted - ordered food deduction' : `${adjustmentType.toUpperCase()} recorded`),
        date: new Date().toISOString(),
        status: 'active',
        addedBy: 'Viren (Owner)'
      };

      const existingAdjustments = adjustingEmployee.salaryAdjustments || [];
      const updatedAdjustments = [newAdjustment, ...existingAdjustments];

      await updateEmployee(adjustingEmployee.id, {
        salaryAdjustments: updatedAdjustments
      });

      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'SHIFT_UPDATED',
          description: `Viren recorded <strong>${adjustmentType.toUpperCase().replace('_', ' ')}</strong> of <strong>₹${amount.toLocaleString()}</strong> for <strong>${adjustingEmployee.displayName}</strong>. Reason: ${newAdjustment.reason}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: `${adjustmentType.toUpperCase().replace('_', ' ')} Recorded`,
        description: `Logged ₹${amount.toLocaleString()} for ${adjustingEmployee.displayName}.`,
      });

      // Keep dialog open in ledger mode to view updated list
      setAdjustingEmployee({
        ...adjustingEmployee,
        salaryAdjustments: updatedAdjustments
      });
      setAdjustmentAmount('');
      setAdjustmentReason('');
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Action Failed', description: err.message || 'Could not record adjustment.' });
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  // Start Editing an existing adjustment
  const handleStartEditAdjustment = (adj: SalaryAdjustment) => {
    setEditingAdjustment(adj);
    setEditAdjustmentAmount(adj.amount.toString());
    setEditAdjustmentReason(adj.reason || '');
    setEditAdjustmentType(adj.type);
    setEditAdjustmentStatus(adj.status || 'active');
  };

  // Save changes to an existing adjustment
  const handleSaveEditAdjustment = async () => {
    if (!adjustingEmployee || !editingAdjustment) return;
    const amount = parseFloat(editAdjustmentAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({ variant: 'destructive', title: 'Invalid Amount', description: 'Please enter a valid amount greater than 0.' });
      return;
    }

    setIsUpdatingAdjustment(true);
    try {
      const existingAdjustments = adjustingEmployee.salaryAdjustments || [];
      const updatedAdjustments = existingAdjustments.map((adj) => {
        if (adj.id === editingAdjustment.id) {
          return {
            ...adj,
            amount,
            reason: editAdjustmentReason.trim() || adj.reason,
            type: editAdjustmentType,
            status: editAdjustmentStatus,
            updatedAt: new Date().toISOString(),
          };
        }
        return adj;
      });

      await updateEmployee(adjustingEmployee.id, {
        salaryAdjustments: updatedAdjustments
      });

      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'SHIFT_UPDATED',
          description: `Viren updated salary ledger entry for <strong>${adjustingEmployee.displayName}</strong>: ${editAdjustmentType.toUpperCase().replace('_', ' ')} changed to ₹${amount.toLocaleString()} (${editAdjustmentStatus.toUpperCase()}). Reason: ${editAdjustmentReason.trim() || editingAdjustment.reason}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: 'Ledger Entry Updated',
        description: `Successfully modified ${editAdjustmentType.toUpperCase().replace('_', ' ')} record.`,
      });

      setAdjustingEmployee({
        ...adjustingEmployee,
        salaryAdjustments: updatedAdjustments
      });
      setEditingAdjustment(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Update Failed', description: err.message || 'Could not update entry.' });
    } finally {
      setIsUpdatingAdjustment(false);
    }
  };

  // Delete / Remove an adjustment
  const handleDeleteAdjustment = async (adjustmentId: string) => {
    if (!adjustingEmployee) return;
    try {
      const existingAdjustments = adjustingEmployee.salaryAdjustments || [];
      const updatedAdjustments = existingAdjustments.filter(a => a.id !== adjustmentId);

      await updateEmployee(adjustingEmployee.id, {
        salaryAdjustments: updatedAdjustments
      });

      toast({
        title: 'Adjustment Removed',
        description: 'The ledger entry was deleted successfully.',
      });

      setAdjustingEmployee({
        ...adjustingEmployee,
        salaryAdjustments: updatedAdjustments
      });
      if (editingAdjustment?.id === adjustmentId) {
        setEditingAdjustment(null);
      }
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'Delete Failed', description: err.message });
    }
  };

  // 2. Mark Salary Paid (With optional settlement of active advances/deductions)
  const handleMarkSalaryPaid = async () => {
    if (!salaryEmployee) return;
    const baseSalary = salaryEmployee.salary || 0;
    const adjustments = salaryEmployee.salaryAdjustments || [];
    const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
    const activeDeductions = adjustments.filter(a => a.status === 'active' && (a.type === 'deduction' || a.type === 'meal_overage')).reduce((s, a) => s + a.amount, 0);
    const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
    const netSalary = Math.max(0, baseSalary + activeBonuses - activeAdvances - activeDeductions);

    try {
      const cycle = getCycleInfo(salaryEmployee.joinDate);
      const settledTimestamp = new Date().toISOString();
      const updatedAdjustments = settleAdjustmentsWithSalary && adjustments.length > 0
        ? adjustments.map(a => a.status === 'active' ? { ...a, status: 'settled' as const, settledAt: settledTimestamp } : a)
        : adjustments;

      await updateEmployee(salaryEmployee.id, {
        foodAllowanceBalance: 1000,
        lastQuotaResetCycle: cycle.currentCycleKey,
        ...(settleAdjustmentsWithSalary && adjustments.length > 0 ? { salaryAdjustments: updatedAdjustments } : {})
      });

      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'SHIFT_UPDATED',
          description: `Viren marked salary as <strong>PAID</strong> for <strong>${salaryEmployee.displayName}</strong>. Net Paid: <strong>₹${netSalary.toLocaleString()}</strong> (Base: ₹${baseSalary.toLocaleString()}, Advances Settled: ₹${activeAdvances.toLocaleString()}, Deductions/Meal Overages Settled: ₹${activeDeductions.toLocaleString()}). Note: ${salaryNote || 'Salary cycle cleared'}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: "Salary Marked Paid",
        description: `Logged ₹${netSalary.toLocaleString()} net salary payment for ${salaryEmployee.displayName}.`,
      });
      setSalaryEmployee(null);
      setSalaryNote('');
    } catch (err) {
      toast({ variant: 'destructive', title: "Action Failed" });
    }
  };

  // 3. Mark Employee Absent
  const handleMarkAbsent = async () => {
    if (!attendanceEmployee || !db) return;
    setIsMarkingAttendance(true);

    try {
      const scheduledStart = attendanceEmployee.workStartTime || "11:00";
      const scheduledEnd = attendanceEmployee.workEndTime || "23:00";
      const [year, month, day] = attendanceDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      const [sh, sm] = scheduledStart.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);

      const strategicTask = {
        name: `Verify ${attendanceEmployee.displayName} Presence`,
        type: 'strategic' as const,
        ownerOnly: true,
        completed: true,
        verificationResult: 'no',
        completedAt: new Date().toISOString(),
        completedBy: { username: 'Viren', displayName: 'Viren (Owner)' }
      };

      const absentShift = {
        date: attendanceDate,
        staffId: attendanceEmployee.username,
        employeeId: attendanceEmployee.username,
        employees: [{ username: attendanceEmployee.username, displayName: attendanceEmployee.displayName }],
        startTime: start.toISOString(),
        status: 'completed' as const,
        tasks: [strategicTask],
        breaks: [],
        cycle: 'Live Cycle',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workedOnWeeklyOff: false,
        scheduledLogin: scheduledStart,
        actualLogin: null,
        scheduledLogout: scheduledEnd,
        actualLogout: null,
        totalHoursWorked: 0,
        attendanceStatus: 'Absent' as const,
        logoutMethod: null,
        forgotToLogout: false,
        notes: absentReason
      };

      // Check if a shift already exists for this staff on this date
      const existingShift = (shifts || []).find(
        (s) => (s.staffId === attendanceEmployee.username || s.employeeId === attendanceEmployee.username || s.employees?.some(e => e.username === attendanceEmployee.username)) && s.date === attendanceDate
      );

      if (existingShift?.id) {
        await updateDoc(doc(db, 'shifts', existingShift.id), {
          attendanceStatus: 'Absent',
          status: 'completed',
          tasks: [strategicTask],
          totalHoursWorked: 0,
          actualLogin: null,
          actualLogout: null,
          notes: absentReason
        });
      } else {
        await addDoc(collection(db, 'shifts'), absentShift);
      }

      // Calculate 1-day salary deduction based on paid week-off (30-day base)
      const monthlySalary = attendanceEmployee.salary || 0;
      const dailyAbsentDeduction = Math.round(monthlySalary / 30);

      let deductionApplied = false;
      if (autoDeductAbsentSalary && dailyAbsentDeduction > 0) {
        const absentAdjustment: SalaryAdjustment = {
          id: `adj-absent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          type: 'deduction',
          amount: dailyAbsentDeduction,
          reason: `Absent Day: ${attendanceDate} (-1 day salary @ ₹${dailyAbsentDeduction.toLocaleString()}/d, week-off paid base) - ${absentReason.trim() || 'Unexcused'}`,
          date: attendanceDate,
          status: 'active',
          addedBy: 'Viren (Owner)',
          updatedAt: new Date().toISOString()
        };

        const existingAdjustments = attendanceEmployee.salaryAdjustments || [];
        const updatedAdjustments = [...existingAdjustments, absentAdjustment];

        await updateEmployee(attendanceEmployee.id, {
          salaryAdjustments: updatedAdjustments
        });
        deductionApplied = true;
      }

      await addDoc(collection(db, 'logs'), {
        type: 'SHIFT_UPDATED',
        description: `Viren marked <strong>${attendanceEmployee.displayName}</strong> as <strong class="text-rose-400">ABSENT</strong> on <strong>${attendanceDate}</strong>.${deductionApplied ? ` Salary deduction of <strong class="text-rose-400">-₹${dailyAbsentDeduction.toLocaleString()}</strong> applied (₹${monthlySalary.toLocaleString()}/30, week-off paid).` : ''} Reason: ${absentReason}.`,
        timestamp: new Date().toISOString(),
        user: { uid: 'Viren', displayName: 'Viren (Owner)' }
      });

      toast({
        title: "Employee Marked Absent",
        description: `${attendanceEmployee.displayName} marked Absent for ${attendanceDate}.${deductionApplied ? ` Salary deducted: ₹${dailyAbsentDeduction.toLocaleString()} (1-day rate, week-off paid).` : ''}`,
      });

      setAttendanceEmployee(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: err.message });
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  // 4. Mark Employee Present manually if needed
  const handleMarkPresent = async () => {
    if (!attendanceEmployee || !db) return;
    setIsMarkingAttendance(true);

    try {
      const scheduledStart = attendanceEmployee.workStartTime || "11:00";
      const scheduledEnd = attendanceEmployee.workEndTime || "23:00";
      const [year, month, day] = attendanceDate.split('-').map(Number);
      const start = new Date(year, month - 1, day);
      const [sh, sm] = scheduledStart.split(':').map(Number);
      start.setHours(sh, sm, 0, 0);

      const end = new Date(year, month - 1, day);
      const [eh, em] = scheduledEnd.split(':').map(Number);
      end.setHours(eh, em, 0, 0);
      if (end < start) end.setDate(end.getDate() + 1);

      const strategicTask = {
        name: `Verify ${attendanceEmployee.displayName} Presence`,
        type: 'strategic' as const,
        ownerOnly: true,
        completed: true,
        verificationResult: 'yes',
        completedAt: new Date().toISOString(),
        completedBy: { username: 'Viren', displayName: 'Viren (Owner)' }
      };

      const presentShift = {
        date: attendanceDate,
        staffId: attendanceEmployee.username,
        employeeId: attendanceEmployee.username,
        employees: [{ username: attendanceEmployee.username, displayName: attendanceEmployee.displayName }],
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        status: 'completed' as const,
        tasks: [strategicTask],
        breaks: [],
        cycle: 'Live Cycle',
        lateMinutes: 0,
        earlyLeaveMinutes: 0,
        overtimeMinutes: 0,
        workedOnWeeklyOff: false,
        scheduledLogin: scheduledStart,
        actualLogin: scheduledStart,
        scheduledLogout: scheduledEnd,
        actualLogout: scheduledEnd,
        totalHoursWorked: Math.round(((end.getTime() - start.getTime()) / (1000 * 60 * 60)) * 10) / 10,
        attendanceStatus: 'Present' as const,
        logoutMethod: 'manual' as const,
        forgotToLogout: false
      };

      await addDoc(collection(db, 'shifts'), presentShift);

      await addDoc(collection(db, 'logs'), {
        type: 'SHIFT_UPDATED',
        description: `Viren marked <strong>${attendanceEmployee.displayName}</strong> as <strong class="text-emerald-400">PRESENT</strong> on <strong>${attendanceDate}</strong>.`,
        timestamp: new Date().toISOString(),
        user: { uid: 'Viren', displayName: 'Viren (Owner)' }
      });

      toast({
        title: "Employee Marked Present",
        description: `${attendanceEmployee.displayName} marked Present for ${attendanceDate}.`,
      });

      setAttendanceEmployee(null);
    } catch (err: any) {
      toast({ variant: 'destructive', title: "Action Failed", description: err.message });
    } finally {
      setIsMarkingAttendance(false);
    }
  };

  // 3. Inventory Quick Actions Handler
  const handleInventorySubmit = async () => {
    if (!activeInventoryAction || !db) return;
    const qty = parseInt(inventoryQty, 10) || 0;
    const cost = parseInt(inventoryCost, 10) || 0;

    try {
      if (activeInventoryAction === 'receive' || activeInventoryAction === 'po') {
        await addDoc(collection(db, 'inventoryPurchases'), {
          itemName: inventoryItemName || 'General Stock Intake',
          category: inventoryCategory,
          quantity: qty,
          unit: 'Units',
          totalCost: cost,
          unitCost: qty > 0 ? Math.round(cost / qty) : 0,
          purchaseDate: new Date().toISOString(),
          addedBy: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      } else if (activeInventoryAction === 'wastage') {
        await addDoc(collection(db, 'expenses'), {
          amount: cost,
          description: `Inventory Wastage: ${inventoryItemName || 'Stock Waste'} (${qty} units) - ${inventoryReason}`,
          category: 'Wastage',
          timestamp: new Date().toISOString(),
          addedBy: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      await addDoc(collection(db, 'logs'), {
        type: 'INVENTORY_PURCHASED',
        description: `Viren executed Inventory Action [${activeInventoryAction.toUpperCase()}]: ${inventoryItemName || 'Stock'} (${qty} qty, ₹${cost}).`,
        timestamp: new Date().toISOString(),
        user: { uid: 'Viren', displayName: 'Viren (Owner)' }
      });

      toast({
        title: `Action Recorded: ${activeInventoryAction.toUpperCase()}`,
        description: `Successfully logged ${inventoryItemName || 'stock item'} record.`,
      });
      setActiveInventoryAction(null);
    } catch (e) {
      toast({ variant: 'destructive', title: "Inventory Action Failed" });
    }
  };

  // 4. Payroll Quick Actions Handler
  const handlePayrollSubmit = async () => {
    if (!activePayrollAction || !db) return;
    const amt = parseInt(payrollAmount, 10) || 0;
    const targetEmp = employees?.find(e => e.id === payrollEmpId);
    const empName = targetEmp ? targetEmp.displayName : 'Staff Member';

    try {
      if (activePayrollAction === 'calculate') {
        const totalBase = (employees || []).reduce((s, e) => s + (e.salary || 0), 0);
        setPayrollResultView({
          title: 'Automated Monthly Payroll Calculation',
          totalStaff: (employees || []).length,
          totalBaseSalary: totalBase,
          estimatedPayout: totalBase,
        });
        return;
      }

      if (activePayrollAction === 'approve') {
        await addDoc(collection(db, 'logs'), {
          type: 'SHIFT_UPDATED',
          description: `Viren officially <strong>APPROVED</strong> the monthly staff payroll run.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
        toast({ title: "Payroll Approved", description: "Monthly workforce payroll run has been approved." });
        setActivePayrollAction(null);
        return;
      }

      await addDoc(collection(db, 'logs'), {
        type: 'SHIFT_UPDATED',
        description: `Payroll Action [${activePayrollAction.toUpperCase()}] for <strong>${empName}</strong>: ₹${amt.toLocaleString()}. Note: ${payrollNote || 'N/A'}.`,
        timestamp: new Date().toISOString(),
        user: { uid: 'Viren', displayName: 'Viren (Owner)' }
      });

      toast({
        title: `Payroll Action: ${activePayrollAction.toUpperCase()}`,
        description: `Logged ₹${amt.toLocaleString()} for ${empName}.`,
      });
      setActivePayrollAction(null);
    } catch (e) {
      toast({ variant: 'destructive', title: "Payroll Action Failed" });
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16 font-body">
      {/* HEADER BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/40 pb-6">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-4">
            <h1 className="font-pixel text-2xl md:text-3xl text-foreground flex items-center gap-3">
              <Crown className="h-8 w-8 text-primary fill-primary/20" />
              OWNER MAIN HUB
            </h1>
            <AppUpdatesDropdown />
          </div>
          <p className="text-muted-foreground font-bold uppercase tracking-[0.2em] text-xs pl-1">
            EXECUTIVE CONTROL CENTER &bull; VIREN HEADQUARTERS
          </p>
        </div>

        {/* PRIMARY GUEST LOGIN WIZARD TRIGGER */}
        <Button
          onClick={() => setIsGuestWizardOpen(true)}
          className="h-12 px-6 bg-gradient-to-r from-primary to-rose-600 hover:from-primary/90 hover:to-rose-700 text-white font-headline text-xs uppercase tracking-wider gap-3 shadow-xl hover:shadow-primary/30 transition-all rounded-xl shrink-0"
        >
          <UserCheck className="h-5 w-5" /> LAUNCH GUEST CHECK-IN WIZARD
        </Button>
      </div>

      {/* MINIMAL EXECUTIVE GRID */}
      <div className="space-y-8">
        {/* 0. EXECUTIVE EXPENSES & UPCOMING DUE DATES HUB */}
        <ExecutiveExpensesHub />

        {/* 1. EMPLOYEE & WORKFORCE CYCLE HUB (STAFF TEAM) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> TEAM STAFF &amp; SALARY CONTROLS
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-400 uppercase">
              {(employees || []).filter(e => e.username?.toLowerCase() !== 'viren').length} TEAM MEMBERS
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(employees || []).filter(e => e.username?.toLowerCase() !== 'viren').map((emp) => {
              const cycle = getCycleInfo(emp.joinDate);
              const dailyRate = Math.round((emp.salary || 0) / 30);
              const empAllShifts = (shifts || []).filter(
                (s) => s.staffId === emp.username || s.employeeId === emp.username || s.employees?.some(e => e.username === emp.username)
              );
              const absentShifts = empAllShifts.filter((s) => s.attendanceStatus === 'Absent');
              const absentCount = absentShifts.length;
              const totalAbsentShiftPenalty = absentCount * dailyRate;

              const adjustments = emp.salaryAdjustments || [];
              const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
              const activeMealOverages = adjustments.filter(a => a.status === 'active' && a.type === 'meal_overage').reduce((s, a) => s + a.amount, 0);
              const activeLedgerAbsentDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && (a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);
              const activeOtherDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && !(a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);

              const effectiveAbsentDeductions = activeLedgerAbsentDeductions > 0 ? activeLedgerAbsentDeductions : totalAbsentShiftPenalty;
              const totalDeductions = activeMealOverages + activeOtherDeductions + effectiveAbsentDeductions;
              const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
              const netSalary = Math.max(0, (emp.salary || 0) + activeBonuses - activeAdvances - totalDeductions);
              const hasAdjustments = (activeAdvances > 0 || totalDeductions > 0 || activeBonuses > 0);

              return (
                <Card id={`emp-card-${emp.id}`} key={emp.id} className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-md hover:border-primary/40 transition-all flex flex-col justify-between p-4 space-y-4">
                  {/* Top Bar: Name, Username, Role, Edit Button, Join Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-base uppercase text-foreground">{emp.displayName}</h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(emp)}
                          className="h-6 w-6 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-md"
                          title="Edit Employee Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground font-bold uppercase">@{emp.username} &bull; {emp.role}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase bg-primary/10 text-primary">
                        Join: {emp.joinDate ? emp.joinDate.split('T')[0] : 'N/A'}
                      </Badge>
                      <Badge className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5", cycle.isToday ? "bg-emerald-500 text-white animate-pulse" : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30")}>
                        {cycle.isToday ? "Salary Day Today!" : `${cycle.daysLeft} Days Till Salary`}
                      </Badge>
                    </div>
                  </div>

                  {/* DAYS TILL SALARY COUNTDOWN BANNER */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-xs font-mono">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Salary Day ({cycle.ordinalDay}):
                    </span>
                    <span className={cn("font-extrabold text-xs px-2 py-0.5 rounded", cycle.isToday ? "bg-emerald-500 text-white animate-pulse" : "text-indigo-400 bg-indigo-500/10")}>
                      {cycle.isToday ? "TODAY!" : `${cycle.daysLeft}d left (${cycle.nextResetFormatted})`}
                    </span>
                  </div>

                  {/* QUOTA & SALARY METRICS */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Meal Quota Balance</p>
                      <p className={cn("text-base font-extrabold", (emp.foodAllowanceBalance ?? 1000) <= 0 ? "text-rose-400" : "text-amber-400")}>
                        ₹{(emp.foodAllowanceBalance ?? 1000).toLocaleString()}
                      </p>
                      {(emp.foodAllowanceBalance ?? 1000) <= 0 && (
                        <span className="text-[9px] font-bold uppercase text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">Quota Empty</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Salary</p>
                      <p className="text-base font-extrabold text-emerald-400">₹{(emp.salary || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* ADVANCES & DEDUCTIONS BREAKDOWN STRIP */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-[11px] font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3 text-indigo-400" /> Net Payable Salary:
                      </span>
                      <span className="font-extrabold text-sm text-emerald-400">
                        ₹{netSalary.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
                      <span className="text-muted-foreground">Active Advances:</span>
                      <span className={cn("font-bold", activeAdvances > 0 ? "text-amber-400 font-extrabold" : "text-muted-foreground")}>
                        {activeAdvances > 0 ? `-₹${activeAdvances.toLocaleString()}` : '₹0'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Absent Deductions {absentCount > 0 && `(${absentCount}d @ ₹${dailyRate}/d)`}:
                      </span>
                      <span className={cn("font-bold", effectiveAbsentDeductions > 0 ? "text-rose-400 font-extrabold" : "text-muted-foreground")}>
                        {effectiveAbsentDeductions > 0 ? `-₹${effectiveAbsentDeductions.toLocaleString()}` : '₹0'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Meal Overages / Other:</span>
                      <span className={cn("font-bold", (activeMealOverages + activeOtherDeductions) > 0 ? "text-rose-400 font-extrabold" : "text-muted-foreground")}>
                        {(activeMealOverages + activeOtherDeductions) > 0 ? `-₹${(activeMealOverages + activeOtherDeductions).toLocaleString()}` : '₹0'}
                      </span>
                    </div>
                  </div>

                  {/* QUICK TRACKING ACTIONS: ADVANCE & DEDUCT */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(emp);
                        setAdjustmentType('advance');
                        setAdjustmentAmount('');
                        setAdjustmentReason('Salary Advance');
                        setViewLedgerOnly(false);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1 rounded-md px-1"
                    >
                      <ArrowUpCircle className="h-3 w-3" /> + Advance
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(emp);
                        setAdjustmentType('meal_overage');
                        setAdjustmentAmount('');
                        setAdjustmentReason('Finished meal quota - extra food ordered');
                        setViewLedgerOnly(false);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1 rounded-md px-1"
                    >
                      <ArrowDownCircle className="h-3 w-3" /> - Deduct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(emp);
                        setViewLedgerOnly(true);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 gap-1 rounded-md px-1"
                    >
                      <History className="h-3 w-3" /> Ledger ({adjustments.filter(a => a.status === 'active').length})
                    </Button>
                  </div>

                  {/* ATTENDANCE CONTROLS & TODAY'S STATUS */}
                  {(() => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const todayShift = empAllShifts.find((s) => s.date === todayStr);
                    const todayStatus = todayShift?.attendanceStatus || (todayShift ? 'Present' : 'Not Clocked In');
                    const isAbsent = todayStatus === 'Absent';
                    const isPresent = todayStatus === 'Present';

                    return (
                      <div className="space-y-1.5 p-2 rounded-lg bg-muted/20 border border-border/40 text-[11px] font-mono">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Today:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] uppercase font-bold px-1.5 py-0",
                                isAbsent
                                  ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                  : isPresent
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                  : "text-muted-foreground border-border/50"
                              )}
                            >
                              {todayStatus}
                            </Badge>
                          </div>

                          <div className="flex items-center gap-1">
                            <span className="text-[10px] uppercase font-bold text-muted-foreground">Absent:</span>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-mono font-bold px-1.5 py-0",
                                absentCount > 0
                                  ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                                  : "text-muted-foreground border-border/50"
                              )}
                            >
                              {absentCount} {absentCount === 1 ? 'Day' : 'Days'}
                              {absentCount > 0 && ` (-₹${(absentCount * dailyRate).toLocaleString()})`}
                            </Badge>
                          </div>
                        </div>

                        <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[9px] text-muted-foreground">
                          <span>Rate: ₹{dailyRate.toLocaleString()}/d (Week-off paid)</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setAttendanceEmployee(emp);
                              setAttendanceDate(new Date().toISOString().slice(0, 10));
                              setAbsentReason('Unexcused / Absent for shift');
                              setAutoDeductAbsentSalary(true);
                            }}
                            className="h-6 text-[10px] font-bold uppercase hover:bg-indigo-500/10 text-indigo-400 gap-1 px-2"
                          >
                            <UserCheck className="h-3 w-3" /> Attendance / Mark Absent
                          </Button>
                        </div>
                      </div>
                    );
                  })()}

                  {/* REFRESH QUOTA & MARK SALARY PAID */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setQuotaEmployee(emp); setQuotaAmount('1000'); }}
                      className="h-9 text-[11px] font-bold uppercase border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1 rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5" /> Refresh Quota
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setSalaryEmployee(emp); setSalaryNote(''); setSettleAdjustmentsWithSalary(true); }}
                      className="h-9 text-[11px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-lg shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Salary Paid
                    </Button>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        {/* 2. OWNER EXECUTIVE PROFILE SECTION (VIREN) */}
        {(() => {
          const ownerEmp = (employees || []).find(e => e.username?.toLowerCase() === 'viren');
          if (!ownerEmp) return null;

          const cycle = getCycleInfo(ownerEmp.joinDate);
          const dailyRate = Math.round((ownerEmp.salary || 0) / 30);
          const empAllShifts = (shifts || []).filter(
            (s) => s.staffId === ownerEmp.username || s.employeeId === ownerEmp.username || s.employees?.some(e => e.username === ownerEmp.username)
          );
          const absentShifts = empAllShifts.filter((s) => s.attendanceStatus === 'Absent');
          const absentCount = absentShifts.length;
          const totalAbsentShiftPenalty = absentCount * dailyRate;

          const adjustments = ownerEmp.salaryAdjustments || [];
          const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
          const activeMealOverages = adjustments.filter(a => a.status === 'active' && a.type === 'meal_overage').reduce((s, a) => s + a.amount, 0);
          const activeLedgerAbsentDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && (a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);
          const activeOtherDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && !(a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);

          const effectiveAbsentDeductions = activeLedgerAbsentDeductions > 0 ? activeLedgerAbsentDeductions : totalAbsentShiftPenalty;
          const totalDeductions = activeMealOverages + activeOtherDeductions + effectiveAbsentDeductions;
          const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
          const netSalary = Math.max(0, (ownerEmp.salary || 0) + activeBonuses - activeAdvances - totalDeductions);

          const todayStr = new Date().toISOString().slice(0, 10);
          const todayShift = empAllShifts.find((s) => s.date === todayStr);
          const todayStatus = todayShift?.attendanceStatus || (todayShift ? 'Present' : 'Not Clocked In');
          const isAbsent = todayStatus === 'Absent';
          const isPresent = todayStatus === 'Present';

          return (
            <section className="space-y-3">
              <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-400 flex items-center gap-2">
                  <Crown className="h-4 w-4 text-amber-400 fill-amber-400/20" /> OWNER &bull; EXECUTIVE PROFILE
                </h2>
                <Badge className="text-[10px] font-mono font-bold border-amber-500/40 bg-amber-500/10 text-amber-400 uppercase">
                  HEADQUARTERS / FOUNDER
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-2 border-amber-500/40 bg-card/90 backdrop-blur-md shadow-xl hover:border-amber-500/70 transition-all flex flex-col justify-between p-4 space-y-4">
                  {/* Top Bar: Name, Edit, Join Date */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Crown className="h-4 w-4 text-amber-400 fill-amber-400/30" />
                        <h3 className="font-extrabold text-base uppercase text-foreground">{ownerEmp.displayName}</h3>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => handleOpenEdit(ownerEmp)}
                          className="h-6 w-6 text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 rounded-md"
                          title="Edit Owner Details"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <p className="text-xs text-amber-400/80 font-bold uppercase">@{ownerEmp.username} &bull; OWNER / ADMIN</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase bg-amber-500/10 text-amber-400 border border-amber-500/30">
                        Join: {ownerEmp.joinDate ? ownerEmp.joinDate.split('T')[0] : 'N/A'}
                      </Badge>
                      <Badge className={cn("text-[10px] font-mono font-bold uppercase px-2 py-0.5", cycle.isToday ? "bg-emerald-500 text-white animate-pulse" : "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30")}>
                        {cycle.isToday ? "Salary Day Today!" : `${cycle.daysLeft} Days Till Salary`}
                      </Badge>
                    </div>
                  </div>

                  {/* DAYS TILL SALARY COUNTDOWN BANNER */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20 text-xs font-mono">
                    <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-amber-400" /> Salary Day ({cycle.ordinalDay}):
                    </span>
                    <span className={cn("font-extrabold text-xs px-2 py-0.5 rounded", cycle.isToday ? "bg-emerald-500 text-white animate-pulse" : "text-amber-400 bg-amber-500/10")}>
                      {cycle.isToday ? "TODAY!" : `${cycle.daysLeft}d left (${cycle.nextResetFormatted})`}
                    </span>
                  </div>

                  {/* QUOTA & SALARY METRICS */}
                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Meal Quota Balance</p>
                      <p className={cn("text-base font-extrabold", (ownerEmp.foodAllowanceBalance ?? 1000) <= 0 ? "text-rose-400" : "text-amber-400")}>
                        ₹{(ownerEmp.foodAllowanceBalance ?? 1000).toLocaleString()}
                      </p>
                      {(ownerEmp.foodAllowanceBalance ?? 1000) <= 0 && (
                        <span className="text-[9px] font-bold uppercase text-rose-400 bg-rose-500/10 px-1 py-0.5 rounded">Quota Empty</span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Salary</p>
                      <p className="text-base font-extrabold text-emerald-400">₹{(ownerEmp.salary || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  {/* ADVANCES & DEDUCTIONS BREAKDOWN STRIP */}
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-[11px] font-mono space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3 text-indigo-400" /> Net Payable Salary:
                      </span>
                      <span className="font-extrabold text-sm text-emerald-400">
                        ₹{netSalary.toLocaleString()}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] pt-1 border-t border-border/30">
                      <span className="text-muted-foreground">Active Advances:</span>
                      <span className={cn("font-bold", activeAdvances > 0 ? "text-amber-400 font-extrabold" : "text-muted-foreground")}>
                        {activeAdvances > 0 ? `-₹${activeAdvances.toLocaleString()}` : '₹0'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground flex items-center gap-1">
                        Absent Deductions {absentCount > 0 && `(${absentCount}d @ ₹${dailyRate}/d)`}:
                      </span>
                      <span className={cn("font-bold", effectiveAbsentDeductions > 0 ? "text-rose-400 font-extrabold" : "text-muted-foreground")}>
                        {effectiveAbsentDeductions > 0 ? `-₹${effectiveAbsentDeductions.toLocaleString()}` : '₹0'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-muted-foreground">Meal Overages / Other:</span>
                      <span className={cn("font-bold", (activeMealOverages + activeOtherDeductions) > 0 ? "text-rose-400 font-extrabold" : "text-muted-foreground")}>
                        {(activeMealOverages + activeOtherDeductions) > 0 ? `-₹${(activeMealOverages + activeOtherDeductions).toLocaleString()}` : '₹0'}
                      </span>
                    </div>
                  </div>

                  {/* QUICK TRACKING ACTIONS: ADVANCE & DEDUCT */}
                  <div className="grid grid-cols-3 gap-1.5">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(ownerEmp);
                        setAdjustmentType('advance');
                        setAdjustmentAmount('');
                        setAdjustmentReason('Salary Advance');
                        setViewLedgerOnly(false);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1 rounded-md px-1"
                    >
                      <ArrowUpCircle className="h-3 w-3" /> + Advance
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(ownerEmp);
                        setAdjustmentType('meal_overage');
                        setAdjustmentAmount('');
                        setAdjustmentReason('Finished meal quota - extra food ordered');
                        setViewLedgerOnly(false);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-rose-500/30 text-rose-400 hover:bg-rose-500/10 gap-1 rounded-md px-1"
                    >
                      <ArrowDownCircle className="h-3 w-3" /> - Deduct
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setAdjustingEmployee(ownerEmp);
                        setViewLedgerOnly(true);
                      }}
                      className="h-8 text-[10px] font-bold uppercase border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 gap-1 rounded-md px-1"
                    >
                      <History className="h-3 w-3" /> Ledger ({adjustments.filter(a => a.status === 'active').length})
                    </Button>
                  </div>

                  {/* ATTENDANCE CONTROLS & TODAY'S STATUS */}
                  <div className="space-y-1.5 p-2 rounded-lg bg-muted/20 border border-border/40 text-[11px] font-mono">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Today:</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] uppercase font-bold px-1.5 py-0",
                            isAbsent
                              ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                              : isPresent
                              ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                              : "text-muted-foreground border-border/50"
                          )}
                        >
                          {todayStatus}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-1">
                        <span className="text-[10px] uppercase font-bold text-muted-foreground">Absent:</span>
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-[10px] font-mono font-bold px-1.5 py-0",
                            absentCount > 0
                              ? "bg-rose-500/15 text-rose-400 border-rose-500/30"
                              : "text-muted-foreground border-border/50"
                          )}
                        >
                          {absentCount} {absentCount === 1 ? 'Day' : 'Days'}
                          {absentCount > 0 && ` (-₹${(absentCount * dailyRate).toLocaleString()})`}
                        </Badge>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-border/20 text-[9px] text-muted-foreground">
                      <span>Rate: ₹{dailyRate.toLocaleString()}/d (Week-off paid)</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setAttendanceEmployee(ownerEmp);
                          setAttendanceDate(new Date().toISOString().slice(0, 10));
                          setAbsentReason('Unexcused / Absent for shift');
                          setAutoDeductAbsentSalary(true);
                        }}
                        className="h-6 text-[10px] font-bold uppercase hover:bg-amber-500/10 text-amber-400 gap-1 px-2"
                      >
                        <UserCheck className="h-3 w-3" /> Attendance / Mark Absent
                      </Button>
                    </div>
                  </div>

                  {/* REFRESH QUOTA & MARK SALARY PAID */}
                  <div className="grid grid-cols-2 gap-2 pt-1 border-t border-border/30">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setQuotaEmployee(ownerEmp); setQuotaAmount('1000'); }}
                      className="h-9 text-[11px] font-bold uppercase border-amber-500/30 text-amber-400 hover:bg-amber-500/10 gap-1 rounded-lg"
                    >
                      <Plus className="h-3.5 w-3.5" /> Refresh Quota
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setSalaryEmployee(ownerEmp); setSalaryNote(''); setSettleAdjustmentsWithSalary(true); }}
                      className="h-9 text-[11px] font-bold uppercase bg-emerald-600 hover:bg-emerald-700 text-white gap-1 rounded-lg shadow-sm"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Salary Paid
                    </Button>
                  </div>
                </Card>
              </div>
            </section>
          );
        })()}

        {/* 2. CAFÉ & INVENTORY CONTROLS (MINIMAL QUICK ACTIONS GRID) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Utensils className="h-4 w-4 text-primary" /> CAFÉ &amp; INVENTORY CONTROL HUB
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-primary/30 text-primary uppercase">
              7 INVENTORY ACTIONS
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('receive'); setInventoryItemName(''); setInventoryQty('10'); setInventoryCost('500'); }}
              className="h-24 flex-col gap-2 border-2 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <PackageCheck className="h-6 w-6" /> Receive Stock
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('count'); }}
              className="h-24 flex-col gap-2 border-2 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <Layers className="h-6 w-6" /> Stock Count
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('wastage'); setInventoryItemName(''); setInventoryQty('1'); setInventoryCost('100'); }}
              className="h-24 flex-col gap-2 border-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <TrendingDown className="h-6 w-6" /> Wastage
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('adjustment'); }}
              className="h-24 flex-col gap-2 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <RefreshCw className="h-6 w-6" /> Stock Adjust
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('po'); setInventoryItemName(''); setInventoryQty('50'); setInventoryCost('2500'); }}
              className="h-24 flex-col gap-2 border-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-purple-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <FileText className="h-6 w-6" /> Purchase Order
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('low-stock'); }}
              className="h-24 flex-col gap-2 border-2 border-rose-500/30 bg-rose-500/5 hover:bg-rose-500/15 text-rose-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <AlertTriangle className="h-6 w-6" /> Low Stock
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActiveInventoryAction('cost-price'); }}
              className="h-24 flex-col gap-2 border-2 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <DollarSign className="h-6 w-6" /> Update Cost
            </Button>
          </div>
        </section>

        {/* 3. PAYROLL ACTION HUB (MINIMAL QUICK ACTIONS GRID) */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Wallet className="h-4 w-4 text-emerald-400" /> PAYROLL ACTION HUB
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-400 uppercase">
              8 PAYROLL ACTIONS
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <Button
              variant="outline"
              onClick={() => handlePayrollSubmit()}
              onMouseDown={() => setActivePayrollAction('calculate')}
              className="h-24 flex-col gap-2 border-2 border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/15 text-emerald-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <Sparkles className="h-6 w-6" /> Calculate
            </Button>

            <Button
              variant="outline"
              onClick={() => setActivePayrollAction('review')}
              className="h-24 flex-col gap-2 border-2 border-blue-500/30 bg-blue-500/5 hover:bg-blue-500/15 text-blue-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <Eye className="h-6 w-6" /> Review
            </Button>

            <Button
              variant="outline"
              onClick={() => setActivePayrollAction('approve')}
              className="h-24 flex-col gap-2 border-2 border-indigo-500/30 bg-indigo-500/5 hover:bg-indigo-500/15 text-indigo-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <CheckCircle2 className="h-6 w-6" /> Approve
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActivePayrollAction('advance'); setPayrollAmount('500'); setPayrollEmpId(employees?.[0]?.id || ''); }}
              className="h-24 flex-col gap-2 border-2 border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <ArrowUpRight className="h-6 w-6" /> Advance
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActivePayrollAction('deduction'); setPayrollAmount('200'); setPayrollEmpId(employees?.[0]?.id || ''); }}
              className="h-24 flex-col gap-2 border-2 border-destructive/30 bg-destructive/5 hover:bg-destructive/15 text-destructive font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <ArrowDownRight className="h-6 w-6" /> Deduction
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActivePayrollAction('bonus'); setPayrollAmount('1000'); setPayrollEmpId(employees?.[0]?.id || ''); }}
              className="h-24 flex-col gap-2 border-2 border-yellow-500/30 bg-yellow-500/5 hover:bg-yellow-500/15 text-yellow-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <Crown className="h-6 w-6" /> Bonus
            </Button>

            <Button
              variant="outline"
              onClick={() => { setActivePayrollAction('mark-paid'); setPayrollEmpId(employees?.[0]?.id || ''); }}
              className="h-24 flex-col gap-2 border-2 border-teal-500/30 bg-teal-500/5 hover:bg-teal-500/15 text-teal-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <DollarSign className="h-6 w-6" /> Mark Paid
            </Button>

            <Button
              variant="outline"
              onClick={() => setActivePayrollAction('payslip')}
              className="h-24 flex-col gap-2 border-2 border-purple-500/30 bg-purple-500/5 hover:bg-purple-500/15 text-purple-400 font-bold uppercase text-xs rounded-xl shadow-sm"
            >
              <FileSpreadsheet className="h-6 w-6" /> Payslip
            </Button>
          </div>
        </section>
      </div>

      {/* GUEST CHECK-IN WIZARD MODAL */}
      <GuestLoginWizardModal
        isOpen={isGuestWizardOpen}
        onOpenChange={setIsGuestWizardOpen}
        stations={stations || []}
        onAssignStation={handleAssignStationFromWizard}
      />

      {/* DIALOG 1: REFRESH MEAL QUOTA */}
      <Dialog open={!!quotaEmployee} onOpenChange={(open) => !open && setQuotaEmployee(null)}>
        <DialogContent className="sm:max-w-md font-body border-2 border-primary/20">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl text-foreground flex items-center gap-2">
              <Utensils className="h-5 w-5 text-amber-400" />
              ADD MONTHLY MEAL QUOTA
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Add food allowance balance for {quotaEmployee?.displayName} (@{quotaEmployee?.username}).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Quota Amount to Add (₹)</Label>
              <Input
                type="number"
                value={quotaAmount}
                onChange={(e) => setQuotaAmount(e.target.value)}
                className="h-10 font-mono font-bold text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setQuotaEmployee(null)}>Cancel</Button>
            <Button onClick={handleRefreshMealQuota} className="bg-amber-500 hover:bg-amber-600 text-black font-bold uppercase">
              Add ₹{quotaAmount} Quota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 2: MARK SALARY PAID */}
      <Dialog open={!!salaryEmployee} onOpenChange={(open) => !open && setSalaryEmployee(null)}>
        <DialogContent className="sm:max-w-md font-body border-2 border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-400" />
              MARK SALARY PAID
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Confirm monthly salary payout for {salaryEmployee?.displayName} (@{salaryEmployee?.username}).
            </DialogDescription>
          </DialogHeader>

          {salaryEmployee && (() => {
            const baseSalary = salaryEmployee.salary || 0;
            const dailyRate = Math.round(baseSalary / 30);
            const empShifts = (shifts || []).filter(
              (s) => s.staffId === salaryEmployee.username || s.employeeId === salaryEmployee.username || s.employees?.some(e => e.username === salaryEmployee.username)
            );
            const absentCount = empShifts.filter(s => s.attendanceStatus === 'Absent').length;
            const shiftAbsentPenalty = absentCount * dailyRate;

            const adjustments = salaryEmployee.salaryAdjustments || [];
            const activeAdvances = adjustments.filter(a => a.status === 'active' && a.type === 'advance').reduce((s, a) => s + a.amount, 0);
            const activeMealOverages = adjustments.filter(a => a.status === 'active' && a.type === 'meal_overage').reduce((s, a) => s + a.amount, 0);
            const activeLedgerAbsentDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && (a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);
            const activeOtherDeductions = adjustments.filter(a => a.status === 'active' && a.type === 'deduction' && !(a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent'))).reduce((s, a) => s + a.amount, 0);

            const effectiveAbsentDeductions = activeLedgerAbsentDeductions > 0 ? activeLedgerAbsentDeductions : shiftAbsentPenalty;
            const totalDeductions = activeMealOverages + activeOtherDeductions + effectiveAbsentDeductions;
            const activeBonuses = adjustments.filter(a => a.status === 'active' && a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
            const netSalary = Math.max(0, baseSalary + activeBonuses - activeAdvances - totalDeductions);

            return (
              <div className="space-y-4 py-2 text-xs">
                {/* Net Salary Summary Card */}
                <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 font-mono space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-muted-foreground">Base Salary:</span>
                    <span className="font-bold text-foreground">₹{baseSalary.toLocaleString()}</span>
                  </div>
                  {activeAdvances > 0 && (
                    <div className="flex justify-between items-center text-xs text-amber-400">
                      <span>- Salary Advances to Settle:</span>
                      <span className="font-bold">-₹{activeAdvances.toLocaleString()}</span>
                    </div>
                  )}
                  {effectiveAbsentDeductions > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-400">
                      <span>- Absent Deductions {absentCount > 0 && `(${absentCount}d @ ₹${dailyRate}/d)`}:</span>
                      <span className="font-bold">-₹{effectiveAbsentDeductions.toLocaleString()}</span>
                    </div>
                  )}
                  {(activeMealOverages + activeOtherDeductions) > 0 && (
                    <div className="flex justify-between items-center text-xs text-rose-400">
                      <span>- Meal Overages &amp; Deductions:</span>
                      <span className="font-bold">-₹{(activeMealOverages + activeOtherDeductions).toLocaleString()}</span>
                    </div>
                  )}
                  {activeBonuses > 0 && (
                    <div className="flex justify-between items-center text-xs text-emerald-400">
                      <span>+ Active Bonuses:</span>
                      <span className="font-bold">+₹{activeBonuses.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="border-t border-emerald-500/30 pt-2 flex justify-between items-center">
                    <span className="font-bold uppercase text-foreground">Final Net Payable:</span>
                    <span className="text-base font-extrabold text-emerald-400">₹{netSalary.toLocaleString()}</span>
                  </div>
                </div>

                {/* Settle Adjustments Checkbox */}
                {(activeAdvances > 0 || totalDeductions > 0 || activeBonuses > 0) && (
                  <label className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/40 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settleAdjustmentsWithSalary}
                      onChange={(e) => setSettleAdjustmentsWithSalary(e.target.checked)}
                      className="rounded border-border accent-emerald-500 h-4 w-4"
                    />
                    <span className="text-[11px] font-bold text-foreground">
                      Mark all active advances &amp; meal deductions as <strong className="text-emerald-400">SETTLED</strong> for this cycle
                    </span>
                  </label>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase">Payment Note / Reference</Label>
                  <Input
                    placeholder="e.g. UPI transfer #987654 / Month cleared"
                    value={salaryNote}
                    onChange={(e) => setSalaryNote(e.target.value)}
                    className="h-10 font-bold text-sm"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter>
            <Button variant="outline" onClick={() => setSalaryEmployee(null)}>Cancel</Button>
            <Button onClick={handleMarkSalaryPaid} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase">
              Confirm Salary Paid
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 3: INVENTORY ACTION DIALOG */}
      <Dialog open={!!activeInventoryAction} onOpenChange={(open) => !open && setActiveInventoryAction(null)}>
        <DialogContent className="sm:max-w-md font-body border-2 border-primary/20">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl uppercase flex items-center gap-2 text-foreground">
              <PackageCheck className="h-5 w-5 text-primary" />
              CAFÉ INVENTORY: {activeInventoryAction?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Execute inventory operation for bistro kitchen &amp; retail items.
            </DialogDescription>
          </DialogHeader>

          {(activeInventoryAction === 'receive' || activeInventoryAction === 'wastage' || activeInventoryAction === 'po') && (
            <div className="space-y-4 py-2 text-xs">
              <div className="space-y-1.5">
                <Label className="font-bold uppercase">Item Name</Label>
                <Input
                  placeholder="e.g. Campa Cola 250ml / Fries 1kg"
                  value={inventoryItemName}
                  onChange={(e) => setInventoryItemName(e.target.value)}
                  className="h-10 font-bold text-sm"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Quantity</Label>
                  <Input
                    type="number"
                    value={inventoryQty}
                    onChange={(e) => setInventoryQty(e.target.value)}
                    className="h-10 font-mono font-bold text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Total Cost (₹)</Label>
                  <Input
                    type="number"
                    value={inventoryCost}
                    onChange={(e) => setInventoryCost(e.target.value)}
                    className="h-10 font-mono font-bold text-sm"
                  />
                </div>
              </div>

              {activeInventoryAction === 'wastage' && (
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Wastage Reason</Label>
                  <Input
                    placeholder="Expired / Spoiled / Damaged"
                    value={inventoryReason}
                    onChange={(e) => setInventoryReason(e.target.value)}
                    className="h-10 font-bold text-sm"
                  />
                </div>
              )}
            </div>
          )}

          {(activeInventoryAction === 'count' || activeInventoryAction === 'adjustment' || activeInventoryAction === 'low-stock' || activeInventoryAction === 'cost-price') && (
            <div className="py-4 text-center space-y-3">
              <p className="text-xs uppercase font-bold text-muted-foreground">
                Current Inventory Audit: {(foodItems || []).length} Menu &amp; Retail Items Tracked.
              </p>
              <div className="p-3 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono text-left space-y-1 max-h-48 overflow-y-auto">
                {(foodItems || []).map((item) => (
                  <div key={item.id} className="flex justify-between py-1 border-b border-border/20">
                    <span className="font-bold uppercase">{item.name}</span>
                    <span className="text-emerald-400">₹{item.price}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setActiveInventoryAction(null)}>Close</Button>
            {(activeInventoryAction === 'receive' || activeInventoryAction === 'wastage' || activeInventoryAction === 'po') && (
              <Button onClick={handleInventorySubmit} className="font-bold uppercase">Submit {activeInventoryAction}</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 4: PAYROLL ACTION DIALOG */}
      <Dialog open={!!activePayrollAction} onOpenChange={(open) => !open && setActivePayrollAction(null)}>
        <DialogContent className="sm:max-w-md font-body border-2 border-emerald-500/30">
          <DialogHeader>
            <DialogTitle className="font-headline text-xl uppercase flex items-center gap-2 text-foreground">
              <Wallet className="h-5 w-5 text-emerald-400" />
              PAYROLL ACTION: {activePayrollAction?.toUpperCase()}
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Execute workforce salary and payroll operations.
            </DialogDescription>
          </DialogHeader>

          {payrollResultView ? (
            <div className="py-4 space-y-3 font-mono text-xs">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-2">
                <p className="font-bold text-sm text-emerald-400 uppercase">{payrollResultView.title}</p>
                <div className="flex justify-between">
                  <span>Total Active Staff:</span>
                  <span className="font-bold">{payrollResultView.totalStaff}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span>Total Monthly Base Payout:</span>
                  <span className="font-extrabold text-emerald-400">₹{payrollResultView.totalBaseSalary.toLocaleString()}</span>
                </div>
              </div>
            </div>
          ) : (
            (activePayrollAction === 'advance' || activePayrollAction === 'deduction' || activePayrollAction === 'bonus' || activePayrollAction === 'mark-paid') && (
              <div className="space-y-4 py-2 text-xs">
                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Select Staff Member</Label>
                  <Select value={payrollEmpId} onValueChange={setPayrollEmpId}>
                    <SelectTrigger className="h-10 font-bold uppercase">
                      <SelectValue placeholder="Select staff..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(employees || []).map((emp) => (
                        <SelectItem key={emp.id} value={emp.id} className="font-bold uppercase">
                          {emp.displayName} (@{emp.username})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Amount (₹)</Label>
                  <Input
                    type="number"
                    value={payrollAmount}
                    onChange={(e) => setPayrollAmount(e.target.value)}
                    className="h-10 font-mono font-bold text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="font-bold uppercase">Note / Reason</Label>
                  <Input
                    placeholder="e.g. Festival advance / Performance bonus / Fine"
                    value={payrollNote}
                    onChange={(e) => setPayrollNote(e.target.value)}
                    className="h-10 font-bold text-sm"
                  />
                </div>
              </div>
            )
          )}

          {(activePayrollAction === 'review' || activePayrollAction === 'payslip') && (
            <div className="py-4 space-y-3 font-mono text-xs">
              <div className="p-3 rounded-lg bg-muted/20 border border-border/40 space-y-2">
                <p className="font-bold uppercase text-foreground">Monthly Workforce Payout Summary</p>
                {(employees || []).map((emp) => (
                  <div key={emp.id} className="flex justify-between py-1 border-b border-border/20">
                    <span>{emp.displayName}</span>
                    <span className="font-bold text-emerald-400">₹{(emp.salary || 0).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setActivePayrollAction(null); setPayrollResultView(null); }}>Close</Button>
            {activePayrollAction !== 'review' && activePayrollAction !== 'payslip' && (
              <Button onClick={handlePayrollSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold uppercase">
                Confirm {activePayrollAction}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 5: EDIT EMPLOYEE PROFILE */}
      <Dialog open={!!editingEmployee} onOpenChange={(open) => !open && setEditingEmployee(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-xl max-h-[90vh] overflow-y-auto font-body border-2 border-primary/30 p-0 shadow-2xl">
          <DialogHeader className="p-5 pb-3 bg-muted/20 border-b">
            <DialogTitle className="font-headline text-lg uppercase tracking-tight flex items-center gap-2 text-foreground">
              <Pencil className="h-5 w-5 text-primary" />
              EDIT OPERATOR &amp; SALARY PROFILE
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              Modify employee details, monthly base salary, meal allowance quota, or credentials for @{editingEmployee?.username}.
            </DialogDescription>
          </DialogHeader>

          <div className="p-5 space-y-4 text-xs">
            {/* Display Name & Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Full / Display Name</Label>
                <Input
                  value={editEmployeeForm.displayName}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, displayName: e.target.value })}
                  placeholder="e.g. Eshaan"
                  className="h-10 text-xs font-bold uppercase"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Username</Label>
                <Input
                  value={editEmployeeForm.username}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, username: e.target.value })}
                  placeholder="e.g. eshaan"
                  className="h-10 text-xs font-mono font-bold lowercase"
                />
              </div>
            </div>

            {/* Terminal PIN & Access Role */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Terminal PIN (4-6 Digits)</Label>
                <div className="relative">
                  <Input
                    type={showEditPin ? 'text' : 'password'}
                    value={editEmployeeForm.pin}
                    onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, pin: e.target.value })}
                    maxLength={6}
                    placeholder="••••"
                    className="h-10 text-xs font-mono font-bold tracking-widest pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowEditPin(!showEditPin)}
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 text-muted-foreground"
                  >
                    {showEditPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Access Role</Label>
                <select
                  value={editEmployeeForm.role}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, role: e.target.value as any })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="staff">Staff</option>
                  <option value="admin">Admin</option>
                  <option value="guest">Guest</option>
                </select>
              </div>
            </div>

            {/* Salary Amount & Salary Type */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase text-emerald-400">Monthly Base Salary (₹)</Label>
                <Input
                  type="number"
                  value={editEmployeeForm.salary}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, salary: parseFloat(e.target.value) || 0 })}
                  className="h-10 text-xs font-mono font-bold border-emerald-500/30"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Salary Type</Label>
                <select
                  value={editEmployeeForm.salaryType}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, salaryType: e.target.value as any })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="monthly">Monthly Fixed</option>
                  <option value="hourly">Hourly Rate</option>
                </select>
              </div>
            </div>

            {/* Meal Quota Balance & Join Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase text-amber-400">Current Meal Allowance (₹)</Label>
                <Input
                  type="number"
                  value={editEmployeeForm.foodAllowanceBalance}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, foodAllowanceBalance: parseFloat(e.target.value) || 0 })}
                  className="h-10 text-xs font-mono font-bold border-amber-500/30"
                />
                <span className="text-[10px] text-muted-foreground font-semibold block">
                  Quota for bistro snacks/meals during duty shifts.
                </span>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1 text-indigo-400">
                  <Calendar className="h-3 w-3" /> Join Date (Salary Reset Cycle)
                </Label>
                <Input
                  type="date"
                  value={editEmployeeForm.joinDate}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, joinDate: e.target.value })}
                  className="h-10 text-xs font-mono font-bold border-indigo-500/30"
                />
                <span className="text-[10px] text-muted-foreground font-semibold block">
                  Determines monthly salary cycle ({editEmployeeForm.joinDate ? new Date(editEmployeeForm.joinDate).getDate() : 1}th of each month).
                </span>
              </div>
            </div>

            {/* Work Shift Timings */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Shift Starts
                </Label>
                <Input
                  type="time"
                  value={editEmployeeForm.workStartTime}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, workStartTime: e.target.value })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase flex items-center gap-1">
                  <Clock className="h-3 w-3 text-primary" /> Shift Ends
                </Label>
                <Input
                  type="time"
                  value={editEmployeeForm.workEndTime}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, workEndTime: e.target.value })}
                  className="h-10 text-xs font-mono font-bold"
                />
              </div>
            </div>

            {/* Assigned Shift & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Assigned Shift</Label>
                <select
                  value={editEmployeeForm.assignedShift}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, assignedShift: e.target.value })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="opening">Opening</option>
                  <option value="closing">Closing</option>
                  <option value="both">Both</option>
                </select>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] font-bold uppercase">Account Status</Label>
                <select
                  value={editEmployeeForm.isActive ? 'active' : 'inactive'}
                  onChange={(e) => setEditEmployeeForm({ ...editEmployeeForm, isActive: e.target.value === 'active' })}
                  className="w-full h-10 px-3 bg-background border-2 border-border/80 rounded-md font-bold uppercase text-xs outline-none focus:border-primary cursor-pointer"
                >
                  <option value="active">Active Staff</option>
                  <option value="inactive">Inactive / Deactivated</option>
                </select>
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 bg-muted/10 border-t flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingEmployee(null)}
              className="h-11 font-bold uppercase text-xs border-2 flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSaveEmployeeEdit}
              disabled={isSavingEmployee}
              className="h-11 font-bold uppercase text-xs tracking-wider flex-[2] bg-primary hover:bg-primary/90 text-white shadow-xl"
            >
              {isSavingEmployee ? 'Saving Updates...' : 'Save Employee Details'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 6: SALARY ADJUSTMENTS / ADVANCES / DEDUCTIONS / LEDGER */}
      <Dialog open={!!adjustingEmployee} onOpenChange={(open) => !open && setAdjustingEmployee(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto font-body border-2 border-indigo-500/30 p-0 shadow-2xl">
          <DialogHeader className="p-5 pb-3 bg-muted/20 border-b">
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="font-headline text-lg uppercase tracking-tight flex items-center gap-2 text-foreground">
                  <Receipt className="h-5 w-5 text-indigo-400" />
                  SALARY LEDGER &amp; ADJUSTMENTS
                </DialogTitle>
                <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
                  {adjustingEmployee?.displayName} (@{adjustingEmployee?.username}) &bull; Monthly Base: ₹{(adjustingEmployee?.salary || 0).toLocaleString()}
                </DialogDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono font-bold uppercase text-indigo-400 border-indigo-500/40">
                Quota: ₹{(adjustingEmployee?.foodAllowanceBalance ?? 1000).toLocaleString()}
              </Badge>
            </div>
          </DialogHeader>

          {adjustingEmployee && (() => {
            const adjustments = adjustingEmployee.salaryAdjustments || [];
            const activeAdjustments = adjustments.filter(a => a.status === 'active');
            const settledAdjustments = adjustments.filter(a => a.status === 'settled');
            const totalActiveAdvances = activeAdjustments.filter(a => a.type === 'advance').reduce((s, a) => s + a.amount, 0);
            const totalActiveDeductions = activeAdjustments.filter(a => a.type === 'deduction' || a.type === 'meal_overage').reduce((s, a) => s + a.amount, 0);
            const totalActiveBonuses = activeAdjustments.filter(a => a.type === 'bonus').reduce((s, a) => s + a.amount, 0);
            const netSalary = Math.max(0, (adjustingEmployee.salary || 0) + totalActiveBonuses - totalActiveAdvances - totalActiveDeductions);

            return (
              <div className="p-5 space-y-5">
                {/* Real-time Summary Card */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 rounded-xl bg-muted/30 border border-border/60 text-xs font-mono">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground">Base Salary</p>
                    <p className="text-sm font-extrabold text-foreground">₹{(adjustingEmployee.salary || 0).toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-amber-400">Active Advances</p>
                    <p className="text-sm font-extrabold text-amber-400">-₹{totalActiveAdvances.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-rose-400">Meal / Deductions</p>
                    <p className="text-sm font-extrabold text-rose-400">-₹{totalActiveDeductions.toLocaleString()}</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-emerald-400">Net Payable</p>
                    <p className="text-base font-extrabold text-emerald-400">₹{netSalary.toLocaleString()}</p>
                  </div>
                </div>

                {/* Form to Record New Advance / Deduction / Meal Overage */}
                <div className="p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                      <Plus className="h-4 w-4 text-indigo-400" /> Record New Entry
                    </p>
                    <div className="flex gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={adjustmentType === 'advance' ? 'default' : 'outline'}
                        onClick={() => {
                          setAdjustmentType('advance');
                          setAdjustmentReason('Salary Advance');
                        }}
                        className={cn("h-7 text-[10px] font-bold uppercase", adjustmentType === 'advance' ? "bg-amber-500 hover:bg-amber-600 text-black" : "text-amber-400 border-amber-500/30")}
                      >
                        Advance
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={adjustmentType === 'meal_overage' ? 'default' : 'outline'}
                        onClick={() => {
                          setAdjustmentType('meal_overage');
                          setAdjustmentReason('Finished meal quota - extra food ordered');
                        }}
                        className={cn("h-7 text-[10px] font-bold uppercase", adjustmentType === 'meal_overage' ? "bg-rose-500 hover:bg-rose-600 text-white" : "text-rose-400 border-rose-500/30")}
                      >
                        Meal Overage
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={adjustmentType === 'deduction' ? 'default' : 'outline'}
                        onClick={() => {
                          setAdjustmentType('deduction');
                          setAdjustmentReason('Salary Deduction');
                        }}
                        className={cn("h-7 text-[10px] font-bold uppercase", adjustmentType === 'deduction' ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-rose-400 border-rose-500/30")}
                      >
                        Other Deduction
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={adjustmentType === 'bonus' ? 'default' : 'outline'}
                        onClick={() => {
                          setAdjustmentType('bonus');
                          setAdjustmentReason('Performance Bonus / Incentive');
                        }}
                        className={cn("h-7 text-[10px] font-bold uppercase", adjustmentType === 'bonus' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-400 border-emerald-500/30")}
                      >
                        Bonus
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold uppercase">Amount (₹)</Label>
                      <Input
                        type="number"
                        placeholder="e.g. 500"
                        value={adjustmentAmount}
                        onChange={(e) => setAdjustmentAmount(e.target.value)}
                        className="h-10 text-xs font-mono font-bold"
                      />
                    </div>
                    <div className="space-y-1 sm:col-span-2">
                      <Label className="text-[11px] font-bold uppercase">Reason / Notes</Label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="e.g. Emergency advance / Extra pizza & shake ordered after quota limit"
                          value={adjustmentReason}
                          onChange={(e) => setAdjustmentReason(e.target.value)}
                          className="h-10 text-xs font-bold"
                        />
                        <Button
                          onClick={handleAddSalaryAdjustment}
                          disabled={isSavingAdjustment || !adjustmentAmount}
                          className="h-10 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold uppercase text-xs shrink-0"
                        >
                          {isSavingAdjustment ? 'Adding...' : 'Add'}
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Preset quick buttons for meal deduction */}
                  {adjustmentType === 'meal_overage' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Quick Reasons:</span>
                      {[
                        'Finished meal quota - extra food ordered',
                        'Café snack order over quota',
                        'Beverage order after allowance depleted',
                        'Extra lunch beyond monthly ₹1,000 allowance'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAdjustmentReason(preset)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-medium transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Preset quick buttons for other deductions including 1-day absent */}
                  {adjustmentType === 'deduction' && (
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground mr-1">Quick Presets:</span>
                      <button
                        type="button"
                        onClick={() => {
                          const dailyRate = Math.round((adjustingEmployee.salary || 0) / 30);
                          setAdjustmentAmount(dailyRate.toString());
                          setAdjustmentReason(`Absent Day Salary Deduction (₹${(adjustingEmployee.salary || 0).toLocaleString()}/30, week-off paid)`);
                        }}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/40 hover:bg-rose-500/25 font-bold transition-colors"
                      >
                        + 1-Day Absent (₹{Math.round((adjustingEmployee.salary || 0) / 30).toLocaleString()})
                      </button>
                      {[
                        'Unexcused Absent Day',
                        'Late arrival penalty',
                        'Inventory damage / shortage'
                      ].map((preset) => (
                        <button
                          key={preset}
                          type="button"
                          onClick={() => setAdjustmentReason(preset)}
                          className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-medium transition-colors"
                        >
                          {preset}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Ledger Table / List */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                      <History className="h-3.5 w-3.5 text-indigo-400" />
                      Adjustment History &amp; Ledger ({adjustments.length} Records)
                    </p>
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {activeAdjustments.length} Active &bull; {settledAdjustments.length} Settled
                    </span>
                  </div>

                  {adjustments.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground font-mono text-xs border border-dashed border-border/60 rounded-xl">
                      No advances or deductions recorded yet for {adjustingEmployee.displayName}.
                    </div>
                  ) : (
                    <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                      {adjustments.map((adj) => {
                        const isAdvance = adj.type === 'advance';
                        const isMealOverage = adj.type === 'meal_overage';
                        const isBonus = adj.type === 'bonus';
                        const isSettled = adj.status === 'settled';
                        const isAbsentDeduction = adj.type === 'deduction' && (adj.reason.toLowerCase().includes('absent') || adj.id.startsWith('adj-absent'));

                        return (
                          <div
                            key={adj.id}
                            className={cn(
                              "p-3 rounded-lg border flex items-center justify-between gap-3 text-xs font-mono transition-all",
                              isSettled
                                ? "bg-muted/10 border-border/30 opacity-60"
                                : isAdvance
                                ? "bg-amber-500/5 border-amber-500/30"
                                : isAbsentDeduction
                                ? "bg-rose-500/10 border-rose-500/40"
                                : isMealOverage
                                ? "bg-rose-500/5 border-rose-500/30"
                                : isBonus
                                ? "bg-emerald-500/5 border-emerald-500/30"
                                : "bg-muted/30 border-border/50"
                            )}
                          >
                            <div className="flex items-start gap-2.5">
                              {isAdvance && <ArrowUpCircle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />}
                              {isMealOverage && <Utensils className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                              {isAbsentDeduction && <UserX className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                              {!isAbsentDeduction && adj.type === 'deduction' && <ArrowDownCircle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                              {isBonus && <Sparkles className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />}

                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="font-extrabold text-foreground uppercase">
                                    {isAbsentDeduction ? 'ABSENT DEDUCTION' : adj.type.replace('_', ' ')}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "text-[9px] uppercase font-bold px-1.5 py-0",
                                      isSettled
                                        ? "border-muted-foreground text-muted-foreground"
                                        : "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                                    )}
                                  >
                                    {adj.status}
                                  </Badge>
                                  <span className="text-[10px] text-muted-foreground">
                                    {new Date(adj.date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-[11px] text-muted-foreground font-sans mt-0.5">
                                  {adj.reason}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-1.5 shrink-0">
                              <span
                                className={cn(
                                  "font-extrabold text-sm mr-1.5",
                                  isBonus ? "text-emerald-400" : isAdvance ? "text-amber-400" : "text-rose-400"
                                )}
                              >
                                {isBonus ? `+₹${adj.amount.toLocaleString()}` : `-₹${adj.amount.toLocaleString()}`}
                              </span>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleStartEditAdjustment(adj)}
                                className="h-7 w-7 text-muted-foreground hover:text-indigo-400 hover:bg-indigo-500/10"
                                title="Edit Entry"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>

                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => handleDeleteAdjustment(adj.id)}
                                className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                title="Delete Entry"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* EDIT ENTRY INLINE FORM WHEN AN ENTRY IS SELECTED */}
                {editingAdjustment && (
                  <div className="p-4 rounded-xl border-2 border-indigo-500/50 bg-indigo-950/30 space-y-3.5 animate-in fade-in-50 duration-200">
                    <div className="flex items-center justify-between border-b border-indigo-500/30 pb-2">
                      <div className="flex items-center gap-2">
                        <Pencil className="h-4 w-4 text-indigo-400" />
                        <span className="font-bold text-xs uppercase text-foreground">
                          Edit Entry ({editingAdjustment.type.toUpperCase().replace('_', ' ')})
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAdjustment(null)}
                        className="h-6 text-[10px] text-muted-foreground hover:text-foreground"
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="flex flex-wrap gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant={editAdjustmentType === 'advance' ? 'default' : 'outline'}
                        onClick={() => setEditAdjustmentType('advance')}
                        className={cn("h-7 text-[10px] font-bold uppercase", editAdjustmentType === 'advance' ? "bg-amber-500 hover:bg-amber-600 text-black" : "text-amber-400 border-amber-500/30")}
                      >
                        Advance
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editAdjustmentType === 'meal_overage' ? 'default' : 'outline'}
                        onClick={() => setEditAdjustmentType('meal_overage')}
                        className={cn("h-7 text-[10px] font-bold uppercase", editAdjustmentType === 'meal_overage' ? "bg-rose-500 hover:bg-rose-600 text-white" : "text-rose-400 border-rose-500/30")}
                      >
                        Meal Overage
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editAdjustmentType === 'deduction' ? 'default' : 'outline'}
                        onClick={() => setEditAdjustmentType('deduction')}
                        className={cn("h-7 text-[10px] font-bold uppercase", editAdjustmentType === 'deduction' ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-rose-400 border-rose-500/30")}
                      >
                        Other Deduction
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant={editAdjustmentType === 'bonus' ? 'default' : 'outline'}
                        onClick={() => setEditAdjustmentType('bonus')}
                        className={cn("h-7 text-[10px] font-bold uppercase", editAdjustmentType === 'bonus' ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "text-emerald-400 border-emerald-500/30")}
                      >
                        Bonus
                      </Button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase">Amount (₹)</Label>
                        <Input
                          type="number"
                          value={editAdjustmentAmount}
                          onChange={(e) => setEditAdjustmentAmount(e.target.value)}
                          className="h-9 text-xs font-mono font-bold"
                        />
                      </div>
                      <div className="space-y-1 sm:col-span-2">
                        <Label className="text-[10px] font-bold uppercase">Reason / Note</Label>
                        <Input
                          value={editAdjustmentReason}
                          onChange={(e) => setEditAdjustmentReason(e.target.value)}
                          className="h-9 text-xs font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] font-bold uppercase">Status</Label>
                        <select
                          value={editAdjustmentStatus}
                          onChange={(e) => setEditAdjustmentStatus(e.target.value as 'active' | 'settled')}
                          className="w-full h-9 px-2 bg-background border border-border/80 rounded-md font-bold uppercase text-[11px] outline-none focus:border-indigo-400 cursor-pointer"
                        >
                          <option value="active">Active</option>
                          <option value="settled">Settled</option>
                        </select>
                      </div>
                    </div>

                    <div className="flex justify-end gap-2 pt-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setEditingAdjustment(null)}
                        className="h-8 text-xs font-bold uppercase"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        disabled={isUpdatingAdjustment || !editAdjustmentAmount}
                        onClick={handleSaveEditAdjustment}
                        className="h-8 text-xs font-bold uppercase bg-indigo-600 hover:bg-indigo-700 text-white"
                      >
                        {isUpdatingAdjustment ? 'Saving...' : 'Save Changes'}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          <DialogFooter className="p-4 bg-muted/10 border-t">
            <Button
              variant="outline"
              onClick={() => setAdjustingEmployee(null)}
              className="h-10 font-bold uppercase text-xs"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* DIALOG 7: ATTENDANCE & MARK ABSENT DIALOG */}
      <Dialog open={!!attendanceEmployee} onOpenChange={(open) => !open && setAttendanceEmployee(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-md font-body border-2 border-rose-500/30 p-0 shadow-2xl overflow-hidden">
          <DialogHeader className="p-5 pb-3 bg-muted/20 border-b">
            <DialogTitle className="font-headline text-lg uppercase tracking-tight flex items-center gap-2 text-foreground">
              <UserX className="h-5 w-5 text-rose-500" />
              STAFF ATTENDANCE &amp; ABSENT CONTROLS
            </DialogTitle>
            <DialogDescription className="text-xs font-bold uppercase text-muted-foreground">
              {attendanceEmployee?.displayName} (@{attendanceEmployee?.username}) &bull; Shift: {attendanceEmployee?.workStartTime || '11:00'} - {attendanceEmployee?.workEndTime || '23:00'}
            </DialogDescription>
          </DialogHeader>

          {attendanceEmployee && (() => {
            const empShifts = (shifts || []).filter(
              (s) => s.staffId === attendanceEmployee.username || s.employeeId === attendanceEmployee.username || s.employees?.some(e => e.username === attendanceEmployee.username)
            );
            const absentCount = empShifts.filter(s => s.attendanceStatus === 'Absent').length;
            const presentCount = empShifts.filter(s => s.attendanceStatus === 'Present' || (!s.attendanceStatus && s.status === 'completed')).length;
            const lateCount = empShifts.filter(s => s.attendanceStatus === 'Late' || (s.lateMinutes && s.lateMinutes > 0)).length;

            const monthlySalary = attendanceEmployee.salary || 0;
            const dailyRate = Math.round(monthlySalary / 30);
            const totalAbsentDeduction = absentCount * dailyRate;

            const activeLedgerAbsentDeductions = (attendanceEmployee.salaryAdjustments || [])
              .filter(a => a.status === 'active' && a.type === 'deduction' && (a.reason.toLowerCase().includes('absent') || a.id.startsWith('adj-absent')))
              .reduce((s, a) => s + a.amount, 0);

            const unloggedPenalty = Math.max(0, totalAbsentDeduction - activeLedgerAbsentDeductions);

            return (
              <div className="p-5 space-y-4 text-xs font-mono">
                {/* SALARY & ABSENT DEDUCTION RULE BANNER */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-rose-500/10 via-purple-500/10 to-indigo-500/10 border-2 border-rose-500/30 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-4 w-4 text-rose-400" />
                      <span className="font-extrabold text-xs text-foreground uppercase tracking-tight">Salary Deduction Rule</span>
                    </div>
                    <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[9px] font-mono font-bold uppercase px-2 py-0.5">
                      WEEK-OFF PAID &bull; 30-DAY BASE
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                    <div className="p-2 rounded-lg bg-black/40 border border-border/40">
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Salary</p>
                      <p className="text-sm font-extrabold text-emerald-400">₹{monthlySalary.toLocaleString()}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-black/40 border border-rose-500/30">
                      <p className="text-[10px] uppercase font-bold text-rose-300">Daily Absent Deduction</p>
                      <p className="text-sm font-extrabold text-rose-400">
                        ₹{dailyRate.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">/ day</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 flex items-center justify-between border-t border-border/30">
                    <span>Formula: ₹{monthlySalary.toLocaleString()} ÷ 30 days (Week-off paid)</span>
                    <span className="text-rose-400 font-bold">Total Penalty: -₹{totalAbsentDeduction.toLocaleString()}</span>
                  </div>
                </div>

                {/* Unsynced Absent Shift Penalty Callout */}
                {absentCount > 0 && unloggedPenalty > 0 && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-2 text-[10px]">
                    <div className="space-y-0.5">
                      <p className="font-bold text-amber-300 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3 text-amber-400" /> Unrecorded Absent Shift Penalty
                      </p>
                      <p className="text-muted-foreground">
                        {absentCount} absent day(s) logged in shifts, but ₹{unloggedPenalty.toLocaleString()} not yet recorded in salary ledger.
                      </p>
                    </div>
                    <Button
                      size="sm"
                      type="button"
                      onClick={async () => {
                        if (!attendanceEmployee || !db) return;
                        try {
                          const absentAdjustment: SalaryAdjustment = {
                            id: `adj-absent-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                            type: 'deduction',
                            amount: unloggedPenalty,
                            reason: `Absent Penalty Sync (${absentCount} day(s) @ ₹${dailyRate.toLocaleString()}/d, week-off paid base)`,
                            date: new Date().toISOString().slice(0, 10),
                            status: 'active',
                            addedBy: 'Viren (Owner)',
                            updatedAt: new Date().toISOString()
                          };
                          const existing = attendanceEmployee.salaryAdjustments || [];
                          const updated = [...existing, absentAdjustment];
                          await updateEmployee(attendanceEmployee.id, { salaryAdjustments: updated });
                          setAttendanceEmployee({ ...attendanceEmployee, salaryAdjustments: updated });
                          toast({
                            title: "Absent Penalty Synced",
                            description: `Added -₹${unloggedPenalty.toLocaleString()} absent deduction to ledger.`
                          });
                        } catch (err: any) {
                          toast({ variant: 'destructive', title: "Sync Failed", description: err.message });
                        }
                      }}
                      className="h-7 text-[10px] font-bold uppercase bg-amber-500 hover:bg-amber-600 text-black shrink-0 px-2.5 rounded shadow-sm"
                    >
                      Sync -₹{unloggedPenalty.toLocaleString()}
                    </Button>
                  </div>
                )}

                {/* Attendance Metric Breakdown */}
                <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl bg-muted/30 border border-border/50 text-center">
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-rose-400">Total Absent</p>
                    <p className="text-base font-extrabold text-rose-400">{absentCount} {absentCount === 1 ? 'Day' : 'Days'}</p>
                    {absentCount > 0 && (
                      <p className="text-[9px] text-rose-400/80 font-bold">-₹{totalAbsentDeduction.toLocaleString()}</p>
                    )}
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-emerald-400">Present</p>
                    <p className="text-base font-extrabold text-emerald-400">{presentCount} Days</p>
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[10px] uppercase font-bold text-amber-400">Late Days</p>
                    <p className="text-base font-extrabold text-amber-400">{lateCount} Days</p>
                  </div>
                </div>

                {/* Date Selection */}
                <div className="space-y-1.5 font-sans">
                  <Label className="text-[11px] font-bold uppercase flex items-center gap-1.5 text-foreground">
                    <Calendar className="h-3.5 w-3.5 text-indigo-400" /> Attendance Date
                  </Label>
                  <Input
                    type="date"
                    value={attendanceDate}
                    onChange={(e) => setAttendanceDate(e.target.value)}
                    className="h-10 text-xs font-mono font-bold"
                  />
                </div>

                {/* Quick Reason for Absence */}
                <div className="space-y-1.5 font-sans">
                  <Label className="text-[11px] font-bold uppercase text-foreground">Absence Reason / Note</Label>
                  <Input
                    value={absentReason}
                    onChange={(e) => setAbsentReason(e.target.value)}
                    placeholder="e.g. Unannounced no-show / Sick leave / Personal emergency"
                    className="h-10 text-xs font-bold"
                  />

                  {/* Quick Pills */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {[
                      'Unannounced No-Show',
                      'Sick Leave',
                      'Emergency / Personal',
                      'Informed Absence'
                    ].map((reason) => (
                      <button
                        key={reason}
                        type="button"
                        onClick={() => setAbsentReason(reason)}
                        className="text-[10px] px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 font-sans font-semibold transition-colors"
                      >
                        {reason}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Auto Deduct Salary Checkbox */}
                <div className="p-3 rounded-lg bg-rose-500/5 border border-rose-500/20 space-y-1">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoDeductAbsentSalary}
                      onChange={(e) => setAutoDeductAbsentSalary(e.target.checked)}
                      className="mt-0.5 rounded border-border accent-rose-500 h-4 w-4 shrink-0"
                    />
                    <div className="space-y-0.5">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        Apply <strong className="text-rose-400 font-extrabold">-₹{dailyRate.toLocaleString()}</strong> salary deduction to ledger
                      </span>
                      <p className="text-[10px] text-muted-foreground font-sans">
                        Auto-creates an active salary deduction entry of 1 day's pay (₹{monthlySalary.toLocaleString()} / 30) for {attendanceDate}.
                      </p>
                    </div>
                  </label>
                </div>

                {/* Recent 5 Attendance Records for this employee */}
                <div className="space-y-2 pt-2 border-t border-border/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <History className="h-3.5 w-3.5 text-indigo-400" /> Recent Attendance History
                  </p>
                  {(() => {
                    const recentShifts = empShifts
                      .slice()
                      .sort((a, b) => new Date(b.startTime || b.date).getTime() - new Date(a.startTime || a.date).getTime())
                      .slice(0, 5);

                    if (recentShifts.length === 0) {
                      return (
                        <p className="text-[10px] text-muted-foreground italic py-2">No shift attendance logged yet.</p>
                      );
                    }

                    return (
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {recentShifts.map((sh) => {
                          const isAbsent = sh.attendanceStatus === 'Absent';
                          const isPresent = sh.attendanceStatus === 'Present' || (!sh.attendanceStatus && sh.status === 'completed');
                          const isLate = sh.attendanceStatus === 'Late' || (sh.lateMinutes && sh.lateMinutes > 0);

                          return (
                            <div key={sh.id} className="p-2 rounded bg-muted/20 border border-border/30 flex items-center justify-between text-[10px]">
                              <div>
                                <span className="font-bold text-foreground mr-2">{sh.date}</span>
                                <span className="text-muted-foreground">
                                  {sh.actualLogin ? `${sh.actualLogin} - ${sh.actualLogout || 'Active'}` : (sh.attendanceStatus || 'Shift')}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {isAbsent && (
                                  <span className="text-[9px] font-bold text-rose-400">
                                    -₹{dailyRate.toLocaleString()}
                                  </span>
                                )}
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "text-[9px] uppercase font-bold px-1.5 py-0",
                                    isAbsent
                                      ? "bg-rose-500/20 text-rose-400 border-rose-500/40"
                                      : isPresent
                                      ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                                      : isLate
                                      ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                                      : "text-muted-foreground border-border/40"
                                  )}
                                >
                                  {sh.attendanceStatus || (isLate ? 'Late' : 'Present')}
                                </Badge>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="p-4 bg-muted/10 border-t flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setAttendanceEmployee(null)}
              className="h-10 font-bold uppercase text-xs flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleMarkPresent}
              disabled={isMarkingAttendance}
              className="h-10 font-bold uppercase text-xs bg-emerald-600 hover:bg-emerald-700 text-white gap-1 flex-1"
            >
              <Check className="h-3.5 w-3.5" /> Mark Present
            </Button>
            <Button
              onClick={handleMarkAbsent}
              disabled={isMarkingAttendance}
              className="h-10 font-bold uppercase text-xs bg-rose-600 hover:bg-rose-700 text-white gap-1 flex-1 shadow-md shadow-rose-950/40"
            >
              <UserX className="h-3.5 w-3.5" /> Mark Absent {autoDeductAbsentSalary && attendanceEmployee?.salary ? `(-₹${Math.round((attendanceEmployee.salary || 0) / 30).toLocaleString()})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
