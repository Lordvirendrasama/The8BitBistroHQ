'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { logUserLogin } from '@/firebase/firestore/logs';
import { createAdminNotification } from '@/firebase/firestore/notifications';
import { getFirestore, collection, query, where, getDocs, limit, doc, getDoc } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { endShift } from '../firestore/shifts';
import type { Employee } from '@/lib/types';

export interface CustomUser {
  username: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'staff' | 'guest';
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  login: (username: string, pin: string) => Promise<void>;
  logout: (totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number }, forceLogout?: boolean) => Promise<void>;
  switchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        // Firebase auth is persistent, fetch user details
        const db = getFirestore();
        const roleDoc = await getDoc(doc(db, 'userRoles', firebaseUser.uid));
        if (roleDoc.exists()) {
          const roleData = roleDoc.data();
          const loggedInUser: CustomUser = {
              username: roleData.username,
              displayName: roleData.username,
              photoURL: `https://picsum.photos/seed/${roleData.username}/100/100`,
              role: roleData.role,
          };
          setUser(loggedInUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const login = async (username: string, pin: string) => {
    setLoading(true);
    const auth = getAuth();
    const email = `${username.toLowerCase()}@8bitbistro.local`;
    const password = `${pin}-8bit`;

    try {
      await signInWithEmailAndPassword(auth, email, password);
      // onAuthStateChanged will handle the rest
      const loggedInUser: CustomUser = {
        username: username,
        displayName: username,
        photoURL: `https://picsum.photos/seed/${username}/100/100`,
        role: 'staff', // Temporary until onAuthStateChanged fetches the real role
      };
      await logUserLogin(loggedInUser);

      if (username.toLowerCase() === 'kaif') {
        await createAdminNotification(
          `<strong>Kaif</strong> has logged in.`,
          loggedInUser,
          'STAFF_LOGIN'
        );
      }
    } catch (error) {
      setLoading(false);
      throw new Error('Invalid PIN or user not found');
    }
  };

  /**
   * ATOMIC LOGOUT: Finds and ends ONLY THIS user's active shift.
   */
  const logout = async (totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number }, forceLogout?: boolean) => {
    if (user && (totals || forceLogout)) {
      try {
        const db = getFirestore();
        const q = query(
          collection(db, 'shifts'),
          where('staffId', '==', user.username),
          where('status', '==', 'active'),
          limit(1)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
          await endShift(snap.docs[0].id, user, totals, forceLogout);
        }
      } catch (error) {
        console.error("Atomic logout failed:", error);
      }
    }
    const auth = getAuth();
    await firebaseSignOut(auth);
    setUser(null);
  };

  const switchUser = async () => {
    const auth = getAuth();
    await firebaseSignOut(auth);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, switchUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === null) throw new Error('useAuth missing provider');
  return context;
};