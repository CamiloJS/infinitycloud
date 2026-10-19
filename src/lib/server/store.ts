import fs from 'fs';
import path from 'path';
import { adminDb, isFirebaseAdminConfigured } from '@/lib/firebase/admin';
import { InfinityItem, InfinityCollection } from '@/types';

const DATA_FILE_PATH = path.join(process.cwd(), '.server_data.json');

interface ServerStorageSchema {
  settings: Record<string, Record<string, any>>;
  items: Record<string, InfinityItem[]>;
  collections: Record<string, InfinityCollection[]>;
}

function loadLocalStore(): ServerStorageSchema {
  try {
    if (fs.existsSync(DATA_FILE_PATH)) {
      const content = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (err) {
    console.warn('Could not read .server_data.json:', err);
  }
  return { settings: {}, items: {}, collections: {} };
}

function saveLocalStore(data: ServerStorageSchema): void {
  try {
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.warn('Could not write to .server_data.json:', err);
  }
}

/**
 * Gets user settings (2FA, Notion token, preferences)
 */
export async function getServerUserSettings(userId: string): Promise<Record<string, any>> {
  if (isFirebaseAdminConfigured && adminDb) {
    try {
      const snap = await adminDb.collection('users').doc(userId).collection('settings').doc('config').get();
      return snap.exists ? snap.data() || {} : {};
    } catch (err) {
      console.warn('Firebase Admin getUserSettings failed, falling back:', err);
    }
  }

  const store = loadLocalStore();
  return store.settings[userId] || {};
}

/**
 * Saves user settings (2FA, Notion encrypted token, etc.)
 */
export async function saveServerUserSettings(userId: string, settings: Record<string, any>): Promise<void> {
  if (isFirebaseAdminConfigured && adminDb) {
    try {
      await adminDb.collection('users').doc(userId).collection('settings').doc('config').set(settings, { merge: true });
    } catch (err) {
      console.warn('Firebase Admin saveUserSettings failed, falling back:', err);
    }
  }

  const store = loadLocalStore();
  store.settings[userId] = {
    ...(store.settings[userId] || {}),
    ...settings
  };
  saveLocalStore(store);
}

/**
 * Fetches user items from database or local server storage
 */
export async function fetchServerItems(userId: string): Promise<InfinityItem[]> {
  if (isFirebaseAdminConfigured && adminDb) {
    try {
      const snap = await adminDb.collection('users').doc(userId).collection('items').get();
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as InfinityItem));
    } catch (err) {
      console.warn('Firebase Admin fetchServerItems failed, falling back:', err);
    }
  }

  const store = loadLocalStore();
  return store.items[userId] || [];
}

/**
 * Finds an item by ID across all server stores or public shares
 */
export async function findServerItemById(itemId: string): Promise<InfinityItem | null> {
  const store = loadLocalStore();
  for (const userItems of Object.values(store.items)) {
    const found = userItems.find(i => i.id === itemId);
    if (found) return found;
  }

  if (isFirebaseAdminConfigured && adminDb) {
    try {
      const snap = await adminDb.collectionGroup('items').where('id', '==', itemId).limit(1).get();
      if (!snap.empty) {
        return snap.docs[0].data() as InfinityItem;
      }
    } catch (err) {
      console.warn('Firebase Admin findServerItemById error:', err);
    }
  }

  return null;
}

/**
 * Saves or updates an item in user storage
 */
export async function saveServerItem(userId: string, item: InfinityItem): Promise<void> {
  const itemToSave = { ...item, userId, updatedAt: Date.now() };

  if (isFirebaseAdminConfigured && adminDb) {
    try {
      await adminDb.collection('users').doc(userId).collection('items').doc(item.id).set(itemToSave, { merge: true });
    } catch (err) {
      console.warn('Firebase Admin saveServerItem failed, falling back:', err);
    }
  }

  const store = loadLocalStore();
  const userItems = store.items[userId] || [];
  const idx = userItems.findIndex(i => i.id === item.id);
  if (idx >= 0) {
    userItems[idx] = itemToSave;
  } else {
    userItems.unshift(itemToSave);
  }
  store.items[userId] = userItems;
  saveLocalStore(store);
}

/**
 * Updates an item's properties
 */
export async function updateServerItem(userId: string, itemId: string, updates: Partial<InfinityItem>): Promise<void> {
  const merged = { ...updates, updatedAt: Date.now() };

  if (isFirebaseAdminConfigured && adminDb) {
    try {
      await adminDb.collection('users').doc(userId).collection('items').doc(itemId).update(merged);
    } catch (err) {
      console.warn('Firebase Admin updateServerItem failed, falling back:', err);
    }
  }

  const store = loadLocalStore();
  const userItems = store.items[userId] || [];
  const idx = userItems.findIndex(i => i.id === itemId);
  if (idx >= 0) {
    userItems[idx] = { ...userItems[idx], ...merged };
    store.items[userId] = userItems;
    saveLocalStore(store);
  }
}
