'use server';
import { getFirestore, collection, addDoc, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import type { AppUpdate } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';

/**
 * Adds a new app update request to the Roadmap.
 */
export const addAppUpdate = async (text: string, user: CustomUser) => {
  const db = getFirestore();
  try {
    await addDoc(collection(db, 'appUpdates'), {
      text,
      status: 'pending',
      createdAt: new Date().toISOString(),
      addedBy: {
        uid: user.username,
        displayName: user.displayName,
      }
    });
    return true;
  } catch (error) {
    console.error("Error adding app update:", error);
    return false;
  }
};

/**
 * Updates an existing app update (text or status).
 */
export const updateAppUpdate = async (id: string, updates: Partial<AppUpdate>) => {
  const db = getFirestore();
  try {
    await updateDoc(doc(db, 'appUpdates', id), updates);
    return true;
  } catch (error) {
    console.error("Error updating app update:", error);
    return false;
  }
};

/**
 * Deletes an app update from the Roadmap.
 */
export const deleteAppUpdate = async (id: string) => {
  const db = getFirestore();
  try {
    await deleteDoc(doc(db, 'appUpdates', id));
    return true;
  } catch (error) {
    console.error("Error deleting app update:", error);
    return false;
  }
};
