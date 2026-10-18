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
import { InfinityItem, InfinityCollection } from '@/types';
import { ExportData, ExportDataSchema } from '../validation/schemas';

// Helper for local storage simulation when Firebase credentials aren't active
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
  if (!isFirebaseConfigured) {
    return getLocalData<InfinityItem>(userId, 'items');
  }

  try {
    const colRef = collection(db, 'users', userId, 'items');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InfinityItem));
  } catch (error) {
    console.warn('Firestore fetch failed, falling back to local user store:', error);
    return getLocalData<InfinityItem>(userId, 'items');
  }
}

export async function saveItem(userId: string, item: InfinityItem): Promise<void> {
  const itemToSave = { ...item, userId, updatedAt: Date.now() };

  if (!isFirebaseConfigured) {
    const items = getLocalData<InfinityItem>(userId, 'items');
    const existingIndex = items.findIndex(i => i.id === item.id);
    if (existingIndex >= 0) {
      items[existingIndex] = itemToSave;
    } else {
      items.unshift(itemToSave);
    }
    setLocalData(userId, 'items', items);
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'items', item.id);
    await setDoc(docRef, itemToSave, { merge: true });
  } catch (error) {
    console.warn('Firestore write failed, saving to local user store:', error);
    const items = getLocalData<InfinityItem>(userId, 'items');
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = itemToSave;
    else items.unshift(itemToSave);
    setLocalData(userId, 'items', items);
  }
}

export async function updateItem(
  userId: string, 
  itemId: string, 
  updates: Partial<InfinityItem>
): Promise<void> {
  const mergedUpdates = { ...updates, updatedAt: Date.now() };

  if (!isFirebaseConfigured) {
    const items = getLocalData<InfinityItem>(userId, 'items');
    const idx = items.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...mergedUpdates };
      setLocalData(userId, 'items', items);
    }
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'items', itemId);
    await updateDoc(docRef, mergedUpdates);
  } catch (error) {
    console.warn('Firestore update failed, falling back:', error);
    const items = getLocalData<InfinityItem>(userId, 'items');
    const idx = items.findIndex(i => i.id === itemId);
    if (idx >= 0) {
      items[idx] = { ...items[idx], ...mergedUpdates };
      setLocalData(userId, 'items', items);
    }
  }
}

export async function moveItemToTrash(userId: string, itemId: string): Promise<void> {
  await updateItem(userId, itemId, {
    isTrash: true,
    trashedAt: Date.now(),
    isFavorite: false // Automatically unfavorite when sent to trash
  });
}

export async function restoreItemFromTrash(userId: string, itemId: string): Promise<void> {
  await updateItem(userId, itemId, {
    isTrash: false,
    trashedAt: null
  });
}

export async function permanentlyDeleteItem(userId: string, itemId: string): Promise<void> {
  if (!isFirebaseConfigured) {
    const items = getLocalData<InfinityItem>(userId, 'items');
    const filtered = items.filter(i => i.id !== itemId);
    setLocalData(userId, 'items', filtered);
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'items', itemId);
    await deleteDoc(docRef);
  } catch (error) {
    console.warn('Firestore delete failed:', error);
    const items = getLocalData<InfinityItem>(userId, 'items');
    setLocalData(userId, 'items', items.filter(i => i.id !== itemId));
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
  if (!isFirebaseConfigured) {
    return getLocalData<InfinityCollection>(userId, 'collections');
  }

  try {
    const colRef = collection(db, 'users', userId, 'collections');
    const snapshot = await getDocs(colRef);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InfinityCollection));
  } catch (error) {
    console.warn('Firestore collections fetch failed:', error);
    return getLocalData<InfinityCollection>(userId, 'collections');
  }
}

export async function saveCollection(userId: string, coll: InfinityCollection): Promise<void> {
  const toSave = { ...coll, userId, updatedAt: Date.now() };

  if (!isFirebaseConfigured) {
    const list = getLocalData<InfinityCollection>(userId, 'collections');
    const idx = list.findIndex(c => c.id === coll.id);
    if (idx >= 0) list[idx] = toSave;
    else list.push(toSave);
    setLocalData(userId, 'collections', list);
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'collections', coll.id);
    await setDoc(docRef, toSave, { merge: true });
  } catch (error) {
    const list = getLocalData<InfinityCollection>(userId, 'collections');
    const idx = list.findIndex(c => c.id === coll.id);
    if (idx >= 0) list[idx] = toSave;
    else list.push(toSave);
    setLocalData(userId, 'collections', list);
  }
}

/**
 * Deletes a collection SAFELY:
 * All items in that collection are updated to collectionId: null (unassigned)
 * so that no user files are ever deleted or lost accidentally!
 */
export async function deleteCollectionSafely(userId: string, collectionId: string): Promise<void> {
  // 1. Move associated items to null collection
  const items = await fetchUserItems(userId);
  const affected = items.filter(i => i.collectionId === collectionId);
  for (const item of affected) {
    await updateItem(userId, item.id, { collectionId: null });
  }

  // 2. Delete collection document
  if (!isFirebaseConfigured) {
    const list = getLocalData<InfinityCollection>(userId, 'collections');
    setLocalData(userId, 'collections', list.filter(c => c.id !== collectionId));
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'collections', collectionId);
    await deleteDoc(docRef);
  } catch (error) {
    const list = getLocalData<InfinityCollection>(userId, 'collections');
    setLocalData(userId, 'collections', list.filter(c => c.id !== collectionId));
  }
}

// User Settings (TOTP, Notion token, etc.)
export async function getUserSettings(userId: string): Promise<Record<string, any>> {
  if (!isFirebaseConfigured) {
    if (typeof localStorage === 'undefined') return {};
    try {
      const data = localStorage.getItem(`infinity_${userId}_settings`);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config');
    const snap = await getDoc(docRef);
    return snap.exists() ? snap.data() : {};
  } catch {
    return {};
  }
}

export async function saveUserSettings(userId: string, settings: Record<string, any>): Promise<void> {
  if (!isFirebaseConfigured) {
    if (typeof localStorage === 'undefined') return;
    try {
      const current = await getUserSettings(userId);
      localStorage.setItem(`infinity_${userId}_settings`, JSON.stringify({ ...current, ...settings }));
    } catch (err) {
      console.error(err);
    }
    return;
  }

  try {
    const docRef = doc(db, 'users', userId, 'settings', 'config');
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.error('Error saving settings:', err);
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
      // Clear current
      const currentItems = await fetchUserItems(userId);
      for (const i of currentItems) {
        await permanentlyDeleteItem(userId, i.id);
      }
      const currentColls = await fetchUserCollections(userId);
      for (const c of currentColls) {
        await deleteCollectionSafely(userId, c.id);
      }
    }

    // Save collections
    for (const coll of validated.collections) {
      await saveCollection(userId, { ...coll, userId });
    }

    // Save items
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
