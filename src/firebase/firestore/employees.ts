
'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where } from 'firebase/firestore';
import type { Employee, LogEntry } from '@/lib/types';

export const addEmployee = async (employeeData: Omit<Employee, 'id'>) => {
  const db = getFirestore();
  try {
    const docRef = await addDoc(collection(db, 'employees'), {
      ...employeeData,
      isActive: true
    });
    
    await addDoc(collection(db, 'logs'), {
      type: 'EMPLOYEE_ADDED',
      description: `New employee <strong>${employeeData.displayName}</strong> added to the registry.`,
      timestamp: new Date().toISOString(),
      user: { uid: 'system', displayName: 'System' }
    });

    return docRef.id;
  } catch (e) {
    console.error("Error adding employee:", e);
    return null;
  }
};

export const updateEmployee = async (employeeId: string, updates: Partial<Employee>) => {
  const db = getFirestore();
  const ref = doc(db, 'employees', employeeId);
  try {
    await updateDoc(ref, updates);
    return true;
  } catch (e) {
    console.error("Error updating employee:", e);
    return false;
  }
};

export const deleteEmployee = async (employeeId: string) => {
  const db = getFirestore();
  const ref = doc(db, 'employees', employeeId);
  try {
    await deleteDoc(ref);
    return true;
  } catch (e) {
    console.error("Error deleting employee:", e);
    return false;
  }
};

export const getActiveEmployees = async (): Promise<Employee[]> => {
  const db = getFirestore();
  const q = query(collection(db, 'employees'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
};
