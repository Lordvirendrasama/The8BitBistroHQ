
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Shift, ShiftTask, Employee, Leave } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  isSameMonth, 
  startOfWeek, 
  endOfWeek, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { 
  Clock, 
  UserCheck, 
  UserX, 
  ChevronLeft, 
  ChevronRight, 
  PlusCircle,
  Edit,
  Trash2,
  Zap,
  Moon,
  Plus,
  AlertTriangle,
  DollarSign,
  Plane
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogCancel, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle, 
  AlertDialogTrigger 
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateShiftTimes, updateTask, manuallyCreateShift, deleteShift } from '@/firebase/firestore/shifts';
import { clearAttendanceData } from '@/firebase/firestore/data-management';
import { recordLeave } from '@/firebase/firestore/leaves';
import { SalaryCalculator } from '@/components/attendance/salary-calculator';
import { useToast } from '@/hooks/use-toast';
 
const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

function AttendanceCalendar({ shifts, leaves, filterStaff, user, onAddClick, onEditClick }: { shifts: Shift[], leaves: Leave[], filterStaff: string, user: any, onAddClick?: (date: Date) => void, onEditClick?: (s: any) => void }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { toast } = useToast();

  const isOwner = user?.username === 'Viren';

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleVerify = async (shiftId: string, taskName: string, result: 'yes' | 'no' | null) => {
    if (!isOwner) return;
    const success = await updateTask(shiftId, taskName, result !== null, user, result || undefined);
    if (success) {
        toast({ title: result ? "Verified" : "Reset", description: result ? `Marked as ${result.toUpperCase()}.` : "Reset." });
    }
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    
    const results: any[] = [];

    // Process Overlapping Leaves First
    const overlappingLeaves = leaves.filter(l => {
        const s = new Date(l.startDate);
        const e = new Date(l.endDate);
        const d = new Date(date);
        s.setHours(0,0,0,0);
        e.setHours(0,0,0,0);
        d.setHours(0,0,0,0);
        return d >= s && d <= e;
    });

    overlappingLeaves.forEach(leave => {
        const isMismatched = filterStaff !== 'all' && leave.employeeName.toLowerCase() !== filterStaff.toLowerCase();
        if (isMismatched) return;
        
        results.push({
            isLeave: true,
            leaveId: leave.id,
            displayName: leave.employeeName,
            type: leave.type,
            reason: leave.reason,
            status: leave.status
        });
    });

    dayShifts.forEach(shift => {
      const staffUsername = shift.staffId || (shift.employees && shift.employees[0]?.username);
      const staffDisplayName = (shift.employees && shift.employees[0]?.displayName) || shift.staffId || 'Unknown';
      
      if (!staffUsername) return; 
      if (filterStaff !== 'all' && staffUsername.toLowerCase() !== filterStaff.toLowerCase()) return;

      const verifyTask = (shift.tasks || []).find(t => t.type === 'strategic');

      results.push({
        shiftId: shift.id,
        taskName: verifyTask?.name || `Verify ${staffDisplayName} Presence`,
        username: staffUsername,
        displayName: staffDisplayName,
        verified: !!verifyTask?.completed,
        result: verifyTask?.verificationResult,
        loginTime: shift.startTime ? format(new Date(shift.startTime), 'p') : 'N/A',
        rawStartTime: shift.startTime ? new Date(shift.startTime).getTime() : null,
        logoutTime: shift.endTime ? format(new Date(shift.endTime), 'p') : null,
        rawEndTime: shift.endTime ? new Date(shift.endTime).getTime() : null,
        originalShift: shift,
        wasForceExited: !!shift.wasForceExited
      });
    });

    return results.length > 0 ? results : null;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 bg-muted/20 p-4 rounded-xl border-2 border-dashed">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
          <h2 className="font-headline text-lg uppercase">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
        </div>
        <p className="text-[10px] font-black uppercase text-muted-foreground opacity-60">Visual Presence Audit</p>
      </div>

      <div className="grid grid-cols-7 gap-px bg-muted border-2 rounded-xl overflow-hidden shadow-inner overflow-x-auto min-w-[800px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-muted/50 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">{d}</div>
        ))}
        {days.map((day, i) => {
          const isCurrent = isSameMonth(day, currentMonth);
          const status = getDayStatus(day);
          return (
            <div key={i} className={cn("min-h-[160px] p-2 bg-background flex flex-col gap-1 transition-all group", !isCurrent && "opacity-20 pointer-events-none", isToday(day) && "ring-2 ring-inset ring-primary/20 bg-primary/[0.02]")}>
              <div className="flex justify-between items-start mb-1">
                <span className={cn("text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full", isToday(day) ? "bg-primary text-white" : "text-muted-foreground")}>{format(day, 'd')}</span>
                {isOwner && onAddClick && <Button variant="ghost" size="icon" onClick={() => onAddClick(day)} className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"><Plus className="h-3 w-3" /></Button>}
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                {status?.map((s: any, idx) => {
                  if (s.isLeave) {
                      return (
                          <div key={idx} className={cn("w-full p-2 rounded-lg border-2 border-dashed text-[9px] font-black uppercase text-left transition-all", s.type === 'paid' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : s.type === 'sick' ? "bg-amber-500/10 border-amber-500/20 text-amber-700" : "bg-red-500/10 border-red-500/20 text-red-700")}>
                              <div className="flex items-center justify-between gap-1 mb-1">
                                  <span className="truncate">{s.displayName}</span>
                                  <Plane className="h-3 w-3 opacity-60" />
                              </div>
                              <p className="text-[7px] font-mono opacity-80">{s.type} LEAVE ({s.status})</p>
                              {s.reason && <p className="text-[7px] font-mono opacity-50 mt-0.5 truncate">{s.reason}</p>}
                          </div>
                      );
                  }

                  return (
                      <button key={idx} onClick={() => isOwner && onEditClick?.(s)} className={cn("w-full p-2 rounded-lg border-2 text-[9px] font-black uppercase text-left transition-all", s.result === 'yes' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : s.result === 'no' ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-background border-muted text-muted-foreground")}>
                        <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="truncate">{s.displayName}</span>
                            {s.result === 'yes' ? <UserCheck className="h-3 w-3" /> : s.result === 'no' ? <UserX className="h-3 w-3" /> : <Clock className="h-3 w-3 opacity-40" />}
                        </div>
                        <p className="text-[7px] font-mono opacity-60">IN: {s.loginTime}</p>
                        {isOwner && (
                            <div className="flex gap-1 pt-1 border-t border-dashed border-current mt-1">
                                {!s.verified ? (
                                    <>
                                        <div onClick={(e) => { e.stopPropagation(); handleVerify(s.shiftId, s.taskName, 'yes'); }} className="flex-1 py-1 bg-emerald-600 text-white rounded text-center">YES</div>
                                        <div onClick={(e) => { e.stopPropagation(); handleVerify(s.shiftId, s.taskName, 'no'); }} className="flex-1 py-1 bg-destructive text-white rounded text-center">NO</div>
                                    </>
                                ) : (
                                    <div onClick={(e) => { e.stopPropagation(); handleVerify(s.shiftId, s.taskName, null); }} className="w-full py-1 bg-muted text-muted-foreground rounded flex justify-center items-center gap-1">RESET</div>
                                )}
                            </div>
                        )}
                      </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AttendanceRegistryPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [activeTab, setActiveTab] = useState('registry');
  const [staffFilter, setStaffFilter] = useState('all');
  const [monthFilter, setMonthFilter] = useState('all');
  
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'yes' | 'no' | 'leave' | null>(null);
  const [editLeaveType, setEditLeaveType] = useState<'paid' | 'unpaid' | 'sick'>('paid');
  const [editLeaveReason, setEditLeaveReason] = useState('');
  
  const [editStartDate, setEditStartDate] = useState('');
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndDate, setEditEndDate] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editCash, setEditCash] = useState('');
  const [editUpi, setEditUpi] = useState('');
  const [editTasks, setEditTasks] = useState<ShiftTask[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const auditFlags = useMemo(() => {
    if (!editStartTime || editStatus === 'leave') return { isLate: false, isShortShift: false, shiftDurationHours: 0 };
    
    // Check Late Login (After 11:10 AM)
    const [h, m] = editStartTime.split(':').map(Number);
    const loginMinutes = h * 60 + m;
    const isLate = loginMinutes > (11 * 60 + 10);
    
    // Check 12-Hour Shift
    let isShortShift = false;
    let shiftDurationHours = 0;
    if (editStartDate && editStartTime && editEndDate && editEndTime) {
        const start = new Date(`${editStartDate}T${editStartTime}:00`);
        const end = new Date(`${editEndDate}T${editEndTime}:00`);
        const durationMs = end.getTime() - start.getTime();
        shiftDurationHours = Math.round((durationMs / (1000 * 60 * 60)) * 10) / 10;
        isShortShift = shiftDurationHours > 0 && shiftDurationHours < 12;
    }
    
    return { isLate, isShortShift, shiftDurationHours };
  }, [editStartTime, editStartDate, editEndDate, editEndTime, editStatus]);

  // Manual Add State
  const [isAddAttendanceModalOpen, setIsAddAttendanceModalOpen] = useState(false);
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [addFormData, setAddFormData] = useState({
    username: '',
    date: toLocalISOString(new Date()).slice(0, 10),
    loginTime: '11:00',
    logoutTime: '23:00',
    status: 'yes' as 'yes' | 'no' | 'leave',
    leaveType: 'paid' as 'paid' | 'unpaid' | 'sick',
    leaveReason: ''
  });
  
  const [isSalaryCalculatorOpen, setIsSalaryCalculatorOpen] = useState(false);

  const shiftsQuery = useMemo(() => !db ? null : query(collection(db, 'shifts'), orderBy('startTime', 'desc')), [db]);
  const { data: allShifts, loading } = useCollection<Shift>(shiftsQuery);

  const leavesQuery = useMemo(() => !db ? null : collection(db, 'leaves'), [db]);
  const { data: allLeaves } = useCollection<Leave>(leavesQuery);

  const employeesQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const staffOptions = useMemo(() => {
    if (!allShifts) return [];
    const staffMap = new Map<string, string>();
    allShifts.forEach(s => {
      if (s.staffId) {
        const displayName = (s.employees && s.employees[0]?.displayName) || s.staffId;
        staffMap.set(s.staffId.toLowerCase(), displayName);
      }
    });
    return Array.from(staffMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allShifts]);

  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(s => {
        const matchesStaff = staffFilter === 'all' || (s.staffId && s.staffId.toLowerCase() === staffFilter.toLowerCase());
        const matchesMonth = monthFilter === 'all' || (s.startTime && format(new Date(s.startTime), 'yyyy-MM') === monthFilter);
        return matchesStaff && matchesMonth;
    });
  }, [allShifts, staffFilter, monthFilter]);

  const handleManualAddAttendance = async () => {
    const emp = employees?.find(e => e.username === addFormData.username);
    if (!emp || !user) {
        toast({ variant: 'destructive', title: "Operator Missing", description: "Please pick an operator from the registry." });
        return;
    }
    setIsAddingAttendance(true);
    
    try {
        if (addFormData.status === 'leave') {
            await recordLeave({
                employeeId: emp.id,
                employeeName: emp.displayName,
                startDate: addFormData.date,
                endDate: addFormData.date,
                type: addFormData.leaveType,
                reason: addFormData.leaveReason || (addFormData.leaveType.toUpperCase() + ' LEAVE'),
                status: 'approved'
            });

            // Reconcile manual absent shift to balance visual registry
            const [year, month, day] = addFormData.date.split('-').map(Number);
            const start = new Date(year, month - 1, day, 11, 0, 0, 0);
            await manuallyCreateShift({ 
                username: addFormData.username,
                date: addFormData.date,
                status: 'no',
                displayName: emp.displayName,
                startTime: start.toISOString(),
                endTime: null
            }, user);

            toast({ title: "Logged", description: `Leave recorded for ${emp.displayName}.` });
            setIsAddAttendanceModalOpen(false);
            setAddFormData({
                username: '',
                date: new Date().toISOString().slice(0, 10),
                loginTime: '11:00',
                logoutTime: '23:00',
                status: 'yes',
                leaveType: 'paid',
                leaveReason: ''
            });

        } else {
            const [year, month, day] = addFormData.date.split('-').map(Number);
            const start = new Date(year, month - 1, day);
            const [sh, sm] = addFormData.loginTime.split(':').map(Number);
            start.setHours(sh, sm, 0, 0);
            const startIso = start.toISOString();

            let endIso = null;
            if (addFormData.logoutTime) {
                const end = new Date(year, month - 1, day);
                const [eh, em] = addFormData.logoutTime.split(':').map(Number);
                end.setHours(eh, em, 0, 0);
                if (end < start) end.setDate(end.getDate() + 1);
                endIso = end.toISOString();
            }

            const success = await manuallyCreateShift({ 
                username: addFormData.username,
                date: addFormData.date,
                status: addFormData.status as 'yes' | 'no',
                displayName: emp.displayName,
                startTime: startIso,
                endTime: endIso
            }, user);

            if (success) {
                toast({ title: "Logged", description: `Attendance record created for ${emp.displayName}.` });
                setIsAddAttendanceModalOpen(false);
                setAddFormData({
                    username: '',
                    date: new Date().toISOString().slice(0, 10),
                    loginTime: '11:00',
                    logoutTime: '23:00',
                    status: 'yes',
                    leaveType: 'paid',
                    leaveReason: ''
                });
            }
        }
    } catch (error) {
        console.error("Manual add failed:", error);
        toast({ variant: 'destructive', title: "Creation Failed" });
    } finally {
        setIsAddingAttendance(false);
    }
  };

  const handleEditClick = (record: any) => {
    const isCalendar = !!record.originalShift;
    const shift = isCalendar ? record.originalShift : record;
    
    setEditingRecord({ isCalendar, shift, record });
    
    const verifyTask = (shift.tasks || []).find((t: any) => t.type === 'strategic');
    setEditStatus(verifyTask ? (verifyTask.verificationResult as any) : null);
    
    if (shift.startTime) {
        const d = new Date(shift.startTime);
        setEditStartDate(format(d, 'yyyy-MM-dd'));
        setEditStartTime(format(d, 'HH:mm'));
    } else {
        setEditStartDate('');
        setEditStartTime('');
    }
    
    if (shift.endTime) {
        const d = new Date(shift.endTime);
        setEditEndDate(format(d, 'yyyy-MM-dd'));
        setEditEndTime(format(d, 'HH:mm'));
    } else {
        setEditEndDate('');
        setEditEndTime('');
    }
    setEditCash(shift.cashTotal?.toString() || '0');
    setEditUpi(shift.upiTotal?.toString() || '0');
    setEditTasks(shift.tasks || []);
    
    setEditLeaveType('paid');
    setEditLeaveReason('');
  };

  const handleSaveEdit = async () => {
    if (!editingRecord || !user) return;
    setIsSubmitting(true);
    
    const { shift } = editingRecord;
    const shiftDate = format(new Date(shift.startTime), 'yyyy-MM-dd');
    const staffUsername = shift.staffId || shift.employees?.[0]?.username || 'unknown';
    const displayName = shift.employees?.[0]?.displayName || staffUsername;
    
    if (editStatus === 'leave') {
        const leaveSuccess = await recordLeave({
            employeeId: staffUsername,
            employeeName: displayName,
            startDate: shiftDate,
            endDate: shiftDate,
            type: editLeaveType,
            reason: editLeaveReason || (editLeaveType.toUpperCase() + ' LEAVE (UPDATE AUDIT)'),
            status: 'approved'
        });
        
        if (leaveSuccess) {
            const verifyTask = (shift.tasks || []).find((t: any) => t.type === 'strategic');
            if (verifyTask) await updateTask(shift.id, verifyTask.name, true, user, 'no');
            toast({ title: 'Leave Recorded' });
            setEditingRecord(null);
        }
    } else {
        const newStartTime = (editStartDate && editStartTime) ? new Date(`${editStartDate}T${editStartTime}:00`).toISOString() : shift.startTime;
        const newEndTime = (editEndDate && editEndTime) ? new Date(`${editEndDate}T${editEndTime}:00`).toISOString() : null;

        const sSuccess = await updateShiftTimes(shift.id, { 
            startTime: newStartTime, 
            endTime: newEndTime,
            cashTotal: Number(editCash),
            upiTotal: Number(editUpi),
            tasks: editTasks
        }, user);
        
        let tSuccess = true;
        const verifyTask = (shift.tasks || []).find((t: any) => t.type === 'strategic');
        if (verifyTask && editStatus && editStatus !== 'leave') {
            tSuccess = await updateTask(shift.id, verifyTask.name, true, user, editStatus);
        }

        if (sSuccess && tSuccess) {
          toast({ title: 'Updated' });
          setEditingRecord(null);
        }
    }
    
    setIsSubmitting(false);
  };

  const handleDeleteShift = async () => {
    if (!editingRecord || !window.confirm("Are you sure you want to permanently delete this login record?")) return;
    setIsSubmitting(true);
    const success = await deleteShift(editingRecord.shift.id);
    if (success) { toast({ title: "Record Deleted" }); setEditingRecord(null); }
    else { toast({ variant: 'destructive', title: "Delete Failed" }); }
    setIsSubmitting(false);
  };

  const handleWipeAll = async () => {
    try {
        await clearAttendanceData();
        toast({ title: "Attendance Nuked", description: "All shift records have been erased." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Wipe Failed" });
    }
  };

  const monthOptions = useMemo(() => {
    if (!allShifts) return [];
    const months = new Set<string>();
    allShifts.forEach(s => {
      if (s.startTime) {
        months.add(format(new Date(s.startTime), 'yyyy-MM'));
      }
    });
    return Array.from(months).sort().reverse();
  }, [allShifts]);

  if (loading) return <div className="flex h-screen items-center justify-center animate-pulse uppercase font-black text-xs">Syncing Registry...</div>;

  const isAdmin = user?.role === 'admin' || user?.username === 'Viren';
  const isOwner = user?.username === 'Viren';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20 font-body">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
          <div className="flex items-center gap-4">
            <h1 className="font-headline text-4xl uppercase tracking-wider">Attendance Hub</h1>
            {isOwner && (
                <div className="flex gap-2">
                    <Button onClick={() => setIsAddAttendanceModalOpen(true)} size="sm" className="h-8 px-4 font-black uppercase text-[10px] gap-2 shadow-lg">
                        <Plus className="h-3.5 w-3.5" /> ADD LOG
                    </Button>
                    <Button onClick={() => setIsSalaryCalculatorOpen(true)} size="sm" className="h-8 px-4 font-black uppercase text-[10px] gap-2 shadow-lg bg-emerald-600 hover:bg-emerald-700">
                        <DollarSign className="h-3.5 w-3.5" /> PAYROLL
                    </Button>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button variant="outline" size="sm" className="h-8 border-2 border-destructive/30 text-destructive hover:bg-destructive hover:text-white transition-all font-black uppercase text-[10px] gap-2">
                                <Trash2 className="h-3.5 w-3.5" /> Wipe History
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="border-4 border-destructive font-body">
                            <AlertDialogHeader>
                                <AlertDialogTitle className="font-headline text-destructive text-xl">NUCLEAR WIPEOUT?</AlertDialogTitle>
                                <AlertDialogDescription className="font-bold text-foreground">
                                    This will permanently delete ALL shift records and attendance data. This action is irreversible.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel className="font-bold">Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={handleWipeAll} className="bg-destructive hover:bg-destructive/90 font-black uppercase">Destroy Records</AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            )}
          </div>
          <div className="flex items-center gap-3">
              <Select value={staffFilter} onValueChange={setStaffFilter}>
                  <SelectTrigger className="w-[160px] h-10 border-2 font-bold uppercase text-[10px] bg-background">
                      <SelectValue placeholder="Filter Staff" />
                  </SelectTrigger>
                  <SelectContent>
                      <SelectItem value="all">ALL OPERATORS</SelectItem>
                      {staffOptions.map(([u, d]) => <SelectItem key={u} value={u}>{d.toUpperCase()}</SelectItem>)}
                  </SelectContent>
              </Select>
              <TabsList className="bg-muted/20 border-2 border-dashed h-10 p-1 rounded-xl">
                  <TabsTrigger value="registry" className="font-black uppercase text-[9px] tracking-widest px-4 h-full data-[state=active]:bg-background">Registry</TabsTrigger>
                  <TabsTrigger value="calendar" className="font-black uppercase text-[9px] tracking-widest px-4 h-full data-[state=active]:bg-background">Visual Audit</TabsTrigger>
              </TabsList>
          </div>
        </div>

        <TabsContent value="registry" className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
          <Card className="border-2 shadow-none overflow-hidden">
              <Table>
                  <TableHeader className="bg-muted/20">
                  <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Operator</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Logins</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Alerts</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Tasks</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px]">Pool</TableHead>
                      {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredShifts.map((shift) => (
                      <TableRow key={shift.id} className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="font-black uppercase text-[10px]">{format(new Date(shift.startTime), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-black uppercase text-xs">{(shift.employees || [])[0]?.displayName || shift.staffId || 'Unknown'}</TableCell>
                      <TableCell>
                          <div className="flex flex-col text-[10px] font-bold uppercase text-emerald-600">
                              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 fill-current" /> {format(new Date(shift.startTime), 'p')}</span>
                              {shift.endTime && <span className="text-muted-foreground flex items-center gap-1.5 mt-1"><Moon className="h-3 w-3" /> {format(new Date(shift.endTime), 'p')}</span>}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex gap-1">
                              {(() => {
                                  const verifyTask = (shift.tasks || []).find((t: any) => t.type === 'strategic');
                                  const isAbsent = verifyTask?.verificationResult === 'no';
                                  if (isAbsent) {
                                      return <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black">ABSENT</Badge>;
                                  }
                                  const staffUsername = shift.staffId || shift.employees?.[0]?.username;
                                  if (staffUsername === 'Rupali') {
                                      return <Badge variant="outline" className="h-4 text-[7px] uppercase font-black text-emerald-600 border-emerald-500/30 bg-emerald-500/5">PRESENT</Badge>;
                                  }
                                  return shift.lateMinutes ? <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black">LATE</Badge> : <Badge variant="outline" className="h-4 text-[7px] uppercase font-black text-emerald-600">ON TIME</Badge>;
                              })()}
                              {shift.wasForceExited && <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black">FORCE</Badge>}
                          </div>
                      </TableCell>
                      <TableCell>
                          {(() => {
                              const pendingCount = (shift.tasks || []).filter(t => !t.completed).length;
                              if (pendingCount === 0) {
                                  return <Badge variant="outline" className="h-4 text-[7px] uppercase font-black text-emerald-600 border-emerald-500/30">ALL DONE</Badge>;
                              }
                              return (
                                  <Badge variant="outline" className="h-4 text-[7px] uppercase font-black text-destructive border-destructive/30 bg-destructive/5 gap-1">
                                      <AlertTriangle className="h-2 w-2" /> {pendingCount} PENDING
                                  </Badge>
                              );
                          })()}
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono font-black text-xs text-primary">₹{((shift.cashTotal || 0) + (shift.upiTotal || 0)).toLocaleString()}</TableCell>
                      {isAdmin && <TableCell><Button variant="ghost" size="icon" onClick={() => handleEditClick(shift)}><Edit className="h-4 w-4" /></Button></TableCell>}
                      </TableRow>
                  ))}
                  {filteredShifts.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={7} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No matching records found.</TableCell>
                      </TableRow>
                  )}
                  </TableBody>
              </Table>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="animate-in fade-in slide-in-from-right-2 duration-300">
            <AttendanceCalendar 
                shifts={allShifts || []} 
                leaves={allLeaves || []}
                filterStaff={staffFilter} 
                user={user} 
                onAddClick={(date) => {
                    setAddFormData(p => ({ ...p, date: format(date, 'yyyy-MM-dd') }));
                    setIsAddAttendanceModalOpen(true);
                }}
                onEditClick={handleEditClick}
            />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingRecord} onOpenChange={o => !o && setEditingRecord(null)}>
        <DialogContent className="max-w-md font-body">
            <DialogHeader><DialogTitle className="font-headline text-lg uppercase">Update Audit</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">

                <div className="space-y-1.5 border-b pb-4">
                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Presence Verification</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <Button variant={editStatus === 'yes' ? 'default' : 'outline'} onClick={() => setEditStatus('yes')} className="h-10 font-black uppercase text-[10px] border-2">PRESENT</Button>
                        <Button variant={editStatus === 'no' ? 'destructive' : 'outline'} onClick={() => setEditStatus('no')} className="h-10 font-black uppercase text-[10px] border-2">ABSENT</Button>
                        <Button variant={editStatus === 'leave' ? 'secondary' : 'outline'} onClick={() => setEditStatus('leave')} className="h-10 font-black uppercase text-[10px] border-2 bg-muted/60">LEAVE (OFF)</Button>
                    </div>
                </div>

                {editStatus === 'leave' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50 pl-1">Leave Category</Label><Select value={editLeaveType} onValueChange={(v: any) => setEditLeaveType(v)}><SelectTrigger className="h-12 border-2 uppercase font-bold text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="paid" className="font-bold text-xs uppercase">Paid Leave</SelectItem><SelectItem value="unpaid" className="font-bold text-xs uppercase">Unpaid (LWP)</SelectItem><SelectItem value="sick" className="font-bold text-xs uppercase">Sick Leave</SelectItem></SelectContent></Select></div>
                    <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50 pl-1">Reason / Memo</Label><Input value={editLeaveReason} onChange={e => setEditLeaveReason(e.target.value)} placeholder="e.g. SICK LEAVE" className="h-12 font-bold uppercase text-xs border-2" /></div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Start Date</Label>
                                <Input type="date" value={editStartDate} onChange={e => setEditStartDate(e.target.value)} className="h-12 font-mono border-2" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between pr-1">
                                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Start Time</Label>
                                    {auditFlags.isLate && <span className="text-[8px] font-black text-destructive uppercase animate-pulse flex items-center gap-1"><AlertTriangle className="h-2 w-2" /> LATE LOGIN</span>}
                                </div>
                                <Input type="time" value={editStartTime} onChange={e => setEditStartTime(e.target.value)} className={cn("h-12 font-mono border-2", auditFlags.isLate && "border-destructive/50 bg-destructive/5")} />
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <Label className="text-[9px] font-black uppercase opacity-50 pl-1">End Date</Label>
                                <Input type="date" value={editEndDate} onChange={e => setEditEndDate(e.target.value)} className="h-12 font-mono border-2" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between pr-1">
                                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">End Time</Label>
                                    {auditFlags.isShortShift && <span className="text-[8px] font-black text-amber-600 uppercase flex items-center gap-1"><Zap className="h-2 w-2" /> {auditFlags.shiftDurationHours} HRS</span>}
                                </div>
                                <Input type="time" value={editEndTime} onChange={e => setEditEndTime(e.target.value)} className={cn("h-12 font-mono border-2", auditFlags.isShortShift && "border-amber-500/50 bg-amber-500/5")} />
                            </div>
                        </div>
                    </div>
                    {auditFlags.isShortShift && (
                        <div className="px-3 py-2 bg-amber-50 border-2 border-amber-200/50 rounded-lg flex items-center gap-3">
                            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                            <p className="text-[10px] font-bold text-amber-700 uppercase leading-tight">Wait! Shift is only {auditFlags.shiftDurationHours} hours. Verify if employee completed the full 12-hour session.</p>
                        </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50 pl-1">Cash Total</Label><Input type="number" value={editCash} onChange={e => setEditCash(e.target.value)} className="h-12 font-mono font-bold border-2" /></div>
                        <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50 pl-1">UPI Total</Label><Input type="number" value={editUpi} onChange={e => setEditUpi(e.target.value)} className="h-12 font-mono font-bold border-2" /></div>
                    </div>

                    {editTasks.length > 0 && isAdmin && (
                        <div className="space-y-3 pt-4 border-t border-dashed">
                            <Label className="text-[10px] font-black uppercase opacity-50 pl-1">Compliance Audit</Label>
                            <div className="space-y-3 max-h-32 overflow-y-auto pr-2 custom-scrollbar">
                                {editTasks.map((task, idx) => (
                                    <div key={idx} className="flex items-start space-x-3">
                                        <Checkbox 
                                            id={`edit-task-${idx}`} 
                                            checked={task.completed} 
                                            onCheckedChange={(checked) => {
                                                const newTasks = [...editTasks];
                                                newTasks[idx] = { 
                                                    ...task, 
                                                    completed: !!checked,
                                                    completedAt: checked ? new Date().toISOString() : undefined,
                                                    completedBy: checked ? { username: user.username, displayName: user.displayName } : undefined
                                                };
                                                setEditTasks(newTasks);
                                            }}
                                            className="mt-0.5 h-4 w-4 border-2"
                                        />
                                        <div className="flex-1">
                                            <Label htmlFor={`edit-task-${idx}`} className={cn("text-xs font-bold uppercase cursor-pointer transition-all", task.completed ? "text-muted-foreground line-through opacity-50" : "text-foreground")}>{task.name}</Label>
                                            {task.completed && task.completedBy && <p className="text-[8px] font-medium text-emerald-600 uppercase mt-0.5">Verified by {task.completedBy.displayName}</p>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                  </>
                )}
            </div>
            <DialogFooter className="flex w-full gap-2 sm:justify-between items-center sm:space-x-0">
                <Button disabled={isSubmitting} variant="destructive" onClick={handleDeleteShift} className="h-12 w-12 shrink-0 p-0"><Trash2 className="h-5 w-5" /></Button>
                <Button disabled={isSubmitting} onClick={handleSaveEdit} className="h-12 flex-1 font-black uppercase tracking-widest shadow-xl">Update Audit</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddAttendanceModalOpen} onOpenChange={setIsAddAttendanceModalOpen}>
        <DialogContent className="max-w-md font-body">
            <DialogHeader>
                <DialogTitle className="font-headline text-lg uppercase">Manual Entry</DialogTitle>
                <DialogDescription className="text-xs uppercase font-bold text-muted-foreground tracking-widest">Construct a historical attendance record.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Target Operator</Label>
                    <Select value={addFormData.username} onValueChange={v => setAddFormData(p => ({...p, username: v}))}>
                        <SelectTrigger className="h-12 font-bold uppercase border-2"><SelectValue placeholder="PICK OPERATOR" /></SelectTrigger>
                        <SelectContent>{employees?.filter(e => e.isActive).map(e => <SelectItem key={e.username} value={e.username} className="font-bold">{e.displayName.toUpperCase()}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Presence Verification</Label>
                    <div className="grid grid-cols-3 gap-2">
                        <Button variant={addFormData.status === 'yes' ? 'default' : 'outline'} onClick={() => setAddFormData(p => ({...p, status: 'yes'}))} className="h-12 font-black uppercase text-[10px] border-2">PRESENT</Button>
                        <Button variant={addFormData.status === 'no' ? 'destructive' : 'outline'} onClick={() => setAddFormData(p => ({...p, status: 'no'}))} className="h-12 font-black uppercase text-[10px] border-2">ABSENT</Button>
                        <Button variant={addFormData.status === 'leave' ? 'secondary' : 'outline'} onClick={() => setAddFormData(p => ({...p, status: 'leave'}))} className="h-12 font-black uppercase text-[10px] border-2 bg-muted/60">LEAVE (OFF)</Button>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Business Date</Label>
                    <Input type="date" value={addFormData.date} onChange={e => setAddFormData(p => ({...p, date: e.target.value}))} className="h-12 font-bold border-2" />
                </div>

                {addFormData.status === 'leave' ? (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Leave Category</Label>
                        <Select value={addFormData.leaveType} onValueChange={(v: any) => setAddFormData(p => ({...p, leaveType: v}))}>
                            <SelectTrigger className="h-12 border-2 uppercase font-bold text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                <SelectItem value="paid" className="font-bold text-xs uppercase">Paid Leave</SelectItem>
                                <SelectItem value="unpaid" className="font-bold text-xs uppercase">Unpaid (LWP)</SelectItem>
                                <SelectItem value="sick" className="font-bold text-xs uppercase">Sick Leave</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="space-y-1.5">
                        <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Reason / Memo</Label>
                        <Input value={addFormData.leaveReason} onChange={e => setAddFormData(p => ({...p, leaveReason: e.target.value}))} placeholder="e.g. SICK LEAVE" className="h-12 font-bold uppercase text-xs border-2" />
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Login Time</Label>
                          <Input type="time" value={addFormData.loginTime} onChange={e => setAddFormData(p => ({...p, loginTime: e.target.value}))} className="h-12 font-mono font-bold border-2" />
                      </div>
                      <div className="space-y-1.5">
                          <Label className="text-[9px] font-black uppercase opacity-50 pl-1">Logout Time</Label>
                          <Input type="time" value={addFormData.logoutTime} onChange={e => setAddFormData(p => ({...p, logoutTime: e.target.value}))} className="h-12 font-mono font-bold border-2" />
                      </div>
                  </div>
                )}
            </div>
            <DialogFooter>
                <Button disabled={isAddingAttendance || !addFormData.username} onClick={handleManualAddAttendance} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">
                    {isAddingAttendance ? 'Saving...' : 'Commit Record'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SalaryCalculator open={isSalaryCalculatorOpen} onOpenChange={setIsSalaryCalculatorOpen} />
    </div>
  );
}
