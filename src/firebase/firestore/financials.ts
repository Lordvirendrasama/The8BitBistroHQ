
'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import type { FixedBill, InventoryPurchase, Expense, LogEntry, RepeatCycle, SalaryPayment, Employee } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { getSettings } from './settings';
import { addDays, addWeeks, addMonths, addYears } from 'date-fns';

// --- FIXED BILLS ---

export const addFixedBill = async (billData: Omit<FixedBill, 'id'>, user: CustomUser) => {
  const db = getFirestore();
  try {
    const docRef = await addDoc(collection(db, 'fixedBills'), billData);
    
    const logRef = await addDoc(collection(db, 'logs'), {
      type: 'SETTINGS_UPDATED',
      description: `Added new fixed bill: <strong>${billData.name}</strong> (₹${billData.amount}).`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });

    return docRef.id;
  } catch (e) {
    console.error("Error adding fixed bill:", e);
    return null;
  }
};

export const updateFixedBill = async (billId: string, updates: Partial<FixedBill>, user: CustomUser) => {
  const db = getFirestore();
  const billRef = doc(db, 'fixedBills', billId);
  try {
    await updateDoc(billRef, updates);
    await addDoc(collection(db, 'logs'), {
      type: 'SETTINGS_UPDATED',
      description: `Updated fixed bill: <strong>${updates.name || 'ID: ' + billId}</strong>.`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });
    return true;
  } catch (e) {
    console.error("Error updating fixed bill:", e);
    return false;
  }
};

export const markBillAsPaid = async (
  billId: string, 
  user: CustomUser, 
  actualPaidAmount?: number, 
  nextCycleAmount?: number
) => {
  const db = getFirestore();
  const billRef = doc(db, 'fixedBills', billId);
  
  try {
    const snap = await getDoc(billRef);
    if (!snap.exists()) return;
    
    const bill = snap.data() as FixedBill;
    const now = new Date();
    let nextDate = new Date(bill.nextDueDate);
    
    switch (bill.repeatCycle) {
      case 'daily': nextDate = addDays(nextDate, 1); break;
      case 'weekly': nextDate = addWeeks(nextDate, 1); break;
      case 'monthly': nextDate = addMonths(nextDate, 1); break;
      case 'yearly': nextDate = addYears(nextDate, 1); break;
    }

    const finalPaidAmount = actualPaidAmount !== undefined ? actualPaidAmount : bill.amount;

    await updateDoc(billRef, {
      nextDueDate: nextDate.toISOString(),
      lastPaidDate: now.toISOString(),
      ...(nextCycleAmount !== undefined ? { amount: nextCycleAmount } : {})
    });

    // Record entry to paidBills collection for Paid Bills History
    await addDoc(collection(db, 'paidBills'), {
      billId,
      name: bill.name,
      amountPaid: finalPaidAmount,
      repeatCycle: bill.repeatCycle,
      paymentMethod: bill.paymentMethod || 'UPI',
      isVariable: !!bill.isVariable,
      paidAt: now.toISOString(),
      nextDueDate: nextDate.toISOString(),
      paidBy: { uid: user.username, displayName: user.displayName }
    });

    await addDoc(collection(db, 'logs'), {
      type: 'FIXED_BILL_PAID',
      description: `Fixed bill <strong>${bill.name}</strong> marked as PAID (Paid Amount: <strong>₹${finalPaidAmount.toLocaleString()}</strong>). Next due: ${nextDate.toLocaleDateString()}.`,
      timestamp: now.toISOString(),
      user: { uid: user.username, displayName: user.displayName },
      details: { billId, name: bill.name, amountPaid: finalPaidAmount, nextDueDate: nextDate.toISOString() }
    });

    return true;
  } catch (e) {
    console.error("Error paying bill:", e);
    return false;
  }
};

export const deleteFixedBill = async (billId: string) => {
  const db = getFirestore();
  await deleteDoc(doc(db, 'fixedBills', billId));
};

export const undoBillPayment = async (paidBillRecordId?: string, billId?: string, user?: CustomUser) => {
  const db = getFirestore();
  try {
    let targetBillId = billId;

    if (paidBillRecordId) {
      const paidDocRef = doc(db, 'paidBills', paidBillRecordId);
      const paidDocSnap = await getDoc(paidDocRef);
      if (paidDocSnap.exists()) {
        const data = paidDocSnap.data();
        if (data.billId) targetBillId = data.billId;
      }
      await deleteDoc(paidDocRef);
    }
    
    if (targetBillId) {
      const q = query(collection(db, 'paidBills'), where('billId', '==', targetBillId));
      const snap = await getDocs(q);
      const deletePromises: Promise<void>[] = [];
      snap.forEach((dDoc) => {
        deletePromises.push(deleteDoc(doc(db, 'paidBills', dDoc.id)));
      });
      await Promise.all(deletePromises);

      const billRef = doc(db, 'fixedBills', targetBillId);
      const billSnap = await getDoc(billRef);
      if (billSnap.exists()) {
        const bill = billSnap.data() as FixedBill;
        const now = new Date();
        const cycleDay = bill.dueDayOfMonth || 1;
        const maxDays = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const validDay = Math.min(Math.max(1, cycleDay), maxDays);
        const currentCycleDate = new Date(now.getFullYear(), now.getMonth(), validDay);

        await updateDoc(billRef, {
          lastPaidDate: null,
          nextDueDate: currentCycleDate.toISOString()
        });
      }
    }

    if (user) {
      await addDoc(collection(db, 'logs'), {
        type: 'SETTINGS_UPDATED',
        description: `Undid bill payment and restored unpaid status.`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName }
      });
    }

    return true;
  } catch (e) {
    console.error("Error undoing bill payment:", e);
    return false;
  }
};

// --- STAFF SALARY PAYMENTS ---

export const recordSalaryPayment = async (
  employee: Employee,
  paymentDetails: {
    amountPaid: number;
    baseSalary: number;
    advancesSettled: number;
    deductionsSettled: number;
    bonusesAdded: number;
    cycleKey: string;
    note?: string;
    paymentMethod?: string;
  },
  user: CustomUser
) => {
  const db = getFirestore();
  const now = new Date();
  const settledTimestamp = now.toISOString();

  try {
    // 1. Add record to salaryPayments collection for payment history
    const paymentDocRef = await addDoc(collection(db, 'salaryPayments'), {
      employeeId: employee.id,
      employeeUsername: employee.username,
      employeeDisplayName: employee.displayName,
      amountPaid: paymentDetails.amountPaid,
      baseSalary: paymentDetails.baseSalary,
      advancesSettled: paymentDetails.advancesSettled,
      deductionsSettled: paymentDetails.deductionsSettled,
      bonusesAdded: paymentDetails.bonusesAdded,
      cycleKey: paymentDetails.cycleKey,
      paidAt: settledTimestamp,
      paymentMethod: paymentDetails.paymentMethod || 'UPI / Cash',
      note: paymentDetails.note || 'Monthly salary cleared',
      paidBy: { uid: user.username, displayName: user.displayName }
    });

    // 2. Mark active adjustments settled on the employee
    const adjustments = employee.salaryAdjustments || [];
    const updatedAdjustments = adjustments.map(a =>
      a.status === 'active' ? { ...a, status: 'settled' as const, settledAt: settledTimestamp } : a
    );

    // 3. Update employee document
    const empRef = doc(db, 'employees', employee.id);
    await updateDoc(empRef, {
      foodAllowanceBalance: 1000,
      lastQuotaResetCycle: paymentDetails.cycleKey,
      lastSalaryPaidCycle: paymentDetails.cycleKey,
      lastSalaryPaidDate: settledTimestamp,
      lastSalaryAmount: paymentDetails.amountPaid,
      salaryAdjustments: updatedAdjustments
    });

    // 4. Record audit log
    await addDoc(collection(db, 'logs'), {
      type: 'STAFF_SALARY_PAID',
      description: `Viren marked salary as <strong>PAID</strong> for <strong>${employee.displayName}</strong>. Net Paid: <strong>₹${paymentDetails.amountPaid.toLocaleString()}</strong> (Base: ₹${paymentDetails.baseSalary.toLocaleString()}, Advances Settled: ₹${paymentDetails.advancesSettled.toLocaleString()}, Deductions Settled: ₹${paymentDetails.deductionsSettled.toLocaleString()}). Cycle: ${paymentDetails.cycleKey}.`,
      timestamp: settledTimestamp,
      user: { uid: user.username, displayName: user.displayName },
      details: {
        paymentId: paymentDocRef.id,
        employeeId: employee.id,
        employeeUsername: employee.username,
        amountPaid: paymentDetails.amountPaid,
        cycleKey: paymentDetails.cycleKey
      }
    });

    return paymentDocRef.id;
  } catch (e) {
    console.error("Error recording salary payment:", e);
    return null;
  }
};

export const undoSalaryPayment = async (
  salaryPaymentId?: string,
  employeeId?: string,
  user?: CustomUser
) => {
  const db = getFirestore();
  try {
    let targetEmpId = employeeId;
    let paymentDoc: any = null;

    if (salaryPaymentId) {
      const payRef = doc(db, 'salaryPayments', salaryPaymentId);
      const paySnap = await getDoc(payRef);
      if (paySnap.exists()) {
        paymentDoc = paySnap.data();
        if (!targetEmpId) targetEmpId = paymentDoc.employeeId;
      }
      await deleteDoc(payRef);
    }

    if (targetEmpId) {
      if (!salaryPaymentId) {
        const q = query(collection(db, 'salaryPayments'), where('employeeId', '==', targetEmpId));
        const snap = await getDocs(q);
        const delPromises: Promise<void>[] = [];
        snap.forEach(d => delPromises.push(deleteDoc(doc(db, 'salaryPayments', d.id))));
        await Promise.all(delPromises);
      }

      const empRef = doc(db, 'employees', targetEmpId);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        await updateDoc(empRef, {
          lastSalaryPaidCycle: null,
          lastSalaryPaidDate: null,
          lastSalaryAmount: null
        });
      }
    }

    if (user) {
      await addDoc(collection(db, 'logs'), {
        type: 'SALARY_PAYMENT_UNDONE',
        description: `Undid salary payment for staff member and restored unpaid status for cycle.`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName }
      });
    }

    return true;
  } catch (e) {
    console.error("Error undoing salary payment:", e);
    return false;
  }
};

export const recordManualSalaryPayment = async (
  paymentData: {
    employeeId: string;
    employeeUsername: string;
    employeeDisplayName: string;
    amountPaid: number;
    baseSalary?: number;
    advancesSettled?: number;
    deductionsSettled?: number;
    bonusesAdded?: number;
    cycleKey: string;
    paidAt: string;
    paymentMethod: string;
    note?: string;
  },
  user: CustomUser
) => {
  const db = getFirestore();
  try {
    const paymentDocRef = await addDoc(collection(db, 'salaryPayments'), {
      employeeId: paymentData.employeeId,
      employeeUsername: paymentData.employeeUsername,
      employeeDisplayName: paymentData.employeeDisplayName,
      amountPaid: paymentData.amountPaid,
      baseSalary: paymentData.baseSalary || paymentData.amountPaid,
      advancesSettled: paymentData.advancesSettled || 0,
      deductionsSettled: paymentData.deductionsSettled || 0,
      bonusesAdded: paymentData.bonusesAdded || 0,
      cycleKey: paymentData.cycleKey,
      paidAt: paymentData.paidAt,
      paymentMethod: paymentData.paymentMethod || 'UPI / Cash',
      note: paymentData.note || 'Manual salary payment logged',
      paidBy: { uid: user.username, displayName: user.displayName }
    });

    // Update employee document to mark cycle as paid
    const empRef = doc(db, 'employees', paymentData.employeeId);
    const empSnap = await getDoc(empRef);
    if (empSnap.exists()) {
      await updateDoc(empRef, {
        lastSalaryPaidCycle: paymentData.cycleKey,
        lastSalaryPaidDate: paymentData.paidAt,
        lastSalaryAmount: paymentData.amountPaid
      });
    }

    await addDoc(collection(db, 'logs'), {
      type: 'STAFF_SALARY_PAID',
      description: `Logged salary payout of <strong>₹${paymentData.amountPaid.toLocaleString()}</strong> for <strong>${paymentData.employeeDisplayName}</strong> (${paymentData.cycleKey}).`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });

    return paymentDocRef.id;
  } catch (e) {
    console.error("Error creating salary payment record:", e);
    return null;
  }
};

export const updateSalaryPayment = async (
  salaryPaymentId: string,
  updatedFields: Partial<SalaryPayment>,
  user: CustomUser
) => {
  const db = getFirestore();
  try {
    const payRef = doc(db, 'salaryPayments', salaryPaymentId);
    const paySnap = await getDoc(payRef);
    if (!paySnap.exists()) throw new Error("Salary payment record not found");
    const existing = paySnap.data() as SalaryPayment;

    await updateDoc(payRef, {
      ...updatedFields,
      updatedAt: new Date().toISOString()
    });

    // Update employee document if amount or cycle changed
    if (existing.employeeId) {
      const empRef = doc(db, 'employees', existing.employeeId);
      const empSnap = await getDoc(empRef);
      if (empSnap.exists()) {
        const updates: any = {};
        if (updatedFields.amountPaid !== undefined) {
          updates.lastSalaryAmount = updatedFields.amountPaid;
        }
        if (updatedFields.cycleKey !== undefined) {
          updates.lastSalaryPaidCycle = updatedFields.cycleKey;
        }
        if (updatedFields.paidAt !== undefined) {
          updates.lastSalaryPaidDate = updatedFields.paidAt;
        }
        if (Object.keys(updates).length > 0) {
          await updateDoc(empRef, updates);
        }
      }
    }

    await addDoc(collection(db, 'logs'), {
      type: 'STAFF_SALARY_PAID',
      description: `Updated salary payment record for <strong>${existing.employeeDisplayName || 'Staff'}</strong>. Amount: ₹${(updatedFields.amountPaid ?? existing.amountPaid).toLocaleString()}.`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });

    return true;
  } catch (e) {
    console.error("Error updating salary payment:", e);
    return false;
  }
};

export const updatePaidBillRecord = async (
  paidBillId: string,
  updates: {
    amountPaid?: number;
    paymentMethod?: string;
    paidAt?: string;
    name?: string;
  },
  user: CustomUser
) => {
  const db = getFirestore();
  try {
    const billRef = doc(db, 'paidBills', paidBillId);
    await updateDoc(billRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await addDoc(collection(db, 'logs'), {
      type: 'SETTINGS_UPDATED',
      description: `Updated paid bill record <strong>${updates.name || paidBillId}</strong> (Amount: ₹${updates.amountPaid?.toLocaleString()}).`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });

    return true;
  } catch (e) {
    console.error("Error updating paid bill record:", e);
    return false;
  }
};

export const updateExpenseRecord = async (
  expenseId: string,
  updates: {
    description?: string;
    amount?: number;
    category?: string;
    paymentMethod?: 'cash' | 'upi';
    timestamp?: string;
    notes?: string;
  },
  user: CustomUser
) => {
  const db = getFirestore();
  try {
    const expRef = doc(db, 'expenses', expenseId);
    await updateDoc(expRef, {
      ...updates,
      updatedAt: new Date().toISOString()
    });

    await addDoc(collection(db, 'logs'), {
      type: 'SETTINGS_UPDATED',
      description: `Updated expense: <strong>${updates.description || expenseId}</strong> (₹${updates.amount?.toLocaleString()}).`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });

    return true;
  } catch (e) {
    console.error("Error updating expense record:", e);
    return false;
  }
};

// --- INVENTORY ---

export const addInventoryPurchase = async (purchaseData: Omit<InventoryPurchase, 'id' | 'unitCost' | 'addedBy'>, user: CustomUser) => {
  const db = getFirestore();
  const settings = await getSettings();
  
  const unitCost = purchaseData.totalCost / (purchaseData.quantity || 1);
  const fullData = {
    ...purchaseData,
    unitCost,
    addedBy: { uid: user.username, displayName: user.displayName },
    cycle: settings.activeCycle || 'Live Cycle'
  };

  try {
    const docRef = await addDoc(collection(db, 'inventory'), fullData);
    
    await addDoc(collection(db, 'logs'), {
      type: 'INVENTORY_PURCHASED',
      description: `Stock Purchase: <strong>${purchaseData.itemName}</strong> (${purchaseData.quantity} ${purchaseData.unit}) for ₹${purchaseData.totalCost}.`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName },
      cycle: settings.activeCycle
    });

    return docRef.id;
  } catch (e) {
    console.error("Error adding stock:", e);
    return null;
  }
};

// --- CALCULATIONS ---

export const calculateDailyFixedCost = (bills: FixedBill[]) => {
  return bills.reduce((sum, bill) => {
    let divisor = 30; // default monthly
    if (bill.repeatCycle === 'daily') divisor = 1;
    if (bill.repeatCycle === 'weekly') divisor = 7;
    if (bill.repeatCycle === 'yearly') divisor = 365;
    return sum + (bill.amount / divisor);
  }, 0);
};
