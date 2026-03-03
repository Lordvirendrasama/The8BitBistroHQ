'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch } from 'firebase/firestore';
import type { TaskFormData, LogEntry } from '@/lib/types';


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

export const addTask = async (taskData: TaskFormData) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const newTaskRef = doc(collection(db, 'tasks'));
  try {
    batch.set(newTaskRef, taskData);
    createLogEntry(db, batch, {
        type: 'SETTINGS_UPDATED',
        description: `Created a new shift task: <strong>${taskData.name}</strong>.`,
        details: { taskId: newTaskRef.id, taskData }
    });
    await batch.commit();
    return newTaskRef.id;
  } catch (e) {
    console.error("Error adding task: ", e);
    return null;
  }
};

export const updateTask = async (taskId: string, taskData: Partial<TaskFormData>) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const taskRef = doc(db, 'tasks', taskId);
    try {
        batch.update(taskRef, taskData);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Updated details for task <strong>${taskData.name || 'ID: ' + taskId}</strong>.`,
            details: { taskId, updates: taskData }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error updating task: ", e);
    }
}

export const deleteTask = async (taskId: string, taskName: string) => {
    const db = getFirestore();
    const batch = writeBatch(db);
    const taskRef = doc(db, 'tasks', taskId);
    try {
        batch.delete(taskRef);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Deleted shift task <strong>${taskName}</strong>.`,
            details: { taskId, taskName }
        });
        await batch.commit();
    } catch (e) {
        console.error("Error deleting task: ", e);
    }
}
