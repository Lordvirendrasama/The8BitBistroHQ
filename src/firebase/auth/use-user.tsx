
'use client';
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { logUserLogin } from '@/firebase/firestore/logs';
import { getFirestore, collection, query, where, getDocs, limit, doc, setDoc } from 'firebase/firestore';
import { endShift } from '../firestore/shifts';
import type { Employee } from '@/lib/types';

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
  login: (username: string, pin: string) => Promise<void>;
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

  // Initialization Seed: Ensure base users exist in DB if not present
  useEffect(() => {
    const seed = async () => {
        const db = getFirestore();
        const empsRef = collection(db, 'employees');
        const q = query(empsRef, limit(1));
        const snap = await getDocs(q);
        
        if (snap.empty) {
            console.log("Seeding initial employees...");
            const initial = [
                { username: 'Viren', displayName: 'Viren', role: 'admin', pin: '6969', salary: 0, salaryType: 'monthly', weekOffDay: 5, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/viren/100/100' },
                { username: 'Abbas', displayName: 'Abbas', role: 'staff', pin: '8888', salary: 100, salaryType: 'hourly', weekOffDay: 5, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/abbas/100/100' },
                { username: 'Guest', displayName: 'Guest', role: 'guest', pin: '1234', salary: 0, salaryType: 'hourly', weekOffDay: 0, joinDate: new Date().toISOString(), isActive: true, photoURL: 'https://picsum.photos/seed/guest/100/100' }
            ];
            for (const emp of initial) {
                // Use username as the ID to avoid duplicates and ensure consistency
                const empDocRef = doc(db, 'employees', emp.username);
                await setDoc(empDocRef, emp);
            }
        }
    };
    seed();
  }, []);


  const login = async (username: string, pin: string) => {
    setLoading(true);
    const db = getFirestore();
    const empsRef = collection(db, 'employees');
    const q = query(empsRef, where('username', '==', username), where('isActive', '==', true), limit(1));
    const snap = await getDocs(q);

    if (snap.empty) {
        setLoading(false);
        throw new Error('User not found or inactive');
    }

    const empData = snap.docs[0].data() as Employee;
    
    if (empData.pin !== pin) {
        setLoading(false);
        throw new Error('Invalid PIN');
    }

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

  const logout = async (totals?: { cashTotal: number; upiTotal: number; shiftExpenses: number; }, forceLogout?: boolean) => {
    if (user && (user.role === 'staff' || user.role === 'admin' || user.role === 'guest')) {
      try {
        const db = getFirestore();
        const q = query(
          collection(db, 'shifts'),
          where('endTime', '==', null),
          limit(1)
        );
        const activeShiftSnapshot = await getDocs(q);

        if (!activeShiftSnapshot.empty) {
          const activeShiftDoc = activeShiftSnapshot.docs[0];
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
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const useUser = () => {
    const { user, loading } = useAuth();
    return { user, loading };
}
