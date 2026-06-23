import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase/init';
import { collection, getDocs, doc, query, where, updateDoc, deleteDoc, addDoc } from 'firebase/firestore';
import type { Employee, Shift } from '@/lib/types';
import { getBusinessDate } from '@/lib/utils';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get('date');
    
    const { db } = initializeFirebase();
    const targetDate = dateParam || getBusinessDate();

    // 1. MIDNIGHT AUTO LOGOUT for active shifts
    // Find all active shifts for targetDate or earlier
    const activeShiftsQuery = query(
      collection(db, 'shifts'),
      where('status', '==', 'active')
    );
    const activeShiftsSnapshot = await getDocs(activeShiftsQuery);
    const activeShifts = activeShiftsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shift));

    const processedLogs: string[] = [];

    for (const shift of activeShifts) {
      if (shift.date <= targetDate) {
        // Fetch employee settings
        const empsRef = collection(db, 'employees');
        const empQ = query(empsRef, where('username', '==', shift.staffId));
        const empSnap = await getDocs(empQ);
        const empSettings = empSnap.empty ? undefined : empSnap.docs[0].data() as Employee;

        const [y, m, d] = shift.date.split('-').map(Number);
        // Midnight is the transition to the next day
        const midnightDate = new Date(y, m - 1, d + 1, 0, 0, 0, 0);

        const startTimeDate = new Date(shift.startTime);
        const durationMs = midnightDate.getTime() - startTimeDate.getTime();
        const totalHoursWorked = Math.max(0, Math.round((durationMs / (1000 * 60 * 60)) * 100) / 100);

        const scheduledStart = shift.scheduledLogin || empSettings?.workStartTime || "11:00";
        const scheduledEnd = shift.scheduledLogout || empSettings?.workEndTime || "23:00";
        const [startH, startM] = scheduledStart.split(':').map(Number);
        const [endH, endM] = scheduledEnd.split(':').map(Number);

        let scheduledDiffMins = (endH * 60 + endM) - (startH * 60 + startM);
        if (scheduledDiffMins < 0) {
            scheduledDiffMins += 24 * 60;
        }
        const scheduledDurationHours = scheduledDiffMins / 60;

        const gracePeriod = empSettings?.gracePeriod ?? 5;
        const [schH, schM] = scheduledStart.split(':').map(Number);
        const schDate = new Date(startTimeDate);
        schDate.setHours(schH, schM, 0, 0);
        const delayMinutes = Math.floor((startTimeDate.getTime() - schDate.getTime()) / 60000);

        let currentAttendanceStatus: 'Present' | 'Late' | 'Half Day' = 'Present';
        if (delayMinutes > gracePeriod) {
            currentAttendanceStatus = 'Late';
        }
        if (totalHoursWorked < 0.5 * scheduledDurationHours) {
            currentAttendanceStatus = 'Half Day';
        }

        const shiftRef = doc(db, 'shifts', shift.id);
        const lockRef = doc(db, 'user_active_shift', shift.staffId);

        await updateDoc(shiftRef, {
          endTime: midnightDate.toISOString(),
          actualLogout: "00:00",
          status: 'completed',
          totalHoursWorked,
          attendanceStatus: currentAttendanceStatus,
          logoutMethod: 'auto-midnight',
          forgotToLogout: true
        });

        // Clear active session lock
        try {
          await deleteDoc(lockRef);
        } catch (e) {
          console.error("Error clearing lock:", e);
        }

        processedLogs.push(`Auto-logged out ${shift.staffId} at midnight of ${shift.date}`);
      }
    }

    // 2. AUTO ATTENDANCE GENERATION
    // Fetch all active employees
    const empsQuery = query(collection(db, 'employees'), where('isActive', '==', true));
    const empsSnapshot = await getDocs(empsQuery);
    const activeEmployees = empsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Employee));

    const [y, m, d] = targetDate.split('-').map(Number);
    const targetDateObj = new Date(y, m - 1, d);
    const dayOfWeek = targetDateObj.getDay(); // 0 (Sun) - 6 (Sat)

    for (const employee of activeEmployees) {
      const shiftQ = query(
        collection(db, 'shifts'),
        where('staffId', '==', employee.username),
        where('date', '==', targetDate)
      );
      const shiftSnap = await getDocs(shiftQ);

      if (shiftSnap.empty) {
        const isWeeklyOff = dayOfWeek === employee.weekOffDay;
        
        const schStart = employee.workStartTime || "11:00";
        const schEnd = employee.workEndTime || "23:00";
        const [shH, shM] = schStart.split(':').map(Number);
        const [ehH, ehM] = schEnd.split(':').map(Number);

        const startTimeDate = new Date(y, m - 1, d, shH, shM, 0, 0);
        const endTimeDate = new Date(y, m - 1, d, ehH, ehM, 0, 0);
        if (endTimeDate < startTimeDate) {
            endTimeDate.setDate(endTimeDate.getDate() + 1);
        }

        const docData: any = {
          date: targetDate,
          staffId: employee.username,
          employeeId: employee.username,
          employees: [{ username: employee.username, displayName: employee.displayName }],
          startTime: startTimeDate.toISOString(),
          endTime: endTimeDate.toISOString(),
          status: 'completed',
          totalHoursWorked: 0,
          attendanceStatus: isWeeklyOff ? 'Weekly Off' : 'Absent',
          logoutMethod: 'auto-midnight',
          forgotToLogout: false,
          tasks: [],
          breaks: [],
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
          overtimeMinutes: 0,
          workedOnWeeklyOff: false
        };

        // Get settings for cycle
        const settingsSnap = await getDocs(collection(db, 'settings'));
        const settings = settingsSnap.empty ? { activeCycle: 'Live Cycle' } : settingsSnap.docs[0].data();
        docData.cycle = settings.activeCycle || 'Live Cycle';

        await addDoc(collection(db, 'shifts'), docData);
        processedLogs.push(`Generated ${isWeeklyOff ? 'Weekly Off' : 'Absent'} for ${employee.username} on ${targetDate}`);
      }
    }

    return NextResponse.json({
      success: true,
      processed: processedLogs
    });

  } catch (error: any) {
    console.error("Cron Error:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
