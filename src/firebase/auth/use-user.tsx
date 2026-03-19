'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { logUserLogin } from '@/firebase/firestore/logs';
import { getFirestore, collection, query, where, getDocs, limit, doc, setDoc } from 'firebase/firestore';
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
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    setLoading(false);
  }, []);

  const login = async (username: string, pin: string) => {
    setLoading(true);
    const db = getFirestore();
    const empsRef = collection(db, 'employees');
    const q = query(empsRef, where('username', '==', username), where('isActive', '==', true), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) { setLoading(false); throw new Error('User inactive'); }
    const empData = snap.docs[0].data() as Employee;
    if (empData.pin !== pin) { setLoading(false); throw new Error('Invalid PIN'); }

    const loggedInUser: CustomUser = {
        username: empData.username,
        displayName: empData.displayName,
        photoURL: empData.photoURL || `https://picsum.photos/seed/${empData.username}/100/100`,
        role: empData.role,
    };

    sessionStorage.setItem('user', JSON.stringify(loggedInUser));
    setUser(loggedInUser);
    await logUserLogin(loggedInUser);
    setLoading(false);
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
    sessionStorage.removeItem('user');
    setUser(null);
  };

  const switchUser = () => {
    sessionStorage.removeItem('user');
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