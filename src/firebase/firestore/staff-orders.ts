'use client';

import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import type { StaffOrder } from '@/lib/types';
import type { LogEntry } from '@/lib/types';

export const addStaffOrder = async (
  employeeId: string,
  newBalance: number,
  orderData: Omit<StaffOrder, 'id'>
) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  // 1. Reference to the employee to update their balance
  const employeeRef = doc(db, 'employees', employeeId);
  batch.update(employeeRef, { foodAllowanceBalance: newBalance });

  // 2. Reference to create a new staff order
  const orderRef = doc(collection(db, 'staffOrders'));
  batch.set(orderRef, orderData);

  // 3. Create a log entry
  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'STAFF_FOOD_ORDER',
    description: `Staff member <strong>${orderData.employeeDisplayName}</strong> placed a meal order of ₹${orderData.totalAmount.toLocaleString()}.`,
    timestamp: new Date().toISOString(),
    cycle: orderData.cycle,
    user: {
      uid: orderData.employeeUsername,
      displayName: orderData.employeeDisplayName
    },
    details: {
      orderId: orderRef.id,
      items: orderData.items,
      totalAmount: orderData.totalAmount
    }
  };
  batch.set(logRef, logEntry);

  await batch.commit();
  return orderRef.id;
};
