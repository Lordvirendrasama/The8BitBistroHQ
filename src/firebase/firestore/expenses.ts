
'use client';
import { getFirestore, collection, addDoc, doc, writeBatch, deleteDoc } from 'firebase/firestore';
import type { Expense, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { getSettings } from './settings';

export const addExpense = async (amount: number, description: string, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  const settings = await getSettings();
  const expenseRef = doc(collection(db, 'expenses'));
  const expenseData: Omit<Expense, 'id'> = {
    amount,
    description,
    timestamp: new Date().toISOString(),
    addedBy: {
      uid: user.username,
      displayName: user.displayName,
    },
    cycle: settings.activeCycle || 'Testing Data 1'
  };

  batch.set(expenseRef, expenseData);

  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'EXPENSE_ADDED',
    description: `Added an expense of <strong>₹${amount.toLocaleString()}</strong> for: <em>${description}</em>.`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName },
    details: { expenseId: expenseRef.id, amount, description },
    cycle: settings.activeCycle
  };
  batch.set(logRef, logEntry);

  try {
    await batch.commit();
    return expenseRef.id;
  } catch (error) {
    console.error("Error adding expense:", error);
    return null;
  }
};

export const deleteExpense = async (expenseId: string, amount: number, description: string, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const expenseRef = doc(db, 'expenses', expenseId);
  batch.delete(expenseRef);

  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'EXPENSE_DELETED',
    description: `Deleted an expense of <strong>₹${amount.toLocaleString()}</strong>: <em>${description}</em>.`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName },
    details: { expenseId, amount, description }
  };
  batch.set(logRef, logEntry);

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error deleting expense:", error);
    return false;
  }
};
