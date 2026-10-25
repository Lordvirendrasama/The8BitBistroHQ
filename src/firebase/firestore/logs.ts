
'use client';

import { getFirestore, collection, addDoc } from 'firebase/firestore';
import type { LogEntry, LogEntryType } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { getSettings } from './settings';

const sanitizeDetails = (data: any): any => {
  if (data === undefined || data === null) return null;
  if (Array.isArray(data)) return data.map(sanitizeDetails);
  if (typeof data === 'object') {
    const clean: any = {};
    Object.keys(data).forEach(key => {
      const val = data[key];
      if (val !== undefined) clean[key] = sanitizeDetails(val);
    });
    return clean;
  }
  return data;
};

const log = async (
    type: LogEntryType,
    description: string,
    loggedInUser: CustomUser | null,
    details?: Record<string, any>
) => {
  const db = getFirestore();
  const logsCollection = collection(db, 'logs');
  
  // Try to get active cycle from storage or firestore
  const settings = await getSettings();

  const logEntry: Omit<LogEntry, 'id'> = {
    type,
    description,
    timestamp: new Date().toISOString(),
    cycle: settings.activeCycle || 'Testing Data 1'
  };

  if (loggedInUser) {
    logEntry.user = {
      uid: loggedInUser.username,
      displayName: loggedInUser.displayName,
    };
  }

  if (details) {
    logEntry.details = sanitizeDetails(details);
  }

  try {
    await addDoc(logsCollection, logEntry);
  } catch (error) {
    console.error("Error logging action: ", error);
  }
}

export const logUserLogin = async (user: CustomUser) => {
    await log('USER_LOGIN', `User <strong>${user.displayName}</strong> (${user.role}) logged in.`, user, { displayName: user.displayName, role: user.role });
};

export const logUserAction = async (
    description: string, 
    details?: Record<string, any>
) => {
  const currentUser: CustomUser = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('user') || 'null') : null;
  await log('UI_ACTION', description, currentUser, details);
};

export const logSettingsUpdate = async (
    description: string, 
    details?: Record<string, any>
) => {
    const currentUser: CustomUser = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('user') || 'null') : null;
    await log('SETTINGS_UPDATED', description, currentUser, details);
}

export const logDataAction = async (
    description: string,
    details?: Record<string, any>
) => {
    const currentUser: CustomUser = typeof window !== 'undefined' ? JSON.parse(sessionStorage.getItem('user') || 'null') : null;
    await log('DATA_ACTION', description, currentUser, details);
}
