'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import type { Leave } from '@/lib/types';

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

export const recordLeave = async (leaveData: Omit<Leave, 'id' | 'createdAt'>) => {
  const db = getFirestore();
  try {
    const sanitizedData = sanitize({
      ...leaveData,
      createdAt: new Date().toISOString()
    });

    const docRef = await addDoc(collection(db, 'leaves'), sanitizedData);
    
    await addDoc(collection(db, 'logs'), {
      type: 'LEAVE_RECORDED',
      description: `Leave recorded for <strong>${leaveData.employeeName || 'Unknown Staff'}</strong> (${leaveData.type}).`,
      timestamp: new Date().toISOString(),
      user: { uid: 'system', displayName: 'System' }
    });

    return docRef.id;
  } catch (e) {
    console.error("Error recording leave:", e);
    return null;
  }
};

export const updateLeaveStatus = async (leaveId: string, status: Leave['status']) => {
  const db = getFirestore();
  const ref = doc(db, 'leaves', leaveId);
  try {
    await updateDoc(ref, { status });
    return true;
  } catch (e) {
    console.error("Error updating leave:", e);
    return false;
  }
};

export const deleteLeave = async (leaveId: string) => {
  const db = getFirestore();
  const ref = doc(db, 'leaves', leaveId);
  try {
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error("Error deleting leave:", e);
    return false;
  }
};
