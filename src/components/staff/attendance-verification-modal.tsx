
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '@/firebase/auth/use-user';
import { useCollection } from '@/firebase/firestore/use-collection';
import { collection, query, where } from 'firebase/firestore';
import { useFirebase } from '@/firebase/provider';
import type { Shift, Employee } from '@/lib/types';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ShieldCheck, UserCheck, UserX, Clock, History, CheckCircle2 } from 'lucide-react';
import { format, isSameDay } from 'date-fns';
import { cn, getBusinessDate } from '@/lib/utils';

export function AttendanceVerificationModal() {
  const { user } = useAuth();
  const { db } = useFirebase();
  const [isOpen, setIsOpen] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  const isOwner = user?.username === 'Viren';

  // 1. Logic to show at 10:00 PM local time
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      
      const hour = now.getHours();
      const minute = now.getMinutes();
      
      // Trigger modal at exactly 10:00 PM if owner is logged in
      if (isOwner && hour === 22 && minute === 0 && !isOpen) {
        // Only trigger once per day check (using sessionStorage)
        const lastChecked = sessionStorage.getItem('last_attendance_audit');
        const todayStr = getBusinessDate();
        if (lastChecked !== todayStr) {
            setIsOpen(true);
            sessionStorage.setItem('last_attendance_audit', todayStr);
        }
      }
    }, 30000); // Check every 30 seconds

    return () => clearInterval(timer);
  }, [isOwner, isOpen]);

  // 2. Data Fetching
  const shiftsQuery = useMemo(() => {
    if (!db || !isOpen) return null;
    return query(collection(db, 'shifts'), where('date', '==', getBusinessDate()));
  }, [db, isOpen]);

  const { data: todayShifts } = useCollection<Shift>(shiftsQuery);

  const employeesQuery = useMemo(() => {
    if (!db || !isOpen) return null;
    return query(collection(db, 'employees'), where('username', 'in', ['Abbas', 'Didi']));
  }, [db, isOpen]);

  const { data: targetStaff } = useCollection<Employee>(employeesQuery);

  const staffStatus = useMemo(() => {
    if (!targetStaff) return [];
    return targetStaff.map(staff => {
        const shift = todayShifts?.find(s => 
            s.staffId === staff.username || 
            s.employees?.some(e => e.username === staff.username)
        );
        return { staff, shift };
    });
  }, [targetStaff, todayShifts]);

  if (!isOwner) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-md font-body p-0 overflow-hidden border-none shadow-2xl">
        <DialogHeader className="p-6 bg-primary text-white shrink-0">
          <DialogTitle className="flex items-center gap-3 text-2xl font-display uppercase tracking-tight">
            <ShieldCheck className="h-8 w-8" />
            Shift Verification
          </DialogTitle>
          <DialogDescription className="text-white/70 font-bold text-[10px] uppercase tracking-[0.2em] mt-1">
            DAILY OPERATIONAL AUDIT • {format(currentTime, 'p')}
          </DialogDescription>
        </DialogHeader>

        <div className="p-6 space-y-6">
          <p className="text-sm font-medium text-foreground/80 leading-relaxed">
            It is 10:00 PM. Please verify if the following staff members arrived for their 12-hour shift today.
          </p>

          <div className="space-y-3">
            {staffStatus.map(({ staff, shift }) => (
              <div key={staff.id} className={cn(
                "p-4 rounded-2xl border-2 flex items-center justify-between transition-all",
                shift ? "bg-emerald-500/5 border-emerald-500/20" : "bg-destructive/5 border-destructive/20 shadow-lg animate-pulse"
              )}>
                <div className="flex items-center gap-4">
                  <div className={cn(
                    "h-12 w-12 rounded-full flex items-center justify-center text-white shadow-md",
                    shift ? "bg-emerald-600" : "bg-destructive"
                  )}>
                    {shift ? <UserCheck className="h-6 w-6" /> : <UserX className="h-6 w-6" />}
                  </div>
                  <div>
                    <p className="font-black uppercase text-sm tracking-tight">{staff.displayName}</p>
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">11:00 AM - 11:00 PM Shift</p>
                  </div>
                </div>
                <div className="text-right">
                  {shift ? (
                    <div className="space-y-1">
                      <Badge className="bg-emerald-600 uppercase font-black text-[8px] h-4">Present</Badge>
                      <p className="text-[10px] font-mono font-bold text-emerald-700">IN: {format(new Date(shift.startTime), 'p')}</p>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <Badge variant="destructive" className="uppercase font-black text-[8px] h-4">No Record</Badge>
                      <p className="text-[10px] font-bold text-destructive uppercase">NOT LOGGED IN</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="bg-muted/30 p-4 rounded-xl border-2 border-dashed flex items-start gap-3">
            <History className="text-muted-foreground h-5 w-5 shrink-0 mt-0.5" />
            <div className="space-y-1">
                <p className="text-[10px] font-black uppercase text-muted-foreground">Tally Logic</p>
                <p className="text-[10px] font-medium text-muted-foreground leading-tight">
                    This data is derived directly from terminal logins for the current business cycle.
                </p>
            </div>
          </div>
        </div>

        <DialogFooter className="p-4 bg-muted/10 border-t">
          <Button onClick={() => setIsOpen(false)} className="w-full h-12 font-black uppercase tracking-widest shadow-xl">
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Audit Complete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
