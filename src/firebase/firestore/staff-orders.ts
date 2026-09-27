'use client';

import { getFirestore, collection, doc, writeBatch, getDoc, getDocs, query, where } from 'firebase/firestore';
import type { StaffOrder, LogEntry, Employee, SalaryAdjustment } from '@/lib/types';

export const addStaffOrder = async (
  employeeId: string,
  newBalance: number,
  orderData: Omit<StaffOrder, 'id'>
) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  const normalizedOrderData = {
    ...orderData,
    employeeUsername: orderData.employeeUsername.toLowerCase()
  };

  // 1. Reference to create a new staff order
  const orderRef = doc(collection(db, 'staffOrders'));
  batch.set(orderRef, normalizedOrderData);

  // 2. Fetch employee to update foodAllowanceBalance & check for overage salary deduction
  let empDocRef = null;
  let currentEmp: Employee | null = null;

  if (employeeId && !employeeId.startsWith('temp-') && !employeeId.startsWith('former-')) {
    empDocRef = doc(db, 'employees', employeeId);
    try {
      const snap = await getDoc(empDocRef);
      if (snap.exists()) {
        currentEmp = { id: snap.id, ...snap.data() } as Employee;
      }
    } catch (e) {
      console.warn("Could not fetch emp by id:", e);
    }
  }

  // Fallback by username query if id wasn't resolved
  if (!currentEmp && normalizedOrderData.employeeUsername) {
    try {
      const q = query(collection(db, 'employees'), where('username', '==', normalizedOrderData.employeeUsername));
      const qSnap = await getDocs(q);
      if (!qSnap.empty) {
        empDocRef = qSnap.docs[0].ref;
        currentEmp = { id: qSnap.docs[0].id, ...qSnap.docs[0].data() } as Employee;
      }
    } catch (e) {
      console.warn("Could not query employee by username:", e);
    }
  }

  let overageAmount = 0;
  if (currentEmp && empDocRef) {
    const currentAllowance = currentEmp.foodAllowanceBalance ?? 1000;
    // Calculate if order exceeded available allowance
    if (orderData.totalAmount > currentAllowance) {
      overageAmount = orderData.totalAmount - Math.max(0, currentAllowance);
    }

    const employeeUpdates: Partial<Employee> = {
      foodAllowanceBalance: Math.max(0, newBalance)
    };

    if (overageAmount > 0) {
      const itemsList = (orderData.items || []).map(i => `${i.quantity}x ${i.name}`).join(', ');
      const newAdjustment: SalaryAdjustment = {
        id: `adj-meal-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        type: 'meal_overage',
        amount: overageAmount,
        reason: `Meal quota finished: ordered ${itemsList || 'food items'} (Excess ₹${overageAmount.toLocaleString()} auto-deducted)`,
        date: new Date().toISOString(),
        status: 'active',
        addedBy: 'System (Auto Meal Overage)'
      };

      const existingAdjustments = currentEmp.salaryAdjustments || [];
      employeeUpdates.salaryAdjustments = [newAdjustment, ...existingAdjustments];
    }

    batch.update(empDocRef, employeeUpdates);
  }

  // 3. Create a log entry
  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'STAFF_FOOD_ORDER',
    description: `Staff member <strong>${orderData.employeeDisplayName}</strong> placed a meal order of ₹${orderData.totalAmount.toLocaleString()}.${
      overageAmount > 0
        ? ` <span class="text-rose-400 font-bold">Quota exceeded: ₹${overageAmount.toLocaleString()} auto-deducted from salary!</span>`
        : ''
    }`,
    timestamp: new Date().toISOString(),
    cycle: orderData.cycle,
    user: {
      uid: normalizedOrderData.employeeUsername,
      displayName: orderData.employeeDisplayName
    },
    details: {
      orderId: orderRef.id,
      items: orderData.items,
      totalAmount: orderData.totalAmount,
      overageDeduction: overageAmount
    }
  };
  batch.set(logRef, logEntry);

  await batch.commit();
  return orderRef.id;
};
