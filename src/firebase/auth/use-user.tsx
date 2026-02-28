
'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { logUserLogin } from '@/firebase/firestore/logs';
import { getFirestore, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { endShift } from '../firestore/shifts';
import { createAdminNotification } from '../firestore/notifications';
import type { Shift, ShiftTask } from '@/lib/types';

// Define a user type for our custom auth
export interface CustomUser {
  username: string;
  displayName: string;
  photoURL: string;
  role: 'admin' | 'staff' | 'guest';
}

interface AuthContextType {
  user: CustomUser | null;
  loading: boolean;
  login: (username: 'Viren' | 'Abbas' | 'Guest') => Promise<void>;
  logout: (totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number }, forceLogout?: boolean) => Promise<void>;
  switchUser: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<CustomUser | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    // Check if user is stored in session storage on component mount
    const storedUser = sessionStorage.getItem('user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);


  const login = async (username: 'Viren' | 'Abbas' | 'Guest') => {
    setLoading(true);
    let loggedInUser: CustomUser | null = null;

    if (username === 'Viren') {
        loggedInUser = { 
            username: 'Viren',
            displayName: 'Viren',
            photoURL: 'https://picsum.photos/seed/viren/100/100',
            role: 'admin',
        };
    } else if (username === 'Abbas') {
        loggedInUser = {
            username: 'Abbas',
            displayName: 'Abbas',
            photoURL: 'https://picsum.photos/seed/abbas/100/100',
            role: 'staff',
        };
    } else if (username === 'Guest') {
        loggedInUser = {
            username: 'Guest',
            displayName: 'Guest',
            photoURL: 'https://picsum.photos/seed/guest/100/100',
            role: 'guest',
        };
    }

    if (loggedInUser) {
      sessionStorage.setItem('user', JSON.stringify(loggedInUser));
      setUser(loggedInUser);
      await logUserLogin(loggedInUser);
      setLoading(false);
    } else {
      setLoading(false);
      throw new Error('Invalid user selected');
    }
  };

  const logout = async (totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number; }, forceLogout?: boolean) => {
    if (user && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest')) {
      try {
        const db = getFirestore();
        const today = new Date().toISOString().split('T')[0];
        const q = query(
          collection(db, 'shifts'),
          where('endTime', '==', null),
          limit(1)
        );
        const activeShiftSnapshot = await getDocs(q);

        if (!activeShiftSnapshot.empty) {
          const activeShiftDoc = activeShiftSnapshot.docs[0];
          // Pass forceLogout flag to endShift so it can handle the notification logic
          await endShift(activeShiftDoc.id, user, totals, forceLogout);
        }
      } catch (error) {
        console.error("Could not end active shift on logout:", error);
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
  if (context === null) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Keep useUser for compatibility if other parts of the app use it,
// but it will now use the custom AuthContext.
export const useUser = () => {
    const { user, loading } = useAuth();
    return { user, loading };
}
