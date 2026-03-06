
'use client';
import { useState, useMemo } from 'react';
import type { Leave, Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PlusCircle, Calendar, Trash, CheckCircle2, Clock, XCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, orderBy } from 'firebase/firestore';
import { recordLeave, updateLeaveStatus, deleteLeave } from '@/firebase/firestore/leaves';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

export function LeaveManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
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

  const handleRecord = async () => {
    const emp = employees?.find(e => e.id === formData.employeeId);
    if (!emp || !formData.startDate || !formData.endDate) return;
    setIsSubmitting(true);
    
    await recordLeave({
      employeeId: emp.id,
      employeeName: emp.displayName,
      startDate: formData.startDate,
      endDate: formData.endDate,
      type: formData.type,
      reason: formData.reason,
      status: 'approved' // Automatically approved for simplicity or adjust as needed
    });
    
    toast({ title: "Leave Recorded" });
    setModalOpen(false);
    setIsSubmitting(false);
    setFormData({ employeeId: '', type: 'paid', startDate: new Date().toISOString().slice(0, 10), endDate: new Date().toISOString().slice(0, 10), reason: '' });
  };

  return (
    <Card className="border-2 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/10">
        <div>
          <CardTitle className="font-headline text-xl flex items-center gap-2"><Calendar className="text-primary" /> Leave Registry</CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest">Track staff absences and paid/unpaid time off.</CardDescription>
        </div>
        <Button onClick={() => setModalOpen(true)} className="font-black uppercase tracking-tight h-10 shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" /> Record Leave
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[600px]">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/30">
              <TableRow>
                <TableHead className="font-black uppercase text-[10px]">Employee</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Dates</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Type</TableHead>
                <TableHead className="font-black uppercase text-[10px]">Reason</TableHead>
                <TableHead className="text-right font-black uppercase text-[10px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse">Fetching records...</TableCell></TableRow> : 
                leaves?.map(leave => (
                  <TableRow key={leave.id} className="hover:bg-muted/5">
                    <TableCell className="py-4">
                      <span className="font-black uppercase text-xs">{leave.employeeName}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col text-[10px] font-mono font-bold">
                        <span>{format(new Date(leave.startDate), 'MMM dd')} - {format(new Date(leave.endDate), 'MMM dd')}</span>
                        <span className="opacity-50 text-[8px] uppercase">{format(new Date(leave.startDate), 'yyyy')}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={leave.type === 'unpaid' ? 'destructive' : 'outline'} className="text-[8px] font-black uppercase">
                        {leave.type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <p className="text-[10px] font-medium opacity-70 italic">"{leave.reason}"</p>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => deleteLeave(leave.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                        <Trash className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              }
              {leaves?.length === 0 && (
                <TableRow><TableCell colSpan={5} className="h-64 text-center opacity-30 italic font-black uppercase text-[10px] tracking-widest">No leave records found.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg">Record Staff Absence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Select Employee</Label>
              <Select value={formData.employeeId} onValueChange={v => setFormData({...formData, employeeId: v})}>
                <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue placeholder="PICK OPERATOR" /></SelectTrigger>
                <SelectContent>
                  {employees?.map(e => <SelectItem key={e.id} value={e.id}>{e.displayName.toUpperCase()}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">From Date</Label>
                <Input type="date" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} className="h-10 text-xs font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">To Date</Label>
                <Input type="date" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} className="h-10 text-xs font-bold" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Leave Type</Label>
              <Select value={formData.type} onValueChange={(v: any) => setFormData({...formData, type: v})}>
                <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="paid">Paid Leave</SelectItem>
                  <SelectItem value="unpaid">Unpaid / LWP</SelectItem>
                  <SelectItem value="sick">Sick Leave</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[9px] font-black uppercase text-muted-foreground">Reason / Internal Note</Label>
              <Input value={formData.reason} onChange={e => setFormData({...formData, reason: e.target.value})} placeholder="e.g. FAMILY EVENT" className="font-bold text-xs uppercase" />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRecord} disabled={isSubmitting || !formData.employeeId} className="w-full h-12 font-black uppercase tracking-widest shadow-xl">Commit Leave Record</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
