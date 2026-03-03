'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, deleteField } from 'firebase/firestore';
import type { GamingPackage, GamingPackageFormData, LogEntry } from '@/lib/types';


const createLogEntry = (
  db: ReturnType<typeof getFirestore>, 
  batch: ReturnType<typeof writeBatch>,
  entry: Omit<LogEntry, 'id' | 'timestamp' | 'user'>
) => {
  const logRef = doc(collection(db, 'logs'));
  const currentUser = { uid: 'system', displayName: 'System' }; // Simplified
  batch.set(logRef, {
    ...entry,
    timestamp: new Date().toISOString(),
    user: {
      uid: currentUser.uid,
      displayName: currentUser.displayName,
    }
  });
};

export const addGamingPackage = async (packageData: GamingPackageFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newPackageRef = doc(collection(db, 'gamingPackages'));
  try {
    // Create a clean object without any 'undefined' values, which Firestore forbids.
    const dataToAdd: { [key: string]: any } = {};
    Object.keys(packageData).forEach(key => {
      const value = packageData[key as keyof GamingPackageFormData];
      if (value !== undefined) {
        dataToAdd[key] = value;
      }
    });

    batch.set(newPackageRef, dataToAdd);

    createLogEntry(db, batch, {
        type: 'SETTINGS_UPDATED',
        description: `Created a new gaming package: <strong>${dataToAdd.name}</strong>.`,
        details: { packageId: newPackageRef.id, packageData: dataToAdd }
    });
    await batch.commit();
    return newPackageRef.id;
  } catch (e) {
    console.error("Error adding gaming package: ", e);
    return null;
  }
};

export const updateGamingPackage = async (packageId: string, packageData: Partial<GamingPackageFormData>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const packageRef = doc(db, 'gamingPackages', packageId);
    try {
        const dataToUpdate: { [key: string]: any } = { ...packageData };
        const dataToLog: { [key: string]: any } = { ...packageData };

        if (dataToUpdate.startTime === undefined) {
            dataToUpdate.startTime = deleteField();
            delete dataToLog.startTime;
        }
        if (dataToUpdate.endTime === undefined) {
            dataToUpdate.endTime = deleteField();
            delete dataToLog.endTime;
        }

        batch.update(packageRef, dataToUpdate);
        
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Updated details for gaming package <strong>${packageData.name || 'ID: ' + packageId}</strong>.`,
            details: { packageId, updates: dataToLog }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating gaming package: ", e);
    }
}

export const deleteGamingPackage = async (packageId: string, packageName: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const packageRef = doc(db, 'gamingPackages', packageId);
    try {
        batch.delete(packageRef);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Deleted gaming package <strong>${packageName}</strong>.`,
            details: { packageId, packageName }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting gaming package: ", e);
    }
}

export const migratePackageDurations = async (): Promise<{success: boolean, migratedCount: number}> => {
    const db = getFirestore();
    const packagesRef = collection(db, 'gamingPackages');
    const snapshot = await getDocs(packagesRef);
    
    if (snapshot.empty) {
        return { success: true, migratedCount: 0 };
    }

    const batch = writeBatch(db);
    let migratedCount = 0;

    snapshot.forEach(doc => {
        const pkg = doc.data() as GamingPackage;
        // Assume durations under 1000 are in minutes and need migration.
        // This is a heuristic to avoid re-migrating.
        if (pkg.duration && pkg.duration < 1000) {
            batch.update(doc.ref, { duration: pkg.duration * 60 });
            migratedCount++;
        }
    });

    if (migratedCount > 0) {
        try {
            await batch.commit();
            // Also log this action
            const logRef = doc(collection(db, 'logs'));
            const logBatch = writeBatch(db);
            createLogEntry(db, logBatch, {
                type: 'DATA_ACTION',
                description: `Migrated <strong>${migratedCount}</strong> gaming package durations from minutes to seconds.`,
                details: { migratedCount }
            });
            await logBatch.commit();

            return { success: true, migratedCount };
        } catch (e) {
            console.error("Error migrating package durations: ", e);
            return { success: false, migratedCount: 0 };
        }
    }

    return { success: true, migratedCount: 0 };
}
