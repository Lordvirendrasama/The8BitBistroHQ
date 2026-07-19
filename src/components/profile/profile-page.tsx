'use client';

import { useMemo, useState, useEffect } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import { GuidedTour, TourStep } from '@/components/ui/guided-tour';
import type { Employee, Leave, Shift } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { recordLeave } from '@/firebase/firestore/leaves';
import { updateEmployee } from '@/firebase/firestore/employees';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format, formatDistanceToNow } from 'date-fns';
import {
  User,
  Clock,
  Calendar,
  Utensils,
  Briefcase,
  AlertCircle,
  PlusCircle,
  Sparkles,
  Timer,
  CheckCircle,
  FileSpreadsheet,
  HelpCircle,
  Plane,
  Edit,
  Trash2,
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function ProfileOperations() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const { toast } = useToast();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tourVal = searchParams.get('tour');
    if (tourVal) {
      setTutorialOpen(true);
    }
  }, [searchParams]);

  const [selectedUsername, setSelectedUsername] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [isEditingSpecs, setIsEditingSpecs] = useState(false);
  const [editShiftModalOpen, setEditShiftModalOpen] = useState(false);
  const [selectedShiftToEdit, setSelectedShiftToEdit] = useState<Shift | null>(null);
  const [isSavingShift, setIsSavingShift] = useState(false);
  const [tutorialOpen, setTutorialOpen] = useState(false);
  const [tutorialStep, setTutorialStep] = useState(0);

  const tourParam = searchParams.get('tour');

  const defaultTourSteps: TourStep[] = [
    {
      selector: "#profile-header-card",
      title: "1. Operator Credentials",
      description: "Welcome to your profile. Check your basic employee information, role status, joined dates, and live duty status at a glance.",
      position: "bottom"
    },
    {
      selector: "#performance-stats-row",
      title: "2. Key Metrics Summary",
      description: "View your remaining meal quota allowance, total completed shifts, cumulative duty hours logged, and number of late check-ins.",
      position: "bottom"
    },
    {
      selector: "#shift-specs-card",
      title: "3. Shift Specifications",
      description: "Understand your working hours expectations, weekly off days, assigned shifts, and basic payment rules.",
      position: "right"
    },
    {
      selector: "#leave-ops-card",
      title: "4. Leave Request Center",
      description: "File leave applications and track pending, approved, or rejected status directly on the roster ledger.",
      position: "left"
    },
    {
      selector: "#recent-duty-records-card",
      title: "5. Recent Duty Records",
      description: "Review your detailed checkout summaries, task checklist ratios completed on-duty, and final attendance states.",
      position: "top"
    }
  ];

  const shiftTourSteps: TourStep[] = [
    {
      selector: "#profile-header-card",
      title: "1. Shift Authorization Log",
      description: "Initialize your daily shift here. Click 'Initialize Shift' to start duty and verify your check-in timings.",
      position: "bottom"
    },
    {
      selector: "#performance-stats-row",
      title: "2. Shift Punctuality Metrics",
      description: "Attendance is logged daily. Monitor your late check-in counts (triggered if checked in after a 10 min grace period).",
      position: "bottom"
    },
    {
      selector: "#recent-duty-records-card",
      title: "3. Shift End Checkout & Settlement",
      description: "Log out at shift completion. Click 'Complete Shift' in the app header and file the drawer's total Cash, UPI, and emergency expenses.",
      position: "top"
    }
  ];

  const leavesTourSteps: TourStep[] = [
    {
      selector: "#leave-ops-card",
      title: "1. PTO & Sick Leave Tracker",
      description: "File leave applications using the 'Apply Leave' form. Enter starting/ending dates, leave type classifications, and brief explanations.",
      position: "left"
    }
  ];

  const tutorialSteps = 
    tourParam === 'shift' ? shiftTourSteps :
    tourParam === 'leaves' ? leavesTourSteps : defaultTourSteps;

  const handleStartTutorial = () => {
    setTutorialOpen(true);
  };
  const [specFormData, setSpecFormData] = useState({
    workStartTime: '11:00',
    workEndTime: '23:00',
    weekOffDay: 5,
    assignedShift: 'opening',
    gracePeriod: 5,
    salaryType: 'monthly' as Employee['salaryType'],
    salary: 0,
    foodAllowanceBalance: 1000
  });

  const [shiftFormData, setShiftFormData] = useState({
    startTime: '',
    endTime: '',
    attendanceStatus: 'Present' as Shift['attendanceStatus'],
    totalHoursWorked: 0
  });

  const toLocalISOString = (dateStr: string | undefined | null) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const tzoffset = date.getTimezoneOffset() * 60000;
    return (new Date(date.getTime() - tzoffset)).toISOString().slice(0, 16);
  };

  const handleOpenEditShiftModal = (shift: Shift) => {
    setSelectedShiftToEdit(shift);
    setShiftFormData({
      startTime: toLocalISOString(shift.startTime),
      endTime: toLocalISOString(shift.endTime),
      attendanceStatus: shift.attendanceStatus || 'Present',
      totalHoursWorked: shift.totalHoursWorked || 0
    });
    setEditShiftModalOpen(true);
  };

  const handleSaveShiftEdit = async () => {
    if (!selectedShiftToEdit || !db) return;
    setIsSavingShift(true);
    try {
      const startIso = new Date(shiftFormData.startTime).toISOString();
      const endIso = shiftFormData.endTime ? new Date(shiftFormData.endTime).toISOString() : null;

      // Auto calculate hours if not modified manually
      let finalHours = shiftFormData.totalHoursWorked;
      if (finalHours === selectedShiftToEdit.totalHoursWorked && 
          (startIso !== selectedShiftToEdit.startTime || endIso !== selectedShiftToEdit.endTime)) {
        if (endIso) {
          const diffMs = new Date(endIso).getTime() - new Date(startIso).getTime();
          finalHours = Math.round((diffMs / (1000 * 60 * 60)) * 10) / 10;
        } else {
          finalHours = 0;
        }
      }

      const updates = {
        startTime: startIso,
        endTime: endIso || null,
        attendanceStatus: shiftFormData.attendanceStatus,
        totalHoursWorked: finalHours
      };

      const ref = doc(db, 'shifts', selectedShiftToEdit.id);
      await updateDoc(ref, updates);

      toast({ title: 'Shift Record Updated', description: 'Shift details have been written to the ledger.' });
      setEditShiftModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'Failed to record modifications.' });
    } finally {
      setIsSavingShift(false);
    }
  };

  const handleDeleteShift = async (shiftId: string) => {
    if (!db) return;
    if (!confirm("Are you sure you want to delete this shift record permanently? This cannot be undone.")) return;
    try {
      await deleteDoc(doc(db, 'shifts', shiftId));
      toast({ title: 'Shift Record Deleted', description: 'Roster record removed from database.' });
      setEditShiftModalOpen(false);
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Deletion Failed', description: 'Failed to delete roster record.' });
    }
  };

  const handleStartEditSpecs = () => {
    if (!currentEmployee) return;
    setSpecFormData({
      workStartTime: currentEmployee.workStartTime || '11:00',
      workEndTime: currentEmployee.workEndTime || '23:00',
      weekOffDay: currentEmployee.weekOffDay ?? 5,
      assignedShift: currentEmployee.assignedShift || 'opening',
      gracePeriod: currentEmployee.gracePeriod ?? 5,
      salaryType: currentEmployee.salaryType || 'monthly',
      salary: currentEmployee.salary || 0,
      foodAllowanceBalance: currentEmployee.foodAllowanceBalance ?? 1000
    });
    setIsEditingSpecs(true);
  };

  const handleSaveSpecs = async () => {
    if (!currentEmployee) return;
    try {
      const success = await updateEmployee(currentEmployee.id, specFormData);
      if (success) {
        toast({ title: 'Specifications Updated', description: 'Employee records updated successfully.' });
        setIsEditingSpecs(false);
      } else {
        toast({ variant: 'destructive', title: 'Update Failed', description: 'Failed to write update to database.' });
      }
    } catch (err) {
      console.error(err);
      toast({ variant: 'destructive', title: 'Update Failed', description: 'An unexpected error occurred.' });
    }
  };
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);
  const [leaveFormData, setLeaveFormData] = useState({
    type: 'paid' as Leave['type'],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: ''
  });

  // Check if viewing own profile
  const targetUsername = selectedUsername || user?.username || '';
  const isOwnProfile = targetUsername === user?.username;

  // Fetch all active employees (only for Viren / Admins)
  const allEmployeesQuery = useMemo(() => {
    if (!db || (user?.username !== 'Viren' && user?.role !== 'admin')) return null;
    return query(collection(db, 'employees'), where('isActive', '==', true));
  }, [db, user]);
  const { data: allEmployees } = useCollection<Employee>(allEmployeesQuery);

  const sortedEmployees = useMemo(() => {
    if (!allEmployees) return [];
    return [...allEmployees].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [allEmployees]);

  // 1. Fetch target employee's record
  const employeeQuery = useMemo(() => {
    if (!db || !targetUsername) return null;
    return query(
      collection(db, 'employees'),
      where('username', '==', targetUsername)
    );
  }, [db, targetUsername]);

  const { data: employeeDocs, loading: empLoading } = useCollection<Employee>(employeeQuery);
  const currentEmployee = employeeDocs?.[0] || null;

  // 2. Fetch employee's leaves
  const leavesQuery = useMemo(() => {
    if (!db || !currentEmployee?.id) return null;
    return query(
      collection(db, 'leaves'),
      where('employeeId', '==', currentEmployee.id)
    );
  }, [db, currentEmployee?.id]);

  const { data: userLeaves, loading: leavesLoading } = useCollection<Leave>(leavesQuery);

  // In-memory sort for leaves by startDate desc
  const sortedLeaves = useMemo(() => {
    if (!userLeaves) return [];
    return [...userLeaves].sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [userLeaves]);

  // 3. Fetch employee's shifts
  const shiftsQuery = useMemo(() => {
    if (!db || !targetUsername) return null;
    return query(
      collection(db, 'shifts'),
      where('staffId', '==', targetUsername)
    );
  }, [db, targetUsername]);

  const { data: userShifts, loading: shiftsLoading } = useCollection<Shift>(shiftsQuery);

  // In-memory sort for shifts by startTime desc
  const sortedShifts = useMemo(() => {
    if (!userShifts) return [];
    return [...userShifts].sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());
  }, [userShifts]);

  // Active shift check
  const activeShift = useMemo(() => {
    return userShifts?.find(s => s.status === 'active') || null;
  }, [userShifts]);

  // Calculations
  const stats = useMemo(() => {
    if (!userShifts) return { completedCount: 0, totalHours: 0, lateCount: 0, leavesCount: 0 };
    
    const completed = userShifts.filter(s => s.status === 'completed' || s.endTime);
    const completedCount = completed.length;
    
    const totalHours = completed.reduce((acc, s) => acc + (s.totalHoursWorked || 0), 0);
    const lateCount = completed.filter(s => (s.lateMinutes || 0) > 0).length;

    // Filter leaves approved
    const leavesCount = userLeaves?.filter(l => l.status === 'approved').length || 0;

    return {
      completedCount,
      totalHours: Math.round(totalHours * 10) / 10,
      lateCount,
      leavesCount
    };
  }, [userShifts, userLeaves]);

  const handleOpenLeaveModal = () => {
    setLeaveFormData({
      type: 'paid',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: ''
    });
    setLeaveModalOpen(true);
  };

  const handleRequestLeave = async () => {
    if (!currentEmployee) return;
    if (!leaveFormData.startDate || !leaveFormData.endDate || !leaveFormData.reason) {
      toast({ variant: 'destructive', title: 'Missing Information', description: 'Please fill in all details.' });
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const resultId = await recordLeave({
        employeeId: currentEmployee.id,
        employeeName: currentEmployee.displayName,
        startDate: leaveFormData.startDate,
        endDate: leaveFormData.endDate,
        reason: leaveFormData.reason,
        type: leaveFormData.type,
        status: 'pending'
      });

      if (resultId) {
        toast({ title: 'Leave Requested Successfully', description: 'Your request is pending owner approval.' });
        setLeaveModalOpen(false);
      } else {
        toast({ variant: 'destructive', title: 'Request Failed', description: 'Failed to record leave.' });
      }
    } catch (error) {
      console.error(error);
      toast({ variant: 'destructive', title: 'Request Failed', description: 'An unexpected error occurred.' });
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  if (empLoading || shiftsLoading || leavesLoading) {
    return (
      <div className="flex py-20 items-center justify-center font-headline text-sm animate-pulse">
        ACCESSING OPERATOR CREDENTIALS...
      </div>
    );
  }

  const foodAllowancePercentage = currentEmployee 
    ? Math.min(100, Math.max(0, ((currentEmployee.foodAllowanceBalance ?? 1000) / 1000) * 100))
    : 0;

  return (
    <div className="space-y-8 font-body animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* Operator Profile Selector (Owner / Admin Only) */}
      {(user?.username === 'Viren' || user?.role === 'admin') && allEmployees && allEmployees.length > 0 && (
        <Card className="border-2 border-primary/20 shadow-none bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="h-4 w-4" /> Owner Administration Panel
            </p>
            <p className="text-xs text-muted-foreground font-bold uppercase mt-0.5">
              Select an operator to inspect their schedule, meal quota, check-in history, and leave logs.
            </p>
          </div>
          <div className="w-full sm:w-64">
            <Select
              value={targetUsername}
              onValueChange={(val) => setSelectedUsername(val)}
            >
              <SelectTrigger className="font-bold uppercase text-xs h-10 border-2 bg-background border-primary/30">
                <SelectValue placeholder="Select Profile" />
              </SelectTrigger>
              <SelectContent className="font-body">
                <SelectItem value={user?.username || ''} className="font-bold uppercase text-xs">
                  My Profile ({user?.displayName})
                </SelectItem>
                {sortedEmployees
                  .filter(emp => emp.username !== user?.username)
                  .map(emp => (
                    <SelectItem key={emp.id} value={emp.username} className="font-bold uppercase text-xs">
                      {emp.displayName} (@{emp.username})
                    </SelectItem>
                  ))
                }
              </SelectContent>
            </Select>
          </div>
        </Card>
      )}

      {/* 1. Cyberpunk Header operator profile details card */}
      <Card id="profile-header-card" className="border-2 border-primary/20 shadow-none overflow-hidden relative bg-gradient-to-br from-card to-background">
        <div className="absolute right-0 top-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none border-l-2 border-b-2 border-primary/10 flex items-center justify-center">
          <Sparkles className="h-8 w-8 text-primary opacity-20" />
        </div>
        <CardContent className="p-6 sm:p-8 flex flex-col md:flex-row items-center gap-6">
          <div className="relative group shrink-0">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-amber-500 rounded-full blur opacity-30 group-hover:opacity-60 transition duration-1000 group-hover:duration-200" />
            <div className="relative h-24 w-24 sm:h-28 sm:w-28 rounded-full border-2 border-primary/50 overflow-hidden bg-muted flex items-center justify-center">
              <Avatar className="h-full w-full">
                <AvatarImage src={currentEmployee?.photoURL || `https://picsum.photos/seed/${targetUsername}/100/100`} />
                <AvatarFallback className="text-2xl font-bold uppercase">
                  {(currentEmployee?.displayName || targetUsername).charAt(0)}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
          
          <div className="text-center md:text-left flex-1 min-w-0 space-y-2.5">
            <div className="flex flex-wrap justify-center md:justify-start items-center gap-2">
              <h1 className="font-headline text-3xl sm:text-4xl tracking-wider text-foreground truncate">
                {currentEmployee?.displayName || targetUsername}
              </h1>
              <Badge variant="outline" className="font-bold uppercase tracking-wider text-sm border-primary/30 text-primary bg-primary/5 h-6">
                {currentEmployee?.role || (targetUsername === 'Viren' ? 'owner' : 'staff')}
              </Badge>
              {isOwnProfile && (
                <Button 
                  size="sm" 
                  variant="outline" 
                  onClick={handleStartTutorial}
                  className="h-7 px-2.5 font-bold uppercase tracking-tight text-[10px] bg-primary/10 border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground ml-2 shadow-sm rounded"
                >
                  <HelpCircle className="mr-1 h-3.5 w-3.5" /> Start Tutorial
                </Button>
              )}
            </div>
            
            <div className="text-sm font-bold text-muted-foreground uppercase tracking-normal">
              SYSTEM CODEX ID: <span className="font-mono text-foreground font-bold">@{targetUsername}</span>
            </div>

            <div className="flex flex-wrap justify-center md:justify-start gap-y-2 gap-x-4 text-sm font-bold text-muted-foreground uppercase tracking-tight">
              <div className="flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-primary" />
                Joined: <span className="text-foreground">{currentEmployee?.joinDate ? format(new Date(currentEmployee.joinDate), 'MMMM d, yyyy') : 'N/A'}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {activeShift ? (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping inline-block shrink-0" />
                    <span className="text-emerald-500 font-bold uppercase tracking-widest bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded text-xs">On Duty (Active Shift)</span>
                  </>
                ) : (
                  <>
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block shrink-0" />
                    <span className="text-amber-500 font-bold uppercase tracking-widest bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 rounded text-xs">Off Duty (Idle)</span>
                  </>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 2. Key Stats Summary Row */}
      <div id="performance-stats-row" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Meal Allowance */}
        <Card className="border-2 shadow-none relative overflow-hidden bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Meal Quota</span>
            <Utensils className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0 space-y-3">
            <div>
              <p className="text-3xl font-mono font-bold tracking-tight text-amber-600">
                ₹{(currentEmployee?.foodAllowanceBalance ?? 0).toLocaleString()}
              </p>
              <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">Of ₹1,000 allowance</p>
            </div>
            <Progress value={foodAllowancePercentage} className="h-2 bg-muted-foreground/10" />
          </CardContent>
        </Card>

        {/* Completed Shifts */}
        <Card className="border-2 shadow-none relative overflow-hidden bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Completed Shifts</span>
            <CheckCircle className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-mono font-bold tracking-tight text-emerald-600">{stats.completedCount}</p>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">Active Cycle Total</p>
          </CardContent>
        </Card>

        {/* Total Hours Worked */}
        <Card className="border-2 shadow-none relative overflow-hidden bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Duty Hours</span>
            <Timer className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-mono font-bold tracking-tight text-indigo-600">{stats.totalHours} hrs</p>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">Cumulative Hours Logged</p>
          </CardContent>
        </Card>

        {/* Punctuality Alert Stats */}
        <Card className="border-2 shadow-none relative overflow-hidden bg-card">
          <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between">
            <span className="text-sm font-bold uppercase tracking-tight text-muted-foreground">Late Check-ins</span>
            <Clock className="h-5 w-5 text-rose-500" />
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <p className="text-3xl font-mono font-bold tracking-tight text-rose-600">{stats.lateCount}</p>
            <p className="text-[11px] font-bold text-muted-foreground uppercase mt-0.5">Alert Threshold &gt; 10m</p>
          </CardContent>
        </Card>
      </div>

      {/* 3. Shift Settings & Leaves Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        
        {/* Duty Schedule Card */}
        <Card id="shift-specs-card" className="border-2 shadow-none overflow-hidden bg-card">
          <CardHeader className="bg-muted/10 border-b p-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md font-bold uppercase flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-primary" /> Shift Specifications
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-normal opacity-60">
                Operational expectations & schedule guidelines.
              </CardDescription>
            </div>
            {currentEmployee && (user?.username === 'Viren' || user?.role === 'admin') && !isEditingSpecs && (
              <Button size="sm" variant="outline" onClick={handleStartEditSpecs} className="h-9 px-3 font-bold uppercase tracking-tight text-xs shadow border-primary/20 hover:bg-primary/5 hover:text-primary">
                Edit Specs
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            {currentEmployee ? (
              isEditingSpecs ? (
                <div className="space-y-4 text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Shift Starts</Label>
                      <Input 
                        type="time" 
                        value={specFormData.workStartTime} 
                        onChange={e => setSpecFormData({...specFormData, workStartTime: e.target.value})} 
                        className="font-bold h-9" 
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Shift Ends</Label>
                      <Input 
                        type="time" 
                        value={specFormData.workEndTime} 
                        onChange={e => setSpecFormData({...specFormData, workEndTime: e.target.value})} 
                        className="font-bold h-9" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Weekly Off</Label>
                      <Select 
                        value={specFormData.weekOffDay.toString()} 
                        onValueChange={v => setSpecFormData({...specFormData, weekOffDay: parseInt(v)})}
                      >
                        <SelectTrigger className="font-bold uppercase text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-body">
                          {DAYS.map((day, idx) => (
                            <SelectItem key={idx} value={idx.toString()} className="font-bold uppercase text-xs">
                              {day}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Grace Check-in (Mins)</Label>
                      <Input 
                        type="number" 
                        value={specFormData.gracePeriod} 
                        onChange={e => setSpecFormData({...specFormData, gracePeriod: parseInt(e.target.value) || 0})} 
                        className="font-bold h-9" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Assigned Shift</Label>
                      <Select 
                        value={specFormData.assignedShift} 
                        onValueChange={v => setSpecFormData({...specFormData, assignedShift: v})}
                      >
                        <SelectTrigger className="font-bold uppercase text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-body">
                          <SelectItem value="opening" className="font-bold uppercase text-xs">Opening Shift</SelectItem>
                          <SelectItem value="closing" className="font-bold uppercase text-xs">Closing Shift</SelectItem>
                          <SelectItem value="both" className="font-bold uppercase text-xs">Both Shifts</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Meal Quota (₹)</Label>
                      <Input 
                        type="number" 
                        value={specFormData.foodAllowanceBalance} 
                        onChange={e => setSpecFormData({...specFormData, foodAllowanceBalance: parseInt(e.target.value) || 0})} 
                        className="font-bold h-9" 
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Salary Type</Label>
                      <Select 
                        value={specFormData.salaryType} 
                        onValueChange={(v: any) => setSpecFormData({...specFormData, salaryType: v})}
                      >
                        <SelectTrigger className="font-bold uppercase text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="font-body">
                          <SelectItem value="monthly" className="font-bold uppercase text-xs">Monthly Fixed</SelectItem>
                          <SelectItem value="hourly" className="font-bold uppercase text-xs">Hourly Duty Rate</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold uppercase text-muted-foreground">Salary Amount (₹)</Label>
                      <Input 
                        type="number" 
                        value={specFormData.salary} 
                        onChange={e => setSpecFormData({...specFormData, salary: parseInt(e.target.value) || 0})} 
                        className="font-bold h-9" 
                      />
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2">
                    <Button size="sm" variant="outline" onClick={() => setIsEditingSpecs(false)} className="font-bold uppercase text-xs h-9">
                      Cancel
                    </Button>
                    <Button size="sm" onClick={handleSaveSpecs} className="font-bold uppercase text-xs h-9 shadow-md">
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-y-4 gap-x-6 text-sm">
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Expected Hours</span>
                    <span className="font-bold text-foreground block">
                      {currentEmployee.workStartTime || '11:00'} - {currentEmployee.workEndTime || '23:00'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Weekly Off</span>
                    <span className="font-bold text-foreground block">
                      {DAYS[currentEmployee.weekOffDay] || 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Assigned Shift Type</span>
                    <Badge variant="outline" className="font-bold uppercase text-[11px] mt-0.5 bg-muted">
                      {currentEmployee.assignedShift || 'Opening'} Shift
                    </Badge>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Grace Check-in</span>
                    <span className="font-bold text-foreground block">
                      {currentEmployee.gracePeriod ?? 5} Minutes
                    </span>
                  </div>
                  <div className="col-span-2 border-t border-dashed pt-4 flex justify-between items-center">
                    <div>
                      <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Compensation Plan</span>
                      <span className="font-bold text-foreground block">
                        {currentEmployee.salaryType === 'monthly' ? 'Monthly Fixed' : 'Hourly Duty Rate'}
                      </span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-bold text-muted-foreground uppercase block mb-1">Payment Value</span>
                      <span className="font-mono font-bold text-emerald-600 block">
                        ₹{(currentEmployee.salary ?? 0).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <div className="py-8 text-center text-muted-foreground text-sm font-bold uppercase opacity-45">
                No shift specifications defined.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Leave Requests Card */}
        <Card id="leave-ops-card" className="border-2 shadow-none overflow-hidden bg-card">
          <CardHeader className="bg-muted/10 border-b p-4 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-md font-bold uppercase flex items-center gap-2">
                <Plane className="h-5 w-5 text-indigo-500" /> Leave Operations
              </CardTitle>
              <CardDescription className="text-xs font-bold uppercase tracking-normal opacity-60">
                Log leave applications or view histories.
              </CardDescription>
            </div>
            {currentEmployee && isOwnProfile && (
              <Button size="sm" onClick={handleOpenLeaveModal} className="h-9 px-3 font-bold uppercase tracking-tight text-xs shadow">
                <PlusCircle className="mr-1.5 h-4 w-4" /> Apply Leave
              </Button>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-[250px]">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/5">
                    <TableHead className="font-bold uppercase text-xs">Dates</TableHead>
                    <TableHead className="font-bold uppercase text-xs">Type</TableHead>
                    <TableHead className="font-bold uppercase text-xs text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedLeaves.length > 0 ? (
                    sortedLeaves.map(leave => (
                      <TableRow key={leave.id} className="hover:bg-muted/5">
                        <TableCell className="py-3">
                          <div className="font-bold text-xs uppercase">
                            {format(new Date(leave.startDate), 'MMM d')} - {format(new Date(leave.endDate), 'MMM d')}
                          </div>
                          <div className="text-[10px] text-muted-foreground font-bold uppercase truncate max-w-[150px] mt-0.5">
                            {leave.reason}
                          </div>
                        </TableCell>
                        <TableCell className="py-3">
                          <Badge variant="secondary" className="text-[10px] font-bold uppercase tracking-tight">
                            {leave.type}
                          </Badge>
                        </TableCell>
                        <TableCell className="py-3 text-right">
                          <Badge
                            className={cn(
                              "text-[10px] font-bold uppercase",
                              leave.status === 'approved' ? 'bg-emerald-600 hover:bg-emerald-600' :
                              leave.status === 'rejected' ? 'bg-destructive hover:bg-destructive' : 'bg-amber-500 hover:bg-amber-500'
                            )}
                          >
                            {leave.status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={3} className="py-16 text-center text-xs font-bold uppercase opacity-35 italic">
                        No leaves registered.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* 4. Recent Shift History logs ledger */}
      <Card id="recent-duty-records-card" className="border-2 shadow-none overflow-hidden bg-card">
        <CardHeader className="bg-muted/10 border-b p-4">
          <CardTitle className="text-md font-bold uppercase flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-indigo-500" /> Recent Duty Records
          </CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-normal opacity-60">
            A real-time log of recent completed check-in cycles.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/5">
                <TableHead className="font-bold uppercase text-xs">Date</TableHead>
                <TableHead className="font-bold uppercase text-xs">Login / Logout</TableHead>
                <TableHead className="font-bold uppercase text-xs">Duration</TableHead>
                <TableHead className="font-bold uppercase text-xs">Checklist</TableHead>
                <TableHead className="font-bold uppercase text-xs">Outcome</TableHead>
                {(user?.username === 'Viren' || user?.role === 'admin') && (
                  <TableHead className="font-bold uppercase text-xs text-right">Actions</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedShifts.length > 0 ? (
                sortedShifts.slice(0, 5).map(shift => {
                  const completedTasksCount = (shift.tasks || []).filter(t => t.completed).length;
                  const totalTasksCount = (shift.tasks || []).length;
                  const durationStr = shift.totalHoursWorked 
                    ? `${Math.round(shift.totalHoursWorked * 10) / 10} hrs`
                    : 'Ongoing';

                  return (
                    <TableRow key={shift.id} className="hover:bg-muted/5">
                      <TableCell className="py-4 font-bold text-xs uppercase">
                        {format(new Date(shift.startTime), 'EEEE, MMM d')}
                      </TableCell>
                      <TableCell className="py-4 font-mono text-xs text-muted-foreground uppercase">
                        {format(new Date(shift.startTime), 'p')} - {shift.endTime ? format(new Date(shift.endTime), 'p') : 'Ongoing'}
                      </TableCell>
                      <TableCell className="py-4 font-mono font-bold text-xs">
                        {durationStr}
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge variant="outline" className="font-bold uppercase text-[10px]">
                          {completedTasksCount} / {totalTasksCount} TASKS
                        </Badge>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge
                          className={cn(
                            "font-bold uppercase text-[10px]",
                            shift.attendanceStatus === 'Present' ? 'bg-emerald-600 hover:bg-emerald-600' :
                            shift.attendanceStatus === 'Late' ? 'bg-rose-500 hover:bg-rose-500' :
                            shift.attendanceStatus === 'Half Day' ? 'bg-amber-500 hover:bg-amber-500' : 'bg-slate-600 hover:bg-slate-600'
                          )}
                        >
                          {shift.attendanceStatus || 'Active'}
                        </Badge>
                      </TableCell>
                      {(user?.username === 'Viren' || user?.role === 'admin') && (
                        <TableCell className="py-4 text-right">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEditShiftModal(shift)}
                            className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-primary"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="py-16 text-center text-xs font-bold uppercase opacity-35 italic">
                    No active or historical duty cycles detected.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* 5. Request Leave Modal dialog */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg uppercase flex items-center gap-2">
              <Plane className="h-5 w-5 text-primary" /> Apply for Leave
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Start Date</Label>
                <Input
                  type="date"
                  value={leaveFormData.startDate}
                  onChange={e => setLeaveFormData({ ...leaveFormData, startDate: e.target.value })}
                  className="font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">End Date</Label>
                <Input
                  type="date"
                  value={leaveFormData.endDate}
                  onChange={e => setLeaveFormData({ ...leaveFormData, endDate: e.target.value })}
                  className="font-bold"
                />
              </div>
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Leave Classification</Label>
              <Select
                value={leaveFormData.type}
                onValueChange={(v: Leave['type']) => setLeaveFormData({ ...leaveFormData, type: v })}
              >
                <SelectTrigger className="font-bold uppercase text-xs h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="font-body">
                  <SelectItem value="paid">Paid Time Off (PTO)</SelectItem>
                  <SelectItem value="unpaid">Unpaid Leave</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Reason & Details</Label>
              <Textarea
                rows={3}
                placeholder="State reason for leave request..."
                value={leaveFormData.reason}
                onChange={e => setLeaveFormData({ ...leaveFormData, reason: e.target.value })}
                className="font-bold text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLeaveModalOpen(false)} className="font-bold uppercase text-xs h-10">
              Cancel
            </Button>
            <Button onClick={handleRequestLeave} disabled={isSubmittingLeave} className="font-bold uppercase text-xs h-10 shadow-lg">
              {isSubmittingLeave ? 'Submitting...' : 'Submit Request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Shift Modal Dialog */}
      <Dialog open={editShiftModalOpen} onOpenChange={setEditShiftModalOpen}>
        <DialogContent className="max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg uppercase flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" /> Edit Shift Log
              </span>
              {selectedShiftToEdit && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={() => handleDeleteShift(selectedShiftToEdit.id)}
                  className="h-8 w-8 text-destructive hover:bg-destructive/10 rounded-lg"
                  title="Delete Shift Log"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4 text-sm">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Login Time</Label>
              <Input
                type="datetime-local"
                value={shiftFormData.startTime}
                onChange={e => setShiftFormData({ ...shiftFormData, startTime: e.target.value })}
                className="font-bold text-xs"
              />
            </div>
            
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase text-muted-foreground">Logout Time</Label>
              <Input
                type="datetime-local"
                value={shiftFormData.endTime}
                onChange={e => setShiftFormData({ ...shiftFormData, endTime: e.target.value })}
                className="font-bold text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Attendance Status</Label>
                <Select
                  value={shiftFormData.attendanceStatus}
                  onValueChange={(v: any) => setShiftFormData({ ...shiftFormData, attendanceStatus: v })}
                >
                  <SelectTrigger className="font-bold uppercase text-xs h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="font-body">
                    <SelectItem value="Present" className="font-bold uppercase text-xs text-emerald-600">Present</SelectItem>
                    <SelectItem value="Late" className="font-bold uppercase text-xs text-rose-600">Late</SelectItem>
                    <SelectItem value="Half Day" className="font-bold uppercase text-xs text-amber-600">Half Day</SelectItem>
                    <SelectItem value="Absent" className="font-bold uppercase text-xs text-slate-500">Absent</SelectItem>
                    <SelectItem value="Weekly Off" className="font-bold uppercase text-xs text-indigo-500">Weekly Off</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase text-muted-foreground">Hours Logged</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={shiftFormData.totalHoursWorked}
                  onChange={e => setShiftFormData({ ...shiftFormData, totalHoursWorked: parseFloat(e.target.value) || 0 })}
                  className="font-bold text-xs font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter className="flex flex-row justify-between sm:justify-end gap-2">
            <Button variant="outline" onClick={() => setEditShiftModalOpen(false)} className="font-bold uppercase text-xs h-10">
              Cancel
            </Button>
            <Button onClick={handleSaveShiftEdit} disabled={isSavingShift} className="font-bold uppercase text-xs h-10 shadow-lg">
              {isSavingShift ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guided Tour component */}
      <GuidedTour
        isOpen={tutorialOpen}
        onClose={() => setTutorialOpen(false)}
        steps={tutorialSteps}
      />
    </div>
  );
}
