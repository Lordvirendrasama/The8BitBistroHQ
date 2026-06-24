'use client';

import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import type { TaskFormData, LogEntry, Shift } from '@/lib/types';


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

const syncNewTasksToActiveShifts = async (db: ReturnType<typeof getFirestore>, tasksToAdd: TaskFormData[]) => {
  try {
    const activeShiftsQuery = query(collection(db, 'shifts'), where('status', '==', 'active'));
    const activeShiftsSnapshot = await getDocs(activeShiftsQuery);
    
    if (!activeShiftsSnapshot.empty) {
      const batch = writeBatch(db);
      for (const shiftDoc of activeShiftsSnapshot.docs) {
        const shiftData = shiftDoc.data() as Shift;
        const currentTasks = shiftData.tasks || [];
        
        // Filter out tasks that already exist in this shift by name
        const filteredTasks = tasksToAdd.filter(newTask => 
          !currentTasks.some(existingTask => existingTask.name === newTask.name)
        ).map(taskData => ({
          name: taskData.name,
          type: taskData.type,
          completed: false,
          ownerOnly: taskData.ownerOnly || false
        }));

        if (filteredTasks.length > 0) {
          batch.update(shiftDoc.ref, {
            tasks: [...currentTasks, ...filteredTasks]
          });
        }
      }
      await batch.commit();
    }
  } catch (e) {
    console.error("Error syncing new tasks to active shifts: ", e);
  }
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
    
    // Sync the new task to currently active shifts
    await syncNewTasksToActiveShifts(db, [taskData]);

    return newTaskRef.id;
  } catch (e) {
    console.error("Error adding task: ", e);
    return null;
  }
};

export const addTasks = async (tasksData: TaskFormData[]) => {
  const db = getFirestore();
  try {
    // Each task creation takes 2 operations (task + log entry), so we use a chunk size of 200 (400 operations total) to stay under the 500 limit.
    const chunkSize = 200;
    for (let i = 0; i < tasksData.length; i += chunkSize) {
      const chunk = tasksData.slice(i, i + chunkSize);
      const batch = writeBatch(db);
      for (const taskData of chunk) {
        const newTaskRef = doc(collection(db, 'tasks'));
        batch.set(newTaskRef, taskData);
        createLogEntry(db, batch, {
            type: 'SETTINGS_UPDATED',
            description: `Created a new shift task via CSV: <strong>${taskData.name}</strong>.`,
            details: { taskId: newTaskRef.id, taskData }
        });
      }
      await batch.commit();
    }
    
    // Sync all new tasks to currently active shifts
    await syncNewTasksToActiveShifts(db, tasksData);

    return true;
  } catch (e) {
    console.error("Error adding tasks in batch: ", e);
    return false;
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
