
'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import type { FixedBill, InventoryPurchase, Expense, LogEntry, RepeatCycle } from '@/lib/types';
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
