
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import type { Shift } from '@/lib/types';
import { useFirebase } from '@/firebase/provider';
import { useAuth } from '@/firebase/auth/use-user';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format, differenceInHours, differenceInMinutes } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { CheckCircle2, XCircle, Clock, Wallet, IndianRupee, ShoppingCart, User, AlertCircle, Timer, Coffee, Zap, Moon, Edit, Save } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { updateShiftTimes } from '@/firebase/firestore/shifts';
import { useToast } from '@/hooks/use-toast';

export default function AttendanceRegistryPage() {
  const { db } = useFirebase();
  const { user } = useAuth();
  const { toast } = useToast();
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
    return <div className="flex h-screen items-center justify-center font-headline text-xs animate-pulse">Syncing Attendance Records...</div>;
  }

  const isAdmin = user?.role === 'admin' || user?.username === 'Viren';

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Attendance Registry</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-[10px] tracking-[0.2em]">Official Shift Tracking & Punctuality Audit</p>
        </div>
        <Badge variant="outline" className="h-10 px-4 border-2 font-black uppercase text-[10px] bg-background shadow-sm">
            {filteredShifts.length} RECORDS FOUND
        </Badge>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter by Staff</Label>
                <Select value={staffFilter} onValueChange={setStaffFilter}>
                    <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-[10px]">
                        <SelectValue placeholder="All Staff" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ALL STAFF</SelectItem>
                        {staffOptions.map(([username, displayName]) => (
                            <SelectItem key={username} value={username}>{displayName.toUpperCase()}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <div className="space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Filter by Month</Label>
                <Select value={monthFilter} onValueChange={setMonthFilter}>
                    <SelectTrigger className="w-[180px] h-10 border-2 font-bold uppercase text-[10px]">
                        <SelectValue placeholder="All Months" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">ALL HISTORY</SelectItem>
                        {monthOptions.map(m => <SelectItem key={m} value={m}>{format(new Date(m + "-01"), 'MMMM yyyy').toUpperCase()}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
          <CardTitle className="text-lg font-black uppercase tracking-tight">Shift Master Table</CardTitle>
          <CardDescription className="text-[10px] font-bold uppercase tracking-widest">Audit trail for logins, logouts, punctuality and work hours.</CardDescription>
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
                <TableHead className="font-black uppercase text-[10px] text-right">Accounting</TableHead>
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
                            <AvatarFallback className="text-[10px] font-black">{shift.staffId?.charAt(0) || 'S'}</AvatarFallback>
                        </Avatar>
                        <span className="font-black uppercase text-xs">{shift.staffId || 'Unknown'}</span>
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
                  <TableCell className="text-right">
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

      {/* EDIT MODAL */}
      <Dialog open={!!editingShift} onOpenChange={o => !o && setEditingShift(null)}>
        <DialogContent className="max-w-md font-body">
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
                    <Input type="datetime-local" value={editStart} onChange={e => setEditStart(e.target.value)} className="h-12 font-mono font-bold" />
                </div>
                <div className="space-y-1.5">
                    <Label className="text-[9px] font-black uppercase text-muted-foreground px-1">Logout Timestamp (Optional)</Label>
                    <Input type="datetime-local" value={editEnd} onChange={e => setEditEnd(e.target.value)} className="h-12 font-mono font-bold" />
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
