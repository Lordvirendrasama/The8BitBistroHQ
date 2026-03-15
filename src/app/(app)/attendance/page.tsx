'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Shift, ShiftTask } from '@/lib/types';
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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
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
  X
} from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { updateShiftTimes, updateTask } from '@/firebase/firestore/shifts';
import { useToast } from '@/hooks/use-toast';

function AttendanceCalendar({ shifts, staffOptions, user }: { shifts: Shift[], staffOptions: [string, string][], user: any }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [filterStaff, setFilterStaff] = useState('all');
  const { toast } = useToast();

  const isOwner = user?.username === 'Viren';

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 1 });
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  const handleVerify = async (shiftId: string, taskName: string, result: 'yes' | 'no' | null) => {
    if (!isOwner) return;
    
    // If result is null, it means we are "un-completing" or resetting
    await updateTask(shiftId, taskName, result !== null, user, result || undefined);
    
    toast({ 
        title: result ? "Attendance Verified" : "Audit Reset", 
        description: result ? `Marked as ${result.toUpperCase()}.` : "Verification removed."
    });
  };

  const getDayStatus = (date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const dayShifts = shifts.filter(s => s.date === dateStr);
    
    if (dayShifts.length === 0) return null;

    // Use a Map to ensure unique entry per user per day
    const userMap = new Map<string, any>();

    dayShifts.forEach(shift => {
      // Find relevant employees in this shift
      const activeInShift = (shift.employees || []).filter(e => 
        filterStaff === 'all' || e.username.toLowerCase() === filterStaff.toLowerCase()
      );

      activeInShift.forEach(emp => {
        // Find verification task for this employee
        const taskName = `Verify ${emp.displayName || emp.username} Presence`;
        const verifyTask = (shift.tasks || []).find(t => 
          t.type === 'strategic' && t.name.toLowerCase().includes(emp.username.toLowerCase())
        );

        const currentData = {
          shiftId: shift.id,
          taskName: verifyTask?.name || taskName,
          username: emp.username,
          displayName: emp.displayName,
          verified: !!verifyTask?.completed,
          result: verifyTask?.verificationResult,
          loginTime: format(new Date(shift.startTime), 'p'),
          rawStartTime: new Date(shift.startTime).getTime()
        };

        const existing = userMap.get(emp.username);

        if (!existing) {
          userMap.set(emp.username, currentData);
        } else {
          // If we have multiple records, prioritize verified ones
          if (!existing.verified && currentData.verified) {
            userMap.set(emp.username, currentData);
          } else if (existing.verified === currentData.verified) {
            // If verification status is same, pick the earlier login
            if (currentData.rawStartTime < existing.rawStartTime) {
              userMap.set(emp.username, currentData);
            }
          }
        }
      });
    });

    return Array.from(userMap.values());
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
      <div className="flex flex-col sm:flex-row justify-between items-center gap-4 bg-muted/20 p-4 rounded-xl border-2 border-dashed">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}><ChevronLeft className="h-5 w-5" /></Button>
          <h2 className="font-headline text-lg sm:text-xl min-w-[200px] text-center uppercase tracking-tight">
            {format(currentMonth, 'MMMM yyyy')}
          </h2>
          <Button variant="outline" size="icon" className="h-10 w-10" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}><ChevronRight className="h-5 w-5" /></Button>
        </div>
        <div className="flex items-center gap-3">
            <Label className="text-[10px] font-black uppercase tracking-widest opacity-50 hidden sm:block">Filter Operator:</Label>
            <Select value={filterStaff} onValueChange={setFilterStaff}>
                <SelectTrigger className="w-[200px] h-10 border-2 font-bold uppercase text-[10px] bg-background">
                    <SelectValue placeholder="All Staff" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="font-bold text-[10px] uppercase">ALL STAFF</SelectItem>
                    {staffOptions.map(([username, displayName]) => (
                        <SelectItem key={username} value={username} className="font-bold text-[10px] uppercase">{displayName.toUpperCase()}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-px bg-muted border-2 rounded-xl overflow-hidden shadow-inner">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
          <div key={d} className="bg-muted/50 py-3 text-center text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground border-b">{d}</div>
        ))}
        {days.map((day, i) => {
          const isCurrent = isSameMonth(day, currentMonth);
          const status = getDayStatus(day);
          const isTodayDate = isToday(day);

          return (
            <div key={i} className={cn(
              "min-h-[160px] p-2 bg-background flex flex-col gap-1 transition-all",
              !isCurrent && "opacity-20 bg-muted/10 pointer-events-none",
              isTodayDate && "ring-2 ring-inset ring-primary/20 bg-primary/[0.02]"
            )}>
              <div className="flex justify-between items-start mb-1">
                <span className={cn(
                  "text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full",
                  isTodayDate ? "bg-primary text-white shadow-lg" : "text-muted-foreground"
                )}>
                  {format(day, 'd')}
                </span>
              </div>
              <div className="flex-1 space-y-2 overflow-y-auto no-scrollbar">
                {status?.map((s: any, idx) => (
                  <div key={idx} className={cn(
                    "p-2 rounded-lg border-2 text-[9px] font-black uppercase leading-tight flex flex-col gap-2 shadow-sm",
                    s.result === 'yes' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700" :
                    s.result === 'no' ? "bg-destructive/10 border-destructive/20 text-destructive" :
                    "bg-background border-muted text-muted-foreground"
                  )}>
                    <div className="flex items-center justify-between gap-1">
                        <div className="flex flex-col truncate">
                            <span className="truncate">{s.displayName}</span>
                            <span className="text-[7px] font-mono opacity-60 tracking-tighter">IN: {s.loginTime}</span>
                        </div>
                        {s.result === 'yes' ? <UserCheck className="h-3 w-3 shrink-0 text-emerald-600" /> :
                        s.result === 'no' ? <UserX className="h-3 w-3 shrink-0 text-destructive" /> :
                        <Clock className="h-3 w-3 shrink-0 opacity-40 animate-pulse" />}
                    </div>

                    {isOwner && (
                        <div className="flex gap-1 pt-1 border-t border-current border-dashed opacity-80 hover:opacity-100 transition-opacity">
                            {!s.verified ? (
                                <>
                                    <button 
                                        onClick={() => handleVerify(s.shiftId, s.taskName, 'yes')}
                                        className="flex-1 py-1 bg-emerald-600 text-white rounded font-black text-[7px] hover:bg-emerald-700 transition-colors"
                                    >
                                        YES
                                    </button>
                                    <button 
                                        onClick={() => handleVerify(s.shiftId, s.taskName, 'no')}
                                        className="flex-1 py-1 bg-destructive text-white rounded font-black text-[7px] hover:bg-destructive/90 transition-colors"
                                    >
                                        NO
                                    </button>
                                </>
                            ) : (
                                <button 
                                    onClick={() => handleVerify(s.shiftId, s.taskName, null)}
                                    className="w-full py-1 bg-muted text-muted-foreground rounded font-black text-[7px] flex items-center justify-center gap-1 hover:bg-muted/80 transition-colors"
                                >
                                    <X className="h-2 w-2" /> RESET AUDIT
                                </button>
                            )}
                        </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      
      <div className="flex flex-wrap justify-center gap-6 p-5 bg-muted/10 border-2 border-dashed rounded-2xl">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-emerald-500/20 border-2 border-emerald-500/40 flex items-center justify-center"><UserCheck className="h-2 w-2 text-emerald-600"/></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Audit Verified YES</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-destructive/20 border-2 border-destructive/40 flex items-center justify-center"><UserX className="h-2 w-2 text-destructive"/></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Audit Verified NO</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-md bg-background border-2 border-muted flex items-center justify-center"><Clock className="h-2 w-2 text-muted-foreground opacity-40"/></div>
          <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground">Pending verification</span>
        </div>
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
  
  // Edit State
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const shiftsQuery = useMemo(() => {
    if (!db) return null;
    return query(collection(db, 'shifts'), orderBy('startTime', 'desc'));
  }, [db]);

  const { data: allShifts, loading } = useCollection<Shift>(shiftsQuery);

  const staffOptions = useMemo(() => {
    if (!allShifts) return [];
    const staff = new Map<string, string>();
    allShifts.forEach(s => {
        if (s.staffId) {
            staff.set(s.staffId.toLowerCase(), s.staffId);
        }
        s.employees?.forEach(e => {
            staff.set(e.username.toLowerCase(), e.displayName || e.username);
        });
    });
    return Array.from(staff.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [allShifts]);

  const filteredShifts = useMemo(() => {
    if (!allShifts) return [];
    return allShifts.filter(shift => {
        const date = new Date(shift.startTime);
        const matchesStaff = staffFilter === 'all' || 
                             shift.staffId?.toLowerCase() === staffFilter.toLowerCase() || 
                             shift.employees?.some(e => e.username.toLowerCase() === staffFilter.toLowerCase());
        const matchesMonth = monthFilter === 'all' || format(date, 'yyyy-MM') === monthFilter;
        return matchesStaff && matchesMonth;
    });
  }, [allShifts, staffFilter, monthFilter]);

  const monthOptions = useMemo(() => {
    if (!allShifts) return [];
    const months = new Set<string>();
    allShifts.forEach(s => months.add(format(new Date(s.startTime), 'yyyy-MM')));
    return Array.from(months).sort().reverse();
  }, [allShifts]);

  const formatShiftDuration = (start: string, end?: string) => {
    if (!end) return "Ongoing";
    const s = new Date(start);
    const e = new Date(end);
    const hours = differenceInHours(e, s);
    const mins = differenceInMinutes(e, s) % 60;
    return `${hours}h ${mins}m`;
  };

  const calculateTotalBreak = (breaks: any[] = []) => {
    const totalSeconds = breaks.reduce((sum, b) => sum + (b.durationSeconds || 0), 0);
    const mins = Math.floor(totalSeconds / 60);
    return `${mins}m`;
  };

  const handleEditClick = (shift: Shift) => {
    setEditingShift(shift);
    setEditStart(new Date(shift.startTime).toISOString().slice(0, 16));
    setEditEnd(shift.endTime ? new Date(shift.endTime).toISOString().slice(0, 16) : '');
  };

  const handleSaveEdit = async () => {
    if (!editingShift || !user) return;
    setIsSubmitting(true);
    
    const updates = {
        startTime: new Date(editStart).toISOString(),
        endTime: editEnd ? new Date(editEnd).toISOString() : null
    };

    const success = await updateShiftTimes(editingShift.id, updates, user);
    if (success) {
        toast({ title: "Shift Corrected", description: "Audit timestamps updated." });
        setEditingShift(null);
    }
    setIsSubmitting(false);
  };

  if (loading) {
    return (
        <div className="flex flex-col h-screen items-center justify-center gap-4 opacity-50">
            <Timer className="h-10 w-10 animate-spin text-primary" />
            <p className="font-headline text-[10px] tracking-widest uppercase">Querying Attendance Registry...</p>
        </div>
    );
  }

  const isAdmin = user?.role === 'admin' || user?.username === 'Viren';

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body pb-20">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="font-headline text-4xl tracking-wider text-foreground">Attendance Hub</h1>
            <p className="mt-2 text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">Official Punctuality Audit & Visual Attendance Roadmap</p>
          </div>
          <TabsList className="bg-muted/20 border-2 border-dashed h-12 p-1 rounded-xl">
              <TabsTrigger value="registry" className="font-black uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-background shadow-sm gap-2">
                  <ClipboardCheck className="h-3.5 w-3.5" /> Registry
              </TabsTrigger>
              <TabsTrigger value="calendar" className="font-black uppercase text-[10px] tracking-widest px-6 h-full data-[state=active]:bg-background shadow-sm gap-2">
                  <CalendarDays className="h-3.5 w-3.5" /> Visual Audit
              </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="registry" className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-500">
          <Card className="bg-muted/30 border-dashed border-2">
              <CardContent className="p-4 flex flex-wrap gap-4 items-end">
                  <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Filter by Staff</Label>
                      <Select value={staffFilter} onValueChange={setStaffFilter}>
                          <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-[10px] bg-background">
                              <SelectValue placeholder="All Staff" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all" className="font-bold uppercase text-[10px]">ALL STAFF</SelectItem>
                              {staffOptions.map(([username, displayName]) => (
                                  <SelectItem key={username} value={username} className="font-bold uppercase text-[10px]">{displayName.toUpperCase()}</SelectItem>
                              ))}
                          </SelectContent>
                      </Select>
                  </div>
                  <div className="space-y-1.5">
                      <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground px-1">Filter by Month</Label>
                      <Select value={monthFilter} onValueChange={setMonthFilter}>
                          <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-[10px] bg-background">
                              <SelectValue placeholder="All Months" />
                          </SelectTrigger>
                          <SelectContent>
                              <SelectItem value="all" className="font-bold uppercase text-[10px]">ALL HISTORY</SelectItem>
                              {monthOptions.map(m => <SelectItem key={m} value={m} className="font-bold uppercase text-[10px]">{format(new Date(m + "-01"), 'MMMM yyyy').toUpperCase()}</SelectItem>)}
                          </SelectContent>
                      </Select>
                  </div>
                  <Badge variant="outline" className="h-10 px-4 border-2 font-black uppercase text-[10px] ml-auto bg-background shadow-sm">
                      {filteredShifts.length} RECORDS FOUND
                  </Badge>
              </CardContent>
          </Card>

          <Card className="border-2 shadow-none overflow-hidden">
              <CardHeader className="bg-muted/10 border-b">
              <CardTitle className="text-lg font-black uppercase tracking-tight">Shift Master Table</CardTitle>
              <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Historical log of logins, logouts, and work hour totals.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
              <Table>
                  <TableHeader className="bg-muted/20">
                  <TableRow>
                      <TableHead className="font-black uppercase text-[10px]">Date</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Staff</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Login/Logout</TableHead>
                      <TableHead className="font-black uppercase text-[10px]">Duration</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-center">Alerts</TableHead>
                      <TableHead className="font-black uppercase text-[10px] text-right pr-6">Accounting</TableHead>
                      {isAdmin && <TableHead className="w-[50px]"></TableHead>}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {filteredShifts.map((shift) => (
                      <TableRow key={shift.id} className="group hover:bg-muted/5 transition-colors">
                      <TableCell>
                          <p className="font-black text-[11px] uppercase">{format(new Date(shift.startTime), 'MMM dd, yyyy')}</p>
                          <p className="text-[9px] font-bold text-muted-foreground uppercase">{format(new Date(shift.startTime), 'EEEE')}</p>
                      </TableCell>
                      <TableCell>
                          <div className="flex items-center gap-2">
                              <Avatar className="h-7 w-7 border-2 border-primary/10">
                                  <AvatarFallback className="text-[10px] font-black">{shift.employees?.[0]?.displayName?.charAt(0) || shift.staffId?.charAt(0) || 'S'}</AvatarFallback>
                              </Avatar>
                              <span className="font-black uppercase text-xs">{shift.employees?.[0]?.displayName || shift.staffId || 'Unknown'}</span>
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-emerald-600">
                                  <Zap className="h-3 w-3 text-emerald-500 fill-current" />
                                  {format(new Date(shift.startTime), 'p')}
                              </div>
                              {shift.endTime ? (
                                  <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase text-muted-foreground">
                                      <Moon className="h-3 w-3" />
                                      {format(new Date(shift.endTime), 'p')}
                                  </div>
                              ) : (
                                  <Badge variant="outline" className="w-fit h-4 text-[7px] animate-pulse uppercase border-emerald-500 text-emerald-600 bg-emerald-500/5">Active</Badge>
                              )}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-tighter">
                                  <Timer className="h-3 w-3 opacity-40" />
                                  {formatShiftDuration(shift.startTime, shift.endTime)}
                              </div>
                              {shift.breaks?.length > 0 && (
                                  <div className="flex items-center gap-1.5 text-[9px] font-bold uppercase text-amber-600">
                                      <Coffee className="h-2.5 w-2.5" />
                                      {calculateTotalBreak(shift.breaks)} Break Total
                                  </div>
                              )}
                          </div>
                      </TableCell>
                      <TableCell>
                          <div className="flex flex-wrap justify-center gap-1">
                              {shift.lateMinutes ? (
                                  <Badge variant="destructive" className="h-4 text-[7px] uppercase font-black tracking-widest">
                                      Late ({shift.lateMinutes}m)
                                  </Badge>
                              ) : <Badge variant="outline" className="h-4 text-[7px] uppercase font-black tracking-widest text-emerald-600 border-emerald-600/30">On Time</Badge>}
                              
                              {shift.overtimeMinutes ? (
                                  <Badge className="h-4 text-[7px] uppercase font-black bg-blue-600 tracking-widest">
                                      OT ({shift.overtimeMinutes}m)
                                  </Badge>
                              ) : shift.earlyLeaveMinutes ? (
                                  <Badge variant="secondary" className="h-4 text-[7px] uppercase font-black tracking-widest">
                                      Early Exit ({shift.earlyLeaveMinutes}m)
                                  </Badge>
                              ) : null}
                          </div>
                      </TableCell>
                      <TableCell className="text-right pr-6">
                          <div className="flex flex-col items-end">
                              <span className="font-mono font-black text-xs text-primary">₹{((shift.cashTotal || 0) + (shift.upiTotal || 0)).toLocaleString()}</span>
                              <span className="text-[8px] font-bold text-muted-foreground uppercase">Shift Total</span>
                          </div>
                      </TableCell>
                      {isAdmin && (
                          <TableCell>
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => handleEditClick(shift)}>
                                  <Edit className="h-4 w-4" />
                              </Button>
                          </TableCell>
                      )}
                      </TableRow>
                  ))}
                  </TableBody>
              </Table>
              </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="calendar" className="animate-in fade-in slide-in-from-right-2 duration-500">
            <AttendanceCalendar shifts={allShifts || []} staffOptions={staffOptions} user={user} />
        </TabsContent>
      </Tabs>

      {/* EDIT MODAL */}
      <Dialog open={!!editingShift} onOpenChange={o => !o && setEditingShift(null)}>
        <DialogContent className="max-w-md font-body border-4 border-primary/20">
            <DialogHeader>
                <DialogTitle className="font-headline text-xl flex items-center gap-2">
                    <Edit className="text-primary" />
                    Correct Shift Times
                </DialogTitle>
                <DialogDescription className="font-black text-[9px] uppercase tracking-widest">Manually adjust audit timestamps for record {editingShift?.id.slice(0, 8)}.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground px-1">Login Timestamp</Label>
                    <Input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-12 font-mono font-bold border-2" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground px-1">Logout Timestamp (Optional)</Label>
                    <Input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-12 font-mono font-bold border-2" />
                </div>
            </div>
            <DialogFooter>
                <Button disabled={isSubmitting} onClick={handleSaveEdit} className="w-full h-14 font-black uppercase tracking-widest text-lg shadow-xl">
                    <Save className="mr-2 h-5 w-5" />
                    {isSubmitting ? 'Updating...' : 'Save Audit Correction'}
                </Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
