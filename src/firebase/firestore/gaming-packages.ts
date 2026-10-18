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

export const seedDefaultRateCardPackages = async (): Promise<number> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const colRef = collection(db, 'gamingPackages');

  const defaultPackages: Omit<GamingPackage, 'id'>[] = [
    // PS5 Rates
    {
      name: 'PS5 1 Hour Solo Session',
      duration: 3600,
      price: 150,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps5',
      isPriorityOffer: true,
      isRechargePack: true,
    },
    {
      name: 'PS5 1 Hour Duo Session (Per Player)',
      duration: 3600,
      price: 120,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps5',
      isRechargePack: true,
    },
    {
      name: 'PS5 30 Min Solo Session',
      duration: 1800,
      price: 80,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps5',
      isRechargePack: true,
    },
    {
      name: 'PS5 30 Min Duo Session (Per Player)',
      duration: 1800,
      price: 60,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps5',
      isRechargePack: true,
    },
    {
      name: 'PS5 Happy Hour 1 Hour Solo (8 AM - 1 PM)',
      duration: 3600,
      price: 80,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps5',
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },
    {
      name: 'PS5 Happy Hour 1 Hour Duo (8 AM - 1 PM)',
      duration: 3600,
      price: 60,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps5',
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },

    // PS4 Rates
    {
      name: 'PS4 1 Hour Solo Session',
      duration: 3600,
      price: 100,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps4',
      isPriorityOffer: true,
      isRechargePack: true,
    },
    {
      name: 'PS4 1 Hour Duo Session (Per Player)',
      duration: 3600,
      price: 70,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps4',
      isRechargePack: true,
    },
    {
      name: 'PS4 30 Min Solo Session',
      duration: 1800,
      price: 60,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps4',
      isRechargePack: true,
    },
    {
      name: 'PS4 30 Min Duo Session (Per Player)',
      duration: 1800,
      price: 50,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps4',
      isRechargePack: true,
    },
    {
      name: 'PS4 Happy Hour 1 Hour Solo (8 AM - 1 PM)',
      duration: 3600,
      price: 60,
      validity: 1,
      playerCapacity: 1,
      stationType: 'ps4',
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },
    {
      name: 'PS4 Happy Hour 1 Hour Duo (8 AM - 1 PM)',
      duration: 3600,
      price: 50,
      validity: 1,
      playerCapacity: 2,
      stationType: 'ps4',
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },

    // Board Games Rates
    {
      name: 'Board Pass 1 Hour Session',
      duration: 3600,
      price: 50,
      validity: 1,
      playerCapacity: 1,
      stationType: 'boardgame',
      isBoardGamePass: true,
      isPriorityOffer: true,
      isRechargePack: true,
    },
    {
      name: 'Board Pass 30 Min Session',
      duration: 1800,
      price: 30,
      validity: 1,
      playerCapacity: 1,
      stationType: 'boardgame',
      isBoardGamePass: true,
      isRechargePack: true,
    },
    {
      name: 'Board Pass Happy Hour 1 Hour (8 AM - 1 PM)',
      duration: 3600,
      price: 20,
      validity: 1,
      playerCapacity: 1,
      stationType: 'boardgame',
      isBoardGamePass: true,
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },

    // Retro Gaming Rates
    {
      name: 'Retro Pass 1 Hour Session',
      duration: 3600,
      price: 50,
      validity: 1,
      playerCapacity: 1,
      stationType: 'retrogaming',
      isRetroGamePass: true,
      isPriorityOffer: true,
      isRechargePack: true,
    },
    {
      name: 'Retro Pass 30 Min Session',
      duration: 1800,
      price: 30,
      validity: 1,
      playerCapacity: 1,
      stationType: 'retrogaming',
      isRetroGamePass: true,
      isRechargePack: true,
    },
    {
      name: 'Retro Pass Happy Hour 1 Hour (8 AM - 1 PM)',
      duration: 3600,
      price: 20,
      validity: 1,
      playerCapacity: 1,
      stationType: 'retrogaming',
      isRetroGamePass: true,
      startTime: '08:00',
      endTime: '13:00',
      isRechargePack: true,
    },

    // Recharge Packs
    {
      name: '10 Hour Gaming Recharge Pack',
      duration: 36000,
      price: 1200,
      validity: 30,
      playerCapacity: 1,
      stationType: 'ps5',
      isRechargePack: true,
    },
    {
      name: '5 Hour Gaming Recharge Pack',
      duration: 18000,
      price: 650,
      validity: 15,
      playerCapacity: 1,
      stationType: 'ps5',
      isRechargePack: true,
    },
  ];

  defaultPackages.forEach(pkg => {
    const docRef = doc(colRef);
    batch.set(docRef, pkg);
  });

  createLogEntry(db, batch, {
    type: 'SETTINGS_UPDATED',
    description: `Populated rate card packages (${defaultPackages.length} packages created as Recharge Packs).`,
    details: { count: defaultPackages.length }
  });

  await batch.commit();
  return defaultPackages.length;
};

/**
 * Converts all existing gaming packages in Firestore to Recharge Packs (isRechargePack: true).
 */
export const convertAllGamingPackagesToRechargePacks = async (): Promise<number> => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const colRef = collection(db, 'gamingPackages');
  const snapshot = await getDocs(colRef);

  if (snapshot.empty) return 0;

  let count = 0;
  snapshot.docs.forEach(docSnap => {
    const data = docSnap.data();
    const needsRechargePack = !data.isRechargePack;
    const needsValidity = !data.validity || data.validity <= 0;
    if (needsRechargePack || needsValidity) {
      batch.update(docSnap.ref, { 
        isRechargePack: true,
        validity: data.validity && data.validity > 0 ? data.validity : 1 
      });
      count++;
    }
  });

  if (count > 0) {
    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Converted ${count} gaming packages to recharge packs (prepaid).`,
      details: { convertedCount: count }
    });
    await batch.commit();
  }
  return count;
};

/**
 * Bulk updates the recharge status and validity for multiple packages.
 */
export const bulkUpdatePackageRechargeStatus = async (
  packageIds: string[], 
  isRechargePack: boolean, 
  validity?: number
): Promise<number> => {
  if (packageIds.length === 0) return 0;
  const db = getFirestore();
  const batch = writeBatch(db);

  packageIds.forEach(id => {
    const pkgRef = doc(db, 'gamingPackages', id);
    const updates: Record<string, any> = { isRechargePack };
    if (isRechargePack) {
      updates.validity = (validity !== undefined && validity > 0) ? validity : 1;
    }
    batch.update(pkgRef, updates);
  });

  createLogEntry(db, batch, {
    type: 'SETTINGS_UPDATED',
    description: `Bulk updated recharge status for ${packageIds.length} packages (isRechargePack: ${isRechargePack}${validity ? `, validity: ${validity}d` : ''}).`,
    details: { packageIds, isRechargePack, validity }
  });

  await batch.commit();
  return packageIds.length;
};

/**
 * Bulk updates validity (in days, e.g. 1 = 24h) for multiple packages.
 */
export const bulkUpdatePackageValidity = async (
  packageIds: string[], 
  validityDays: number
): Promise<number> => {
  if (packageIds.length === 0 || validityDays <= 0) return 0;
  const db = getFirestore();
  const batch = writeBatch(db);

  packageIds.forEach(id => {
    const pkgRef = doc(db, 'gamingPackages', id);
    batch.update(pkgRef, { validity: validityDays });
  });

  createLogEntry(db, batch, {
    type: 'SETTINGS_UPDATED',
    description: `Updated validity to ${validityDays} day(s) for ${packageIds.length} gaming packages.`,
    details: { packageIds, validityDays }
  });

  await batch.commit();
  return packageIds.length;
};

/**
 * Toggles a single package's recharge pack status.
 */
export const togglePackageRecharge = async (packageId: string, currentStatus: boolean, validity?: number): Promise<boolean> => {
  const db = getFirestore();
  const pkgRef = doc(db, 'gamingPackages', packageId);
  const newStatus = !currentStatus;
  const updates: Record<string, any> = { isRechargePack: newStatus };
  if (newStatus && (!validity || validity <= 0)) {
    updates.validity = 1; // Default to 24 hours
  }
  await updateDoc(pkgRef, updates);
  return newStatus;
};
