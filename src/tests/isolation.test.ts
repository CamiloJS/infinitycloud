import { describe, it, expect, beforeEach } from 'vitest';
import { 
  fetchUserItems, 
  saveItem, 
  moveItemToTrash, 
  restoreItemFromTrash, 
  permanentlyDeleteItem, 
  emptyTrash, 
  saveCollection, 
  deleteCollectionSafely,
  fetchUserCollections 
} from '@/lib/firebase/firestore';
import { InfinityItem, InfinityCollection } from '@/types';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (i: number) => Object.keys(store)[i] || null,
  length: 0
};

describe('Data Isolation, Collection Safety & Trash Lifecycle', () => {
  const userA = 'user_alpha_1';
  const userB = 'user_beta_2';

  beforeEach(() => {
    localStorage.clear();
  });

  it('maintains strict data separation between two user accounts', async () => {
    const itemA: InfinityItem = {
      id: 'item_a',
      userId: userA,
      name: 'Documento confidencial Usuario A',
      url: 'https://example.com/doc_a.pdf',
      provider: 'direct',
      category: 'documents',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const itemB: InfinityItem = {
      id: 'item_b',
      userId: userB,
      name: 'Documento confidencial Usuario B',
      url: 'https://example.com/doc_b.pdf',
      provider: 'direct',
      category: 'documents',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveItem(userA, itemA);
    await saveItem(userB, itemB);

    const itemsForA = await fetchUserItems(userA);
    const itemsForB = await fetchUserItems(userB);

    expect(itemsForA).toHaveLength(1);
    expect(itemsForA[0].id).toBe('item_a');
    expect(itemsForA[0].name).toBe('Documento confidencial Usuario A');

    expect(itemsForB).toHaveLength(1);
    expect(itemsForB[0].id).toBe('item_b');
    expect(itemsForB[0].name).toBe('Documento confidencial Usuario B');

    // User A cannot see User B's items
    expect(itemsForA.some(i => i.id === 'item_b')).toBe(false);
    expect(itemsForB.some(i => i.id === 'item_a')).toBe(false);
  });

  it('safely deletes collections without losing associated items', async () => {
    const coll: InfinityCollection = {
      id: 'coll_vacaciones',
      userId: userA,
      name: 'Vacaciones 2026',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveCollection(userA, coll);

    const item: InfinityItem = {
      id: 'item_foto_1',
      userId: userA,
      name: 'Foto de playa',
      url: 'https://example.com/beach.jpg',
      provider: 'direct',
      category: 'photos',
      collectionId: 'coll_vacaciones',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveItem(userA, item);

    // Delete collection safely
    await deleteCollectionSafely(userA, 'coll_vacaciones');

    // Collection is removed
    const colls = await fetchUserCollections(userA);
    expect(colls.find(c => c.id === 'coll_vacaciones')).toBeUndefined();

    // Item is PRESERVED, moved to collectionId: null
    const items = await fetchUserItems(userA);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('item_foto_1');
    expect(items[0].collectionId).toBeNull();
  });

  it('handles trash lifecycle: move to trash, restore, and empty trash', async () => {
    const item1: InfinityItem = {
      id: 'item_active',
      userId: userA,
      name: 'Archivo activo',
      url: 'https://example.com/active.mp4',
      provider: 'direct',
      category: 'videos',
      isFavorite: true,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const item2: InfinityItem = {
      id: 'item_to_trash',
      userId: userA,
      name: 'Archivo descartable',
      url: 'https://example.com/temp.mp3',
      provider: 'direct',
      category: 'music',
      isFavorite: true,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await saveItem(userA, item1);
    await saveItem(userA, item2);

    // Send item 2 to trash
    await moveItemToTrash(userA, 'item_to_trash');

    let items = await fetchUserItems(userA);
    const trashed = items.find(i => i.id === 'item_to_trash');
    expect(trashed?.isTrash).toBe(true);
    expect(trashed?.isFavorite).toBe(false); // Trashing automatically un-favorites
    expect(trashed?.trashedAt).toBeGreaterThan(0);

    // Restore item 2
    await restoreItemFromTrash(userA, 'item_to_trash');
    items = await fetchUserItems(userA);
    const restored = items.find(i => i.id === 'item_to_trash');
    expect(restored?.isTrash).toBe(false);
    expect(restored?.trashedAt).toBeNull();

    // Trash again and empty trash
    await moveItemToTrash(userA, 'item_to_trash');
    await emptyTrash(userA);

    items = await fetchUserItems(userA);
    expect(items).toHaveLength(1);
    expect(items[0].id).toBe('item_active');
  });
});
