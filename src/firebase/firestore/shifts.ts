
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, writeBatch, query, where, getDocs, limit, orderBy, runTransaction, DocumentReference, getDoc } from 'firebase/firestore';
import type { Shift, ShiftTask, LogEntry, Task, ShiftBreak, Employee } from '@/lib/types';
import type { CustomUser } from '@/firebase/auth/use-user';
import { getBusinessDate } from '@/lib/utils';

// Defaults for shift logic
const DEFAULT_START_TIME = "11:00"; 
const LATE_ARRIVAL_THRESHOLD = 10; 
const DEFAULT_END_TIME = "23:00";   

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

    // If expected end is early morning (e.g. 1 AM) and current logout is late night
    if (expH < 5 && logoutTime.getHours() >= 18) {
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
        // 1. AUTO LOGOUT LOGIC: Find any "active" shifts from PREVIOUS business days and close them at 5 AM
        const qActive = query(shiftsRef, where('status', '==', 'active'));
        const activeSnap = await getDocs(qActive);
        
        for (const d of activeSnap.docs) {
            const data = d.data() as Shift;
            if (data.date !== businessToday && !data.endTime) {
                // Auto-close at 5 AM of the next calendar day from its start
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

        if (!shiftSnapshot.empty) {
            const shiftDoc = shiftSnapshot.docs[0];
            const shiftData = shiftDoc.data() as Shift;
            const shift = { id: shiftDoc.id, ...shiftData } as Shift;

            const updates: any = {};
            
            const existingTaskNames = new Set(shiftData.tasks.map(t => t.name));
            const newTasksToSync = masterTasks
                .filter(mt => !existingTaskNames.has(mt.name))
                .map(mt => ({ name: mt.name, type: mt.type, completed: false }));

            if (newTasksToSync.length > 0) {
                updates.tasks = [...shiftData.tasks, ...newTasksToSync];
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
                await updateDoc(shiftDoc.ref, updates);
                if (updates.tasks) shift.tasks = updates.tasks;
                if (updates.employees) shift.employees = updates.employees;
                if (updates.status) shift.status = updates.status;
            }
            return shift;
        } else {
            if (isOwner) return null;

            const now = new Date();
            
            const empsRef = collection(db, 'employees');
            const empQ = query(empsRef, where('username', '==', user.username), limit(1));
            const empSnap = await getDocs(empQ);
            const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

            const { lateMinutes, workedOnWeeklyOff } = calculateAttendanceOnStart(now, empSettings);

            const dailyTasks: ShiftTask[] = masterTasks.map(task => ({
                name: task.name,
                type: task.type,
                completed: false
            }));

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
            };

            const batch = writeBatch(db);
            batch.set(newShiftRef, newShiftData);
            
            const logRef = doc(collection(db, 'logs'));
            batch.set(logRef, {
                type: 'SHIFT_START',
                description: `Shift Master Record created for business day <strong>${businessToday}</strong> by <strong>${user.displayName}</strong>.${lateMinutes > 0 ? ` Marked as <strong>LATE</strong> by ${lateMinutes} mins.` : ''}`,
                timestamp: now.toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId: newShiftRef.id, lateMinutes, workedOnWeeklyOff }
            });
            
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

        batch.update(shiftRef, updates);
        
        const logRef = doc(collection(db, 'logs'));
        batch.set(logRef, {
            type: 'SHIFT_END',
            description: `<strong>${user.displayName}</strong> closed the daily shift record.${overtimeMinutes > 0 ? ` Worked <strong>OVERTIME</strong>: ${overtimeMinutes} mins.` : ''}`,
            timestamp: now.toISOString(),
            user: { uid: user.username, displayName: user.displayName },
            details: { shiftId, totals: totals || {}, earlyLeaveMinutes, overtimeMinutes }
        });

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
            
            // Check if there is an active break
            const hasActive = data.breaks?.some(b => !b.endTime);
            if (hasActive) return;

            const newBreaks = [...(data.breaks || []), { startTime: new Date().toISOString() }];
            transaction.update(shiftRef, { breaks: newBreaks });
            
            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, {
                type: 'BREAK_START',
                description: `<strong>${user.displayName}</strong> started a break.`,
                timestamp: new Date().toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId }
            });
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
            transaction.set(logRef, {
                type: 'BREAK_END',
                description: `<strong>${user.displayName}</strong> ended a break.`,
                timestamp: now.toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId }
            });
        });
        return true;
    } catch (e) {
        console.error("Error ending break:", e);
        return false;
    }
};

export const updateTask = async (shiftId: string, taskName: string, completed: boolean, user: CustomUser): Promise<void> => {
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
                    };
                    if (completed) {
                        newTask.completedAt = new Date().toISOString();
                        newTask.completedBy = { username: user.username, displayName: user.displayName };
                    } else {
                        delete newTask.completedAt;
                        delete newTask.completedBy;
                    }
                    return newTask;
                }
                return task;
            });
            
            transaction.update(shiftRef, { tasks: updatedTasks });

            const logRef = doc(collection(db, 'logs'));
            transaction.set(logRef, {
                type: 'TASK_COMPLETED',
                description: `<strong>${user.displayName}</strong> ${completed ? 'completed' : 'un-completed'} task: "${taskName}".`,
                timestamp: new Date().toISOString(),
                user: { uid: user.username, displayName: user.displayName },
                details: { shiftId, taskName, completed }
            });
        });
    } catch (e) {
        console.error("Error updating task transactionally: ", e);
    }
};
