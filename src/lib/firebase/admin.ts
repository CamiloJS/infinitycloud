export const isFirebaseAdminConfigured = Boolean(
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
);

export async function getAdminAuth() {
  if (!isFirebaseAdminConfigured) return null;
  try {
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getAuth } = await import('firebase-admin/auth');
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
    return getAuth(app);
  } catch (err) {
    console.warn('getAdminAuth dynamic import failed:', err);
    return null;
  }
}

export async function getAdminDb() {
  if (!isFirebaseAdminConfigured) return null;
  try {
    const { getApps, initializeApp, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const apps = getApps();
    const app = apps.length > 0 ? apps[0] : initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
      }),
    });
    return getFirestore(app);
  } catch (err) {
    console.warn('getAdminDb dynamic import failed:', err);
    return null;
  }
}

// Fallback exports for backward compatibility
export const adminApp: any = null;
export const adminAuth: any = null;
export const adminDb: any = null;
