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
import { FolderCard } from '@/components/explorer/FolderCard';
import { FolderRow } from '@/components/explorer/FolderRow';
import { EmptyState } from '@/components/explorer/EmptyState';
import { LoginView } from '@/components/auth/LoginView';
import { PhotoViewer } from '@/components/viewers/PhotoViewer';
import { VideoViewer } from '@/components/viewers/VideoViewer';
import { DocumentViewer } from '@/components/viewers/DocumentViewer';
import { OtherViewer } from '@/components/viewers/OtherViewer';
import { ViewerErrorBoundary } from '@/components/common/ViewerErrorBoundary';
import { AddItemModal } from '@/components/modals/AddItemModal';
import { EditItemModal } from '@/components/modals/EditItemModal';
import { PasswordUnlockModal } from '@/components/modals/PasswordUnlockModal';
import { MoveModal } from '@/components/modals/MoveModal';
import { CollectionModal } from '@/components/modals/CollectionModal';
import { NotionImportModal } from '@/components/modals/NotionImportModal';
import { ImportExportModal } from '@/components/modals/ImportExportModal';
import { TwoFactorModal } from '@/components/modals/TwoFactorModal';
import { TwoFactorChallengeModal } from '@/components/modals/TwoFactorChallengeModal';
import { ShareFolderModal } from '@/components/modals/ShareFolderModal';
import { AccountSettingsModal } from '@/components/modals/AccountSettingsModal';
import { TextEditorModal } from '@/components/modals/TextEditorModal';
import { InfinityItem, InfinityCollection } from '@/types';
import { 
  Trash2, 
  Star, 
  ChevronRight,
  Share2,
  Folder,
  CheckCircle2
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
    setActiveView,
    isItemUnlocked,
    unlockItem,
    editItem,
    moveToCollection,
    deleteCollection
  } = useItems();
  const { playTrack } = usePlayer();

  // Mobile drawer
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);
  const [dropFeedback, setDropFeedback] = useState<string | null>(null);

  const handleDropOnFolder = async (itemId: string, targetCollId: string) => {
    const droppedItem = items.find(i => i.id === itemId);
    const targetColl = collections.find(c => c.id === targetCollId);
    try {
      await moveToCollection(itemId, targetCollId);
      setDropFeedback(
        droppedItem 
          ? `"${droppedItem.name}" se movió a "${targetColl?.name || 'Carpeta'}"`
          : `Elemento movido a "${targetColl?.name || 'Carpeta'}"`
      );
      setTimeout(() => {
        setDropFeedback(null);
      }, 3500);
    } catch (err) {
      console.error('Error moving item to folder on drop:', err);
    }
  };

  // Modals state
  const [addModalOpen, setAddModalOpen] = useState<boolean>(false);
  const [notionModalOpen, setNotionModalOpen] = useState<boolean>(false);
  const [importExportModalOpen, setImportExportModalOpen] = useState<boolean>(false);
  const [twoFactorModalOpen, setTwoFactorModalOpen] = useState<boolean>(false);
  const [accountSettingsOpen, setAccountSettingsOpen] = useState<boolean>(false);
  const [textEditorOpen, setTextEditorOpen] = useState<boolean>(false);
  const [editingDocumentItem, setEditingDocumentItem] = useState<InfinityItem | null>(null);
  const [collectionModalOpen, setCollectionModalOpen] = useState<boolean>(false);
  const [editingCollId, setEditingCollId] = useState<string | null>(null);
  const [editingCollName, setEditingCollName] = useState<string>('');
  const [sharingColl, setSharingColl] = useState<InfinityCollection | null>(null);

  // Item Modals
  const [editingItem, setEditingItem] = useState<InfinityItem | null>(null);
  const [movingItem, setMovingItem] = useState<InfinityItem | null>(null);
  const [unlockingItem, setUnlockingItem] = useState<InfinityItem | null>(null);

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

  const handleOpenTextEditor = (docItem?: InfinityItem | null) => {
    setEditingDocumentItem(docItem || null);
    setTextEditorOpen(true);
  };

  const openActualItem = async (item: InfinityItem) => {
    if (item.category === 'photos') {
      setActivePhoto(item);
      return;
    }
    if (item.category === 'music' || item.metadata?.isNotionAudio) {
      playTrack(item, filteredItems.filter(i => i.category === 'music' || i.metadata?.isNotionAudio));
      return;
    }

    // Check if this item is from Notion or a video
    const itemUrl = String(item.url || '');
    const isNotion = item.provider === 'notion' ||
      itemUrl.includes('notion.so') ||
      itemUrl.includes('notion.site') ||
      itemUrl.includes('notion.com');

    if (item.category === 'videos' || item.metadata?.isNotionVideo || (isNotion && !item.metadata?.isNotionAudio)) {
      setActiveVideo(item);
      return;
    }

    if (item.category === 'documents') {
      setActiveDoc(item);
    } else {
      setActiveOther(item);
    }
  };

  const handleOpenItem = (item: InfinityItem) => {
    if (item.isProtected && item.passwordHash && !isItemUnlocked(item)) {
      setUnlockingItem(item);
      return;
    }
    openActualItem(item);
  };

  const handleUnlocked = (item: InfinityItem) => {
    unlockItem(item.id);
    setUnlockingItem(null);
    openActualItem(item);
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
        onOpenAccountSettings={() => setAccountSettingsOpen(true)}
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
        onOpenShareCollectionModal={(coll) => setSharingColl(coll)}
        onOpenTextEditorModal={() => handleOpenTextEditor()}
      />

      {/* Mobile Navigation Drawer */}
      <MobileNav
        isOpen={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        onOpenAddModal={() => setAddModalOpen(true)}
        onOpenNotionModal={() => setNotionModalOpen(true)}
        onOpenImportExportModal={() => setImportExportModalOpen(true)}
        onOpen2FaModal={() => setTwoFactorModalOpen(true)}
        onOpenAccountSettings={() => setAccountSettingsOpen(true)}
        onOpenCreateCollectionModal={() => {
          setEditingCollId(null);
          setEditingCollName('');
          setCollectionModalOpen(true);
        }}
        onOpenTextEditorModal={() => handleOpenTextEditor()}
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
                  <button
                    onClick={() => setSharingColl(activeColl)}
                    className="ml-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    title="Compartir esta carpeta con un enlace público"
                  >
                    <Share2 size={13} />
                    <span>Compartir carpeta</span>
                  </button>
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

          {/* Folders Section in Root Library View */}
          {activeView === 'library' && !activeCollectionId && collections.length > 0 && (
            <div className="mb-8 animate-in fade-in duration-200">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Carpetas
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                    {collections.length}
                  </span>
                </div>
                <button
                  onClick={() => {
                    setEditingCollId(null);
                    setEditingCollName('');
                    setCollectionModalOpen(true);
                  }}
                  className="text-xs font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500 transition-colors flex items-center gap-1"
                >
                  + Nueva carpeta
                </button>
              </div>

              {viewMode === 'grid' ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-3.5">
                  {collections.map(coll => (
                    <FolderCard
                      key={coll.id}
                      collection={coll}
                      itemCount={items.filter(i => i.collectionId === coll.id && !i.isTrash).length}
                      onClick={() => setActiveCollectionId(coll.id)}
                      onDropItem={handleDropOnFolder}
                      onShare={(c) => setSharingColl(c)}
                      onEdit={(c) => {
                        setEditingCollId(c.id);
                        setEditingCollName(c.name);
                        setCollectionModalOpen(true);
                      }}
                      onDelete={(c) => {
                        if (window.confirm(`¿Eliminar la carpeta "${c.name}"? Los archivos que contiene no se borrarán.`)) {
                          deleteCollection(c.id);
                        }
                      }}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {collections.map(coll => (
                    <FolderRow
                      key={coll.id}
                      collection={coll}
                      itemCount={items.filter(i => i.collectionId === coll.id && !i.isTrash).length}
                      onClick={() => setActiveCollectionId(coll.id)}
                      onDropItem={handleDropOnFolder}
                      onShare={(c) => setSharingColl(c)}
                      onEdit={(c) => {
                        setEditingCollId(c.id);
                        setEditingCollName(c.name);
                        setCollectionModalOpen(true);
                      }}
                      onDelete={(c) => {
                        if (window.confirm(`¿Eliminar la carpeta "${c.name}"? Los archivos que contiene no se borrarán.`)) {
                          deleteCollection(c.id);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Files Section Header (when folders are also shown) */}
          {activeView === 'library' && !activeCollectionId && collections.length > 0 && filteredItems.length > 0 && (
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                  Archivos
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                  {filteredItems.length}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 hidden sm:inline">
                Arrastra un archivo sobre una carpeta para organizarlo
              </span>
            </div>
          )}

          {/* Main Grid or List View */}
          {filteredItems.length === 0 ? (
            activeCollectionId ? (
              <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-900 flex items-center justify-center mx-auto text-slate-400">
                  <Folder size={24} />
                </div>
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Esta carpeta está vacía
                </p>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Arrastra archivos hacia esta carpeta desde la raíz o añade nuevos enlaces aquí.
                </p>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setAddModalOpen(true)}
                    className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-all"
                  >
                    Añadir a esta carpeta
                  </button>
                  <button
                    onClick={() => setActiveCollectionId(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 text-xs font-medium hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                  >
                    Volver a la raíz
                  </button>
                </div>
              </div>
            ) : collections.length > 0 && activeView === 'library' ? (
              <div className="p-8 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs">
                <span>No hay archivos en la raíz. Puedes arrastrar archivos a una carpeta o usar el botón &ldquo;Añadir&rdquo;.</span>
              </div>
            ) : (
              <EmptyState
                onOpenAddModal={() => setAddModalOpen(true)}
                onOpenNotionModal={() => setNotionModalOpen(true)}
              />
            )
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
      {activePhoto && (
        <ViewerErrorBoundary onClose={() => setActivePhoto(null)} title="No se pudo abrir la imagen">
          <PhotoViewer
            item={activePhoto}
            itemsList={photosList}
            onClose={() => setActivePhoto(null)}
            onSelectNext={handleNextPhoto}
            onSelectPrev={handlePrevPhoto}
          />
        </ViewerErrorBoundary>
      )}

      {activeVideo && (
        <ViewerErrorBoundary onClose={() => setActiveVideo(null)} title="No se pudo reproducir el video">
          <VideoViewer
            item={activeVideo}
            onClose={() => setActiveVideo(null)}
          />
        </ViewerErrorBoundary>
      )}

      {activeDoc && (
        <ViewerErrorBoundary onClose={() => setActiveDoc(null)} title="No se pudo abrir el documento">
          <DocumentViewer
            item={activeDoc}
            onClose={() => setActiveDoc(null)}
            onPlayVideo={(videoItem) => {
              setActiveDoc(null);
              setActiveVideo(videoItem);
            }}
            onEditDocument={(docItem) => {
              setActiveDoc(null);
              handleOpenTextEditor(docItem);
            }}
          />
        </ViewerErrorBoundary>
      )}

      {activeOther && (
        <ViewerErrorBoundary onClose={() => setActiveOther(null)} title="No se pudo abrir el archivo">
          <OtherViewer
            item={activeOther}
            onClose={() => setActiveOther(null)}
            onPlayVideo={(videoItem) => {
              setActiveOther(null);
              setActiveVideo(videoItem);
            }}
          />
        </ViewerErrorBoundary>
      )}

      {/* Action Modals */}
      <AddItemModal
        isOpen={addModalOpen}
        onClose={() => setAddModalOpen(false)}
      />

      <EditItemModal
        item={editingItem}
        isOpen={Boolean(editingItem)}
        onClose={() => setEditingItem(null)}
      />

      <PasswordUnlockModal
        item={unlockingItem}
        isOpen={Boolean(unlockingItem)}
        onClose={() => setUnlockingItem(null)}
        onUnlocked={handleUnlocked}
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

      <ShareFolderModal
        isOpen={Boolean(sharingColl)}
        onClose={() => setSharingColl(null)}
        collection={sharingColl}
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

      <AccountSettingsModal
        isOpen={accountSettingsOpen}
        onClose={() => setAccountSettingsOpen(false)}
        onOpen2FaModal={() => setTwoFactorModalOpen(true)}
        onOpenImportExportModal={() => setImportExportModalOpen(true)}
      />

      <TextEditorModal
        isOpen={textEditorOpen}
        onClose={() => {
          setTextEditorOpen(false);
          setEditingDocumentItem(null);
        }}
        initialItem={editingDocumentItem}
        initialCollectionId={activeCollectionId}
      />

      {/* Drop Feedback Toast */}
      {dropFeedback && (
        <div className="fixed bottom-24 sm:bottom-8 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-2xl bg-slate-900/95 dark:bg-white/95 text-white dark:text-slate-900 text-xs font-semibold shadow-2xl backdrop-blur-md animate-in slide-in-from-bottom-3 duration-200 border border-white/10 dark:border-slate-800">
          <CheckCircle2 size={16} className="text-emerald-400 shrink-0" />
          <span>{dropFeedback}</span>
        </div>
      )}
    </div>
  );
}
