
'use client';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDoc, getDocs, query, orderBy, limit } from 'firebase/firestore';
import type { OwnerTask, OwnerTaskFormData, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';
import { addMonths } from 'date-fns';

export const addOwnerTask = async (taskData: OwnerTaskFormData, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  // Get current max order
  const tasksQuery = query(collection(db, 'ownerTasks'), orderBy('order', 'desc'), limit(1));
  const snapshot = await getDocs(tasksQuery);
  const maxOrder = snapshot.empty ? 0 : snapshot.docs[0].data().order;

  const taskRef = doc(collection(db, 'ownerTasks'));
  const fullTask: Omit<OwnerTask, 'id'> = {
    ...taskData,
    status: 'pending',
    createdAt: new Date().toISOString(),
    order: maxOrder + 100 // Incremental spacing
  };

  batch.set(taskRef, fullTask);

  // Log action
  const logRef = doc(collection(db, 'logs'));
  const logEntry: Omit<LogEntry, 'id'> = {
    type: 'OWNER_TASK_CREATED',
    description: `Viren created a new ${taskData.isSeparator ? 'separator' : (taskData.category + ' task')}: <strong>${taskData.title}</strong>.`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName },
    details: { taskId: taskRef.id, taskTitle: taskData.title, category: taskData.category, isSeparator: !!taskData.isSeparator }
  };
  batch.set(logRef, logEntry);

  try {
    await batch.commit();
    return taskRef.id;
  } catch (error) {
    console.error("Error adding owner task:", error);
    return null;
  }
};

export const updateOwnerTask = async (taskId: string, updates: Partial<OwnerTask>, user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  const taskRef = doc(db, 'ownerTasks', taskId);
  
  try {
    const taskSnapshot = await getDoc(taskRef);
    if (!taskSnapshot.exists()) return false;
    
    const taskData = taskSnapshot.data() as OwnerTask;
    batch.update(taskRef, updates);

    // Handle Recurring Task Logic
    if (updates.status === 'completed' && taskData.isRecurring && !taskData.isSeparator) {
      const nextDueDate = addMonths(new Date(taskData.dueDateTime), 1).toISOString();
      const newTaskRef = doc(collection(db, 'ownerTasks'));
      const newTaskData: Omit<OwnerTask, 'id'> = {
        title: taskData.title,
        description: taskData.description,
        dueDateTime: nextDueDate,
        priority: taskData.priority,
        category: taskData.category,
        status: 'pending',
        isRecurring: true,
        createdAt: new Date().toISOString(),
        order: taskData.order + 1 // Place right after current
      };
      batch.set(newTaskRef, newTaskData);
    }

    if (updates.status === 'completed') {
      const logRef = doc(collection(db, 'logs'));
      const logEntry: Omit<LogEntry, 'id'> = {
        type: 'OWNER_TASK_COMPLETED',
        description: `Viren completed the owner task: <strong>${taskData.title}</strong>.`,
        timestamp: new Date().toISOString(),
        user: { uid: user.username, displayName: user.displayName },
        details: { taskId }
      };
      batch.set(logRef, logEntry);
    }

    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error updating owner task:", error);
    return false;
  }
};

export const reorderOwnerTasks = async (tasks: OwnerTask[], user: CustomUser) => {
  const db = getFirestore();
  const batch = writeBatch(db);
  
  tasks.forEach((task, index) => {
    const ref = doc(db, 'ownerTasks', task.id);
    batch.update(ref, { order: index * 100 });
  });

  const logRef = doc(collection(db, 'logs'));
  batch.set(logRef, {
    type: 'OWNER_TASK_REORDERED',
    description: `Viren rearranged the strategic checklist.`,
    timestamp: new Date().toISOString(),
    user: { uid: user.username, displayName: user.displayName }
  });

  try {
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error reordering tasks:", error);
    return false;
  }
};

export const deleteOwnerTask = async (taskId: string) => {
  const db = getFirestore();
  try {
    await deleteDoc(doc(db, 'ownerTasks', taskId));
    return true;
  } catch (error) {
    console.error("Error deleting owner task:", error);
    return false;
  }
};
