'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Employee } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';
import { MoreHorizontal, PlusCircle, Trash, Edit, Users, Shield, Banknote, Calendar, Clock, Eye, EyeOff, UserX, UserCheck, AlertTriangle } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
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
import { Badge } from '@/components/ui/badge';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function EmployeeManager() {
  const { db } = useFirebase();
  const { toast } = useToast();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedEmp, setSelectedEmp] = useState<Employee | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPin, setShowPin] = useState(false);

  // Delete dialog state
  const [empToDelete, setEmpToDelete] = useState<Employee | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState({
    username: '',
    displayName: '',
    role: 'staff' as Employee['role'],
    salary: 0,
    salaryType: 'monthly' as Employee['salaryType'],
    weekOffDay: 5,
    joinDate: new Date().toISOString().slice(0, 10),
    pin: '',
    workStartTime: '11:00',
    workEndTime: '23:00',
    workingDaysPerWeek: 6,
    overtimeMultiplier: 1.5,
    isActive: true,
    gracePeriod: 5,
    assignedShift: 'opening',
    foodAllowanceBalance: 1000
  });

  const empQuery = useMemo(() => !db ? null : collection(db, 'employees'), [db]);
  const { data: employees, loading } = useCollection<Employee>(empQuery);

  // Auto-seeding Kaif and Musaib if they don't exist and registry is empty
  useEffect(() => {
    if (loading || !employees) return;
    if (employees.length === 0) {
      const seedData = async () => {
        try {
          await addEmployee({
            username: 'kaif',
            displayName: 'Kaif',
            role: 'staff',
            salary: 6000,
            salaryType: 'monthly',
            weekOffDay: 4, // Thursday
            joinDate: new Date().toISOString().slice(0, 10),
            pin: '1234',
            workStartTime: '09:00',
            workEndTime: '15:00',
            workingDaysPerWeek: 6,
            overtimeMultiplier: 1.5,
            isActive: true,
            gracePeriod: 5,
            assignedShift: 'opening',
            foodAllowanceBalance: 1000
          });
          await addEmployee({
            username: 'musaib',
            displayName: 'Musaib',
            role: 'staff',
            salary: 6000,
            salaryType: 'monthly',
            weekOffDay: 4, // Thursday
            joinDate: new Date().toISOString().slice(0, 10),
            pin: '1234',
            workStartTime: '17:00',
            workEndTime: '23:00',
            workingDaysPerWeek: 6,
            overtimeMultiplier: 1.5,
            isActive: true,
            gracePeriod: 5,
            assignedShift: 'closing',
            foodAllowanceBalance: 1000
          });
        } catch (err) {
          console.error("Auto-seeding workforce failed:", err);
        }
      };
      seedData();
    }
  }, [employees, loading]);

  const handleEdit = (emp: Employee) => {
    setSelectedEmp(emp);
    setShowPin(false);
    setFormData({
      username: emp.username,
      displayName: emp.displayName,
      role: emp.role,
      salary: emp.salary || 0,
      salaryType: emp.salaryType || 'monthly',
      weekOffDay: emp.weekOffDay ?? 5,
      joinDate: emp.joinDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
      pin: emp.pin || '',
      workStartTime: emp.workStartTime || '11:00',
      workEndTime: emp.workEndTime || '23:00',
      workingDaysPerWeek: emp.workingDaysPerWeek ?? 6,
      overtimeMultiplier: emp.overtimeMultiplier ?? 1.5,
      isActive: emp.isActive ?? true,
      gracePeriod: emp.gracePeriod ?? 5,
      assignedShift: emp.assignedShift || 'opening',
      foodAllowanceBalance: emp.foodAllowanceBalance ?? 1000
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.username.trim() || !formData.displayName.trim() || !formData.pin.trim()) {
      toast({ variant: "destructive", title: "Incomplete Profile", description: "Display Name, Username, and PIN are required." });
      return;
    }

    const cleanUsername = formData.username.trim().toLowerCase();
    setIsSubmitting(true);
    
    try {
      if (selectedEmp) {
        await updateEmployee(selectedEmp.id, {
          ...formData,
          username: cleanUsername
        }, {
          username: selectedEmp.username,
          pin: selectedEmp.pin
        });
        toast({ title: "Staff Profile Updated", description: "Profile details and login credentials have been synced." });
      } else {
        // Check if employee with same username already exists in Firestore
        const existingEmp = employees?.find(e => e.username.toLowerCase() === cleanUsername);
        
        if (existingEmp) {
          if (!existingEmp.isActive) {
            // Reactivate existing inactive profile instead of failing
            await updateEmployee(existingEmp.id, {
              ...formData,
              username: cleanUsername,
              isActive: true
            }, {
              username: existingEmp.username,
              pin: existingEmp.pin
            });
            toast({ title: "Operator Reactivated", description: `@${cleanUsername} was inactive and has been reactivated with updated credentials.` });
          } else {
            toast({ variant: "destructive", title: "Username Taken", description: `An active operator with username '@${cleanUsername}' already exists.` });
            setIsSubmitting(false);
            return;
          }
        } else {
          await addEmployee({
            ...formData,
            username: cleanUsername
          });
          toast({ title: "New Staff Added", description: `Operator @${cleanUsername} and terminal credentials created successfully.` });
        }
      }
      
      setModalOpen(false);
      setFormData({ 
          username: '', displayName: '', role: 'staff', salary: 0, salaryType: 'monthly', 
          weekOffDay: 5, joinDate: new Date().toISOString().slice(0, 10), pin: '',
          workStartTime: '11:00', workEndTime: '23:00', workingDaysPerWeek: 6, overtimeMultiplier: 1.5, isActive: true, gracePeriod: 5,
          assignedShift: 'opening', foodAllowanceBalance: 1000
      });
    } catch (err: any) {
      console.error(err);
      toast({ 
        title: "Sync Warning / Error", 
        description: err.message || "Failed to update profile or sync credentials.", 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (emp: Employee) => {
    try {
      const nextStatus = !(emp.isActive ?? true);
      await updateEmployee(emp.id, { isActive: nextStatus });
      toast({
        title: nextStatus ? "Operator Activated" : "Operator Deactivated",
        description: `@${emp.username} terminal access status set to ${nextStatus ? 'Active' : 'Inactive'}.`
      });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
    }
  };

  const handleConfirmDelete = async () => {
    if (!empToDelete) return;
    setIsDeleting(true);
    try {
      const success = await deleteEmployee(empToDelete.id);
      if (success) {
        toast({ title: "Operator Permanently Deleted", description: `Record and Auth credentials for @${empToDelete.username} have been removed.` });
      } else {
        toast({ variant: "destructive", title: "Deletion Error", description: "Could not remove employee record." });
      }
    } catch (err: any) {
      toast({ variant: "destructive", title: "Deletion Error", description: err.message });
    } finally {
      setIsDeleting(false);
      setEmpToDelete(null);
    }
  };

  return (
    <Card className="border-2 shadow-none overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between bg-muted/10">
        <div>
          <CardTitle className="font-headline text-xl flex items-center gap-2"><Users className="text-primary" /> Staff Registry</CardTitle>
          <CardDescription className="text-sm font-bold uppercase tracking-normal">Manage employee profiles, salaries, and weekly offs.</CardDescription>
        </div>
        <Button onClick={() => { setSelectedEmp(null); setShowPin(false); setModalOpen(true); }} className="font-bold uppercase tracking-tight h-10 shadow-lg">
          <PlusCircle className="mr-2 h-4 w-4" /> Add Operator
        </Button>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20">
              <TableHead className="font-bold uppercase text-sm">Operator</TableHead>
              <TableHead className="font-bold uppercase text-sm">Role</TableHead>
              <TableHead className="font-bold uppercase text-sm">Compensation</TableHead>
              <TableHead className="font-bold uppercase text-sm">Meal Quota</TableHead>
              <TableHead className="font-bold uppercase text-sm">Shift Hours</TableHead>
              <TableHead className="text-right font-bold uppercase text-sm">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? <TableRow><TableCell colSpan={6} className="h-32 text-center animate-pulse">Syncing Workforce...</TableCell></TableRow> : 
              employees?.map(emp => (
                <TableRow key={emp.id} className="hover:bg-muted/5">
                  <TableCell className="py-4">
                    <div className="flex flex-col">
                      <span className="font-bold uppercase text-sm">{emp.displayName}</span>
                      <span className="text-sm font-bold text-muted-foreground uppercase">@{emp.username}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5 items-center">
                      <Badge variant="outline" className="font-bold uppercase text-sm border-primary/20 text-primary">{emp.role}</Badge>
                      {emp.isActive === false ? (
                        <Badge className="bg-destructive text-white font-bold uppercase text-sm px-1.5 py-0.5 rounded">INACTIVE</Badge>
                      ) : (
                        <Badge className="bg-emerald-600 text-white font-bold uppercase text-sm px-1.5 py-0.5 rounded">ACTIVE</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 font-mono font-bold text-sm">
                      <Banknote className="h-3 w-3 text-emerald-600" />
                      ₹{(emp.salary ?? 0).toLocaleString()} / {emp.salaryType || 'hourly'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-mono font-bold text-sm">
                      ₹{(emp.foodAllowanceBalance ?? 1000).toLocaleString()}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-col">
                        <span className="text-sm font-bold uppercase tracking-tight">{emp.workStartTime || '11:00'} - {emp.workEndTime || '23:00'}</span>
                        <span className="text-sm font-bold text-muted-foreground uppercase">{DAYS[emp.weekOffDay] || 'N/A'} OFF</span>
                        {emp.assignedShift && (
                          <Badge variant="outline" className="w-fit text-sm font-bold uppercase tracking-tight mt-1 bg-primary/5 text-primary border-primary/20">{emp.assignedShift} Shift</Badge>
                        )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleEdit(emp)} className="font-bold uppercase text-sm">
                          <Edit className="mr-2 h-3.5 w-3.5"/> Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleActive(emp)} className="font-bold uppercase text-sm">
                          {emp.isActive === false ? (
                            <><UserCheck className="mr-2 h-3.5 w-3.5 text-emerald-600"/> Reactivate Operator</>
                          ) : (
                            <><UserX className="mr-2 h-3.5 w-3.5 text-amber-500"/> Deactivate Access</>
                          )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEmpToDelete(emp)} className="text-destructive font-bold uppercase text-sm">
                          <Trash className="mr-2 h-3.5 w-3.5"/> Delete Permanently
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </CardContent>

      {/* Add / Edit Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-headline text-lg">{selectedEmp ? 'Edit Operator' : 'Add New Operator'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Display Name</Label>
                <Input value={formData.displayName} onChange={e => setFormData({...formData, displayName: e.target.value})} className="font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Username</Label>
                <Input value={formData.username} onChange={e => setFormData({...formData, username: e.target.value})} className="font-bold" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Terminal PIN (4-Digit)</Label>
                <div className="relative">
                  <Input 
                    type={showPin ? "text" : "password"} 
                    maxLength={4} 
                    value={formData.pin} 
                    onChange={e => setFormData({...formData, pin: e.target.value})} 
                    className="font-mono text-center tracking-[0.5em] pr-10" 
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPin(!showPin)}
                  >
                    {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Access Role</Label>
                <Select value={formData.role} onValueChange={(v: any) => setFormData({...formData, role: v})}>
                  <SelectTrigger className="font-bold uppercase text-sm"><SelectValue /></SelectTrigger>
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
                <Label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Shift Starts</Label>
                <Input type="time" value={formData.workStartTime} onChange={e => setFormData({...formData, workStartTime: e.target.value})} className="font-bold" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> Shift Ends</Label>
                <Input type="time" value={formData.workEndTime} onChange={e => setFormData({...formData, workEndTime: e.target.value})} className="font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Salary Amount</Label>
                <Input type="number" value={formData.salary || ''} onChange={e => setFormData({...formData, salary: Number(e.target.value)})} className="font-mono" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Salary Type</Label>
                <Select value={formData.salaryType} onValueChange={(v: any) => setFormData({...formData, salaryType: v})}>
                  <SelectTrigger className="font-bold uppercase text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly Fixed</SelectItem>
                    <SelectItem value="hourly">Hourly Rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.salaryType === 'monthly' && (
              <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold uppercase text-muted-foreground">Working Days / Week</Label>
                  <Input type="number" min={1} max={7} value={formData.workingDaysPerWeek || ''} onChange={e => setFormData({...formData, workingDaysPerWeek: Number(e.target.value)})} className="font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-bold uppercase text-muted-foreground">Overtime Multiplier</Label>
                  <Input type="number" step="0.1" value={formData.overtimeMultiplier || ''} onChange={e => setFormData({...formData, overtimeMultiplier: Number(e.target.value)})} className="font-mono" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Weekly Off Day</Label>
                <Select value={String(formData.weekOffDay)} onValueChange={v => setFormData({...formData, weekOffDay: Number(v)})}>
                  <SelectTrigger className="font-bold uppercase text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DAYS.map((d, i) => <SelectItem key={i} value={String(i)}>{d.toUpperCase()}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Join Date</Label>
                <Input type="date" value={formData.joinDate} onChange={e => setFormData({...formData, joinDate: e.target.value})} className="font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Assigned Shift</Label>
                <Select value={formData.assignedShift} onValueChange={v => setFormData({...formData, assignedShift: v})}>
                  <SelectTrigger className="font-bold uppercase text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="opening">Opening</SelectItem>
                    <SelectItem value="closing">Closing</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Grace Period (Mins)</Label>
                <Input type="number" min={0} value={formData.gracePeriod ?? 5} onChange={e => setFormData({...formData, gracePeriod: Number(e.target.value)})} className="font-bold" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-dashed pt-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Status</Label>
                <Select value={String(formData.isActive)} onValueChange={v => setFormData({...formData, isActive: v === 'true'})}>
                  <SelectTrigger className="font-bold uppercase text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="true">Active</SelectItem>
                    <SelectItem value="false">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-sm font-bold uppercase text-muted-foreground">Meal Allowance Quota (₹)</Label>
                <Input type="number" value={formData.foodAllowanceBalance} onChange={e => setFormData({...formData, foodAllowanceBalance: Number(e.target.value)})} className="font-mono font-bold text-sm" />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} disabled={isSubmitting} className="w-full h-12 font-bold uppercase tracking-normal shadow-xl">Apply Profile Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Alert Dialog */}
      <AlertDialog open={!!empToDelete} onOpenChange={(open) => !open && setEmpToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="font-headline text-lg flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Permanently Delete Operator?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 pt-1">
              <p>Are you sure you want to permanently delete <strong>{empToDelete?.displayName}</strong> (<code>@{empToDelete?.username}</code>)?</p>
              <p className="text-xs text-muted-foreground">This will remove their profile record from Firestore and wipe their login credentials from Firebase Authentication. This action cannot be undone.</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={isDeleting} className="bg-destructive text-white hover:bg-destructive/90 font-bold uppercase">
              {isDeleting ? 'Deleting...' : 'Permanently Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
