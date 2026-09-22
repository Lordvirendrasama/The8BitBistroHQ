'use client';

import { useState, useMemo, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, addDoc, doc, updateDoc } from 'firebase/firestore';
import type { Employee, Station, FoodItem, Shift, Member } from '@/lib/types';
import { useRouter } from 'next/navigation';
import { 
  Crown, Sparkles, UserCheck, Utensils, Wallet, PackageCheck, 
  Layers, AlertTriangle, ShieldCheck, DollarSign, CheckCircle2, 
  Plus, Minus, ArrowUpRight, ArrowDownRight, RefreshCw, FileText, 
  Calendar, FileSpreadsheet, Eye, TrendingDown, Clock, Building, Users
} from 'lucide-react';
import { AppUpdatesDropdown } from '@/components/owner/app-updates-dropdown';
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

  // Modals & Dialog State
  const [isGuestWizardOpen, setIsGuestWizardOpen] = useState(false);
  
  // Employee Action Modals
  const [quotaEmployee, setQuotaEmployee] = useState<Employee | null>(null);
  const [quotaAmount, setQuotaAmount] = useState('1000');
  
  const [salaryEmployee, setSalaryEmployee] = useState<Employee | null>(null);
  const [salaryNote, setSalaryNote] = useState('');

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

  // 2. Mark Salary Paid
  const handleMarkSalaryPaid = async () => {
    if (!salaryEmployee) return;
    try {
      if (db) {
        await addDoc(collection(db, 'logs'), {
          type: 'SHIFT_UPDATED',
          description: `Viren marked monthly salary of ₹${(salaryEmployee.salary || 0).toLocaleString()} as <strong>PAID</strong> for <strong>${salaryEmployee.displayName}</strong>. Note: ${salaryNote || 'Paid in full'}.`,
          timestamp: new Date().toISOString(),
          user: { uid: 'Viren', displayName: 'Viren (Owner)' }
        });
      }

      toast({
        title: "Salary Marked Paid",
        description: `Logged ₹${(salaryEmployee.salary || 0).toLocaleString()} salary payment for ${salaryEmployee.displayName}.`,
      });
      setSalaryEmployee(null);
      setSalaryNote('');
    } catch (err) {
      toast({ variant: 'destructive', title: "Action Failed" });
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
        {/* 1. EMPLOYEE & WORKFORCE CYCLE HUB */}
        <section className="space-y-4">
          <div className="flex items-center justify-between border-b border-border/40 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-indigo-400" /> EMPLOYEE HUB &amp; SALARY CONTROLS
            </h2>
            <Badge variant="outline" className="text-[10px] font-mono border-indigo-500/30 text-indigo-400 uppercase">
              {(employees || []).length} ACTIVE STAFF
            </Badge>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(employees || []).map((emp) => {
              const cycle = getCycleInfo(emp.joinDate);
              return (
                <Card key={emp.id} className="border-2 border-border/60 bg-card/80 backdrop-blur-sm shadow-md hover:border-primary/40 transition-all flex flex-col justify-between p-4 space-y-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-extrabold text-base uppercase text-foreground">{emp.displayName}</h3>
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

                  <div className="grid grid-cols-2 gap-2 p-3 rounded-lg bg-muted/20 border border-border/40 text-xs font-mono">
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Meal Quota Balance</p>
                      <p className="text-base font-extrabold text-amber-400">₹{(emp.foodAllowanceBalance ?? 1000).toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase font-bold text-muted-foreground">Monthly Salary</p>
                      <p className="text-base font-extrabold text-emerald-400">₹{(emp.salary || 0).toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
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
                      onClick={() => { setSalaryEmployee(emp); setSalaryNote(''); }}
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
              Confirm monthly salary payout of ₹{(salaryEmployee?.salary || 0).toLocaleString()} to {salaryEmployee?.displayName}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase">Payment Note / Reference</Label>
              <Input
                placeholder="e.g. UPI transfer #987654 / September Salary"
                value={salaryNote}
                onChange={(e) => setSalaryNote(e.target.value)}
                className="h-10 font-bold text-sm"
              />
            </div>
          </div>

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
    </div>
  );
}
