'use client';

import { getFirestore, collection, doc, writeBatch } from 'firebase/firestore';
import type { LogEntry } from '@/lib/types';

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

export const addPolicySection = async (title: string, content: string, order: number) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newRef = doc(collection(db, 'policies'));
  try {
    const data = { title, content, order };
    batch.set(newRef, data);
    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Created a new policy section: <strong>${title}</strong>.`,
      details: { policyId: newRef.id, title }
    });
    await batch.commit();
    return newRef.id;
  } catch (e) {
    console.error("Error adding policy section: ", e);
    return null;
  }
};

export const updatePolicySection = async (id: string, title: string, content: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const ref = doc(db, 'policies', id);
  try {
    batch.update(ref, { title, content });
    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Updated policy section: <strong>${title}</strong>.`,
      details: { policyId: id, title }
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error("Error updating policy section: ", e);
    return false;
  }
};

export const deletePolicySection = async (id: string, title: string) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const ref = doc(db, 'policies', id);
  try {
    batch.delete(ref);
    createLogEntry(db, batch, {
      type: 'SETTINGS_UPDATED',
      description: `Deleted policy section: <strong>${title}</strong>.`,
      details: { policyId: id, title }
    });
    await batch.commit();
    return true;
  } catch (e) {
    console.error("Error deleting policy section: ", e);
    return false;
  }
};
