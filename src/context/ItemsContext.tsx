'use client';

import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { 
  InfinityItem, 
  InfinityCollection, 
  CategoryType, 
  ProviderType, 
  ViewMode, 
  SortOption 
} from '@/types';
import { 
  fetchUserItems, 
  fetchUserCollections, 
  saveItem, 
  updateItem, 
  moveItemToTrash, 
  restoreItemFromTrash, 
  permanentlyDeleteItem, 
  emptyTrash as emptyTrashStore,
  saveCollection, 
  deleteCollectionSafely,
  exportUserData,
  importUserData
} from '@/lib/firebase/firestore';
import { adapterRegistry } from '@/lib/adapters/registry';
import { useAuth } from './AuthContext';

interface ItemsContextType {
  items: InfinityItem[];
  collections: InfinityCollection[];
  loading: boolean;
  activeCategory: CategoryType | 'all';
  activeCollectionId: string | null;
  activeView: 'library' | 'favorites' | 'trash';
  searchQuery: string;
  viewMode: ViewMode;
  sortOption: SortOption;
  selectedProvider: ProviderType | 'all';

  setActiveCategory: (cat: CategoryType | 'all') => void;
  setActiveCollectionId: (id: string | null) => void;
  setActiveView: (view: 'library' | 'favorites' | 'trash') => void;
  setSearchQuery: (query: string) => void;
  setViewMode: (mode: ViewMode) => void;
  setSortOption: (sort: SortOption) => void;
  setSelectedProvider: (prov: ProviderType | 'all') => void;

  addItemByUrl: (
    url: string, 
    customName?: string, 
    customCategory?: CategoryType, 
    collectionId?: string | null,
    customMetadata?: Record<string, any>
  ) => Promise<InfinityItem>;
  createTextDocument: (
    name: string,
    content: string,
    collectionId?: string | null
  ) => Promise<InfinityItem>;
  editItem: (id: string, updates: Partial<InfinityItem>) => Promise<void>;
  moveToTrash: (id: string) => Promise<void>;
  restoreFromTrash: (id: string) => Promise<void>;
  deletePermanently: (id: string) => Promise<void>;
  emptyTrash: () => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  moveToCollection: (itemId: string, collectionId: string | null) => Promise<void>;

  createCollection: (name: string, color?: string) => Promise<InfinityCollection>;
  renameCollection: (id: string, newName: string) => Promise<void>;
  updateCollectionShare: (id: string, isShared: boolean, sharePasswordHash?: string, description?: string) => Promise<InfinityCollection | undefined>;
  deleteCollection: (id: string) => Promise<void>;

  exportDataJson: () => Promise<string>;
  importDataJson: (jsonString: string, mode: 'merge' | 'replace') => Promise<{ success: boolean; message: string }>;
  refreshData: () => Promise<void>;
  filteredItems: InfinityItem[];
  unlockedItemIds: Set<string>;
  unlockItem: (id: string) => void;
  isItemUnlocked: (item: InfinityItem) => boolean;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

export function ItemsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<InfinityItem[]>([]);
  const [collections, setCollections] = useState<InfinityCollection[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters & display preferences
  const [activeCategory, setActiveCategory] = useState<CategoryType | 'all'>('all');
  const [activeCollectionId, setActiveCollectionId] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<'library' | 'favorites' | 'trash'>('library');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortOption, setSortOption] = useState<SortOption>('date-desc');
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | 'all'>('all');
  const [unlockedItemIds, setUnlockedItemIds] = useState<Set<string>>(new Set());

  const unlockItem = (id: string) => {
    setUnlockedItemIds(prev => new Set(prev).add(id));
  };

  const isItemUnlocked = (item: InfinityItem): boolean => {
    if (!item.isProtected || !item.passwordHash) return true;
    return unlockedItemIds.has(item.id);
  };

  const userId = user?.uid || 'guest';

  const refreshData = async () => {
    if (!user) {
      setItems([]);
      setCollections([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [userItems, userColls] = await Promise.all([
        fetchUserItems(userId),
        fetchUserCollections(userId)
      ]);
      setItems(userItems);
      setCollections(userColls);
    } catch (err) {
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, [user?.uid]);

  const addItemByUrl = async (
    url: string, 
    customName?: string, 
    customCategory?: CategoryType, 
    collectionId?: string | null,
    customMetadata?: Record<string, any>
  ): Promise<InfinityItem> => {
    const detected = await adapterRegistry.detect(url);
    const isNotionVideo = Boolean(
      customMetadata?.isNotionVideo || 
      detected.metadata?.isNotionVideo || 
      (detected.provider === 'notion' && detected.category === 'videos')
    );
    const finalName = customName?.trim() || customMetadata?.title || detected.name;
    const finalCategory = isNotionVideo ? 'videos' : (customCategory || detected.category);
    const finalUrl = customMetadata?.s3Url || 
      ((detected.metadata?.isNotionVideo && detected.metadata?.s3Url) 
        ? detected.metadata.s3Url 
        : url);

    const mergedMetadata = {
      ...(detected.metadata || {}),
      ...(customMetadata || {}),
      isNotionVideo: isNotionVideo ? true : detected.metadata?.isNotionVideo
    };

    const newItem: InfinityItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: finalName,
      url: finalUrl,
      provider: customMetadata?.provider || detected.provider,
      category: finalCategory,
      mimeType: detected.mimeType || (isNotionVideo ? 'video/mp4' : undefined),
      thumbnailUrl: customMetadata?.thumbnailUrl || detected.thumbnailUrl,
      collectionId: collectionId || null,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: mergedMetadata
    };

    await saveItem(userId, newItem);
    setItems(prev => [newItem, ...prev]);
    return newItem;
  };

  const createTextDocument = async (
    name: string,
    content: string,
    collectionId?: string | null
  ): Promise<InfinityItem> => {
    const cleanName = name.trim();
    const docName = cleanName.endsWith('.md') || cleanName.endsWith('.txt') ? cleanName : `${cleanName}.md`;
    const blobSize = typeof Blob !== 'undefined' ? new Blob([content]).size : content.length;
    const words = content.trim() ? content.trim().split(/\s+/).length : 0;

    const newItem: InfinityItem = {
      id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: docName,
      url: `infinity://doc/${Date.now()}`,
      provider: 'direct',
      category: 'documents',
      mimeType: 'text/markdown',
      size: blobSize,
      collectionId: collectionId || null,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        content,
        wordCount: words,
        isLocalDocument: true
      }
    };

    await saveItem(userId, newItem);
    setItems(prev => [newItem, ...prev]);
    return newItem;
  };

  const editItem = async (id: string, updates: Partial<InfinityItem>) => {
    await updateItem(userId, id, updates);
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates, updatedAt: Date.now() } : item));
  };

  const moveToTrash = async (id: string) => {
    await moveItemToTrash(userId, id);
    setItems(prev => prev.map(item => item.id === id ? { ...item, isTrash: true, trashedAt: Date.now(), isFavorite: false } : item));
  };

  const restoreFromTrash = async (id: string) => {
    await restoreItemFromTrash(userId, id);
    setItems(prev => prev.map(item => item.id === id ? { ...item, isTrash: false, trashedAt: null } : item));
  };

  const deletePermanently = async (id: string) => {
    await permanentlyDeleteItem(userId, id);
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const emptyTrash = async () => {
    await emptyTrashStore(userId);
    setItems(prev => prev.filter(item => !item.isTrash));
  };

  const toggleFavorite = async (id: string) => {
    const item = items.find(i => i.id === id);
    if (!item || item.isTrash) return;
    const nextVal = !item.isFavorite;
    await updateItem(userId, id, { isFavorite: nextVal });
    setItems(prev => prev.map(i => i.id === id ? { ...i, isFavorite: nextVal } : i));
  };

  const moveToCollection = async (itemId: string, collectionId: string | null) => {
    await updateItem(userId, itemId, { collectionId });
    setItems(prev => prev.map(i => i.id === itemId ? { ...i, collectionId } : i));
  };

  const createCollection = async (name: string, color?: string): Promise<InfinityCollection> => {
    const newColl: InfinityCollection = {
      id: `coll_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId,
      name: name.trim(),
      color: color || '#8b5cf6',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await saveCollection(userId, newColl);
    setCollections(prev => [...prev, newColl]);
    return newColl;
  };

  const renameCollection = async (id: string, newName: string) => {
    const coll = collections.find(c => c.id === id);
    if (!coll) return;
    const updated = { ...coll, name: newName.trim(), updatedAt: Date.now() };
    await saveCollection(userId, updated);
    setCollections(prev => prev.map(c => c.id === id ? updated : c));
  };

  const updateCollectionShare = async (
    id: string, 
    isShared: boolean, 
    sharePasswordHash?: string, 
    description?: string
  ): Promise<InfinityCollection | undefined> => {
    const coll = collections.find(c => c.id === id);
    if (!coll) return undefined;
    const updated: InfinityCollection = {
      ...coll,
      isShared,
      sharePasswordHash: isShared ? (sharePasswordHash || undefined) : undefined,
      description: description !== undefined ? description.trim() : coll.description,
      updatedAt: Date.now()
    };
    await saveCollection(userId, updated);
    setCollections(prev => prev.map(c => c.id === id ? updated : c));
    return updated;
  };

  const deleteCollection = async (id: string) => {
    await deleteCollectionSafely(userId, id);
    setCollections(prev => prev.filter(c => c.id !== id));
    // Any items that were in this collection are now in collectionId: null
    setItems(prev => prev.map(i => i.collectionId === id ? { ...i, collectionId: null } : i));
    if (activeCollectionId === id) {
      setActiveCollectionId(null);
    }
  };

  const exportDataJson = async (): Promise<string> => {
    const data = await exportUserData(userId);
    return JSON.stringify(data, null, 2);
  };

  const importDataJson = async (jsonString: string, mode: 'merge' | 'replace') => {
    const res = await importUserData(userId, jsonString, mode);
    if (res.success) {
      await refreshData();
    }
    return { success: res.success, message: res.message };
  };

  // Filter and sort items dynamically
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Trash vs Active view
      if (activeView === 'trash') {
        if (!item.isTrash) return false;
      } else {
        if (item.isTrash) return false;
        if (activeView === 'favorites' && !item.isFavorite) return false;
      }

      // Category filter
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }

      // Collection filter
      if (activeCollectionId !== null && item.collectionId !== activeCollectionId) {
        return false;
      }

      // Provider filter
      if (selectedProvider !== 'all' && item.provider !== selectedProvider) {
        return false;
      }

      // Search query
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = (item.name || '').toLowerCase().includes(query);
        const matchesUrl = (item.url || '').toLowerCase().includes(query);
        const matchesProvider = (item.provider || '').toLowerCase().includes(query);
        if (!matchesName && !matchesUrl && !matchesProvider) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortOption === 'date-desc') return (b.createdAt || 0) - (a.createdAt || 0);
      if (sortOption === 'date-asc') return (a.createdAt || 0) - (b.createdAt || 0);
      if (sortOption === 'name-asc') return (a.name || '').localeCompare(b.name || '', 'es', { sensitivity: 'base' });
      if (sortOption === 'name-desc') return (b.name || '').localeCompare(a.name || '', 'es', { sensitivity: 'base' });
      return 0;
    });
  }, [items, activeView, activeCategory, activeCollectionId, selectedProvider, searchQuery, sortOption]);

  return (
    <ItemsContext.Provider
      value={{
        items,
        collections,
        loading,
        activeCategory,
        activeCollectionId,
        activeView,
        searchQuery,
        viewMode,
        sortOption,
        selectedProvider,
        setActiveCategory,
        setActiveCollectionId,
        setActiveView,
        setSearchQuery,
        setViewMode,
        setSortOption,
        setSelectedProvider,
        addItemByUrl,
        createTextDocument,
        editItem,
        moveToTrash,
        restoreFromTrash,
        deletePermanently,
        emptyTrash,
        toggleFavorite,
        moveToCollection,
        createCollection,
        renameCollection,
        updateCollectionShare,
        deleteCollection,
        exportDataJson,
        importDataJson,
        refreshData,
        filteredItems,
        unlockedItemIds,
        unlockItem,
        isItemUnlocked
      }}
    >
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error('useItems debe ser usado dentro de un ItemsProvider');
  }
  return context;
}
