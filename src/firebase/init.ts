import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  initializeFirestore, 
  persistentLocalCache, 
  persistentMultipleTabManager 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { firebaseConfig } from './config';

export const initializeFirebase = () => {
  const isServer = typeof window === 'undefined';
  const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
  const auth = getAuth(app);
  
  let db;
  try {
    if (!getApps().length) {
      db = initializeFirestore(app, {
        localCache: !isServer 
          ? persistentLocalCache({
              tabManager: persistentMultipleTabManager(),
            })
          : undefined,
      });
    } else {
      db = getFirestore(app);
    }
  } catch (err) {
    console.warn("Firestore persistent cache initialization failed (iOS Safari / Private Browsing), falling back to standard Firestore:", err);
    db = getFirestore(app);
  }
  
  const storage = getStorage(app);
  return { app, auth, db, storage };
};
