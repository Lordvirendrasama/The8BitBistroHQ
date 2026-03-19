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
const MAX_SHIFT_DURATION_HOURS = 20;

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

    if (expH >= 18 && logoutTime.getHours() < 6) {
        expDate.setDate(expDate.getDate() - 1);
    }
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

/**
 * ATOMIC DESIGN: Gets the current user's active shift or starts a brand new one.
 * No longer shares documents between users.
 */
export const getActiveOrStartShift = async (user: CustomUser): Promise<Shift | null> => {
    const db = getFirestore();
    const businessToday = getBusinessDate(); 
    const now = new Date();
    
    const shiftsRef = collection(db, 'shifts');
    
    try {
        const settings = await getSettings();

        // 1. Find ANY active shifts for THIS SPECIFIC USER
        const qActive = query(
            shiftsRef, 
            where('staffId', '==', user.username), 
            where('status', '==', 'active')
        );
        const activeSnap = await getDocs(qActive);
        
        // 2. Handle existing active shifts
        if (!activeSnap.empty) {
            const shiftDoc = activeSnap.docs[0];
            const shiftData = shiftDoc.data() as Shift;
            
            // Check if it's from a previous business day or too long
            const startTime = new Date(shiftData.startTime);
            const durationMs = now.getTime() - startTime.getTime();
            const maxDurationMs = MAX_SHIFT_DURATION_HOURS * 60 * 60 * 1000;
            
            if (shiftData.date !== businessToday || durationMs > maxDurationMs) {
                // AUTO-CLOSE stale shift
                const cappedEnd = new Date(startTime.getTime() + Math.min(durationMs, maxDurationMs));
                await updateDoc(shiftDoc.ref, {
                    endTime: cappedEnd.toISOString(),
                    status: 'completed',
                    note: 'Auto-closed on new login'
                });
                // Continue to create a new one below
            } else {
                // Return valid existing shift
                return { id: shiftDoc.id, ...shiftData };
            }
        }

        // 3. START A NEW ATOMIC SHIFT
        const empsRef = collection(db, 'employees');
        const empQ = query(empsRef, where('username', '==', user.username), limit(1));
        const empSnap = await getDocs(empQ);
        const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

        const { lateMinutes, workedOnWeeklyOff } = calculateAttendanceOnStart(now, empSettings);

        // Fetch master tasks
        const masterTasksRef = collection(db, 'tasks');
        const masterTasksSnapshot = await getDocs(masterTasksRef);
        const masterTasks = masterTasksSnapshot.docs.map(doc => doc.data() as Task);

        const dailyTasks: ShiftTask[] = masterTasks.map(task => ({
            name: task.name,
            type: task.type,
            completed: false,
            ownerOnly: task.ownerOnly || false
        }));

        // Add verification task for this specific session if not owner
        if (user.username !== 'Viren') {
            dailyTasks.push({
                name: `Verify ${user.displayName} Presence`,
                type: 'strategic',
                ownerOnly: true,
                completed: false
            });
        }

        const newShiftRef = doc(collection(db, 'shifts'));
        const newShiftData: Omit<Shift, 'id'> = {
            date: businessToday,
            staffId: user.username,
            employees: [{ username: user.username, displayName: user.displayName }],
            startTime: now.toISOString(),
            status: 'active',
            tasks: dailyTasks,
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
            description: `Started new shift for <strong>${user.displayName}</strong> on ${businessToday}.`,
            timestamp: now.toISOString(),
            user: { uid: user.username, displayName: user.displayName },
            details: { shiftId: newShiftRef.id, lateMinutes, workedOnWeeklyOff },
            cycle: settings.activeCycle
        }));
        
        await batch.commit();
        return { id: newShiftRef.id, ...newShiftData };

    } catch (e) {
        console.error("Error in Atomic Shift Engine:", e);
        return null;
    }
};

export const endShift = async (shiftId: string, user: CustomUser, totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number; }, forceEnd?: boolean): Promise<void> => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const shiftRef = doc(db, 'shifts', shiftId);

    try {
        const shiftDoc = await getDoc(shiftRef);
        if (!shiftDoc.exists()) return;

        const now = new Date();
        const empsRef = collection(db, 'employees');
        const empQ = query(empsRef, where('username', '==', user.username), limit(1));
        const empSnap = await getDocs(empQ);
        const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

        const { earlyLeaveMinutes, overtimeMinutes } = calculateAttendanceOnEnd(now, empSettings);

        if (forceEnd) {
            const shiftData = shiftDoc.data() as Shift;
            const incompleteTasks = (shiftData.tasks || []).filter(t => !t.completed);
            if (incompleteTasks.length > 0) {
                const incompleteTaskNames = incompleteTasks.map(t => `"${t.name}"`).join(', ');
                const notificationRef = doc(collection(db, 'adminNotifications'));
                batch.set(notificationRef, {
                    message: `<strong>${user.displayName}</strong> force-exited with ${incompleteTasks.length} pending tasks: ${incompleteTaskNames}.`,
                    type: 'INCOMPLETE_SHIFT',
                    isRead: false,
                    timestamp: now.toISOString(),
                    triggeredBy: { username: user.username, displayName: user.displayName, role: user.role }
                });
            }
        }

        const updates: any = {
            endTime: now.toISOString(),
            status: 'completed',
            earlyLeaveMinutes,
            overtimeMinutes,
            wasForceExited: !!forceEnd
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
            description: `<strong>${user.displayName}</strong> ended their atomic shift session.${forceEnd ? ' (FORCE EXIT)' : ''}`,
            timestamp: now.toISOString(),
            user: { uid: user.username, displayName: user.displayName },
            details: { shiftId, totals: totals || {}, earlyLeaveMinutes, overtimeMinutes, wasForceExited: !!forceEnd }
        }));

        await batch.commit();
    } catch (e) {
        console.error("Error ending atomic shift:", e);
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
        });
        return true;
    } catch (e) {
        console.error("Error ending break:", e);
        return false;
    }
};

export const updateTask = async (shiftId: string, taskName: string, completed: boolean, user: CustomUser, verificationResult?: 'yes' | 'no'): Promise<boolean> => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    try {
        await runTransaction(db, async (transaction) => {
            const shiftDoc = await transaction.get(shiftRef);
            if (!shiftDoc.exists()) throw "Shift not found";
            
            const shiftData = shiftDoc.data() as Shift;
            const currentTasks = shiftData.tasks || [];
            
            let taskFound = false;
            let updatedTasks = currentTasks.map(task => {
                if (task.name === taskName) {
                    taskFound = true;
                    const newTask: any = { ...task, completed, verificationResult };
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

            if (!taskFound && taskName.startsWith('Verify ')) {
                updatedTasks = [...updatedTasks, {
                    name: taskName, type: 'strategic', ownerOnly: true, completed, verificationResult,
                    completedAt: completed ? new Date().toISOString() : undefined,
                    completedBy: completed ? { username: user.username, displayName: user.displayName } : undefined
                }];
            }
            
            transaction.update(shiftRef, sanitize({ tasks: updatedTasks }));
        });
        return true;
    } catch (e) {
        console.error("Error updating task:", e);
        return false;
    }
};

export const updateShiftTimes = async (shiftId: string, updates: { startTime: string, endTime?: string | null }, user: CustomUser) => {
    const db = getFirestore();
    const shiftRef = doc(db, 'shifts', shiftId);
    try {
        await updateDoc(shiftRef, sanitize(updates));
        return true;
    } catch (e) {
        console.error("Error updating shift times:", e);
        return false;
    }
};

export const manuallyCreateShift = async (data: { 
    username: string, displayName: string, date: string, startTime: string, endTime?: string | null, status: 'yes' | 'no' 
}, user: CustomUser) => {
    const db = getFirestore();
    const settings = await getSettings();
    const shiftRef = doc(collection(db, 'shifts'));
    const strategicTask: ShiftTask = {
        name: `Verify ${data.displayName} Presence`,
        type: 'strategic', ownerOnly: true, completed: true, verificationResult: data.status,
        completedAt: new Date().toISOString(),
        completedBy: { username: user.username, displayName: user.displayName }
    };
    const shiftData: Omit<Shift, 'id'> = {
        date: data.date, staffId: data.username,
        employees: [{ username: data.username, displayName: data.displayName }],
        startTime: data.startTime, endTime: data.endTime || undefined,
        status: 'completed', tasks: [strategicTask], breaks: [], cycle: settings.activeCycle || 'Live Cycle'
    };
    try {
        await addDoc(collection(db, 'shifts'), sanitize(shiftData));
        return true;
    } catch (error) {
        console.error("Error creating manual shift:", error);
        return false;
    }
};