
'use client';
import { getFirestore, collection, addDoc, doc, writeBatch } from 'firebase/firestore';
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
export const addOwnerConsumption = async (items: BillItem[], user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const settings = await getSettings();
  
  const totalValue = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const consumptionRef = doc(collection(db, 'ownerConsumption'));
  
  const consumptionData: Omit<OwnerConsumption, 'id'> = {
    items,
    totalValue,
    timestamp: new Date().toISOString(),
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
