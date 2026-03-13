
'use client';

import { useMemo, useState } from 'react';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Leave, Employee } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { CalendarRange, User, Search, Clock, Plane, Palmtree, Stethoscope, ChevronRight, Filter, Plus, Trash } from 'lucide-react';
import { format, isPast, isFuture, isToday } from 'date-fns';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { recordLeave, deleteLeave } from '@/firebase/firestore/leaves';
import { useToast } from '@/hooks/use-toast';

export default function LeavesTrackerPage() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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

  const stats = useMemo(() => {
    if (!leaves) return { active: 0, upcoming: 0 };
    const now = new Date();
    return {
        active: leaves.filter(l => {
            const start = new Date(l.startDate);
            const end = new Date(l.endDate);
            return now >= start && now <= end;
        }).length,
        upcoming: leaves.filter(l => new Date(l.startDate) > now).length
    };
  }, [leaves]);

  const filteredLeaves = useMemo(() => {
    if (!leaves) return [];
    return leaves.filter(l => {
        const matchesSearch = l.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                             l.reason.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = typeFilter === 'all' || l.type === typeFilter;
        return matchesSearch && matchesType;
    });
  }, [leaves, searchTerm, typeFilter]);

  const handleRecord = async () => {
    const emp = employees?.find(e => e.id === formData.employeeId);
    if (!emp || !formData.startDate || !formData.endDate) return;
    setIsSubmitting(true);
    
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
    setModalOpen(false);
    setIsSubmitting(false);
    setFormData({ employeeId: '', type: 'paid', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: '' });
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
          <h1 className="font-headline text-4xl tracking-wider text-foreground">Leaves Tracker</h1>
          <p className="mt-2 text-muted-foreground font-black uppercase text-xs tracking-widest">Unified visibility of staff absences & time-off schedules.</p>
        </div>
        <div className="flex gap-2">
            <Button onClick={() => setModalOpen(true)} className="h-12 px-6 font-black uppercase tracking-tight shadow-xl bg-primary text-white">
                <Plus className="mr-2 h-5 w-5" /> Record Leave
            </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-emerald-500/10 border-2 border-emerald-500/20 rounded-xl px-4 py-4 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest leading-none mb-1">On Leave Now</p>
            <p className="text-3xl font-black text-emerald-600 font-mono leading-none">{stats.active}</p>
        </div>
        <div className="bg-primary/5 border-2 border-primary/20 rounded-xl px-4 py-4 flex flex-col justify-center shadow-sm">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest leading-none mb-1">Upcoming</p>
            <p className="text-3xl font-black text-primary font-mono leading-none">{stats.upcoming}</p>
        </div>
      </div>

      <Card className="bg-muted/30 border-dashed border-2">
        <CardContent className="p-4 flex flex-wrap gap-4 items-end">
            <div className="flex-1 min-w-[200px] space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Search Records</Label>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="NAME OR REASON..." 
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        className="pl-10 h-10 border-2 font-bold uppercase text-[10px]"
                    />
                </div>
            </div>
            <div className="w-[180px] space-y-1.5">
                <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground pl-1">Leave Type</Label>
                <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger className="h-10 border-2 font-black uppercase text-[10px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="text-[10px] font-bold uppercase">All Types</SelectItem>
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
            <CardDescription className="text-[10px] font-bold uppercase tracking-widest opacity-60">Audit trail of historical and future absences.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
            <ScrollArea className="h-[600px]">
                <Table>
                    <TableHeader className="bg-muted/20 sticky top-0 z-10 shadow-sm">
                        <TableRow>
                            <TableHead className="font-black uppercase text-[10px] pl-6 bg-muted/20">Employee</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20">Schedule</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20 text-center">Category</TableHead>
                            <TableHead className="font-black uppercase text-[10px] bg-muted/20">Reason / Memo</TableHead>
                            <TableHead className="text-right font-black uppercase text-[10px] pr-6 bg-muted/20">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredLeaves.map((leave) => {
                            const start = new Date(leave.startDate);
                            const end = new Date(leave.endDate);
                            const now = new Date();
                            const isActive = now >= start && now <= end;
                            const isUpcoming = start > now;

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
                                            <span className="text-[8px] font-bold text-muted-foreground uppercase">{format(start, 'yyyy')}</span>
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
                                                <Badge className="bg-emerald-600 text-[8px] font-black uppercase animate-pulse">Active</Badge>
                                            ) : isUpcoming ? (
                                                <Badge variant="outline" className="border-primary/30 text-primary text-[8px] font-black uppercase">Upcoming</Badge>
                                            ) : (
                                                <Badge variant="secondary" className="text-[8px] font-black uppercase opacity-40">Completed</Badge>
                                            )}
                                            <Button variant="ghost" size="icon" onClick={() => deleteLeave(leave.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity">
                                                <Trash className="h-3.5 w-3.5" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </ScrollArea>
        </CardContent>
      </Card>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md font-body">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg uppercase flex items-center gap-2">
                <CalendarRange className="text-primary h-5 w-5" />
                Record Staff Absence
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
            <Button onClick={handleRecord} disabled={isSubmitting || !formData.employeeId} className="w-full h-14 font-black uppercase tracking-widest shadow-xl text-lg">
                Commit Leave Record
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
