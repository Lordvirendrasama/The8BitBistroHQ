
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

export const markBillAsPaid = async (billId: string, user: CustomUser) => {
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

    await updateDoc(billRef, {
      nextDueDate: nextDate.toISOString(),
      lastPaidDate: now.toISOString()
    });

    await addDoc(collection(db, 'logs'), {
      type: 'FIXED_BILL_PAID',
      description: `Fixed bill <strong>${bill.name}</strong> marked as PAID. Next due: ${nextDate.toLocaleDateString()}.`,
      timestamp: now.toISOString(),
      user: { uid: user.username, displayName: user.displayName }
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

// --- INVENTORY ---

export const addInventoryPurchase = async (purchaseData: Omit<InventoryPurchase, 'id' | 'unitCost'>, user: CustomUser) => {
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
