'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Shift, ShiftTask, Employee } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  format, 
  differenceInHours, 
  differenceInMinutes, 
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
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  XCircle, 
  Clock, 
  Timer, 
  Coffee, 
  Zap, 
  Moon, 
  Edit, 
  Save, 
  CalendarDays, 
  UserCheck, 
  UserX, 
  ChevronLeft, 
  ChevronRight, 
  ClipboardCheck,
  X,
  PlusCircle,
  UserPlus,
  AlertTriangle
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateShiftTimes, updateTask, manuallyCreateShift } from '@/firebase/firestore/shifts';
import { useToast } from '@/hooks/use-toast';

function AttendanceCalendar({ shifts, staffOptions, user, employees }: { shifts: Shift[], staffOptions: [string, string][], user: any, employees: Employee[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStaff, setFilterStaff] = useState('all');
  const { toast } = useToast();

  const isOwner = user?.username === 'Viren';

  const [isEditAttendanceModalOpen, setIsEditAttendanceModalOpen] = useState(false);
  const [selectedAttendanceForEdit, setSelectedAttendanceForEdit] = useState<any | null>(null);
  const [editStatus, setEditStatus] = useState<'yes' | 'no' | null>(null);
  const [editLoginTime, setEditLoginTime] = useState('');
  const [editLogoutTime, setEditLogoutTime] = useState('');
  const [isSavingAttendanceEdit, setIsSavingAttendanceEdit] = useState(false);

  const [isAddAttendanceModalOpen, setIsAddAttendanceModalOpen] = useState(false);
  const [isAddingAttendance, setIsAddingAttendance] = useState(false);
  const [addFormData, setAddFormData] = useState({
    username: '',
    date: new Date().toISOString().slice(0, 10),
    loginTime: '11:00',
    logoutTime: '23:00',
    status: 'yes' as 'yes' | 'no'
  });

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
    
    if (dayShifts.length === 0) return null;

    const results: any[] = [];
    dayShifts.forEach(shift => {
      const emp = (shift.employees || [])[0] || { username: shift.staffId, displayName: shift.staffId };
      if (filterStaff !== 'all' && emp.username.toLowerCase() !== filterStaff.toLowerCase()) return;

      const verifyTask = (shift.tasks || []).find(t => t.type === 'strategic');

      results.push({
        shiftId: shift.id,
        taskName: verifyTask?.name || `Verify ${emp.displayName} Presence`,
        username: emp.username,
        displayName: emp.displayName,
        verified: !!verifyTask?.completed,
        result: verifyTask?.verificationResult,
        loginTime: format(new Date(shift.startTime), 'p'),
        rawStartTime: new Date(shift.startTime).getTime(),
        logoutTime: shift.endTime ? format(new Date(shift.endTime), 'p') : null,
        rawEndTime: shift.endTime ? new Date(shift.endTime).getTime() : null,
        originalShift: shift,
        wasForceExited: !!shift.wasForceExited
      });
    });

    return results;
  };

  const handleEditAttendanceClick = (record: any) => {
    setSelectedAttendanceForEdit(record);
    setEditStatus(record.result || null);
    setEditLoginTime(record.rawStartTime ? format(new Date(record.rawStartTime), 'HH:mm') : '');
    setEditLogoutTime(record.rawEndTime ? format(new Date(record.rawEndTime), 'HH:mm') : '');
    setIsEditAttendanceModalOpen(true);
  };

  const handleSaveAttendanceEdit = async () => {
    if (!selectedAttendanceForEdit || !user) return;
    setIsSavingAttendanceEdit(true);
    const originalShift = selectedAttendanceForEdit.originalShift;
    const shiftDate = format(new Date(originalShift.startTime), 'yyyy-MM-dd');
    const newStartTime = editLoginTime ? new Date(`${shiftDate}T${editLoginTime}:00`).toISOString() : originalShift.startTime;
    const newEndTime = (editLogoutTime && editStatus !== 'no') ? new Date(`${shiftDate}T${editLogoutTime}:00`).toISOString() : null;

    const sSuccess = await updateShiftTimes(selectedAttendanceForEdit.shiftId, { startTime: newStartTime, endTime: newEndTime }, user);
    const tSuccess = await updateTask(selectedAttendanceForEdit.shiftId, selectedAttendanceForEdit.taskName, editStatus === 'yes' || editStatus === 'no', user, editStatus || undefined);

    if (sSuccess && tSuccess) {
      toast({ title: 'Updated' });
      setIsEditAttendanceModalOpen(false);
    }
    setIsSavingAttendanceEdit(false);
  };

  const handleManualAddAttendance = async () => {
    const emp = employees.find(e => e.username === addFormData.username);
    if (!emp || !user) return;
    setIsAddingAttendance(true);
    const sTime = new Date(`${addFormData.date}T${addFormData.loginTime}:00`).toISOString();
    const eTime = addFormData.logoutTime ? new Date(`${addFormData.date}T${addFormData.logoutTime}:00`).toISOString() : null;
    const success = await manuallyCreateShift({ ...addFormData, displayName: emp.displayName }, user);
    if (success) {
        toast({ title: "Logged" });
        setIsAddAttendanceModalOpen(false);
    }
    setIsAddingAttendance(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 bg-muted/20 p-4 rounded-xl border-2 border-dashed">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft /></Button>
          <h2 className="font-headline text-lg uppercase">{format(currentMonth, 'MMMM yyyy')}</h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight /></Button>
        </div>
        <div className="flex gap-3">
            {isOwner && <Button onClick={() => setIsAddAttendanceModalOpen(true)} className="font-black uppercase text-[10px]"><PlusCircle className="mr-2 h-4 w-4" /> ADD</Button>}
            <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-[180px] text-[10px] font-bold uppercase"><SelectValue placeholder="Filter Staff" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">ALL STAFF</SelectItem>
                    {staffOptions.map(([u, d]) => <SelectItem key={u} value={u}>{d.toUpperCase()}</SelectItem>)}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-muted border-2 rounded-xl overflow-hidden shadow-inner overflow-x-auto min-w-[800px]">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-muted/50 py-3 text-center text-[10px] font-black uppercase tracking-widest text-muted-foreground border-b">{d}</div>
        ))}
        {days.map((day, i) => {
          const isCurrent = isSameMonth(day, currentMonth);
          const status = getDayStatus(day);
          return (
            <div key={i} className={cn("min-h-[160px] p-2 bg-background flex flex-col gap-1 transition-all", !isCurrent && "opacity-20 pointer-events-none", isToday(day) && "ring-2 ring-inset ring-primary/20 bg-primary/[0.02]")}>
              <div className="flex justify-between items-start mb-1">
                <span className={cn("text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full", isToday(day) ? "bg-primary text-white" : "text-muted-foreground")}>{format(day, 'd')}</span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                {status?.map((s: any, idx) => (
                  <button key={idx} onClick={() => isOwner && handleEditAttendanceClick(s)} className={cn("w-full p-2 rounded-lg border-2 text-[9px] font-black uppercase text-left transition-all", s.result === 'yes' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" : s.result === 'no' ? "bg-destructive/10 border-destructive/20 text-destructive" : "bg-background border-muted text-muted-foreground")}>
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
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* MODALS (Simplified for clarity) */}
      <Dialog open={isEditAttendanceModalOpen} onOpenChange={setIsEditAttendanceModalOpen}>
        <DialogContent className="max-w-md font-body">
            <DialogHeader><DialogTitle className="font-headline text-lg uppercase">Edit Attendance</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <Button variant={editStatus === 'yes' ? 'default' : 'outline'} onClick={() => setEditStatus('yes')} className="h-12 font-black uppercase">PRESENT</Button>
                    <Button variant={editStatus === 'no' ? 'destructive' : 'outline'} onClick={() => setEditStatus('no')} className="h-12 font-black uppercase">ABSENT</Button>
                </div>
                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50">Login Time</Label><Input type="time" value={editLoginTime} onChange={e => setEditLoginTime(e.target.value)} className="h-12 font-mono font-bold" /></div>
                <div className="space-y-1.5"><Label className="text-[9px] font-black uppercase opacity-50">Logout Time</Label><Input type="time" value={editLogoutTime} onChange={e => setEditLogoutTime(e.target.value)} className="h-12 font-mono font-bold" /></div>
            </div>
            <DialogFooter><Button disabled={isSavingAttendanceEdit} onClick={handleSaveAttendanceEdit} className="w-full h-14 font-black uppercase tracking-widest text-lg">Save Changes</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isAddAttendanceModalOpen} onOpenChange={setIsAddAttendanceModalOpen}>
        <DialogContent className="max-w-md font-body">
            <DialogHeader><DialogTitle className="font-headline text-lg uppercase">Manual Entry</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <Select value={addFormData.username} onValueChange={v => setAddFormData(p => ({...p, username: v}))}>
                    <SelectTrigger className="h-12 font-bold uppercase"><SelectValue placeholder="PICK OPERATOR" /></SelectTrigger>
                    <SelectContent>{employees.filter(e => e.isActive).map(e => <SelectItem key={e.username} value={e.username} className="font-bold">{e.displayName.toUpperCase()}</SelectItem>)}</SelectContent>
                </Select>
                <Input type="date" value={addFormData.date} onChange={e => setAddFormData(p => ({...p, date: e.target.value}))} className="h-12 font-bold" />
                <div className="grid grid-cols-2 gap-4">
                    <Input type="time" value={addFormData.loginTime} onChange={e => setAddFormData(p => ({...p, loginTime: e.target.value}))} className="h-12 font-mono" />
                    <Input type="time" value={addFormData.logoutTime} onChange={e => setAddFormData(p => ({...p, logoutTime: e.target.value}))} className="h-12 font-mono" />
                </div>
            </div>
            <DialogFooter><Button disabled={isAddingAttendance || !addFormData.username} onClick={handleManualAddAttendance} className="w-full h-14 font-black uppercase tracking-widest text-lg">Commit Record</Button></DialogFooter>
        </DialogContent>
      </Dialog>
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
  
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shiftsQuery = useMemo(() => !db ? null : query(collection(db, 'shifts'), orderBy('startTime', 'desc')), [db]);
  const { data: allShifts, loading } = useCollection<Shift>(shiftsQuery);

  const employeesQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(employeesQuery);

  const staffOptions = useMemo(() => {
    if (!allShifts) return [];
    const staffMap = new Map<string, string>();
    allShifts.forEach(s => staffMap.set(s.staffId.toLowerCase(), s.staffId));
    return Array.from(staffMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allShifts]);

  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(s => {
        const matchesStaff = staffFilter === 'all' || s.staffId.toLowerCase() === staffFilter.toLowerCase();
        const matchesMonth = monthFilter === 'all' || format(new Date(s.startTime), 'yyyy-MM') === monthFilter;
        return matchesStaff && matchesMonth;
    });
  }, [allShifts, staffFilter, monthFilter]);

  const handleEditClick = (shift: Shift) => {
    setEditingShift(shift);
    setEditStart(new Date(shift.startTime).toISOString().slice(0, 16));
    setEditEnd(shift.endTime ? new Date(shift.endTime).toISOString().slice(0, 16) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingShift || !user) return;
    setIsSubmitting(true);
    const success = await updateShiftTimes(editingShift.id, { startTime: new Date(editStart).toISOString(), endTime: editEnd ? new Date(editEnd).toISOString() : null }, user);
    if (success) { toast({ title: "Updated" }); setEditingShift(null); }
    setIsSubmitting(false);
  };

  const monthOptions = useMemo(() => {
    if (!allShifts) return [];
    const months = new Set<string>();
    allShifts.forEach(s => months.add(format(new Date(s.startTime), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [allShifts]);

  if (loading) return <div className="flex h-screen items-center justify-center animate-pulse uppercase font-black text-xs">Syncing Registry...</div>;

  const isAdmin = user?.role === 'admin' || user?.username === 'Viren';

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex justify-between items-center mb-8">
          <div><h1 className="font-headline text-4xl uppercase tracking-wider">Attendance Hub</h1></div>
          <TabsList className="bg-muted/20 border-2 border-dashed h-12 p-1 rounded-xl">
              <TabsTrigger value="registry" className="font-black uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-background">Registry</TabsTrigger>
              <TabsTrigger value="calendar" className="font-black uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-background">Visual Audit</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="registry" className="space-y-8">
          <Card className="border-2 shadow-none overflow-hidden">
              <Table>
                  <TableHeader className="bg-muted/20">
                  <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Operator</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Logins</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Alerts</TableHead>
                      <TableHead className="text-right font-black uppercase text-[10px]">Pool</TableHead>
                      {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredShifts.map((shift) => (
                      <TableRow key={shift.id} className="hover:bg-muted/5 transition-colors group">
                      <TableCell className="font-black uppercase text-[10px]">{format(new Date(shift.startTime), 'MMM dd, yyyy')}</TableCell>
                      <TableCell className="font-black uppercase text-xs">{(shift.employees || [])[0]?.displayName || shift.staffId}</TableCell>
                      <TableCell>
                          <div className="flex flex-col text-[10px] font-bold uppercase text-emerald-600">
                              <span className="flex items-center gap-1.5"><Zap className="h-3 w-3 fill-current" /> {format(new Date(shift.startTime), 'p')}</span>
                              {shift.endTime && <span className="text-muted-foreground flex items-center gap-1.5 mt-1"><Moon className="h-3 w-3" /> {format(new Date(shift.endTime), 'p')}</span>}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex gap-1">
                              {shift.lateMinutes ? <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black">LATE</Badge> : <Badge variant="outline" className="h-4 text-[7px] uppercase font-black text-emerald-600">ON TIME</Badge>}
                              {shift.wasForceExited && <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black">FORCE</Badge>}
                          </div>
                      </TableCell>
                      <TableCell className="text-right pr-6 font-mono font-black text-xs text-primary">₹{((shift.cashTotal || 0) + (shift.upiTotal || 0)).toLocaleString()}</TableCell>
                      {isAdmin && <TableCell><Button variant="ghost" size="icon" onClick={() => handleEditClick(shift)}><Edit className="h-4 w-4" /></Button></TableCell>}
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
          </Card>
        </TabsContent>

        <TabsContent value="calendar">
            <AttendanceCalendar shifts={allShifts || []} staffOptions={staffOptions} user={user} employees={employees || []} />
        </TabsContent>
      </Tabs>

      <Dialog open={!!editingShift} onOpenChange={o => !o && setEditingShift(null)}>
        <DialogContent className="max-w-md font-body">
            <DialogHeader><DialogTitle className="font-headline text-lg uppercase">Correct Times</DialogTitle></DialogHeader>
            <div className="space-y-4 py-4">
                <Input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-12 font-mono" />
                <Input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-12 font-mono" />
            </div>
            <DialogFooter><Button disabled={isSubmitting} onClick={handleSaveEdit} className="w-full h-12 font-black uppercase">Update Audit</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}