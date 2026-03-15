'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs, limit, orderBy, runTransaction, DocumentReference, getDoc } from 'firebase/firestore';
import type { Shift, ShiftTask, LogEntry, Task, ShiftBreak, Employee } from '@/lib/types';
import type { CustomUser } from '@/firebase/auth/use-user';
import { getBusinessDate } from '@/lib/utils';
import { getSettings } from './settings';

// Defaults for shift logic
const DEFAULT_START_TIME = "11:00"; 
const LATE_ARRIVAL_THRESHOLD = 10; 
const DEFAULT_END_TIME = "23:00";   

/**
 * Robustly sanitizes data for Firestore by removing any 'undefined' values.
 * Firestore accepts 'null' but crashes on 'undefined'.
 */
const sanitize = (data: any): any => {
  if (data === undefined) return null;
  if (data === null) return null;
  
  if (Array.isArray(data)) {
    return data.map(v => sanitize(v));
  }
  
  if (typeof data === 'object' && data !== null) {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      // Skip undefined keys entirely to prevent Firestore crash
      if (val !== undefined) {
        clean[key] = sanitize(val);
      }
    });
    return clean;
  }
  
  return data;
};

const calculateAttendanceOnStart = (loginTime: Date, empSettings?: Employee) => {
    const expectedStart = empSettings?.workStartTime || DEFAULT_START_TIME;
    const [expH, expM] = expectedStart.split(':').map(Number);
    const expDate = new Date(loginTime);
    expDate.setHours(expH, expM, 0, 0);

    let lateMinutes = 0;
    const diffMs = loginTime.getTime() - expDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins > LATE_ARRIVAL_THRESHOLD) {
        lateMinutes = diffMins;
    }

    const weekOff = empSettings ? empSettings.weekOffDay : 5;
    const workedOnWeeklyOff = loginTime.getDay() === weekOff;

    return { lateMinutes, workedOnWeeklyOff };
};

const calculateAttendanceOnEnd = (logoutTime: Date, empSettings?: Employee) => {
    const expectedEnd = empSettings?.workEndTime || DEFAULT_END_TIME;
    const [expH, expM] = expectedEnd.split(':').map(Number);
    const expDate = new Date(logoutTime);
    expDate.setHours(expH, expM, 0, 0);

    // If expected end is 11 PM and current logout is 5 AM (auto logout next morning)
    if (expH >= 18 && logoutTime.getHours() < 6) {
        expDate.setDate(expDate.getDate() - 1);
    }
    // Opposite: if expected end is early morning (e.g. 1 AM) and current logout is late night
    else if (expH < 6 && logoutTime.getHours() >= 18) {
        expDate.setDate(expDate.getDate() + 1);
    }

    let earlyLeaveMinutes = 0;
    let overtimeMinutes = 0;

    const diffMs = logoutTime.getTime() - expDate.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 0) {
        earlyLeaveMinutes = Math.abs(diffMins);
    } else if (diffMins > 0) {
        overtimeMinutes = diffMins;
    }

    return { earlyLeaveMinutes, overtimeMinutes };
};

export const getActiveOrStartShift = async (user: CustomUser): Promise<Shift | null> => {
    const db = getFirestore();
    const businessToday = getBusinessDate(); 
    const isOwner = user.username === 'Viren';
    
    const shiftsRef = collection(db, 'shifts');
    
    try {
        const settings = await getSettings();

        // 1. AUTO LOGOUT LOGIC: Find any "active" shifts from PREVIOUS business days and close them at 5 AM
        const qActive = query(shiftsRef, where('status', '==', 'active'));
        const activeSnap = await getDocs(qActive);
        
        for (const d of activeSnap.docs) {
            const data = d.data() as Shift;
            if (data.date !== businessToday && !data.endTime) {
                const sDate = new Date(data.startTime);
                const autoEndDate = new Date(sDate);
                autoEndDate.setDate(autoEndDate.getDate() + 1);
                autoEndDate.setHours(5, 0, 0, 0);
                
                await updateDoc(d.ref, {
                    endTime: autoEndDate.toISOString(),
                    status: 'completed',
                    note: 'Auto-closed at 5 AM boundary'
                });
            }
        }

        const masterTasksRef = collection(db, 'tasks');
        const masterTasksSnapshot = await getDocs(masterTasksRef);
        const masterTasks = masterTasksSnapshot.docs.map(doc => doc.data() as Task);

        const qToday = query(shiftsRef, where('date', '==', businessToday), limit(1));
        const shiftSnapshot = await getDocs(qToday);

        // STRATEGIC TASKS DEFINITION
        const strategicTasks = [
            { name: "Verify Abbas Presence", type: 'strategic' as const, ownerOnly: true },
            { name: "Verify Didi Presence", type: 'strategic' as const, ownerOnly: true }
        ];

        if (!shiftSnapshot.empty) {
            const shiftDoc = shiftSnapshot.docs[0];
            const shiftData = shiftDoc.data() as Shift;
            const shift = { id: shiftDoc.id, ...shiftData } as Shift;

            const updates: any = {};
            
            const existingTaskNames = new Set(shiftData.tasks.map(t => t.name));
            
            // Sync from Master Tasks
            const newTasksToSync = masterTasks
                .filter(mt => !existingTaskNames.has(mt.name))
                .map(mt => ({ name: mt.name, type: mt.type, completed: false, ownerOnly: mt.ownerOnly }));

            // Sync Strategic Tasks (Always required for Owner)
            const newStrategicToSync = strategicTasks
                .filter(st => !existingTaskNames.has(st.name))
                .map(st => ({ ...st, completed: false }));

            if (newTasksToSync.length > 0 || newStrategicToSync.length > 0) {
                updates.tasks = [...shiftData.tasks, ...newTasksToSync, ...newStrategicToSync];
            }

            if (!isOwner) {
                const userIsListed = shift.employees.some(e => e.username === user.username);
                if (!userIsListed) {
                    updates.employees = [...shift.employees, { username: user.username, displayName: user.displayName }];
                }
            }
            
            if (shift.status === 'completed' && !shift.endTime) {
                updates.status = 'active';
            }

            if (Object.keys(updates).length > 0) {
                await updateDoc(shiftDoc.ref, sanitize(updates));
                if (updates.tasks) shift.tasks = updates.tasks;
                if (updates.employees) shift.employees = updates.employees;
                if (updates.status) shift.status = updates.status;
            }
            return shift;
        } else {
            // RELAXED RESTRICTION: Admins can also initialize the day if staff hasn't yet.
            if (isOwner && user.role !== 'admin') return null;

            const now = new Date();
            
            const empsRef = collection(db, 'employees');
            const empQ = query(empsRef, where('username', '==', user.username), limit(1));
            const empSnap = await getDocs(empQ);
            const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

            const { lateMinutes, workedOnWeeklyOff } = calculateAttendanceOnStart(now, empSettings);

            // Base Tasks from Settings
            const dailyTasks: ShiftTask[] = masterTasks.map(task => ({
                name: task.name,
                type: task.type,
                completed: false,
                ownerOnly: task.ownerOnly || false
            }));

            // INJECT MANDATORY OWNER VERIFICATION TASKS
            const initialStrategic: ShiftTask[] = strategicTasks.map(st => ({ ...st, completed: false }));

            const combinedTasks = [...dailyTasks, ...initialStrategic];

            const newShiftRef = doc(collection(db, 'shifts'));
            const newShiftData: Omit<Shift, 'id'> = {
                date: businessToday,
                staffId: user.username,
                employees: [{ username: user.username, displayName: user.displayName }],
                startTime: now.toISOString(),
                status: 'active',
                tasks: combinedTasks,
                breaks: [],
                lateMinutes,
                workedOnWeeklyOff,
                cycle: settings.activeCycle || 'Live Cycle'
            };

            const batch = writeBatch(db);
            batch.set(newShiftRef, sanitize(newShiftData));
            
            const logRef = doc(collection(db, 'logs'));
            batch.set(logRef, sanitize({
                type: 'SHIFT_START',
                description: `Shift Master Record created for business day <strong>${businessToday}</strong> by <strong>${user.displayName}</strong>.${lateMinutes > 0 ? ` Marked as <strong>LATE</strong> by ${lateMinutes} mins.` : ''}`,
                timestamp: now.toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId: newShiftRef.id, lateMinutes, workedOnWeeklyOff },
                cycle: settings.activeCycle
            }));
            
            await batch.commit();

            return { id: newShiftRef.id, ...newShiftData };
        }
    } catch (e) {
        console.error("Error getting or starting shift:", e);
        return null;
    }
};


export const endShift = async (shiftId: string, user: CustomUser, totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number; }, forceEnd?: boolean): Promise<void> => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const shiftRef = doc(db, 'shifts', shiftId);

    try {
        const shiftDoc = await getDoc(shiftRef);
        const now = new Date();
        
        const empsRef = collection(db, 'employees');
        const empQ = query(empsRef, where('username', '==', user.username), limit(1));
        const empSnap = await getDocs(empQ);
        const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

        const { earlyLeaveMinutes, overtimeMinutes } = calculateAttendanceOnEnd(now, empSettings);

        if (forceEnd && shiftDoc.exists()) {
            const shiftData = shiftDoc.data() as Shift;
            const incompleteTasks = (shiftData.tasks || []).filter(t => !t.completed);
            if (incompleteTasks.length > 0) {
                const incompleteTaskNames = incompleteTasks.map(t => `"${t.name}"`).join(', ');
                const message = `<strong>${user.displayName}</strong> ended the shift with ${incompleteTasks.length} incomplete task(s): ${incompleteTaskNames}.`;
                
                const notificationRef = doc(collection(db, 'adminNotifications'));
                batch.set(notificationRef, {
                    message,
                    type: 'INCOMPLETE_SHIFT',
                    isRead: false,
                    timestamp: now.toISOString(),
                    triggeredBy: {
                        username: user.username,
                        displayName: user.displayName,
                        role: user.role,
                    }
                });
            }
        }

        const updates: any = {
            endTime: now.toISOString(),
            status: 'completed',
            earlyLeaveMinutes,
            overtimeMinutes
        };

        if (totals) {
            updates.cashTotal = totals.cashTotal || 0;
            updates.upiTotal = totals.upiTotal || 0;
            updates.shiftExpenses = totals.shiftExpenses || 0;
        }

        batch.update(shiftRef, sanitize(updates));
        
        const logRef = doc(collection(db, 'logs'));
        batch.set(logRef, sanitize({
            type: 'SHIFT_END',
            description: `<strong>${user.displayName}</strong> closed the daily shift record.${overtimeMinutes > 0 ? ` Worked <strong>OVERTIME</strong>: ${overtimeMinutes} mins.` : ''}`,
            timestamp: now.toISOString(),
            user: { uid: user.username, displayName: user.displayName },
            details: { shiftId, totals: totals || {}, earlyLeaveMinutes, overtimeMinutes }
        }));

        await batch.commit();

    } catch (e) {
        console.error("Error ending shift: ", e);
    }
};

export const startBreak = async (shiftId: string, user: CustomUser) => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(shiftRef);
            if (!snap.exists()) return;
            
            const data = snap.data() as Shift;
            
            const hasActive = data.breaks?.some(b => !b.endTime);
            if (hasActive) return;

            const newBreaks = [...(data.breaks || []), { startTime: new Date().toISOString() }];
            transaction.update(shiftRef, { breaks: newBreaks });
            
            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, sanitize({
                type: 'BREAK_START',
                description: `<strong>${user.displayName}</strong> started a break.`,
                timestamp: new Date().toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId }
            }));
        });
        return true;
    } catch (e) {
        console.error("Error starting break:", e);
        return false;
    }
};

export const endBreak = async (shiftId: string, user: CustomUser) => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const snap = await transaction.get(shiftRef);
            if (!snap.exists()) return;
            
            const data = snap.data() as Shift;
            const now = new Date();
            
            const hasActive = data.breaks?.some(b => !b.endTime);
            if (!hasActive) return;

            const updatedBreaks = data.breaks.map(b => {
                if (!b.endTime) {
                    const duration = Math.floor((now.getTime() - new Date(b.startTime).getTime()) / 1000);
                    return { ...b, endTime: now.toISOString(), durationSeconds: duration };
                }
                return b;
            });
            
            transaction.update(shiftRef, { breaks: updatedBreaks });
            
            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, sanitize({
                type: 'BREAK_END',
                description: `<strong>${user.displayName}</strong> ended a break.`,
                timestamp: now.toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId }
            }));
        });
        return true;
    } catch (e) {
        console.error("Error ending break:", e);
        return false;
    }
};

export const updateTask = async (shiftId: string, taskName: string, completed: boolean, user: CustomUser, verificationResult?: 'yes' | 'no'): Promise<void> => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    
    try {
        await runTransaction(db, async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists()) {
                throw "Shift document not found!";
            }
            const currentTasks = shiftDoc.data().tasks as ShiftTask[];
            const updatedTasks = currentTasks.map(task => {
                if (task.name === taskName) {
                    const newTask: any = { 
                        ...task, 
                        completed, 
                        verificationResult
                    };
                    if (completed) {
                        newTask.completedAt = new Date().toISOString();
                        newTask.completedBy = { username: user.username, displayName: user.displayName };
                    } else {
                        delete newTask.completedAt;
                        delete newTask.completedBy;
                        delete newTask.verificationResult;
                    }
                    return newTask;
                }
                return task;
            });
            
            transaction.update(shiftRef, sanitize({ tasks: updatedTasks }));

            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, sanitize({
                type: 'TASK_COMPLETED',
                description: `<strong>${user.displayName}</strong> ${completed ? 'completed' : 'un-completed'} task: "${taskName}".${verificationResult ? ` Result: <strong>${verificationResult.toUpperCase()}</strong>` : ''}`,
                timestamp: new Date().toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId, taskName, completed, verificationResult }
            }));
        });
    } catch (e) {
        console.error("Error updating task transactionally: ", e);
    }
};

export const updateShiftTimes = async (shiftId: string, updates: { startTime: string, endTime?: string | null }, user: CustomUser) => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    
    try {
        const snap = await getDoc(shiftRef);
        if (!snap.exists()) return false;
        
        await updateDoc(shiftRef, sanitize(updates));
        
        await addDoc(collection(db, 'logs'), sanitize({
            type: 'SHIFT_UPDATED',
            description: `<strong>${user.displayName}</strong> manually adjusted shift times for ID: <strong>${shiftId.slice(0, 8)}</strong>.`,
            timestamp: new Date().toISOString(),
            user: { uid: user.username, displayName: user.displayName },
            details: { shiftId, updates }
        }));
        return true;
    } catch (e) {
        console.error("Error updating shift times:", e);
        return false;
    }
};
