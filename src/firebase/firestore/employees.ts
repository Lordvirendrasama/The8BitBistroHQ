
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

    // Sync to userRoles if there's an existing mapping for this username (relinking restored accounts)
    const userRolesSnap = await getDocs(collection(db, 'userRoles'));
    for (const d of userRolesSnap.docs) {
      const data = d.data();
      if (data.username && data.username.toLowerCase() === employeeData.username.toLowerCase()) {
        const roleRef = doc(db, 'userRoles', d.id);
        await updateDoc(roleRef, { 
          employeeId: docRef.id,
          username: employeeData.username,
          role: employeeData.role
        });
      }
    }

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

    // Sync to userRoles collection if username or role has changed
    if (updates.username !== undefined || updates.role !== undefined) {
      const snap = await getDocs(query(collection(db, 'userRoles'), where('employeeId', '==', employeeId)));
      for (const d of snap.docs) {
        const roleRef = doc(db, 'userRoles', d.id);
        const roleUpdates: any = {};
        if (updates.username !== undefined) roleUpdates.username = updates.username;
        if (updates.role !== undefined) roleUpdates.role = updates.role;
        await updateDoc(roleRef, roleUpdates);
      }
    }

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

    // Also delete any matching credentials in userRoles so they cannot log in
    const snap = await getDocs(query(collection(db, 'userRoles'), where('employeeId', '==', employeeId)));
    for (const d of snap.docs) {
      const roleRef = doc(db, 'userRoles', d.id);
      await deleteDoc(roleRef);
    }

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
