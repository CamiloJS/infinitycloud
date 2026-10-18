import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';

export interface FirebaseClientConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId: string;
}

export function getSavedFirebaseConfig(): FirebaseClientConfig | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('infinity_custom_firebase_config');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed.apiKey && parsed.projectId) return parsed;
      } catch (e) {}
    }
  }

  const envKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const envProject = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (envKey && envProject && envKey !== 'demo-api-key' && envKey !== '') {
    return {
      apiKey: envKey,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || `${envProject}.firebaseapp.com`,
      projectId: envProject,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || ''
    };
  }

  return null;
}

export const isFirebaseConfigured: boolean = Boolean(
  (process.env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== 'demo-api-key' &&
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY !== '') ||
  (typeof window !== 'undefined' && localStorage.getItem('infinity_custom_firebase_config'))
);

export function checkFirebaseConfigured(): boolean {
  return getSavedFirebaseConfig() !== null;
}

export function saveFirebaseConfig(config: FirebaseClientConfig) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('infinity_custom_firebase_config', JSON.stringify(config));
    window.location.reload();
  }
}

const currentConfig = getSavedFirebaseConfig() || {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'infinity-demo.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'infinity-demo',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'infinity-demo.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:abcdef'
};

const app: FirebaseApp = !getApps().length ? initializeApp(currentConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export { app, auth, db };
