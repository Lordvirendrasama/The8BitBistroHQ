
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, writeBatch, getDocs, query, where, setDoc } from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, updatePassword, updateEmail, signOut, initializeAuth, inMemoryPersistence } from 'firebase/auth';
import { firebaseConfig } from '../config';
import type { Employee, LogEntry } from '@/lib/types';

/**
 * Isolated helper to sync Auth user credentials without disrupting the active admin session.
 */
async function createOrUpdateAuthAccount(options: {
  oldUsername?: string;
  oldPin?: string;
  newUsername: string;
  newPin: string;
  role: 'admin' | 'staff' | 'guest';
  employeeId: string;
}) {
  const { oldUsername, oldPin, newUsername, newPin, role, employeeId } = options;
  const tempAppName = `emp-sync-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const tempApp = initializeApp(firebaseConfig, tempAppName);
  const tempAuth = initializeAuth(tempApp, {
    persistence: inMemoryPersistence
  });

  const newEmail = `${newUsername.toLowerCase()}@8bitbistro.local`;
  const newPassword = `${newPin}-8bit`;

  try {
    let authUid: string | null = null;

    if (oldUsername && oldPin) {
      const oldEmail = `${oldUsername.toLowerCase()}@8bitbistro.local`;
      const oldPassword = `${oldPin}-8bit`;

      try {
        const userCred = await signInWithEmailAndPassword(tempAuth, oldEmail, oldPassword);
        authUid = userCred.user.uid;

        // Update password if changed
        if (newPin && newPin !== oldPin) {
          await updatePassword(userCred.user, newPassword);
        }

        // Update email if username changed
        if (newUsername.toLowerCase() !== oldUsername.toLowerCase()) {
          await updateEmail(userCred.user, newEmail);
        }
      } catch (signInErr: any) {
        console.warn("Could not sign in with old credentials, attempting account creation fallback...", signInErr.message);
      }
    }

    // If account was not found or re-authenticated above, create a fresh Auth user
    if (!authUid) {
      try {
        const userCred = await createUserWithEmailAndPassword(tempAuth, newEmail, newPassword);
        authUid = userCred.user.uid;
      } catch (createErr: any) {
        if (createErr.code === 'auth/email-already-in-use') {
          try {
            // Attempt to sign in with the new PIN/password
            const loginCred = await signInWithEmailAndPassword(tempAuth, newEmail, newPassword);
            authUid = loginCred.user.uid;
          } catch (e: any) {
            // If sign in with new password fails, attempt with the old password (if we have oldPin)
            if (oldPin) {
              try {
                const oldPassword = `${oldPin}-8bit`;
                const loginCred = await signInWithEmailAndPassword(tempAuth, newEmail, oldPassword);
                authUid = loginCred.user.uid;
                // Since we successfully signed in with the old password, update it now to the new one!
                if (newPin && newPin !== oldPin) {
                  await updatePassword(loginCred.user, newPassword);
                }
              } catch (signInOldErr: any) {
                throw new Error(`User account exists but login failed with both old and new credentials: ${signInOldErr.message}`);
              }
            } else {
              throw new Error(`User account already exists but login failed: ${e.message}`);
            }
          }
        } else {
          throw new Error(`Failed to create Auth user: ${createErr.message}`);
        }
      }
    }

    // Sync to userRoles document in Firestore if authUid is available
    if (authUid) {
      const db = getFirestore();
      await setDoc(doc(db, 'userRoles', authUid), {
        role: role,
        username: newUsername,
        employeeId: employeeId
      });
    } else {
      throw new Error("Could not determine user Auth UID after synchronization.");
    }

    await signOut(tempAuth);
  } catch (err: any) {
    console.error("Error syncing Auth account:", err);
    throw err;
  } finally {
    try {
      await deleteApp(tempApp);
    } catch (e) {
      // ignore app cleanup errors
    }
  }
}

export const addEmployee = async (employeeData: Omit<Employee, 'id'>) => {
  const db = getFirestore();
  try {
    const docRef = doc(collection(db, 'employees'));
    const employeeId = docRef.id;

    if (employeeData.username && employeeData.pin) {
      await createOrUpdateAuthAccount({
        newUsername: employeeData.username,
        newPin: employeeData.pin,
        role: employeeData.role,
        employeeId: employeeId
      });
    }

    await setDoc(docRef, {
      ...employeeData,
      isActive: true
    });
    
    await addDoc(collection(db, 'logs'), {
      type: 'EMPLOYEE_ADDED',
      description: `New employee <strong>${employeeData.displayName}</strong> added to the registry.`,
      timestamp: new Date().toISOString(),
      user: { uid: 'system', displayName: 'System' }
    });

    return employeeId;
  } catch (e) {
    console.error("Error adding employee:", e);
    throw e;
  }
};

export const updateEmployee = async (
  employeeId: string, 
  updates: Partial<Employee>,
  previousState?: { username?: string; pin?: string }
) => {
  const db = getFirestore();
  const ref = doc(db, 'employees', employeeId);
  try {
    // Sync to userRoles and Firebase Auth if username, pin, or role has changed
    const effectiveUsername = updates.username ?? previousState?.username ?? '';
    const effectivePin = updates.pin ?? previousState?.pin ?? '';
    const effectiveRole = updates.role ?? 'staff';

    if (effectiveUsername && effectivePin) {
      await createOrUpdateAuthAccount({
        oldUsername: previousState?.username,
        oldPin: previousState?.pin,
        newUsername: effectiveUsername,
        newPin: effectivePin,
        role: effectiveRole,
        employeeId: employeeId
      });
    }

    await updateDoc(ref, updates);
    return true;
  } catch (e) {
    console.error("Error updating employee:", e);
    throw e;
  }
};

export const deleteEmployee = async (employeeId: string) => {
  const db = getFirestore();
  const ref = doc(db, 'employees', employeeId);
  try {
    await deleteDoc(ref);

    // Also delete any matching credentials in userRoles so they cannot log in
    const snap = await getDocs(query(collection(db, 'userRoles'), where('employeeId', '==', employeeId)));
    for (const d of snap.docs) {
      const roleRef = doc(db, 'userRoles', d.id);
      await deleteDoc(roleRef);
    }

    return true;
  } catch (e) {
    console.error("Error deleting employee:", e);
    return false;
  }
};

export const getActiveEmployees = async (): Promise<Employee[]> => {
  const db = getFirestore();
  const q = query(collection(db, 'employees'), where('isActive', '==', true));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as Employee));
};

