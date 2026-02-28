'use client';
import { ReactNode } from 'react';
import { FirebaseProvider, initializeFirebase } from './provider';
import { AuthProvider } from './auth/use-user';

// This provider is used to wrap the app and ensures that Firebase is
// initialized only once.
export function FirebaseClientProvider({ children }: { children: ReactNode }) {
  const firebaseContext = initializeFirebase();
  return (
    <FirebaseProvider {...firebaseContext}>
      <AuthProvider>
        {children}
      </AuthProvider>
    </FirebaseProvider>
  );
}
