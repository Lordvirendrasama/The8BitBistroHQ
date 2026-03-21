'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Leave, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarRange, User, Search, Clock, Plane, Palmtree, Stethoscope, ChevronRight, Filter, Plus, Trash, Edit, Save, BarChart3, Calendar } from 'lucide-react';
import { format, isPast, isFuture, isToday, differenceInDays, startOfDay, startOfMonth, endOfMonth, isWithinInterval, max, min } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { recordLeave, deleteLeave, updateLeave } from '@/firebase/firestore/leaves';
import { useToast } from '@/hooks/use-toast';

export default function LeavesTrackerPage() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingLeave, setEditingLeave] = useState<Leave | null>(null);
  
  // Monthly Audit State
  const [auditMonth, setAuditMonth] = useState(format(new Date(), 'yyyy-MM'));

  const [formData, setFormData] = useState({
    employeeId: '',
    type: 'paid' as Leave['type'],
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    reason: ''
  });

  const empQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees } = useCollection<Employee>(empQuery);

  const leavesQuery = useMemo(() => !db ? null : query(collection(db, 'leaves'), orderBy('startDate', 'desc')), [db]);
  const { data: leaves, loading } = useCollection<Leave>(leavesQuery);

  // Statistics: Global & Monthly
  const stats = useMemo(() => {
    if (!leaves) return { active: 0, upcoming: 0, monthlyTotals: [] as { name: string, unpaid: number, other: number, total: number }[] };
    const now = startOfDay(new Date());
    
    // Global status
    const active = leaves.filter(l => {
        const start = startOfDay(new Date(l.startDate));
        const end = startOfDay(new Date(l.endDate));
        return now >= start && now <= end;
    }).length;
    
    const upcoming = leaves.filter(l => startOfDay(new Date(l.startDate)) > now).length;

    // Monthly Audit Calculation
    const auditStart = startOfMonth(new Date(auditMonth + "-01"));
    const auditEnd = endOfMonth(auditStart);
    
    const monthlyMap: Record<string, { unpaid: number, other: number }> = {};
    
    leaves.forEach(leave => {
        const lStart = startOfDay(new Date(leave.startDate));
        const lEnd = startOfDay(new Date(leave.endDate));
        
        // Calculate overlap with selected month
        const overlapStart = max([lStart, auditStart]);
        const overlapEnd = min([lEnd, auditEnd]);
        
        if (overlapStart <= overlapEnd) {
            const daysInMonth = differenceInDays(overlapEnd, overlapStart) + 1;
            if (!monthlyMap[leave.employeeName]) monthlyMap[leave.employeeName] = { unpaid: 0, other: 0 };
            
            if (leave.type === 'unpaid') {
                monthlyMap[leave.employeeName].unpaid += daysInMonth;
            } else {
                monthlyMap[leave.employeeName].other += daysInMonth;
            }
        }
    });

    const monthlyTotals = Object.entries(monthlyMap)
        .map(([name, counts]) => ({ name, unpaid: counts.unpaid, other: counts.other, total: counts.unpaid + counts.other }))
        .sort((a, b) => b.total - a.total);

    return { active, upcoming, monthlyTotals };
  }, [leaves, auditMonth]);

  const filteredLeaves = useMemo(() => {
    if (!leaves) return [];
    return leaves.filter(l => {
        const matchesSearch = l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             l.reason.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || l.type === typeFilter;
        return matchesSearch && matchesType;
    });
  }, [leaves, searchTerm, typeFilter]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    // Always include current month
    months.add(format(new Date(), 'yyyy-MM'));
    if (leaves) {
        leaves.forEach(l => months.add(format(new Date(l.startDate), 'yyyy-MM')));
    }
    return Array.from(months).sort().reverse();
  }, [leaves]);

  const handleOpenAdd = () => {
    setEditingLeave(null);
    setFormData({
      employeeId: '',
      type: 'paid',
      startDate: new Date().toISOString().slice(0, 10),
      endDate: new Date().toISOString().slice(0, 10),
      reason: ''
    });
    setModalOpen(true);
  };

  const handleEditClick = (leave: Leave) => {
    setEditingLeave(leave);
    setFormData({
      employeeId: leave.employeeId,
      type: leave.type,
      startDate: leave.startDate,
      endDate: leave.endDate,
      reason: leave.reason
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    const emp = employees?.find(e => e.id === formData.employeeId);
    if (!emp || !formData.startDate || !formData.endDate) {
        toast({ variant: 'destructive', title: "Missing Information" });
        return;
    }
    setIsSubmitting(true);
    
    if (editingLeave) {
        const success = await updateLeave(editingLeave.id, {
            employeeId: emp.id,
            employeeName: emp.displayName || emp.username || 'Unknown Operator',
            startDate: formData.startDate,
            endDate: formData.endDate,
            type: formData.type,
            reason: formData.reason
        });
        if (success) toast({ title: "Record Updated" });
    } else {
        await recordLeave({
            employeeId: emp.id,
            employeeName: emp.displayName || emp.username || 'Unknown Operator',
            startDate: formData.startDate,
            endDate: formData.endDate,
            type: formData.type,
            reason: formData.reason,
            status: 'approved'
        });
        toast({ title: "Leave Recorded" });
    }
    
    setModalOpen(false);
    setIsSubmitting(false);
    setEditingLeave(null);
  };

  const getLeaveIcon = (type: string) => {
    switch (type) {
        case 'sick': return <Stethoscope className="h-4 w-4 text-rose-500" />;
        case 'paid': return <Palmtree className="h-4 w-4 text-emerald-500" />;
        default: return <Plane className="h-4 w-4 text-blue-500" />;
    }
  };

  if (loading) return <div className="p-20 text-center animate-pulse uppercase font-black text-xs">Syncing Leave Rosters...</div>;

  return (
    <div className="space-y-8 max-w-7xl mx-auto font-body">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="font-headline text-4xl tracking-wider text-foreground uppercase">Leaves Tracker</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">Unified visibility of staff absences & time-off schedules.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={handleOpenAdd} className="h-12 px-6 font-black uppercase tracking-tight shadow-xl bg-primary text-white hover:bg-primary/90">
                <Plus className="mr-2 h-5 w-5" /> Record Leave
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-4">
            <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-xl px-6 py-6 flex flex-col justify-center shadow-sm">
                <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-2">On Leave Now</p>
                <div className="flex items-center gap-3">
                    <p className="text-4xl font-black text-emerald-600 font-mono leading-none">{stats.active}</p>
                    <Badge variant="outline" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-600 uppercase font-black text-[8px]">Operators Out</Badge>
                </div>
            </div>
            <div className="bg-primary/5 border-2 border-primary/20 rounded-xl px-6 py-6 flex flex-col justify-center shadow-sm">
                <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-2">Upcoming Rosters</p>
                <div className="flex items-center gap-3">
                    <p className="text-4xl font-black text-primary font-mono leading-none">{stats.upcoming}</p>
                    <Badge variant="outline" className="bg-primary/10 border-primary/20 text-primary uppercase font-black text-[8px]">Scheduled</Badge>
                </div>
            </div>
        </div>

        {/* MONTHLY AUDIT CARD */}
        <Card className="lg:col-span-2 border-2 border-dashed bg-muted/5">
            <CardHeader className="pb-2">
                <div className="flex justify-between items-center">
                    <div className="space-y-1">
                        <CardTitle className="text-sm font-black uppercase tracking-tight flex items-center gap-2">
                            <BarChart3 className="h-4 w-4 text-primary" />
                            Monthly Utilization Audit
                        </CardTitle>
                        <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Total days out per operator in selected month.</CardDescription>
                    </div>
                    <Select value={auditMonth} onValueChange={setAuditMonth}>
                        <SelectTrigger className="w-[160px] h-9 border-2 font-black uppercase text-[10px] bg-background">
                            <Calendar className="mr-2 h-3.5 w-3.5 text-primary" />
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {monthOptions.map(m => (
                                <SelectItem key={m} value={m} className="text-[10px] font-bold uppercase">
                                    {format(new Date(m + "-01"), 'MMMM yyyy')}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent>
                <div className="space-y-4 pt-2">
                    {stats.monthlyTotals.map((item, idx) => (
                        <div key={idx} className="space-y-1.5 hover:bg-muted/5 p-2 -mx-2 rounded-lg transition-colors">
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black uppercase tracking-tight">{item.name}</span>
                                <div className="text-right">
                                    <span className="text-xs font-black font-mono text-primary">{item.total} {item.total === 1 ? 'DAY' : 'DAYS'} TOTAL</span>
                                    {item.total > 0 && (
                                        <div className="flex justify-end gap-2 text-[8px] font-bold uppercase opacity-60">
                                            {item.unpaid > 0 && <span className="text-red-500">{item.unpaid} UNPAID</span>}
                                            {item.other > 0 && <span className="text-emerald-500">{item.other} PAID/SICK</span>}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden flex">
                                {item.other > 0 && <div className="h-full bg-emerald-500/80" style={{ width: `${(item.other / Math.max(30, item.total)) * 100}%` }} />}
                                {item.unpaid > 0 && <div className="h-full bg-red-500/80" style={{ width: `${(item.unpaid / Math.max(30, item.total)) * 100}%` }} />}
                            </div>
                        </div>
                    ))}
                    {stats.monthlyTotals.length === 0 && (
                        <div className="py-8 text-center opacity-30 italic font-bold uppercase text-[10px] tracking-widest border-2 border-dashed rounded-xl">
                            No absences detected for {format(new Date(auditMonth + "-01"), 'MMMM yyyy')}.
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Search Registry</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="NAME OR REASON..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 border-2 font-bold uppercase text-[10px] bg-background"
                    />
                </div>
            </div>
            <div className="w-[180px] space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Leave Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 border-2 font-black uppercase text-[10px] bg-background">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold uppercase">All Categories</SelectItem>
                        <SelectItem value="paid" className="text-[10px] font-bold uppercase">Paid Leave</SelectItem>
                        <SelectItem value="unpaid" className="text-[10px] font-bold uppercase">Unpaid (LWP)</SelectItem>
                        <SelectItem value="sick" className="text-[10px] font-bold uppercase">Sick Leave</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>

      <Card className="border-2 shadow-none overflow-hidden">
        <CardHeader className="bg-muted/10 border-b">
            <CardTitle className="text-lg font-black uppercase tracking-tight flex items-center gap-2">
                <CalendarRange className="h-5 w-5 text-primary" />
                Staff Absence Registry
            </CardTitle>
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Complete history of workforce absences.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Employee</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20">Schedule & Duration</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20 text-center">Category</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20">Reason / Memo</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeaves.map((leave) => {
                            const start = new Date(leave.startDate);
                            const end = new Date(leave.endDate);
                            const now = startOfDay(new Date());
                            const isActive = now >= startOfDay(start) && now <= startOfDay(end);
                            const isUpcoming = startOfDay(start) > now;
                            const duration = differenceInDays(end, start) + 1;

                            return (
                                <TableRow key={leave.id} className={cn("hover:bg-muted/5 transition-colors group", isActive && "bg-emerald-500/[0.03]")}>
                                    <TableCell className="pl-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center font-black text-xs text-primary">
                                                {leave.employeeName[0]}
                                            </div>
                                            <span className="font-black uppercase text-xs sm:text-sm">{leave.employeeName}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex flex-col">
                                            <span className="font-black text-[10px] uppercase">{format(start, 'MMM dd')} - {format(end, 'MMM dd')}</span>
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">{duration} {duration === 1 ? 'Day' : 'Days'} • {format(start, 'yyyy')}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <div className="flex flex-col items-center gap-1">
                                            {getLeaveIcon(leave.type)}
                                            <span className="text-[8px] font-black uppercase tracking-tighter opacity-60">{leave.type}</span>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="max-w-[200px] truncate text-[10px] font-medium text-foreground/80 italic">
                                            "{leave.reason}"
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right pr-6">
                                        <div className="flex items-center justify-end gap-3">
                                            {isActive ? (
                                                <Badge className="bg-emerald-600 text-[8px] font-black uppercase animate-pulse shadow-md">Active</Badge>
                                            ) : isUpcoming ? (
                                                <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase">Scheduled</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[8px] font-black uppercase opacity-40">History</Badge>
                                            )}
                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Button variant="ghost" size="icon" onClick={() => handleEditClick(leave)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                                                    <Edit className="h-3.5 w-3.5" />
                                                </Button>
                                                <Button variant="ghost" size="icon" onClick={() => deleteLeave(leave.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                                                    <Trash className="h-3.5 w-3.5" />
                                                </Button>
                                            </div>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                        {filteredLeaves.length === 0 && (
                            <TableRow>
                                <TableCell colSpan={5} className="h-64 text-center">
                                    <div className="flex flex-col items-center justify-center opacity-30 italic">
                                        <CalendarRange className="h-12 w-12 mb-2" />
                                        <p className="font-headline text-[10px] tracking-widest uppercase">Registry Empty</p>
                                    </div>
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg uppercase flex items-center gap-2">
                {editingLeave ? <Edit className="text-primary h-5 w-5" /> : <CalendarRange className="text-primary h-5 w-5" />}
                {editingLeave ? 'Correct Leave Record' : 'Record Staff Absence'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Select Employee</Label>
              <Select value={formData.employeeId} onValueChange={v => setFormData({...formData, employeeId: v})}>
                <SelectTrigger className="font-bold uppercase text-[10px] h-11 border-2"><SelectValue placeholder="PICK OPERATOR" /></SelectTrigger>
                <SelectContent>
                  {employees?.map(e => <SelectItem key={e.id} value={e.id}>{(e.displayName || e.username || 'Unknown').toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">From Date</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="h-11 text-xs font-bold border-2" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">To Date</Label>
                <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="h-11 text-xs font-bold border-2" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Leave Type</Label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                <SelectTrigger className="font-bold uppercase text-[10px] h-11 border-2"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid / LWP</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Reason / Internal Note</Label>
              <Input value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="e.g. FAMILY EVENT" className="font-bold text-xs uppercase h-11 border-2" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSubmitting || !formData.employeeId} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-lg">
                {isSubmitting ? 'Syncing...' : editingLeave ? 'Update Record' : 'Commit Record'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
