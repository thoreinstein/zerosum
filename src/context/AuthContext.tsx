'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signInWithPopup, GoogleAuthProvider, signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { checkAndSeedColdStart } from '@/lib/coldStart';
import { useRouter } from 'next/navigation';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

const ColdStartManager = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      const selectedMonth = new Date().toISOString().slice(0, 7);
      void checkAndSeedColdStart(db, user.uid, selectedMonth).catch((error) => {
        console.error('Error during cold start seeding', error);
      });
    }
  }, [user]);

  return null;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        // Sync session cookie
        try {
          const idToken = await user.getIdToken();
          const res = await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
          
          if (res.ok) {
            router.refresh(); // Refresh middleware state
            // If we are on the login page, redirect to home now that session is synced
            if (window.location.pathname === '/login') {
              router.push('/');
            }
          } else {
            const data = await res.json().catch(() => ({}));
            console.error('Failed to sync session:', data.error || res.statusText);
            // If session sync fails, we might want to sign out or show a warning
          }
        } catch (error) {
          console.error('Network error during session sync:', error);
        }
      } else {
        // Clear session cookie
        try {
          await fetch('/api/auth/session', { method: 'DELETE' });
        } catch (error) {
          console.error('Failed to clear session:', error);
        }
      }

      setLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      // No longer redirecting here to avoid race with session cookie sync
    } catch (error) {
      console.error("Error signing in with Google", error);
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      try {
        await fetch('/api/auth/session', { method: 'DELETE' });
      } catch (error) {
        console.error('Failed to clear session during logout:', error);
      }
      router.push('/login');
    } catch (error) {
      console.error("Error signing out", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : (
        <>
          <ColdStartManager />
          {children}
        </>
      )}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
