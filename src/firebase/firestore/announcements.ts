
'use client';
import { getFirestore, collection, addDoc } from 'firebase/firestore';

/**
 * Creates a system-wide voice announcement that will be spoken
 * on all devices currently running the application.
 */
export const createSystemAnnouncement = async (text: string) => {
  const db = getFirestore();
  try {
    await addDoc(collection(db, 'announcements'), {
      text,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error creating system announcement:", error);
  }
};
