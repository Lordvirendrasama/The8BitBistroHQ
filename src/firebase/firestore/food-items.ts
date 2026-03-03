'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { FoodItemFormData, LogEntry } from '@/lib/types';

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

export const addFoodItem = async (itemData: FoodItemFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newItemRef = doc(collection(db, 'foodItems'));
  try {
    batch.set(newItemRef, itemData);
    createLogEntry(db, batch, {
        type: 'SETTINGS_UPDATED',
        description: `Added new menu item: <strong>${itemData.name}</strong>.`,
        details: { itemId: newItemRef.id, itemData }
    });
    await batch.commit();
    return newItemRef.id;
  } catch (e) {
    console.error("Error adding food item: ", e);
    return null;
  }
};

export const updateFoodItem = async (itemId: string, itemData: Partial<FoodItemFormData>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const itemRef = doc(db, 'foodItems', itemId);
    try {
        batch.update(itemRef, itemData);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Updated menu item <strong>${itemData.name || 'ID: ' + itemId}</strong>.`,
            details: { itemId, updates: itemData }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating food item: ", e);
    }
}

export const deleteFoodItem = async (itemId: string, itemName: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const itemRef = doc(db, 'foodItems', itemId);
    try {
        batch.delete(itemRef);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Deleted menu item <strong>${itemName}</strong>.`,
            details: { itemId, itemName }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting food item: ", e);
    }
}
