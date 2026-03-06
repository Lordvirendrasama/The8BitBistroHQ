
'use client';
import { useState, useMemo } from 'react';
import type { Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Users, Shield, Banknote, Calendar } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { useFirebase } from '@/firebase/provider';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection } from 'firebase/firestore';
import { addEmployee, updateEmployee, deleteEmployee } from '@/firebase/firestore/employees';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function EmployeeManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    role: 'staff' as Employee['role'],
    salary: 0,
    salaryType: 'monthly' as Employee['salaryType'],
    weekOffDay: 5,
    joinDate: new Date().toISOString().slice(0, 10),
    pin: ''
  });

  const empQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees, loading } = useCollection<Employee>(empQuery);

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setFormData({
      username: emp.username,
      displayName: emp.displayName,
      role: emp.role,
      salary: emp.salary,
      salaryType: emp.salaryType,
      weekOffDay: emp.weekOffDay,
      joinDate: emp.joinDate.slice(0, 10),
      pin: emp.pin
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username || !formData.displayName || !formData.pin) return;
    setIsSubmitting(true);
    
    if (selectedEmp) {
      await updateEmployee(selectedEmp.id, formData);
      toast({ title: "Staff Updated" });
    } else {
      await addEmployee(formData);
      toast({ title: "New Staff Added" });
    }
    
    setModalOpen(false);
    setIsSubmitting(false);
    setFormData({ username: '', displayName: '', role: 'staff', salary: 0, salaryType: 'monthly', weekOffDay: 5, joinDate: new Date().toISOString().slice(0, 10), pin: '' });
  };

  return (
    <Card className="border-2 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/10">
        <div>
          <CardTitle className="font-headline text-xl flex items-center gap-2"><Users className="text-primary" /> Staff Registry</CardTitle>
          <CardDescription className="text-xs font-bold uppercase tracking-widest">Manage employee profiles, salaries, and weekly offs.</CardDescription>
        </div>
        <Button onClick={() => { setSelectedEmp(null); setModalOpen(true); }} className="font-black uppercase tracking-tight h-10 shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Operator
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="font-black uppercase text-[10px]">Operator</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Role</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Compensation</TableHead>
              <TableHead className="font-black uppercase text-[10px]">Weekoff</TableHead>
              <TableHead className="text-right font-black uppercase text-[10px]">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={5} className="h-32 text-center animate-pulse">Syncing Workforce...</TableCell></TableRow> : 
              employees?.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/5">
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-black uppercase text-sm">{emp.displayName}</span>
                      <span className="text-[10px] font-bold text-muted-foreground uppercase">@{emp.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-black uppercase text-[9px] border-primary/20 text-primary">{emp.role}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-xs">
                      <Banknote className="h-3 w-3 text-emerald-600" />
                      ₹{emp.salary.toLocaleString()} / {emp.salaryType}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-[10px] font-bold uppercase">{DAYS[emp.weekOffDay]}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(emp)} className="font-bold uppercase text-[10px]"><Edit className="mr-2 h-3 w-3"/> Edit Profile</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deleteEmployee(emp.id)} className="text-destructive font-bold uppercase text-[10px]"><Trash className="mr-2 h-3 w-3"/> Remove</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </CardContent>

      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg">{selectedEmp ? 'Edit Operator' : 'Add New Operator'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Display Name</Label>
                <Input value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Username</Label>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Terminal PIN (4-Digit)</Label>
                <Input type="password" maxLength={4} value={formData.pin} onChange={e => setFormData({...formData, pin: e.target.value})} className="font-mono text-center tracking-[0.5em]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Access Role</Label>
                <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}>
                  <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Salary Amount</Label>
                <Input type="number" value={formData.salary || ''} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Salary Type</Label>
                <Select value={formData.salaryType} onValueChange={(v: any) => setFormData({...formData, salaryType: v})}>
                  <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Fixed</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Weekly Off Day</Label>
                <Select value={String(formData.weekOffDay)} onValueChange={v => setFormData({...formData, weekOffDay: Number(v)})}>
                  <SelectTrigger className="font-bold uppercase text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[9px] font-black uppercase text-muted-foreground">Join Date</Label>
                <Input type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} className="font-bold" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-12 font-black uppercase tracking-widest shadow-xl">Apply Profile Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
