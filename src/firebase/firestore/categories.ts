
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { CategoryFormData, LogEntry } from '@/lib/types';

const createLogEntry = (
  db: ReturnType<typeof getFirestore>,
  batch: ReturnType<typeof writeBatch>,
  entry: Omit<LogEntry, 'id' | 'timestamp' | 'user'>
) => {
  const logRef = doc(collection(db, 'logs'));
  const currentUser = { uid: 'system', displayName: 'System' };
  batch.set(logRef, {
    ...entry,
    timestamp: new Date().toISOString(),
    user: {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
    }
  });
};

const clean = <T extends Record<string, any>>(obj: T): Partial<T> => {
  const result: any = {};
  Object.keys(obj).forEach(key => {
    if (obj[key] !== undefined) {
      result[key] = obj[key];
    }
  });
  return result;
};

export const addCategory = async (categoryData: CategoryFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newCategoryRef = doc(collection(db, 'categories'));
  try {
    const cleanData = clean(categoryData);
    batch.set(newCategoryRef, cleanData);
    createLogEntry(db, batch, {
        type: 'SETTINGS_UPDATED',
        description: `Added new menu category: <strong>${categoryData.name}</strong>.`,
        details: { categoryId: newCategoryRef.id, categoryData: cleanData }
    });
    await batch.commit();
    return newCategoryRef.id;
  } catch (e) {
    console.error("Error adding category: ", e);
    return null;
  }
};

export const updateCategory = async (categoryId: string, categoryData: Partial<CategoryFormData>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const categoryRef = doc(db, 'categories', categoryId);
    try {
        const cleanData = clean(categoryData);
        batch.update(categoryRef, cleanData);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Updated menu category <strong>${categoryData.name || 'ID: ' + categoryId}</strong>.`,
            details: { categoryId, updates: cleanData }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating category: ", e);
    }
}

export const deleteCategory = async (categoryId: string, categoryName: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const categoryRef = doc(db, 'categories', categoryId);
    try {
        batch.delete(categoryRef);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Deleted menu category <strong>${categoryName}</strong>.`,
            details: { categoryId, categoryName }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting category: ", e);
    }
}
