'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  signInWithPopup, 
  signOut as fbSignOut, 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  User as FirebaseUser
} from 'firebase/auth';
import { auth, googleProvider, isFirebaseConfigured, checkFirebaseConfigured } from '@/lib/firebase/client';
import { getUserSettings } from '@/lib/firebase/firestore';
import { UserProfile } from '@/types';

interface AuthContextType {
  user: UserProfile | null;
  loading: boolean;
  isFirebaseReady: boolean;
  twoFactorRequired: boolean;
  signInWithGoogle: () => Promise<void>;
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
    idToken?: string
  ) => {
    try {
      // Sync verified server session cookie
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            idToken,
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
    if (!checkFirebaseConfigured()) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          await loadProfile({
            uid: fbUser.uid,
            email: fbUser.email,
            displayName: fbUser.displayName,
            photoURL: fbUser.photoURL
          }, idToken);
        } catch (e) {
          console.error('Failed to get token on auth change:', e);
          setLoading(false);
        }
      } else {
        setUser(null);
        setPendingUser(null);
        setTwoFactorRequired(false);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    if (!checkFirebaseConfigured()) {
      throw new Error('FIREBASE_CONFIG_REQUIRED');
    }
    setLoading(true);
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

  const signInWithEmail = async (email: string, pass: string) => {
    if (!checkFirebaseConfigured()) {
      throw new Error('FIREBASE_CONFIG_REQUIRED');
    }
    setLoading(true);
    try {
      const res = await signInWithEmailAndPassword(auth, email, pass);
      const idToken = await res.user.getIdToken();
      await loadProfile({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL
      }, idToken);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, pass: string) => {
    if (!checkFirebaseConfigured()) {
      throw new Error('FIREBASE_CONFIG_REQUIRED');
    }
    setLoading(true);
    try {
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      const idToken = await res.user.getIdToken();
      await loadProfile({
        uid: res.user.uid,
        email: res.user.email,
        displayName: res.user.displayName,
        photoURL: res.user.photoURL
      }, idToken);
    } catch (error: any) {
      setLoading(false);
      throw error;
    }
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
    } catch (err) {
      console.error('Error verifying 2FA challenge:', err);
      return false;
    }
  };

  const signOut = async () => {
    try {
      await fetch('/api/auth/session', { method: 'DELETE' });
      if (checkFirebaseConfigured()) {
        await fbSignOut(auth);
      }
      setUser(null);
      setPendingUser(null);
      setTwoFactorRequired(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
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
