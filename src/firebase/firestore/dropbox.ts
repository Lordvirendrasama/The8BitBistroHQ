'use client';
import { Firestore, collection, addDoc, doc, deleteDoc, getDocs, writeBatch } from 'firebase/firestore';
import { FirebaseStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll, type UploadTask } from 'firebase/storage';
import type { DropboxFile, LogEntry } from '@/lib/types';
import type { CustomUser } from '../auth/use-user';

/**
 * Uploads a file to Firebase Storage and records its metadata in Firestore.
 * Requires the initialized instances from the provider to ensure correct bucket connection.
 */
export const uploadDropboxFile = async (
  storage: FirebaseStorage, 
  db: Firestore, 
  file: File, 
  user: CustomUser, 
  onTask?: (task: UploadTask) => void
) => {
  try {
    const fileId = doc(collection(db, 'dummy')).id;
    // Standardizing storage path
    const storageRef = ref(storage, `dropbox/${fileId}_${file.name}`);
    
    // 1. Upload to Storage with Resumable Task
    const task = uploadBytesResumable(storageRef, file);
    if (onTask) onTask(task);

    const snapshot = await task;
    const downloadUrl = await getDownloadURL(snapshot.ref);
    
    // 2. Record in Firestore
    const dropboxRef = collection(db, 'dropboxFiles');
    const fileData: Omit<DropboxFile, 'id'> = {
      name: file.name,
      url: downloadUrl,
      type: file.type,
      size: file.size,
      uploadedAt: new Date().toISOString(),
      uploadedBy: {
        uid: user.username,
        displayName: user.displayName
      }
    };
    
    const docRef = await addDoc(dropboxRef, fileData);

    // 3. Log the action
    const logRef = collection(db, 'logs');
    await addDoc(logRef, {
      type: 'DROPBOX_UPLOAD',
      description: `<strong>${user.displayName}</strong> uploaded file to DropBox: <em>${file.name}</em>.`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName },
      details: { fileId: docRef.id, fileName: file.name }
    });

    return docRef.id;
  } catch (error: any) {
    if (error.code === 'storage/canceled') {
      console.log("Upload cancelled by user.");
      return null;
    }
    console.error("Error uploading to dropbox:", error);
    throw error; // Let the component handle UI feedback
  }
};

/**
 * Deletes a specific file from Storage and Firestore.
 */
export const deleteDropboxFile = async (storage: FirebaseStorage, db: Firestore, fileId: string, storageUrl: string, user: CustomUser) => {
  try {
    // 1. Delete from Storage
    const storageRef = ref(storage, storageUrl);
    await deleteObject(storageRef);
    
    // 2. Delete from Firestore
    await deleteDoc(doc(db, 'dropboxFiles', fileId));
    
    return true;
  } catch (error) {
    console.error("Error deleting from dropbox:", error);
    return false;
  }
};

/**
 * Nuclear option: Wipes all files from the shared pool.
 */
export const clearDropbox = async (storage: FirebaseStorage, db: Firestore, user: CustomUser) => {
  try {
    // 1. Get all files in Firestore
    const snapshot = await getDocs(collection(db, 'dropboxFiles'));
    const batch = writeBatch(db);
    
    // 2. Clear Storage folder
    const storageRef = ref(storage, 'dropbox');
    const list = await listAll(storageRef);
    const deletePromises = list.items.map(item => deleteObject(item));
    await Promise.all(deletePromises);
    
    // 3. Clear Firestore collection
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    // 4. Log the wipe
    const logRef = doc(collection(db, 'logs'));
    batch.set(logRef, {
      type: 'DROPBOX_CLEAR',
      description: `<strong>${user.displayName}</strong> nuked the DropBox. All shared files were deleted.`,
      timestamp: new Date().toISOString(),
      user: { uid: user.username, displayName: user.displayName }
    });
    
    await batch.commit();
    return true;
  } catch (error) {
    console.error("Error clearing dropbox:", error);
    return false;
  }
};
