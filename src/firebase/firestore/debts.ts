
'use client';
import { getFirestore, collection, doc, writeBatch, deleteDoc, updateDoc } from 'firebase/firestore';
import type { Debt, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';

export const recordDebt = async (debtData: Omit<Debt, 'id' | 'status' | 'timestamp'>, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  const debtRef = doc(collection(db, 'debts'));
  
  // Sanitize data to remove undefined properties which Firestore rejects
  const sanitizedData: any = {};
  Object.entries(debtData).forEach(([key, value]) => {
    if (value !== undefined) {
      sanitizedData[key] = value;
    }
  });

  const fullDebtData: Omit<Debt, 'id'> = {
    ...sanitizedData,
    status: 'pending',
    timestamp: new Date().toISOString()
  };

  batch.set(debtRef, fullDebtData);

  // Add to master log
  const logRef = doc(collection(db, 'logs'));
  const description = debtData.type === 'receivable' 
    ? `Customer <strong>${debtData.contactName}</strong> owes <strong>₹${debtData.amount.toLocaleString()}</strong>. Reason: ${debtData.description}.`
    : `Bistro owes <strong>${debtData.contactName}</strong> <strong>₹${debtData.amount.toLocaleString()}</strong>. Reason: ${debtData.description}.`;

  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'DEBT_RECORDED',
    description,
    timestamp: new Date().toISOString(),
    user: {
      uid: user.username,
      displayName: user.displayName,
    },
    details: { debtId: debtRef.id, ...sanitizedData }
  };
  batch.set(logRef, logEntry);

  try {
    await batch.commit();
    return debtRef.id;
  } catch (error) {
    console.error("Error recording debt:", error);
    return null;
  }
};

export const clearDebt = async (debtId: string, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const debtRef = doc(db, 'debts', debtId);
  
  batch.update(debtRef, { status: 'cleared', clearedAt: new Date().toISOString() });

  // Add to master log
  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'DEBT_CLEARED',
    description: `Debt <strong>${debtId}</strong> was marked as cleared by <strong>${user.displayName}</strong>.`,
    timestamp: new Date().toISOString(),
    user: {
      uid: user.username,
      displayName: user.displayName,
    },
    details: { debtId }
  };
  batch.set(logRef, logEntry);

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error clearing debt:", error);
    return false;
  }
};
