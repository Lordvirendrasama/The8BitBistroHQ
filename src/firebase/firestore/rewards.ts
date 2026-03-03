'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { RewardFormData, LogEntry } from '@/lib/types';


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

export const addReward = async (rewardData: RewardFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newRewardRef = doc(collection(db, 'rewards'));
  try {
    batch.set(newRewardRef, rewardData);
    createLogEntry(db, batch, {
        type: 'REWARD_CREATED',
        description: `Created a new reward: <strong>${rewardData.name}</strong>.`,
        details: { rewardId: newRewardRef.id, rewardData }
    });
    await batch.commit();
    return newRewardRef.id;
  } catch (e) {
    console.error("Error adding document: ", e);
    return null;
  }
};

export const updateReward = async (rewardId: string, rewardData: Partial<RewardFormData>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const rewardRef = doc(db, 'rewards', rewardId);
    try {
        batch.update(rewardRef, rewardData);
        createLogEntry(db, batch, {
            type: 'REWARD_UPDATED',
            description: `Updated details for reward <strong>${rewardData.name || 'ID: ' + rewardId}</strong>.`,
            details: { rewardId, updates: rewardData }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating document: ", e);
    }
}

export const deleteReward = async (rewardId: string, rewardName: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const rewardRef = doc(db, 'rewards', rewardId);
    try {
        batch.delete(rewardRef);
        createLogEntry(db, batch, {
            type: 'REWARD_DELETED',
            description: `Deleted reward <strong>${rewardName}</strong>.`,
            details: { rewardId, rewardName }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting document: ", e);
    }
}
