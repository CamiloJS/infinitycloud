import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';

export const isFirebaseAdminConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

try {
  const currentApps = getApps();
  if (currentApps.length > 0) {
    adminApp = currentApps[0]!;
  } else if (isFirebaseAdminConfigured) {
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
    adminApp = initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey,
      }),
    });
  }

  if (adminApp) {
    adminAuth = getAuth(adminApp);
    adminDb = getFirestore(adminApp);
  }
} catch (e) {
  console.warn('Firebase Admin safe initialization deferred/warning:', e);
}

export { adminApp, adminAuth, adminDb };
