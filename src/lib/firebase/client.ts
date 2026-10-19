import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
  measurementId?: string;
}

// User's official infinitycloud-da745 project configuration
export const defaultFirebaseConfig: FirebaseClientConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyCoBSB-DYzhNJWuPltE8A7SKsMRHvZcV2c",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "infinitycloud-da745.firebaseapp.com",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "infinitycloud-da745",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "infinitycloud-da745.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "787257854886",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:787257854886:web:af878c079f82994c765d67",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-8C1JKT9WVN"
};

export function getSavedFirebaseConfig(): FirebaseClientConfig {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('infinity_custom_firebase_config');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.apiKey && parsed.projectId) return parsed;
      } catch (e) {}
    }
  }
  return defaultFirebaseConfig;
}

export const isFirebaseConfigured: boolean = true;

export function checkFirebaseConfigured(): boolean {
  const cfg = getSavedFirebaseConfig();
  return Boolean(cfg.apiKey && cfg.projectId && cfg.apiKey.startsWith('AIzaSy'));
}

export function saveFirebaseConfig(config: FirebaseClientConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('infinity_custom_firebase_config', JSON.stringify(config));
    window.location.reload();
  }
}

const currentConfig = getSavedFirebaseConfig();

const app: FirebaseApp = !getApps().length ? initializeApp(currentConfig) : getApp();
const auth: Auth = getAuth(app);

let db: Firestore;
try {
  db = initializeFirestore(app, {
    ignoreUndefinedProperties: true
  });
} catch {
  db = getFirestore(app);
}

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db };
