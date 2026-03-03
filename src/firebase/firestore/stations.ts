
'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, runTransaction } from 'firebase/firestore';
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

/**
 * Transfers an active session from a source station to an available target station.
 */
export const moveStationSession = async (sourceId: string, targetId: string) => {
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
            
            if (targetData.status !== 'available') throw new Error("Target station is no longer available");
            
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
        });
        return { success: true };
    } catch (e: any) {
        console.error("Error moving station session: ", e);
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
