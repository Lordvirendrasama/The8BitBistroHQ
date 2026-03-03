
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

export const addCategory = async (categoryData: CategoryFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newCategoryRef = doc(collection(db, 'categories'));
  try {
    batch.set(newCategoryRef, categoryData);
    createLogEntry(db, batch, {
        type: 'SETTINGS_UPDATED',
        description: `Added new menu category: <strong>${categoryData.name}</strong>.`,
        details: { categoryId: newCategoryRef.id, categoryData }
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
        batch.update(categoryRef, categoryData);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Updated menu category <strong>${categoryData.name || 'ID: ' + categoryId}</strong>.`,
            details: { categoryId, updates: categoryData }
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
