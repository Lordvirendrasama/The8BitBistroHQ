
'use client';

import { useMemo, useState, useEffect } from 'react';
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
  Plane,
  Users,
  IndianRupee
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn, getBusinessDate } from '@/lib/utils';
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
import { updateShiftTimes, updateTask, manuallyCreateShift, deleteShift, endShift } from '@/firebase/firestore/shifts';
import { clearAttendanceData } from '@/firebase/firestore/data-management';
import { recordLeave } from '@/firebase/firestore/leaves';
import { SalaryCalculator } from '@/components/attendance/salary-calculator';
import { useToast } from '@/hooks/use-toast';
 
const toLocalISOString = (date: Date) => {
  const tzOffset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - tzOffset).toISOString().slice(0, 16);
};

const getFormattedDate = (dateStr: string) => {
  try {
    const parts = dateStr.split('-');
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return format(d, 'MMM dd');
  } catch (e) {
    return dateStr;
  }
};

const formatShiftHours = (start?: string, end?: string) => {
  if (!start || !end) return 'N/A';
  const formatTimeStr = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const displayH = h % 12 || 12;
    return m === 0 ? `${displayH}${ampm}` : `${displayH}:${String(m).padStart(2, '0')}${ampm}`;
  };
  return `${formatTimeStr(start)}-${formatTimeStr(end)}`;
};

const getStatusBadge = (status: string, forgotToLogout?: boolean) => {
  if (forgotToLogout) {
    return <Badge className="bg-orange-500 hover:bg-orange-600 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Forgot Logout</Badge>;
  }
  switch (status) {
    case 'Present':
      return <Badge className="bg-emerald-600 hover:bg-emerald-700 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Present</Badge>;
    case 'Late':
      return <Badge className="bg-yellow-500 hover:bg-yellow-600 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Late</Badge>;
    case 'Half Day':
      return <Badge className="bg-amber-500 hover:bg-amber-600 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Half Day</Badge>;
    case 'Absent':
      return <Badge className="bg-destructive hover:bg-destructive/90 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Absent</Badge>;
    case 'Weekly Off':
      return <Badge className="bg-slate-400 hover:bg-slate-500 text-white uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">Weekly Off</Badge>;
    default:
      return <Badge className="bg-muted text-muted-foreground uppercase font-black text-[9px] tracking-widest px-2 py-0.5 rounded">{status}</Badge>;
  }
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

  const [currentTime, setCurrentTime] = useState(new Date());

  // Live timer for active shift duration
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(interval);
  }, []);

  const isOwner = user?.username === 'Viren';

  // Fallback: trigger background cron check when admin loads attendance page
  useEffect(() => {
    if (isOwner) {
      fetch('/api/cron/attendance-cron')
        .then(res => res.json())
        .then(data => {
          if (data.processed && data.processed.length > 0) {
            toast({ title: "System Synced", description: "Absences and auto midnight logouts reconciled." });
          }
        })
        .catch(err => console.error("Error triggering cron:", err));
    }
  }, [isOwner, toast]);

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

  // Today's business date
  const todayStr = useMemo(() => getBusinessDate(), []);

  // Summary stats for today
  const dashboardStats = useMemo(() => {
    if (!allShifts) return { present: 0, late: 0, absent: 0, onShift: 0, loggedOut: 0, forgotLogout: 0 };
    
    const shiftsToday = allShifts.filter(s => s.date === todayStr);
    
    const present = shiftsToday.filter(s => s.attendanceStatus === 'Present').length;
    const late = shiftsToday.filter(s => s.attendanceStatus === 'Late').length;
    const absent = shiftsToday.filter(s => s.attendanceStatus === 'Absent').length;
    const onShift = allShifts.filter(s => s.status === 'active').length;
    const loggedOut = shiftsToday.filter(s => s.status === 'completed' && s.attendanceStatus !== 'Absent' && s.attendanceStatus !== 'Weekly Off').length;
    
    // Forgot logouts count in current month
    const currentMonthPrefix = todayStr.slice(0, 7);
    const forgotLogout = allShifts.filter(s => s.forgotToLogout === true && s.date.slice(0, 7) === currentMonthPrefix).length;

    return { present, late, absent, onShift, loggedOut, forgotLogout };
  }, [allShifts, todayStr]);

  const activeShiftsList = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(s => s.status === 'active');
  }, [allShifts]);

  const attendanceAlerts = useMemo(() => {
    const alerts: string[] = [];
    if (!allShifts) return alerts;

    const shiftsToday = allShifts.filter(s => s.date === todayStr);

    shiftsToday.forEach(s => {
      const empName = s.employees?.[0]?.displayName || s.staffId || 'Unknown';
      if (s.attendanceStatus === 'Late') {
        alerts.push(`⚠️ ${empName} arrived LATE today (login: ${s.actualLogin || 'N/A'})`);
      }
      if (s.attendanceStatus === 'Absent') {
        alerts.push(`🔴 ${empName} is ABSENT today`);
      }
    });

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);
    const threeDaysAgoStr = format(threeDaysAgo, 'yyyy-MM-dd');
    
    allShifts.filter(s => s.forgotToLogout === true && s.date >= threeDaysAgoStr).forEach(s => {
      const empName = s.employees?.[0]?.displayName || s.staffId || 'Unknown';
      alerts.push(`⚠️ ${empName} forgot to logout on ${s.date} (Auto Logged Out)`);
    });

    activeShiftsList.forEach(s => {
      const empName = s.employees?.[0]?.displayName || s.staffId || 'Unknown';
      const startTimeDate = new Date(s.startTime);
      const durationMs = currentTime.getTime() - startTimeDate.getTime();
      
      const scheduledStart = s.scheduledLogin || "11:00";
      const scheduledEnd = s.scheduledLogout || "23:00";
      const [startH, startM] = scheduledStart.split(':').map(Number);
      const [endH, endM] = scheduledEnd.split(':').map(Number);
      let scheduledDiffMins = (endH * 60 + endM) - (startH * 60 + startM);
      if (scheduledDiffMins < 0) scheduledDiffMins += 24 * 60;
      const scheduledDurationHours = scheduledDiffMins / 60;

      const durationHours = durationMs / 3600000;
      if (durationHours > scheduledDurationHours + 0.25) { // 15 mins excess
        const diffStr = (durationHours - scheduledDurationHours).toFixed(1);
        alerts.push(`⏰ ${empName} has exceeded scheduled shift hours by ${diffStr} hours`);
      }
    });

    return alerts;
  }, [allShifts, todayStr, activeShiftsList, currentTime]);

  const handleForceLogout = async (shift: Shift) => {
    if (!user) return;
    if (!window.confirm(`Force logout ${shift.employees?.[0]?.displayName || shift.staffId}?`)) return;
    try {
      setIsSubmitting(true);
      await endShift(shift.id, user, undefined, true, 'force-admin', shift.staffId);
      toast({ title: "Force Logout Complete", description: `Session ended for ${shift.employees?.[0]?.displayName || shift.staffId}.` });
    } catch (e) {
      console.error(e);
      toast({ variant: 'destructive', title: "Force Logout Failed" });
    } finally {
      setIsSubmitting(false);
    }
  };

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
        if (verifyTask && editStatus) {
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
          {/* Attendance Dashboard Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Present Today</span>
              <span className="text-3xl font-black text-emerald-600 mt-2">{dashboardStats.present}</span>
            </Card>
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> Late Today</span>
              <span className="text-3xl font-black text-yellow-500 mt-2">{dashboardStats.late}</span>
            </Card>
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Absent Today</span>
              <span className="text-3xl font-black text-destructive mt-2">{dashboardStats.absent}</span>
            </Card>
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="h-3.5 w-3.5" /> On Shift</span>
              <span className="text-3xl font-black text-primary mt-2">{dashboardStats.onShift}</span>
            </Card>
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Users className="h-3.5 w-3.5" /> Logged Out</span>
              <span className="text-3xl font-black text-indigo-600 mt-2">{dashboardStats.loggedOut}</span>
            </Card>
            <Card className="border-2 shadow-none p-4 flex flex-col justify-between bg-muted/5">
              <span className="text-[10px] font-black text-muted-foreground uppercase tracking-wider flex items-center gap-1"><AlertTriangle className="h-3.5 w-3.5" /> Forgot Logout</span>
              <span className="text-3xl font-black text-orange-500 mt-2">{dashboardStats.forgotLogout}</span>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Active Shift Monitoring List */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="border-2 shadow-none">
                <CardHeader className="bg-muted/10 pb-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <Clock className="h-4 w-4 text-primary animate-pulse" /> Active Shift Monitoring
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  {activeShiftsList.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground font-bold uppercase tracking-wider">No active shifts currently</div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {activeShiftsList.map(s => {
                        const empName = s.employees?.[0]?.displayName || s.staffId || 'Unknown';
                        const hoursStr = formatShiftHours(s.scheduledLogin, s.scheduledLogout);
                        const loginTimeStr = s.startTime ? format(new Date(s.startTime), 'p') : 'N/A';
                        
                        // Calculate duration
                        const startTimeDate = new Date(s.startTime);
                        const durationMs = currentTime.getTime() - startTimeDate.getTime();
                        const h = Math.floor(durationMs / 3600000);
                        const m = Math.floor((durationMs % 3600000) / 60000);
                        const durationStr = `${h}h ${m}m`;

                        const gracePeriod = employees?.find(e => e.username === s.staffId)?.gracePeriod ?? 5;
                        const scheduledStart = s.scheduledLogin || "11:00";
                        const [schH, schM] = scheduledStart.split(':').map(Number);
                        const schDate = new Date(startTimeDate);
                        schDate.setHours(schH, schM, 0, 0);
                        const delayMinutes = Math.floor((startTimeDate.getTime() - schDate.getTime()) / 60000);
                        const isLate = delayMinutes > gracePeriod;

                        return (
                          <Card key={s.id} className="border-2 p-3 flex flex-col justify-between bg-muted/5 relative overflow-hidden">
                            <div className="absolute right-2 top-2">
                              {isLate ? (
                                <Badge className="bg-yellow-500 text-white uppercase text-[8px] font-black">Late</Badge>
                              ) : (
                                <Badge className="bg-emerald-600 text-white uppercase text-[8px] font-black">On Shift</Badge>
                              )}
                            </div>
                            <div>
                              <div className="font-black uppercase text-sm">{empName}</div>
                              <div className="text-[10px] text-muted-foreground font-black uppercase mt-1">Shift: {hoursStr}</div>
                              <div className="text-[10px] text-emerald-600 font-bold uppercase mt-0.5">Logged In: {loginTimeStr}</div>
                            </div>
                            <div className="border-t border-dashed mt-3 pt-2 flex items-center justify-between">
                              <span className="text-[9px] font-black text-muted-foreground uppercase">Duration</span>
                              <span className="font-mono text-xs font-black text-primary">{durationStr}</span>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Attendance Alerts Panel */}
            <div className="space-y-6">
              <Card className="border-2 border-dashed shadow-none h-full bg-muted/5">
                <CardHeader className="bg-muted/10 pb-3">
                  <CardTitle className="text-xs font-black uppercase tracking-widest text-foreground flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500 animate-pulse" /> Attendance Alerts
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-2">
                  {attendanceAlerts.length === 0 ? (
                    <div className="text-center py-6 text-xs text-muted-foreground font-bold uppercase tracking-wider">No compliance alerts</div>
                  ) : (
                    attendanceAlerts.map((alert, idx) => (
                      <div key={idx} className="p-2.5 bg-background border-2 border-dashed border-amber-500/20 rounded-lg text-[10px] font-black uppercase text-foreground/80 leading-tight">
                        {alert}
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          <Card className="border-2 shadow-none overflow-hidden">
              <Table>
                  <TableHeader className="bg-muted/20">
                  <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Employee</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Shift</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Login</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Logout</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Hours Worked</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Status</TableHead>
                      {isAdmin && <TableHead className="w-[120px] text-right font-black uppercase text-[10px] pr-6">Actions</TableHead>}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredShifts.map((shift) => {
                      const empName = (shift.employees || [])[0]?.displayName || shift.staffId || 'Unknown';
                      const formattedDate = getFormattedDate(shift.date);
                      const shiftHours = formatShiftHours(shift.scheduledLogin, shift.scheduledLogout);
                      const actualLoginStr = shift.startTime ? format(new Date(shift.startTime), 'p') : 'N/A';
                      
                      let actualLogoutStr = 'N/A';
                      if (shift.status === 'active') {
                          actualLogoutStr = 'Active';
                      } else if (shift.endTime) {
                          actualLogoutStr = format(new Date(shift.endTime), 'p');
                      }
                      
                      let hoursWorkedStr = '0h';
                      if (shift.status === 'active') {
                          hoursWorkedStr = 'Live';
                      } else if (shift.totalHoursWorked != null) {
                          const h = Math.floor(shift.totalHoursWorked);
                          const m = Math.round((shift.totalHoursWorked - h) * 60);
                          hoursWorkedStr = `${h}h${m}m`;
                      } else if (shift.endTime && shift.startTime) {
                          const durationMs = new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime();
                          const hrs = durationMs / 3600000;
                          const h = Math.floor(hrs);
                          const m = Math.round((hrs - h) * 60);
                          hoursWorkedStr = `${h}h${m}m`;
                      }
                      
                      const attendanceStatusVal = shift.attendanceStatus || (shift.lateMinutes ? 'Late' : 'Present');

                      return (
                          <TableRow key={shift.id} className="hover:bg-muted/5 transition-colors group">
                              <TableCell className="font-black uppercase text-[10px]">{formattedDate}</TableCell>
                              <TableCell className="font-black uppercase text-xs">{empName}</TableCell>
                              <TableCell className="font-mono text-[10px] font-bold">{shiftHours}</TableCell>
                              <TableCell className="font-mono text-[10px] text-emerald-600 font-bold">{actualLoginStr}</TableCell>
                              <TableCell className={cn("font-mono text-[10px] font-bold", shift.status === 'active' ? "text-amber-500 animate-pulse" : "text-muted-foreground")}>{actualLogoutStr}</TableCell>
                              <TableCell className="font-mono text-[10px] font-bold">{hoursWorkedStr}</TableCell>
                              <TableCell>
                                  <div className="flex gap-1 items-center">
                                      {getStatusBadge(attendanceStatusVal, shift.forgotToLogout)}
                                      {shift.logoutMethod && shift.logoutMethod !== 'manual' && (
                                          <Badge variant="outline" className="text-[7px] font-black uppercase text-amber-600 border-amber-500/20 bg-amber-500/5">
                                              {shift.logoutMethod === 'auto-midnight' ? 'MIDNIGHT AUTO' : 'FORCE ADMIN'}
                                          </Badge>
                                      )}
                                  </div>
                              </TableCell>
                              {isAdmin && (
                                  <TableCell className="text-right pr-6 py-3">
                                      <div className="flex items-center justify-end gap-1">
                                          {shift.status === 'active' && (
                                              <Button 
                                                  variant="destructive" 
                                                  size="sm" 
                                                  onClick={() => handleForceLogout(shift)} 
                                                  className="h-8 px-2.5 font-black uppercase text-[9px] shadow-sm shrink-0"
                                              >
                                                  Force Out
                                              </Button>
                                          )}
                                          <Button variant="ghost" size="icon" onClick={() => handleEditClick(shift)} className="h-8 w-8">
                                              <Edit className="h-4 w-4" />
                                          </Button>
                                      </div>
                                  </TableCell>
                              )}
                          </TableRow>
                      );
                  })}
                  {filteredShifts.length === 0 && (
                      <TableRow>
                          <TableCell colSpan={8} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No matching records found.</TableCell>
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
