
'use client';
import { getFirestore, collection, addDoc, doc, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import type { OwnerConsumption, BillItem, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { getSettings } from './settings';

/**
 * Robustly sanitizes data for Firestore by removing any 'undefined' values.
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

/**
 * Records items consumed by the owner.
 */
export const addOwnerConsumption = async (items: BillItem[], user: CustomUser, customTimestamp?: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const settings = await getSettings();
  
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const consumptionRef = doc(collection(db, 'ownerConsumption'));
  
  const timestamp = customTimestamp || new Date().toISOString();

  const consumptionData: Omit<OwnerConsumption, 'id'> = {
    items,
    totalValue,
    timestamp,
    addedBy: {
      uid: user.username,
      displayName: user.displayName,
    },
    cycle: settings.activeCycle || 'Live Cycle'
  };

  batch.set(consumptionRef, sanitize(consumptionData));

  // Log to master audit
  const logRef = doc(collection(db, 'logs'));
  const itemNames = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'OWNER_CONSUMPTION_ADDED',
    description: `<strong>${user.displayName}</strong> logged owner consumption: <em>${itemNames}</em> (Value: ₹${totalValue.toLocaleString()}).`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName },
    details: { consumptionId: consumptionRef.id, items, totalValue },
    cycle: settings.activeCycle
  };
  batch.set(logRef, sanitize(logEntry));

  try {
    await batch.commit();
    return consumptionRef.id;
  } catch (error) {
    console.error("Error adding owner consumption:", error);
    return null;
  }
};

/**
 * Updates an existing owner consumption record.
 */
export const updateOwnerConsumption = async (id: string, items: BillItem[], user: CustomUser, customTimestamp: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const settings = await getSettings();
  
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const consumptionRef = doc(db, 'ownerConsumption', id);
  
  const updates = {
    items,
    totalValue,
    timestamp: customTimestamp,
    updatedBy: {
      uid: user.username,
      displayName: user.displayName,
    }
  };

  batch.update(consumptionRef, sanitize(updates));

  // Log to master audit
  const logRef = doc(collection(db, 'logs'));
  const itemNames = items.map(i => `${i.quantity}x ${i.name}`).join(', ');
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'OWNER_CONSUMPTION_ADDED', // Reusing type or could add OWNER_CONSUMPTION_UPDATED
    description: `<strong>${user.displayName}</strong> updated owner consumption record <strong>${id}</strong>: <em>${itemNames}</em> (Value: ₹${totalValue.toLocaleString()}).`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName },
    details: { consumptionId: id, items, totalValue, wasUpdate: true },
    cycle: settings.activeCycle
  };
  batch.set(logRef, sanitize(logEntry));

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating owner consumption:", error);
    return false;
  }
};

/**
 * Deletes an owner consumption record.
 */
export const deleteOwnerConsumption = async (id: string, user: CustomUser) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const consumptionRef = doc(db, 'ownerConsumption', id);
    
    batch.delete(consumptionRef);

    const logRef = doc(collection(db, 'logs'));
    batch.set(logRef, sanitize({
        type: 'DATA_ACTION',
        description: `<strong>${user.displayName}</strong> deleted owner consumption record <strong>${id}</strong>.`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName },
        details: { consumptionId: id, action: 'delete' }
    }));

    try {
        await batch.commit();
        return true;
    } catch (error) {
        console.error("Error deleting owner consumption:", error);
        return false;
    }
};
