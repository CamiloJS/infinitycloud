'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured } from '@/lib/firebase/client';
import { getUserSettings } from '@/lib/firebase/firestore';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isFirebaseReady: boolean;
  twoFactorRequired: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithDemoUser: (userNum: 1 | 2) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  verifyTwoFactorChallenge: (code: string, isBackup: boolean) => Promise<boolean>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [twoFactorRequired, setTwoFactorRequired] = useState<boolean>(false);
  const [pendingUser, setPendingUser] = useState<UserProfile | null>(null);

  // Load user profile & 2FA status
  const loadProfile = async (
    rawUser: { uid: string; email?: string | null; displayName?: string | null; photoURL?: string | null },
    idToken?: string,
    demoNum?: 1 | 2
  ) => {
    try {
      // Sync verified server session cookie
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
            demoUserNum: demoNum,
            uid: rawUser.uid,
            email: rawUser.email
          })
        });
      } catch (sessionErr) {
        console.warn('Session sync warning:', sessionErr);
      }

      const settings = await getUserSettings(rawUser.uid);
      const is2fa = Boolean(settings.twoFactorEnabled);

      const profile: UserProfile = {
        uid: rawUser.uid,
        email: rawUser.email || null,
        displayName: rawUser.displayName || rawUser.email?.split('@')[0] || 'Usuario',
        photoURL: rawUser.photoURL || null,
        twoFactorEnabled: is2fa,
        createdAt: settings.createdAt || Date.now(),
        notionConnected: Boolean(settings.notionConnected),
        notionWorkspaceName: settings.notionBotName
      };

      if (is2fa) {
        setPendingUser(profile);
        setTwoFactorRequired(true);
      } else {
        setUser(profile);
        setTwoFactorRequired(false);
      }
    } catch (err) {
      console.error('Error loading profile:', err);
      setUser({
        uid: rawUser.uid,
        email: rawUser.email || null,
        displayName: rawUser.displayName || 'Usuario',
        photoURL: rawUser.photoURL || null,
        twoFactorEnabled: false,
        createdAt: Date.now()
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // If demo user is stored in session
    const savedDemo = sessionStorage.getItem('infinity_demo_user');
    if (savedDemo) {
      try {
        const parsed = JSON.parse(savedDemo);
        loadProfile(parsed);
        return;
      } catch {
        // ignore
      }
    }

    if (isFirebaseConfigured) {
      const unsubscribe = onAuthStateChanged(auth, (fbUser) => {
        if (fbUser) {
          loadProfile({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL
          });
        } else {
          setUser(null);
          setTwoFactorRequired(false);
          setLoading(false);
        }
      });
      return () => unsubscribe();
    } else {
      // In demo/test mode with no Firebase keys, default to ready
      setLoading(false);
    }
  }, []);

  const signInWithGoogle = async () => {
    setLoading(true);
    if (!isFirebaseConfigured) {
      // Demo user 1
      await signInWithDemoUser(1);
      return;
    }
    try {
      const res = await signInWithPopup(auth, googleProvider);
      const idToken = await res.user.getIdToken();
      await loadProfile({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL
      }, idToken);
    } catch (error: any) {
      console.error('Google sign in error:', error);
      setLoading(false);
      throw error;
    }
  };

  const signInWithDemoUser = async (userNum: 1 | 2) => {
    setLoading(true);
    const demoProfile = userNum === 1 ? {
      uid: 'demo_user_alpha_1',
      email: 'camilo@infinity.dev',
      displayName: 'Camilo Jaimes',
      photoURL: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80'
    } : {
      uid: 'demo_user_beta_2',
      email: 'test.account@infinity.dev',
      displayName: 'Cuenta de Prueba 2',
      photoURL: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&auto=format&fit=crop&q=80'
    };

    sessionStorage.setItem('infinity_demo_user', JSON.stringify(demoProfile));
    await loadProfile(demoProfile, undefined, userNum);
  };

  const signInWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    if (!isFirebaseConfigured) {
      await signInWithDemoUser(1);
      return;
    }
    const res = await signInWithEmailAndPassword(auth, email, pass);
    const idToken = await res.user.getIdToken();
    await loadProfile({
      uid: res.user.uid,
      email: res.user.email,
      displayName: res.user.displayName,
      photoURL: res.user.photoURL
    }, idToken);
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    setLoading(true);
    if (!isFirebaseConfigured) {
      await signInWithDemoUser(1);
      return;
    }
    const res = await createUserWithEmailAndPassword(auth, email, pass);
    const idToken = await res.user.getIdToken();
    await loadProfile({
      uid: res.user.uid,
      email: res.user.email,
      displayName: res.user.displayName,
      photoURL: res.user.photoURL
    }, idToken);
  };

  const verifyTwoFactorChallenge = async (code: string, isBackup: boolean): Promise<boolean> => {
    if (!pendingUser) return false;
    try {
      const res = await fetch('/api/auth/2fa/challenge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: pendingUser.uid,
          code,
          isBackupCode: isBackup
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setUser(pendingUser);
        setPendingUser(null);
        setTwoFactorRequired(false);
        return true;
      }
      return false;
    } catch {
      return false;
    }
  };

  const signOut = async () => {
    setLoading(true);
    sessionStorage.removeItem('infinity_demo_user');
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
    } catch (e) {
      console.warn('Session delete error:', e);
    }
    if (isFirebaseConfigured) {
      await fbSignOut(auth);
    }
    setUser(null);
    setPendingUser(null);
    setTwoFactorRequired(false);
    setLoading(false);
  };

  const refreshProfile = async () => {
    if (user) {
      await loadProfile(user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isFirebaseReady: isFirebaseConfigured,
        twoFactorRequired,
        signInWithGoogle,
        signInWithDemoUser,
        signInWithEmail,
        signUpWithEmail,
        verifyTwoFactorChallenge,
        signOut,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
