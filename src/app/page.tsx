'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useItems } from '@/context/ItemsContext';
import { usePlayer } from '@/context/PlayerContext';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { MobileNav } from '@/components/layout/MobileNav';
import { CategoryCards } from '@/components/explorer/CategoryCards';
import { ItemCard } from '@/components/explorer/ItemCard';
import { ItemRow } from '@/components/explorer/ItemRow';
import { EmptyState } from '@/components/explorer/EmptyState';
import { LoginView } from '@/components/auth/LoginView';
import { PhotoViewer } from '@/components/viewers/PhotoViewer';
import { VideoViewer } from '@/components/viewers/VideoViewer';
import { DocumentViewer } from '@/components/viewers/DocumentViewer';
import { OtherViewer } from '@/components/viewers/OtherViewer';
import { AddItemModal } from '@/components/modals/AddItemModal';
import { EditItemModal } from '@/components/modals/EditItemModal';
import { MoveModal } from '@/components/modals/MoveModal';
import { CollectionModal } from '@/components/modals/CollectionModal';
import { NotionImportModal } from '@/components/modals/NotionImportModal';
import { ImportExportModal } from '@/components/modals/ImportExportModal';
import { TwoFactorModal } from '@/components/modals/TwoFactorModal';
import { TwoFactorChallengeModal } from '@/components/modals/TwoFactorChallengeModal';
import { InfinityItem } from '@/types';
import { 
  Trash2, 
  Clock, 
  Star, 
  ChevronRight 
} from 'lucide-react';

export default function HomePage() {
  const { user, loading: authLoading, twoFactorRequired } = useAuth();
  const { 
    filteredItems, 
    items, 
    viewMode, 
    activeView, 
    activeCollectionId, 
    collections, 
    emptyTrash,
    setActiveCollectionId,
    setActiveView
  } = useItems();
  const { playTrack } = usePlayer();

  // Mobile drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [notionModalOpen, setNotionModalOpen] = useState<boolean>(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState<boolean>(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState<boolean>(false);
  const [collectionModalOpen, setCollectionModalOpen] = useState<boolean>(false);
  const [editingCollId, setEditingCollId] = useState<string | null>(null);
  const [editingCollName, setEditingCollName] = useState<string>('');

  // Item Modals
  const [editingItem, setEditingItem] = useState<InfinityItem | null>(null);
  const [movingItem, setMovingItem] = useState<InfinityItem | null>(null);

  // Viewers state
  const [activePhoto, setActivePhoto] = useState<InfinityItem | null>(null);
  const [activeVideo, setActiveVideo] = useState<InfinityItem | null>(null);
  const [activeDoc, setActiveDoc] = useState<InfinityItem | null>(null);
  const [activeOther, setActiveOther] = useState<InfinityItem | null>(null);

  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex items-center justify-center bg-white dark:bg-black">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user && !twoFactorRequired) {
    return <LoginView />;
  }

  // Active photos list for navigation in lightbox
  const photosList = filteredItems.filter(i => i.category === 'photos');

  const handleOpenItem = (item: InfinityItem) => {
    if (item.category === 'photos') {
      setActivePhoto(item);
    } else if (item.category === 'videos') {
      setActiveVideo(item);
    } else if (item.category === 'music') {
      // Play audio right away
      playTrack(item, filteredItems.filter(i => i.category === 'music'));
    } else if (item.category === 'documents') {
      setActiveDoc(item);
    } else {
      setActiveOther(item);
    }
  };

  const handleNextPhoto = () => {
    if (!activePhoto || photosList.length <= 1) return;
    const currentIdx = photosList.findIndex(p => p.id === activePhoto.id);
    const nextIdx = (currentIdx + 1) % photosList.length;
    setActivePhoto(photosList[nextIdx]);
  };

  const handlePrevPhoto = () => {
    if (!activePhoto || photosList.length <= 1) return;
    const currentIdx = photosList.findIndex(p => p.id === activePhoto.id);
    const prevIdx = (currentIdx - 1 + photosList.length) % photosList.length;
    setActivePhoto(photosList[prevIdx]);
  };

  // Recent files (most recent 4 items with thumbnails in active library)
  const recentItems = items
    .filter(i => !i.isTrash && i.thumbnailUrl)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 4);

  const activeColl = collections.find(c => c.id === activeCollectionId);

  return (
    <div className="flex h-screen w-full overflow-hidden bg-white text-slate-900 dark:bg-black dark:text-slate-100">
      {/* 2FA Challenge when user session requires TOTP token */}
      <TwoFactorChallengeModal />

      {/* Desktop Sidebar */}
      <Sidebar
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenNotionModal={() => setNotionModalOpen(true)}
        onOpenImportExportModal={() => setImportExportModalOpen(true)}
        onOpen2FaModal={() => setTwoFactorModalOpen(true)}
        onOpenCreateCollectionModal={() => {
          setEditingCollId(null);
          setEditingCollName('');
          setCollectionModalOpen(true);
        }}
        onOpenRenameCollectionModal={(collId, name) => {
          setEditingCollId(collId);
          setEditingCollName(name);
          setCollectionModalOpen(true);
        }}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenNotionModal={() => setNotionModalOpen(true)}
        onOpenImportExportModal={() => setImportExportModalOpen(true)}
        onOpen2FaModal={() => setTwoFactorModalOpen(true)}
        onOpenCreateCollectionModal={() => {
          setEditingCollId(null);
          setEditingCollName('');
          setCollectionModalOpen(true);
        }}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <Header
          onOpenAddModal={() => setAddModalOpen(true)}
          onOpenNotionModal={() => setNotionModalOpen(true)}
          onToggleMobileMenu={() => setMobileMenuOpen(true)}
        />

        {/* Scrollable Viewport */}
        <div className="flex-1 overflow-y-auto px-4 md:px-8 py-6 pb-28">
          {/* Breadcrumb / Section Header */}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-slate-500">
              <button
                onClick={() => {
                  setActiveView('library');
                  setActiveCollectionId(null);
                }}
                className="hover:text-blue-500 transition-colors font-medium"
              >
                Infinity
              </button>
              {activeView === 'library' && activeColl && (
                <>
                  <ChevronRight size={14} />
                  <span className="font-semibold text-slate-800 dark:text-white flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: activeColl.color || '#8b5cf6' }} />
                    {activeColl.name}
                  </span>
                </>
              )}
              {activeView === 'favorites' && (
                <>
                  <ChevronRight size={14} />
                  <span className="font-semibold text-amber-500 flex items-center gap-1">
                    <Star size={14} fill="currentColor" /> Favoritos
                  </span>
                </>
              )}
              {activeView === 'trash' && (
                <>
                  <ChevronRight size={14} />
                  <span className="font-semibold text-rose-500 flex items-center gap-1">
                    <Trash2 size={14} /> Papelera
                  </span>
                </>
              )}
            </div>

            {/* Trash Actions */}
            {activeView === 'trash' && filteredItems.length > 0 && (
              <button
                onClick={emptyTrash}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
              >
                <Trash2 size={14} />
                <span>Vaciar papelera</span>
              </button>
            )}
          </div>

          {/* Category Chips (in main library) */}
          <CategoryCards />

          {/* Recent Files Section with Thumbnails (Only in Main Library when not searching and no active collection) */}
          {activeView === 'library' && !activeColl && recentItems.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-blue-500" />
                <h3 className="font-bold text-sm text-slate-800 dark:text-slate-200">
                  Archivos recientes
                </h3>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {recentItems.map(item => (
                  <div
                    key={item.id}
                    onClick={() => handleOpenItem(item)}
                    className="group relative aspect-[16/10] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/40 shadow-sm hover:shadow-lg transition-all cursor-pointer"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.thumbnailUrl}
                      alt={item.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-2.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-white/70 font-mono">
                        {item.provider}
                      </span>
                      <span className="text-xs font-semibold text-white truncate">
                        {item.name}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Main Grid or List View */}
          {filteredItems.length === 0 ? (
            <EmptyState
              onOpenAddModal={() => setAddModalOpen(true)}
              onOpenNotionModal={() => setNotionModalOpen(true)}
            />
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <ItemCard
                  key={item.id}
                  item={item}
                  onOpen={handleOpenItem}
                  onEdit={(it) => setEditingItem(it)}
                  onMove={(it) => setMovingItem(it)}
                />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredItems.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onOpen={handleOpenItem}
                  onEdit={(it) => setEditingItem(it)}
                  onMove={(it) => setMovingItem(it)}
                />
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Viewers Modals */}
      <PhotoViewer
        item={activePhoto}
        itemsList={photosList}
        onClose={() => setActivePhoto(null)}
        onSelectNext={handleNextPhoto}
        onSelectPrev={handlePrevPhoto}
      />

      <VideoViewer
        item={activeVideo}
        onClose={() => setActiveVideo(null)}
      />

      <DocumentViewer
        item={activeDoc}
        onClose={() => setActiveDoc(null)}
      />

      <OtherViewer
        item={activeOther}
        onClose={() => setActiveOther(null)}
      />

      {/* Action Modals */}
      <AddItemModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      <EditItemModal
        item={editingItem}
        onClose={() => setEditingItem(null)}
      />

      <MoveModal
        item={movingItem}
        onClose={() => setMovingItem(null)}
      />

      <CollectionModal
        isOpen={collectionModalOpen}
        onClose={() => setCollectionModalOpen(false)}
        collIdToEdit={editingCollId}
        initialName={editingCollName}
      />

      <NotionImportModal
        isOpen={notionModalOpen}
        onClose={() => setNotionModalOpen(false)}
      />

      <ImportExportModal
        isOpen={importExportModalOpen}
        onClose={() => setImportExportModalOpen(false)}
      />

      <TwoFactorModal
        isOpen={twoFactorModalOpen}
        onClose={() => setTwoFactorModalOpen(false)}
      />
    </div>
  );
}
