'use client';

import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  getDocs,
  serverTimestamp 
} from 'firebase/firestore';
import type { RawMaterial, RawMaterialFormData, RawMaterialRequest, LogEntry } from '@/lib/types';
import { getSettings } from './settings';

export const sanitizeData = (data: any): any => {
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (data !== null && typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (value !== undefined) {
        clean[key] = sanitizeData(value);
      }
    }
    return clean;
  }
  return data;
};

const createLogEntry = (
  db: ReturnType<typeof getFirestore>,
  batch: ReturnType<typeof writeBatch>,
  entry: Omit<LogEntry, 'id' | 'timestamp' | 'user'>,
  userDisplayName: string = 'Staff'
) => {
  const logRef = doc(collection(db, 'logs'));
  const cleanEntry = sanitizeData(entry);
  batch.set(logRef, {
    ...cleanEntry,
    timestamp: new Date().toISOString(),
    user: {
      uid: 'system',
      displayName: userDisplayName,
    }
  });
};

export const addRawMaterial = async (materialData: RawMaterialFormData, userDisplayName?: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newRef = doc(collection(db, 'rawMaterials'));

  try {
    const cleanData: Record<string, any> = sanitizeData({
      ...materialData,
      isActive: materialData.isActive !== false,
      createdAt: new Date().toISOString(),
    });

    batch.set(newRef, cleanData);

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Added new raw material item: <strong>${materialData.name}</strong> (${materialData.category}).`,
      details: { materialId: newRef.id, materialData: cleanData }
    }, userDisplayName);

    await batch.commit();
    return newRef.id;
  } catch (error) {
    console.error("Error adding raw material: ", error);
    return null;
  }
};

export const updateRawMaterial = async (materialId: string, updates: Partial<RawMaterialFormData>, userDisplayName?: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const itemRef = doc(db, 'rawMaterials', materialId);

  try {
    const cleanUpdates: Record<string, any> = sanitizeData({ ...updates });

    batch.update(itemRef, cleanUpdates);

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Updated raw material item: <strong>${updates.name || materialId}</strong>.`,
      details: { materialId, updates: cleanUpdates }
    }, userDisplayName);

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating raw material: ", error);
    return false;
  }
};

export const deleteRawMaterial = async (materialId: string, materialName: string, userDisplayName?: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const itemRef = doc(db, 'rawMaterials', materialId);

  try {
    batch.delete(itemRef);

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Deleted raw material item: <strong>${materialName}</strong>.`,
      details: { materialId, materialName }
    }, userDisplayName);

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error deleting raw material: ", error);
    return false;
  }
};

export const DEFAULT_RAW_MATERIALS: RawMaterialFormData[] = [
  // Dairy
  { name: 'Amul Taaza Milk (500ml / 1L)', category: 'Dairy', unit: 'Packets', lowStockThreshold: 4, notes: 'Needed daily for coffees and shakes' },
  { name: 'Amul Cheese Slices', category: 'Dairy', unit: 'Packets', lowStockThreshold: 2, notes: 'For burgers and sandwiches' },
  { name: 'Mozzarella Cheese Blend', category: 'Dairy', unit: 'Kg', lowStockThreshold: 2, notes: 'For pizzas and loaded fries' },
  { name: 'Amul Butter (500g)', category: 'Dairy', unit: 'Packets', lowStockThreshold: 2, notes: 'For toast, grilled sandwiches, and pasta' },
  { name: 'Mayonnaise (1Kg Pouch)', category: 'Dairy', unit: 'Packets', lowStockThreshold: 2 },
  
  // Kitchen & Food
  { name: 'Burger Buns (Fresh Batch)', category: 'Kitchen & Food', unit: 'Packets', lowStockThreshold: 3, notes: 'Order daily or every 2 days' },
  { name: 'Sandwich Bread (Jumbo Pack)', category: 'Kitchen & Food', unit: 'Packets', lowStockThreshold: 2 },
  { name: 'Frozen French Fries (2.5kg)', category: 'Kitchen & Food', unit: 'Packets', lowStockThreshold: 3, notes: 'High usage on weekends' },
  { name: 'Pizza Bases (7-inch / 9-inch)', category: 'Kitchen & Food', unit: 'Pieces', lowStockThreshold: 10 },
  { name: 'Tomato Ketchup (1kg pouch)', category: 'Kitchen & Food', unit: 'Pouches', lowStockThreshold: 2 },
  { name: 'Cooking Sunflower Oil (5L)', category: 'Kitchen & Food', unit: 'Cans', lowStockThreshold: 1, notes: 'For fryer' },

  // Beverages & Barista
  { name: 'Espresso Coffee Beans (1kg)', category: 'Beverages', unit: 'Packets', lowStockThreshold: 1, notes: 'Specialty coffee blend' },
  { name: 'Chocolate Sauce (Hershey’s / Mapro)', category: 'Beverages', unit: 'Bottles', lowStockThreshold: 2 },
  { name: 'Vanilla & Caramel Flavoured Syrups', category: 'Beverages', unit: 'Bottles', lowStockThreshold: 2 },
  { name: 'Soft Drink Cans (Coke / Sprite / Thums Up)', category: 'Beverages', unit: 'Cans', lowStockThreshold: 12 },
  { name: 'Red Bull Energy Drink Cans', category: 'Beverages', unit: 'Cans', lowStockThreshold: 6 },
  { name: 'Drinking Water (20L Jar)', category: 'Beverages', unit: 'Jars', lowStockThreshold: 2, notes: 'For dispenser' },

  // Packaging & Supplies
  { name: 'Paper Hot Cups (250ml)', category: 'Packaging & Supplies', unit: 'Pieces', lowStockThreshold: 50 },
  { name: 'Cold Beverage Cups with Lids', category: 'Packaging & Supplies', unit: 'Pieces', lowStockThreshold: 50 },
  { name: 'Paper Napkins / Tissues', category: 'Packaging & Supplies', unit: 'Packets', lowStockThreshold: 4 },
  { name: 'Thermal Billing Paper Rolls (80mm)', category: 'Packaging & Supplies', unit: 'Rolls', lowStockThreshold: 5, notes: 'POS printer' },
  { name: 'Takeaway Brown Paper Bags', category: 'Packaging & Supplies', unit: 'Pieces', lowStockThreshold: 30 },

  // Gaming & Tech Supplies
  { name: 'PS5 Type-C High-Speed Braided Cables', category: 'Gaming & Tech', unit: 'Pieces', lowStockThreshold: 2, notes: 'For charging controller stations' },
  { name: 'Thumbstick Grip Caps (Pairs)', category: 'Gaming & Tech', unit: 'Pairs', lowStockThreshold: 4 },
  { name: 'Microfiber Cleaning Cloths', category: 'Gaming & Tech', unit: 'Pieces', lowStockThreshold: 4, notes: 'For screen & console wipe-down' },

  // Cleaning & Housekeeping
  { name: 'Colin Glass & Surface Spray', category: 'Cleaning & Housekeeping', unit: 'Bottles', lowStockThreshold: 2 },
  { name: 'Dishwashing Liquid (Vim / Pril 1L)', category: 'Cleaning & Housekeeping', unit: 'Bottles', lowStockThreshold: 1 },
  { name: 'Garbage Trash Bags (Large Black)', category: 'Cleaning & Housekeeping', unit: 'Packets', lowStockThreshold: 2 }
];

export const seedDefaultRawMaterials = async (userDisplayName?: string) => {
  const db = getFirestore();
  const existingSnapshot = await getDocs(collection(db, 'rawMaterials'));
  const existingNames = new Set(existingSnapshot.docs.map(d => (d.data().name || '').toLowerCase().trim()));

  const batch = writeBatch(db);
  let addedCount = 0;

  for (const item of DEFAULT_RAW_MATERIALS) {
    if (!existingNames.has(item.name.toLowerCase().trim())) {
      const docRef = doc(collection(db, 'rawMaterials'));
      batch.set(docRef, {
        ...item,
        isActive: true,
        createdAt: new Date().toISOString()
      });
      addedCount++;
    }
  }

  if (addedCount > 0) {
    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Seeded <strong>${addedCount}</strong> standard bistro raw materials into the catalog.`,
      details: { addedCount }
    }, userDisplayName);

    await batch.commit();
  }

  return addedCount;
};

// -------------------------------------------------------------
// RAW MATERIAL PROCUREMENT / ORDER REQUESTS (From Dashboard)
// -------------------------------------------------------------

export const createRawMaterialRequest = async (
  requestData: Omit<RawMaterialRequest, 'id' | 'createdAt' | 'cycle'>
) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newRef = doc(collection(db, 'rawMaterialRequests'));

  try {
    const settings = await getSettings();
    const cycle = settings?.activeCycle || 'Live Cycle';

    const fullData: Record<string, any> = sanitizeData({
      ...requestData,
      status: requestData.status || 'pending',
      urgency: requestData.urgency || 'normal',
      createdAt: new Date().toISOString(),
      cycle
    });

    batch.set(newRef, fullData);

    const itemsSummary = requestData.items.map(i => `${i.name} (${i.quantityRequested} ${i.unit})`).join(', ');

    const details: Record<string, any> = {
      requestId: newRef.id,
      items: sanitizeData(requestData.items)
    };
    if (requestData.notes) {
      details.notes = requestData.notes;
    }

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Employee <strong>${requestData.requestedBy.displayName}</strong> submitted low-stock order request for: ${itemsSummary}.`,
      details
    }, requestData.requestedBy.displayName);

    await batch.commit();
    return newRef.id;
  } catch (error) {
    console.error("Error creating raw material request: ", error);
    return null;
  }
};

export const updateRawMaterialRequestStatus = async (
  requestId: string,
  newStatus: 'pending' | 'ordered' | 'received' | 'cancelled',
  userDisplayName?: string
) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const itemRef = doc(db, 'rawMaterialRequests', requestId);

  try {
    const updates: Record<string, any> = {
      status: newStatus,
      updatedAt: new Date().toISOString()
    };

    if (newStatus === 'ordered') {
      updates.orderedAt = new Date().toISOString();
    } else if (newStatus === 'received') {
      updates.receivedAt = new Date().toISOString();
    }

    batch.update(itemRef, updates);

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Procurement request marked as <strong>${newStatus.toUpperCase()}</strong> by <strong>${userDisplayName || 'Staff'}</strong>.`,
      details: { requestId, status: newStatus }
    }, userDisplayName);

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating request status: ", error);
    return false;
  }
};

export const deleteRawMaterialRequest = async (requestId: string, userDisplayName?: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const itemRef = doc(db, 'rawMaterialRequests', requestId);

  try {
    batch.delete(itemRef);

    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Removed procurement request <strong>${requestId}</strong>.`,
      details: { requestId }
    }, userDisplayName);

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error deleting procurement request: ", error);
    return false;
  }
};
