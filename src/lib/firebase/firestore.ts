import { 
  collection, 
  doc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDoc
} from 'firebase/firestore';
import { db, isFirebaseConfigured } from './client';
import { InfinityItem, InfinityCollection, PublicSharedFolder } from '@/types';
import { ExportData, ExportDataSchema } from '../validation/schemas';

const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
const isFirestoreActive = isFirebaseConfigured && !isTestEnv;

/**
 * Deep sanitization for Firestore:
 * Strips any undefined fields and replaces invalid structures so Firestore never throws
 * "Unsupported field value: undefined"
 */
export function sanitizeForFirestore<T>(data: T): T {
  if (data === null || data === undefined) {
    return null as any;
  }
  if (Array.isArray(data)) {
    return data.map(item => sanitizeForFirestore(item)) as any;
  }
  if (typeof data === 'object') {
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(data as Record<string, any>)) {
      if (val !== undefined) {
        clean[key] = sanitizeForFirestore(val);
      }
    }
    return clean as T;
  }
  return data;
}

// Helper for local storage persistence
function getLocalKey(userId: string, type: string) {
  return `infinity_${userId}_${type}`;
}

function getLocalData<T>(userId: string, type: string): T[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const data = localStorage.getItem(getLocalKey(userId, type));
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

function setLocalData<T>(userId: string, type: string, data: T[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(getLocalKey(userId, type), JSON.stringify(data));
  } catch (err) {
    console.error('Error saving local data:', err);
  }
}

export async function fetchUserItems(userId: string): Promise<InfinityItem[]> {
  const localItems = getLocalData<InfinityItem>(userId, 'items');

  if (!isFirestoreActive) {
    return localItems;
  }

  try {
    const colRef = collection(db, 'users', userId, 'items');
    const snapshot = await getDocs(colRef);
    const firestoreItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InfinityItem));

    if (firestoreItems.length > 0) {
      // Merge with any local items that haven't synced yet
      const firestoreIds = new Set(firestoreItems.map(i => i.id));
      const pendingLocal = localItems.filter(i => !firestoreIds.has(i.id));

      if (pendingLocal.length > 0) {
        // Sync pending local items up to Firestore in background
        for (const item of pendingLocal) {
          try {
            const docRef = doc(db, 'users', userId, 'items', item.id);
            await setDoc(docRef, sanitizeForFirestore(item), { merge: true });
          } catch (e) {
            console.warn('Sync pending item to firestore error:', e);
          }
        }
      }

      const allItems = [...firestoreItems, ...pendingLocal].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setLocalData(userId, 'items', allItems);
      return allItems;
    } else if (localItems.length > 0) {
      // Firestore had 0 items, but local cache has items! Auto-recover and sync to Firestore
      for (const item of localItems) {
        try {
          const docRef = doc(db, 'users', userId, 'items', item.id);
          await setDoc(docRef, sanitizeForFirestore(item), { merge: true });
        } catch (e) {
          console.warn('Recovery save to firestore error:', e);
        }
      }
      return localItems;
    }

    return [];
  } catch (error) {
    console.warn('Firestore fetch failed, falling back to local user store:', error);
    return localItems;
  }
}

export async function saveItem(userId: string, item: InfinityItem): Promise<void> {
  const cleanItem = sanitizeForFirestore<InfinityItem>({
    ...item,
    userId,
    updatedAt: Date.now()
  });

  // 1. Always update local storage first so data is instantly preserved
  const items = getLocalData<InfinityItem>(userId, 'items');
  const existingIndex = items.findIndex(i => i.id === cleanItem.id);
  if (existingIndex >= 0) {
    items[existingIndex] = cleanItem;
  } else {
    items.unshift(cleanItem);
  }
  setLocalData(userId, 'items', items);

  // 2. Persist to Firestore
  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'items', cleanItem.id);
      await setDoc(docRef, cleanItem, { merge: true });
    } catch (error) {
      console.warn('Firestore write failed, kept in local store:', error);
    }
  }

  // 3. Keep shared folder in sync if item belongs to a shared collection
  if (cleanItem.collectionId) {
    await syncCollectionIfShared(userId, cleanItem.collectionId);
  }
}

export async function syncCollectionIfShared(userId: string, collectionId: string | null | undefined): Promise<void> {
  if (!collectionId) return;
  try {
    const colls = await fetchUserCollections(userId);
    const targetColl = colls.find(c => c.id === collectionId);
    if (targetColl?.isShared) {
      await syncSharedFolder(userId, targetColl);
    }
  } catch (e) {
    console.warn('Error auto-syncing shared collection:', e);
  }
}

export async function updateItem(
  userId: string, 
  itemId: string, 
  updates: Partial<InfinityItem>
): Promise<void> {
  const cleanUpdates = sanitizeForFirestore({
    ...updates,
    updatedAt: Date.now()
  });

  // 1. Update local storage
  const items = getLocalData<InfinityItem>(userId, 'items');
  const idx = items.findIndex(i => i.id === itemId);
  let oldCollectionId: string | null | undefined = undefined;
  if (idx >= 0) {
    oldCollectionId = items[idx].collectionId;
    items[idx] = { ...items[idx], ...cleanUpdates };
    setLocalData(userId, 'items', items);
  }

  // 2. Update Firestore
  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'items', itemId);
      await updateDoc(docRef, cleanUpdates);
    } catch (error) {
      console.warn('Firestore update failed, kept in local store:', error);
    }
  }

  // 3. Keep shared folder in sync if collection was affected
  if (cleanUpdates.collectionId !== undefined && cleanUpdates.collectionId !== oldCollectionId) {
    await syncCollectionIfShared(userId, oldCollectionId);
    await syncCollectionIfShared(userId, cleanUpdates.collectionId);
  } else if (oldCollectionId) {
    await syncCollectionIfShared(userId, oldCollectionId);
  }
}

export async function moveItemToTrash(userId: string, itemId: string): Promise<void> {
  const items = getLocalData<InfinityItem>(userId, 'items');
  const target = items.find(i => i.id === itemId);
  await updateItem(userId, itemId, {
    isTrash: true,
    trashedAt: Date.now(),
    isFavorite: false
  });
  if (target?.collectionId) {
    await syncCollectionIfShared(userId, target.collectionId);
  }
}

export async function restoreItemFromTrash(userId: string, itemId: string): Promise<void> {
  const items = getLocalData<InfinityItem>(userId, 'items');
  const target = items.find(i => i.id === itemId);
  await updateItem(userId, itemId, {
    isTrash: false,
    trashedAt: null
  });
  if (target?.collectionId) {
    await syncCollectionIfShared(userId, target.collectionId);
  }
}

export async function permanentlyDeleteItem(userId: string, itemId: string): Promise<void> {
  // 1. Remove from local store
  const items = getLocalData<InfinityItem>(userId, 'items');
  const target = items.find(i => i.id === itemId);
  setLocalData(userId, 'items', items.filter(i => i.id !== itemId));

  // 2. Remove from Firestore
  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'items', itemId);
      await deleteDoc(docRef);
    } catch (error) {
      console.warn('Firestore delete failed:', error);
    }
  }

  // 3. Keep shared folder in sync
  if (target?.collectionId) {
    await syncCollectionIfShared(userId, target.collectionId);
  }
}

export async function emptyTrash(userId: string): Promise<void> {
  const items = await fetchUserItems(userId);
  const trashed = items.filter(i => i.isTrash);
  
  for (const item of trashed) {
    await permanentlyDeleteItem(userId, item.id);
  }
}

// Collections
export async function fetchUserCollections(userId: string): Promise<InfinityCollection[]> {
  const localColls = getLocalData<InfinityCollection>(userId, 'collections');

  if (!isFirestoreActive) {
    return localColls;
  }

  try {
    const colRef = collection(db, 'users', userId, 'collections');
    const snapshot = await getDocs(colRef);
    const firestoreColls = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InfinityCollection));

    if (firestoreColls.length > 0) {
      const firestoreIds = new Set(firestoreColls.map(c => c.id));
      const pendingLocal = localColls.filter(c => !firestoreIds.has(c.id));

      if (pendingLocal.length > 0) {
        for (const coll of pendingLocal) {
          try {
            const docRef = doc(db, 'users', userId, 'collections', coll.id);
            await setDoc(docRef, sanitizeForFirestore(coll), { merge: true });
          } catch (e) {
            console.warn('Sync pending collection error:', e);
          }
        }
      }

      const allColls = [...firestoreColls, ...pendingLocal];
      setLocalData(userId, 'collections', allColls);
      return allColls;
    } else if (localColls.length > 0) {
      for (const coll of localColls) {
        try {
          const docRef = doc(db, 'users', userId, 'collections', coll.id);
          await setDoc(docRef, sanitizeForFirestore(coll), { merge: true });
        } catch (e) {
          console.warn('Recovery collection save to firestore error:', e);
        }
      }
      return localColls;
    }

    return [];
  } catch (error) {
    console.warn('Firestore collections fetch failed:', error);
    return localColls;
  }
}

export async function saveCollection(userId: string, coll: InfinityCollection): Promise<void> {
  const cleanColl = sanitizeForFirestore<InfinityCollection>({
    ...coll,
    userId,
    updatedAt: Date.now()
  });

  const list = getLocalData<InfinityCollection>(userId, 'collections');
  const idx = list.findIndex(c => c.id === cleanColl.id);
  if (idx >= 0) list[idx] = cleanColl;
  else list.push(cleanColl);
  setLocalData(userId, 'collections', list);

  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'collections', cleanColl.id);
      await setDoc(docRef, cleanColl, { merge: true });
    } catch (e) {
      console.warn('Firestore collection write error:', e);
    }
  }

  // Keep public share in sync if shared or unshared
  try {
    await syncSharedFolder(userId, cleanColl);
  } catch (e) {
    console.warn('Error syncing shared folder:', e);
  }
}

/**
 * Deletes a collection SAFELY:
 * All items in that collection are updated to collectionId: null (unassigned)
 * so that no user files are ever deleted or lost accidentally!
 */
export async function deleteCollectionSafely(userId: string, collectionId: string): Promise<void> {
  const items = await fetchUserItems(userId);
  const affected = items.filter(i => i.collectionId === collectionId);
  for (const item of affected) {
    await updateItem(userId, item.id, { collectionId: null });
  }

  const list = getLocalData<InfinityCollection>(userId, 'collections');
  const targetColl = list.find(c => c.id === collectionId);
  setLocalData(userId, 'collections', list.filter(c => c.id !== collectionId));

  if (targetColl?.isShared) {
    await syncSharedFolder(userId, { ...targetColl, isShared: false });
  }

  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'collections', collectionId);
      await deleteDoc(docRef);
    } catch (e) {
      console.warn('Firestore collection delete error:', e);
    }
  }
}

// User Settings (TOTP, Notion token, etc.)
export async function getUserSettings(userId: string): Promise<Record<string, any>> {
  const localSettings = (() => {
    if (typeof localStorage === 'undefined') return {};
    try {
      const data = localStorage.getItem(`infinity_${userId}_settings`);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  })();

  if (!isFirestoreActive) {
    return localSettings;
  }

  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data();
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`infinity_${userId}_settings`, JSON.stringify(data));
      }
      return data;
    }
    return localSettings;
  } catch {
    return localSettings;
  }
}

export async function saveUserSettings(userId: string, settings: Record<string, any>): Promise<void> {
  const cleanSettings = sanitizeForFirestore(settings);

  if (typeof localStorage !== 'undefined') {
    try {
      const current = await getUserSettings(userId);
      localStorage.setItem(`infinity_${userId}_settings`, JSON.stringify({ ...current, ...cleanSettings }));
    } catch (err) {
      console.error(err);
    }
  }

  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'users', userId, 'settings', 'config');
      await setDoc(docRef, cleanSettings, { merge: true });
    } catch (err) {
      console.error('Error saving settings to firestore:', err);
    }
  }
}

// Export / Import
export async function exportUserData(userId: string): Promise<ExportData> {
  const items = await fetchUserItems(userId);
  const collections = await fetchUserCollections(userId);

  return {
    version: 1,
    exportedAt: Date.now(),
    source: 'infinity',
    collections,
    items
  };
}

export async function importUserData(
  userId: string,
  rawJsonString: string,
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; importedItemsCount: number; importedCollectionsCount: number; message: string }> {
  try {
    const parsed = JSON.parse(rawJsonString);
    const validated = ExportDataSchema.parse(parsed);

    if (mode === 'replace') {
      const currentItems = await fetchUserItems(userId);
      for (const i of currentItems) {
        await permanentlyDeleteItem(userId, i.id);
      }
      const currentColls = await fetchUserCollections(userId);
      for (const c of currentColls) {
        await deleteCollectionSafely(userId, c.id);
      }
    }

    for (const coll of validated.collections) {
      await saveCollection(userId, { ...coll, userId });
    }

    for (const item of validated.items) {
      await saveItem(userId, { ...item, userId });
    }

    return {
      success: true,
      importedItemsCount: validated.items.length,
      importedCollectionsCount: validated.collections.length,
      message: `Importados con éxito ${validated.items.length} archivos y ${validated.collections.length} colecciones.`
    };
  } catch (err: any) {
    return {
      success: false,
      importedItemsCount: 0,
      importedCollectionsCount: 0,
      message: err.message || 'El archivo JSON no tiene un formato válido para Infinity.'
    };
  }
}

// ==========================================
// CARPETAS COMPARTIDAS PÚBLICAMENTE
// ==========================================

export async function syncSharedFolder(userId: string, coll: InfinityCollection): Promise<void> {
  const publicShareKey = `infinity_public_share_${coll.id}`;

  if (!coll.isShared) {
    // Unshare: remove from local cache and firestore
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(publicShareKey);
    }
    if (isFirestoreActive) {
      try {
        const shareRef = doc(db, 'public_shares', coll.id);
        await deleteDoc(shareRef);
      } catch (e) {
        console.warn('Error removing public share:', e);
      }
    }
    return;
  }

  // Fetch active items inside this collection
  const items = await fetchUserItems(userId);
  const collectionItems = items
    .filter(i => !i.isTrash && i.collectionId === coll.id)
    .map(i => ({
      ...i,
      // Retain passwordHash for client verification in PasswordUnlockModal
      passwordHash: i.passwordHash || undefined
    }));

  const publicData: PublicSharedFolder = {
    id: coll.id,
    userId,
    name: coll.name,
    description: coll.description || '',
    color: coll.color || '#8b5cf6',
    itemCount: collectionItems.length,
    isShared: true,
    isProtected: Boolean(coll.sharePasswordHash),
    requiresPassword: Boolean(coll.sharePasswordHash),
    items: coll.sharePasswordHash ? [] : collectionItems,
    updatedAt: Date.now()
  };

  // If protected, store sanitized public record in firestore, with hash only for verification
  const firestorePayload = sanitizeForFirestore<any>({
    ...publicData,
    sharePasswordHash: coll.sharePasswordHash || undefined,
    // Store full items in firestore doc so verified visitors can access them
    securedItems: coll.sharePasswordHash ? collectionItems : undefined
  });

  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem(publicShareKey, JSON.stringify({
        ...publicData,
        sharePasswordHash: coll.sharePasswordHash,
        securedItems: coll.sharePasswordHash ? collectionItems : undefined
      }));
    } catch (e) {
      console.warn('Error saving local public share:', e);
    }
  }

  if (isFirestoreActive) {
    try {
      const shareRef = doc(db, 'public_shares', coll.id);
      await setDoc(shareRef, firestorePayload, { merge: true });
    } catch (e) {
      console.warn('Error saving public share to firestore:', e);
    }
  }
}

export async function fetchPublicFolder(
  collectionId: string, 
  passwordAttemptHash?: string
): Promise<PublicSharedFolder | null> {
  let shareDoc: any = null;

  // 1. Try Firestore first
  if (isFirestoreActive) {
    try {
      const docRef = doc(db, 'public_shares', collectionId);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        shareDoc = snapshot.data();
      }
    } catch (e) {
      console.warn('Error fetching public share from Firestore:', e);
    }
  }

  // 2. Fallback to localStorage
  if (!shareDoc && typeof localStorage !== 'undefined') {
    try {
      const raw = localStorage.getItem(`infinity_public_share_${collectionId}`);
      if (raw) shareDoc = JSON.parse(raw);
    } catch (e) {}
  }

  if (!shareDoc || !shareDoc.isShared) {
    return null;
  }

  const isProtected = Boolean(shareDoc.sharePasswordHash);

  if (isProtected) {
    if (!passwordAttemptHash || passwordAttemptHash !== shareDoc.sharePasswordHash) {
      // Return metadata without items
      return {
        id: shareDoc.id || collectionId,
        userId: shareDoc.userId,
        name: shareDoc.name || 'Carpeta Compartida',
        description: shareDoc.description || '',
        color: shareDoc.color || '#8b5cf6',
        itemCount: shareDoc.itemCount || 0,
        isShared: true,
        isProtected: true,
        requiresPassword: true,
        items: [],
        updatedAt: shareDoc.updatedAt || Date.now()
      };
    }

    // Password verified! Return items
    return {
      id: shareDoc.id || collectionId,
      userId: shareDoc.userId,
      name: shareDoc.name || 'Carpeta Compartida',
      description: shareDoc.description || '',
      color: shareDoc.color || '#8b5cf6',
      itemCount: shareDoc.itemCount || (shareDoc.securedItems?.length ?? 0),
      isShared: true,
      isProtected: true,
      requiresPassword: false,
      items: shareDoc.securedItems || shareDoc.items || [],
      updatedAt: shareDoc.updatedAt || Date.now()
    };
  }

  // Public unshielded folder
  return {
    id: shareDoc.id || collectionId,
    userId: shareDoc.userId,
    name: shareDoc.name || 'Carpeta Compartida',
    description: shareDoc.description || '',
    color: shareDoc.color || '#8b5cf6',
    itemCount: shareDoc.itemCount || (shareDoc.items?.length ?? 0),
    isShared: true,
    isProtected: false,
    requiresPassword: false,
    items: shareDoc.items || [],
    updatedAt: shareDoc.updatedAt || Date.now()
  };
}
