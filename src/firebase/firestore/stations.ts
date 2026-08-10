
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, runTransaction, writeBatch, deleteField } from 'firebase/firestore';
import type { Station, AssignedMember, BillItem } from '@/lib/types';

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
      // Skip undefined keys entirely to prevent Firestore crash
      if (val !== undefined) {
        clean[key] = sanitize(val);
      }
    });
    return clean;
  }
  
  return data;
};

export const addStation = async (station: Omit<Station, 'id'>) => {
    const db = getFirestore();
    const stationsCollection = collection(db, 'stations');
    try {
        const sanitizedData = sanitize(station);
        const docRef = await addDoc(stationsCollection, sanitizedData);
        return docRef.id;
    } catch (e) {
        console.error("Error adding station: ", e);
        return null;
    }
}

export const updateStation = async (stationId: string, updates: Partial<Station>) => {
    const db = getFirestore();
    const stationRef = doc(db, 'stations', stationId);
    try {
        const sanitizedUpdates = sanitize(updates);
        await updateDoc(stationRef, sanitizedUpdates);
    } catch (e) {
        console.error("Error updating station: ", e);
    }
}

export const removeStation = async (stationId: string) => {
    const db = getFirestore();
    const stationRef = doc(db, 'stations', stationId);
    try {
        await deleteDoc(stationRef);
    } catch (e) {
        console.error("Error removing station: ", e);
    }
}

export const updateStationsBatch = async (stations: Station[]) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    
    stations.forEach((s, idx) => {
        const ref = doc(db, 'stations', s.id);
        const updates = {
            name: s.name,
            order: s.order ?? idx * 100
        };
        batch.update(ref, updates);
    });

    try {
        await batch.commit();
        return true;
    } catch (e) {
        console.error("Error updating stations batch:", e);
        return false;
    }
};

/**
 * Helper to merge bill items by summing their quantities.
 */
const mergeBillItems = (items1: BillItem[], items2: BillItem[]): BillItem[] => {
    const merged: Record<string, BillItem> = {};
    (items1 || []).forEach(item => {
        merged[item.itemId] = { ...item };
    });
    (items2 || []).forEach(item => {
        if (merged[item.itemId]) {
            merged[item.itemId].quantity += item.quantity;
        } else {
            merged[item.itemId] = { ...item };
        }
    });
    return Object.values(merged);
};

const getEarlierDate = (d1: string | null | undefined, d2: string | null | undefined) => {
    if (!d1) return d2 || null;
    if (!d2) return d1 || null;
    return new Date(d1).getTime() < new Date(d2).getTime() ? d1 : d2;
};

const getLaterDate = (d1: string | null | undefined, d2: string | null | undefined) => {
    if (!d1) return d2 || null;
    if (!d2) return d1 || null;
    return new Date(d1).getTime() > new Date(d2).getTime() ? d1 : d2;
};

/**
 * Transfers, swaps, or merges active sessions between source and target stations.
 */
export const moveStationSession = async (
    sourceId: string, 
    targetId: string, 
    mode: 'move' | 'merge' | 'swap' = 'move'
) => {
    const db = getFirestore();
    try {
        await runTransaction(db, async (transaction) => {
            const sourceRef = doc(db, 'stations', sourceId);
            const targetRef = doc(db, 'stations', targetId);
            
            const sourceDoc = await transaction.get(sourceRef);
            const targetDoc = await transaction.get(targetRef);
            
            if (!sourceDoc.exists()) throw new Error("Source station not found");
            if (!targetDoc.exists()) throw new Error("Target station not found");
            
            const sourceData = sourceDoc.data() as Station;
            const targetData = targetDoc.data() as Station;
            
            if (mode === 'move') {
                if (targetData.status !== 'available') {
                    throw new Error("Target station is no longer available");
                }
                
                // 1. Update target with source data
                transaction.update(targetRef, sanitize({
                    status: sourceData.status,
                    startTime: sourceData.startTime,
                    endTime: sourceData.endTime,
                    pauseStartTime: sourceData.pauseStartTime || null,
                    remainingTimeOnPause: sourceData.remainingTimeOnPause || null,
                    packageName: sourceData.packageName,
                    members: sourceData.members,
                    currentBill: sourceData.currentBill || [],
                    discount: sourceData.discount || 0,
                }));
                
                // 2. Reset source station to available
                transaction.update(sourceRef, {
                    status: 'available',
                    startTime: null,
                    endTime: null,
                    pauseStartTime: null,
                    remainingTimeOnPause: null,
                    packageName: null,
                    members: [],
                    currentBill: [],
                    discount: 0,
                });
            } else if (mode === 'swap') {
                // Swap the session fields completely
                transaction.update(targetRef, sanitize({
                    status: sourceData.status,
                    startTime: sourceData.startTime,
                    endTime: sourceData.endTime,
                    pauseStartTime: sourceData.pauseStartTime || null,
                    remainingTimeOnPause: sourceData.remainingTimeOnPause || null,
                    packageName: sourceData.packageName,
                    members: sourceData.members,
                    currentBill: sourceData.currentBill || [],
                    discount: sourceData.discount || 0,
                }));
                
                transaction.update(sourceRef, sanitize({
                    status: targetData.status,
                    startTime: targetData.startTime,
                    endTime: targetData.endTime,
                    pauseStartTime: targetData.pauseStartTime || null,
                    remainingTimeOnPause: targetData.remainingTimeOnPause || null,
                    packageName: targetData.packageName,
                    members: targetData.members,
                    currentBill: targetData.currentBill || [],
                    discount: targetData.discount || 0,
                }));
            } else if (mode === 'merge') {
                // Merge source session into target session
                const mergedMembers = [...(targetData.members || []), ...(sourceData.members || [])];
                const mergedBill = mergeBillItems(targetData.currentBill || [], sourceData.currentBill || []);
                const mergedStartTime = getEarlierDate(targetData.startTime, sourceData.startTime);
                const mergedEndTime = getLaterDate(targetData.endTime, sourceData.endTime);
                
                let mergedPackageName = targetData.packageName;
                if (sourceData.packageName && sourceData.packageName !== targetData.packageName) {
                    mergedPackageName = targetData.packageName 
                        ? `${targetData.packageName}, ${sourceData.packageName}` 
                        : sourceData.packageName;
                }
                
                const mergedStatus = (targetData.status === 'in-use' || sourceData.status === 'in-use') ? 'in-use' : 'paused';
                
                transaction.update(targetRef, sanitize({
                    status: mergedStatus,
                    startTime: mergedStartTime,
                    endTime: mergedEndTime,
                    pauseStartTime: targetData.pauseStartTime || sourceData.pauseStartTime || null,
                    remainingTimeOnPause: targetData.remainingTimeOnPause || sourceData.remainingTimeOnPause || null,
                    packageName: mergedPackageName,
                    members: mergedMembers,
                    currentBill: mergedBill,
                    discount: (targetData.discount || 0) + (sourceData.discount || 0),
                }));
                
                // Reset source station to available
                transaction.update(sourceRef, {
                    status: 'available',
                    startTime: null,
                    endTime: null,
                    pauseStartTime: null,
                    remainingTimeOnPause: null,
                    packageName: null,
                    members: [],
                    currentBill: [],
                    discount: 0,
                });
            }
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error moving/swapping/merging station session: ", e);
        return { success: false, message: e.message };
    }
}

/**
 * Adds a single player to an already active session.
 */
export const addPlayerToSession = async (stationId: string, newPlayer: AssignedMember, billItem: BillItem | null) => {
    const db = getFirestore();
    const stationRef = doc(db, 'stations', stationId);

    try {
        await runTransaction(db, async (transaction) => {
            const stationDoc = await transaction.get(stationRef);
            if (!stationDoc.exists()) throw new Error("Station not found");

            const station = stationDoc.data() as Station;
            const updatedMembers = [...station.members, newPlayer];
            
            // Calculate new station-level endTime (the latest of all active player endTimes)
            const activeEndTimes = updatedMembers
                .filter(m => m.status !== 'finished' && m.endTime)
                .map(m => new Date(m.endTime!).getTime());
            
            const latestEndTime = activeEndTimes.length > 0 
                ? new Date(Math.max(...activeEndTimes)).toISOString() 
                : station.endTime;

            const updatedBill = [...(station.currentBill || [])];
            if (billItem) {
                updatedBill.push(billItem);
            }

            transaction.update(stationRef, sanitize({
                members: updatedMembers,
                endTime: latestEndTime,
                currentBill: updatedBill
            }));
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error adding player to session:", e);
        return { success: false, message: e.message };
    }
}
