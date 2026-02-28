
'use client';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import type { Settings } from '@/lib/types';

const SETTINGS_DOC_ID = 'app_config';

export const getSettings = async (): Promise<Settings> => {
  const db = getFirestore();
  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
  const snapshot = await getDoc(docRef);

  const defaultSettings: Settings = {
    xpPerRupee: 1,
    xpPerLevel: 1000,
    maxLevels: 10,
    pointsPerLevelUp: 100,
    activeCycle: 'Testing Data 1'
  };

  if (snapshot.exists()) {
    return { ...defaultSettings, ...snapshot.data() } as Settings;
  } else {
    // Initialize if not exists
    await setDoc(docRef, defaultSettings);
    return defaultSettings;
  }
};

export const updateSettings = async (updates: Partial<Settings>) => {
  const db = getFirestore();
  const docRef = doc(db, 'settings', SETTINGS_DOC_ID);
  try {
    const current = await getSettings();
    const finalUpdates: any = { ...updates };

    // If changing the cycle name, we archive the current start date as the "last" start date
    if (updates.activeCycle && updates.activeCycle !== current.activeCycle) {
        finalUpdates.lastCycleStartDate = current.cycleStartDate || new Date().toISOString();
    }

    await updateDoc(docRef, finalUpdates);
    return true;
  } catch (error) {
    console.error("Error updating settings:", error);
    return false;
  }
};
