'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { InfinityItem, PublicSharedFolder, CategoryType, ViewMode } from '@/types';
import { hashItemPassword } from '@/lib/security/itemPassword';
import { ItemCard } from '@/components/explorer/ItemCard';
import { ItemRow } from '@/components/explorer/ItemRow';
import { PhotoViewer } from '@/components/viewers/PhotoViewer';
import { VideoViewer } from '@/components/viewers/VideoViewer';
import { DocumentViewer } from '@/components/viewers/DocumentViewer';
import { OtherViewer } from '@/components/viewers/OtherViewer';
import { ViewerErrorBoundary } from '@/components/common/ViewerErrorBoundary';
import { PasswordUnlockModal } from '@/components/modals/PasswordUnlockModal';
import { usePlayer } from '@/context/PlayerContext';
import { 
  Folder, 
  Lock, 
  Search, 
  Grid, 
  List, 
  Layers, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as MusicIcon, 
  FileText, 
  HelpCircle,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';

function SharedFolderContent() {
  const params = useParams();
  const folderId = (params?.id as string) || '';

  const [folderData, setFolderData] = useState<PublicSharedFolder | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Password state for locked folders
  const [passwordInput, setPasswordInput] = useState<string>('');
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [unlockingFolder, setUnlockingFolder] = useState<boolean>(false);

  // Explorer filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<CategoryType | 'all'>('all');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  // Single file unlocked IDs (in-memory session for shared viewer)
  const [unlockedItemIds, setUnlockedItemIds] = useState<Set<string>>(new Set());
  const [unlockingItem, setUnlockingItem] = useState<InfinityItem | null>(null);

  // Viewers
  const [activePhoto, setActivePhoto] = useState<InfinityItem | null>(null);
  const [activeVideo, setActiveVideo] = useState<InfinityItem | null>(null);
  const [activeDoc, setActiveDoc] = useState<InfinityItem | null>(null);
  const [activeOther, setActiveOther] = useState<InfinityItem | null>(null);

  let playTrack: any = null;
  try {
    const playerContext = usePlayer();
    playTrack = playerContext.playTrack;
  } catch {
    // Player context might not be available in standalone share page
  }

  const fetchFolder = async (pwdHash?: string) => {
    try {
      setLoading(true);
      setError(null);
      const url = `/api/share/folder/${encodeURIComponent(folderId)}${pwdHash ? `?pwdHash=${encodeURIComponent(pwdHash)}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo cargar la carpeta');
      }

      setFolderData(data.folder);
    } catch (err: any) {
      setError(err.message || 'Error al conectar con la carpeta compartida');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (folderId) {
      fetchFolder();
    }
  }, [folderId]);

  const handleUnlockFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordInput.trim()) return;

    setUnlockingFolder(true);
    setPasswordError(null);
    try {
      const hash = await hashItemPassword(passwordInput.trim());
      const url = `/api/share/folder/${encodeURIComponent(folderId)}?pwdHash=${encodeURIComponent(hash)}`;
      const res = await fetch(url);
      const data = await res.json();

      if (!res.ok || data.folder?.requiresPassword) {
        setPasswordError('Contraseña incorrecta. Inténtalo de nuevo.');
      } else {
        setFolderData(data.folder);
      }
    } catch {
      setPasswordError('Error al verificar la contraseña');
    } finally {
      setUnlockingFolder(false);
    }
  };

  const openActualItem = async (item: InfinityItem) => {
    if (item.category === 'photos') {
      setActivePhoto(item);
      return;
    }
    if (item.category === 'music') {
      if (playTrack) {
        const musicItems = (folderData?.items || []).filter(i => i.category === 'music');
        playTrack(item, musicItems);
      } else {
        window.open(item.url, '_blank');
      }
      return;
    }
    if (item.category === 'videos' || item.metadata?.isNotionVideo) {
      setActiveVideo(item);
      return;
    }

    const itemUrl = String(item.url || '');
    const isNotion = item.provider === 'notion' ||
      itemUrl.includes('notion.so') ||
      itemUrl.includes('notion.site');

    if (isNotion) {
      try {
        const res = await fetch('/api/notion/extract-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
        });
        if (res.ok) {
          const data = await res.json();
          if (data.foundVideo && data.video) {
            const videoItem: InfinityItem = {
              ...item,
              category: 'videos',
              name: data.video.title || item.name,
              thumbnailUrl: data.video.coverUrl || item.thumbnailUrl,
              metadata: {
                ...item.metadata,
                isNotionVideo: true,
                s3Url: data.video.url,
                notionBlockId: data.video.notionBlockId,
                notionPageId: data.video.notionPageId,
                originalUrl: item.metadata?.originalUrl || item.url,
                sourceType: data.video.sourceType
              }
            };
            setActiveVideo(videoItem);
            return;
          }
        }
      } catch (err) {
        console.warn('Error checking Notion video in shared folder:', err);
      }
    }

    if (item.category === 'documents') {
      setActiveDoc(item);
    } else {
      setActiveOther(item);
    }
  };

  const handleItemClick = (item: InfinityItem) => {
    if (item.isProtected && item.passwordHash && !unlockedItemIds.has(item.id)) {
      setUnlockingItem(item);
      return;
    }
    openActualItem(item);
  };

  const handleUnlockedItem = (item: InfinityItem) => {
    setUnlockedItemIds(prev => new Set(prev).add(item.id));
    setUnlockingItem(null);
    openActualItem(item);
  };

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!folderData?.items) return [];
    return folderData.items.filter(item => {
      if (activeCategory !== 'all' && item.category !== activeCategory) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (item.name || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [folderData?.items, activeCategory, searchQuery]);

  const photosList = useMemo(() => {
    return (folderData?.items || []).filter(i => i.category === 'photos');
  }, [folderData?.items]);

  const handleNextPhoto = () => {
    if (!activePhoto) return;
    const idx = photosList.findIndex(p => p.id === activePhoto.id);
    if (idx >= 0 && idx < photosList.length - 1) {
      setActivePhoto(photosList[idx + 1]);
    }
  };

  const handlePrevPhoto = () => {
    if (!activePhoto) return;
    const idx = photosList.findIndex(p => p.id === activePhoto.id);
    if (idx > 0) {
      setActivePhoto(photosList[idx - 1]);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-black p-4">
        <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
        <p className="text-xs text-slate-500 font-medium">Cargando carpeta compartida...</p>
      </div>
    );
  }

  if (error || !folderData) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-black p-6 text-center">
        <div className="p-4 rounded-2xl bg-rose-500/10 text-rose-500 mb-4">
          <AlertCircle size={36} />
        </div>
        <h2 className="text-lg font-bold text-slate-800 dark:text-white mb-2">
          Carpeta no disponible
        </h2>
        <p className="text-sm text-slate-500 max-w-md mb-6">
          {error || 'El enlace no es válido o la carpeta ya no está disponible públicamente.'}
        </p>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-lg shadow-blue-500/25 transition-all"
        >
          Ir al inicio de Infinity
        </Link>
      </div>
    );
  }

  // If password required
  if (folderData.requiresPassword) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-black p-4">
        <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-8 shadow-2xl text-center animate-in fade-in duration-200">
          <div 
            className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-lg"
            style={{ backgroundColor: folderData.color || '#8b5cf6' }}
          >
            <Lock size={28} />
          </div>

          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-1.5">
            {folderData.name}
          </h2>
          <p className="text-xs text-slate-400 mb-6">
            Esta carpeta está protegida con contraseña. Ingrésala para acceder a sus archivos.
          </p>

          {passwordError && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs text-left flex items-center gap-2">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleUnlockFolder} className="space-y-4">
            <input
              type="password"
              autoFocus
              required
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              placeholder="Contraseña de la carpeta..."
              className="w-full px-4 py-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors text-center"
            />
            <button
              type="submit"
              disabled={unlockingFolder}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold shadow-lg shadow-blue-500/25 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {unlockingFolder ? 'Verificando...' : 'Desbloquear carpeta'}
            </button>
          </form>

          <div className="mt-8 pt-6 border-t border-slate-100 dark:border-slate-800">
            <Link href="/" className="text-xs text-slate-400 hover:text-blue-500 transition-colors">
              Explorar Infinity Cloud
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Active Shared Folder View
  const categories = [
    { id: 'all', label: 'Todos', icon: <Layers size={14} /> },
    { id: 'photos', label: 'Fotos', icon: <ImageIcon size={14} /> },
    { id: 'videos', label: 'Videos', icon: <VideoIcon size={14} /> },
    { id: 'music', label: 'Música', icon: <MusicIcon size={14} /> },
    { id: 'documents', label: 'Documentos', icon: <FileText size={14} /> },
    { id: 'others', label: 'Otros', icon: <HelpCircle size={14} /> },
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-black text-slate-800 dark:text-white flex flex-col">
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-slate-950/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 px-4 md:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2 hover:opacity-90 transition-opacity">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 via-blue-600 to-violet-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20 font-bold text-sm">
              ∞
            </div>
            <span className="font-extrabold text-base tracking-tight hidden sm:inline">
              Infinity
            </span>
          </Link>
          <span className="text-slate-300 dark:text-slate-700">/</span>
          <div className="flex items-center gap-2">
            <span 
              className="w-3 h-3 rounded-full shrink-0 shadow-sm"
              style={{ backgroundColor: folderData.color || '#8b5cf6' }}
            />
            <h1 className="font-bold text-sm sm:text-base truncate max-w-xs sm:max-w-md">
              {folderData.name}
            </h1>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-500 font-mono">
              {folderData.items.length}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/"
            className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center gap-1.5"
          >
            <span>Crear cuenta gratis</span>
            <ArrowRight size={13} />
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 pb-20">
        {/* Description Banner if available */}
        {folderData.description && (
          <div className="mb-6 p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300 shadow-sm">
            {folderData.description}
          </div>
        )}

        {/* Filter and Search Bar */}
        <div className="mb-6 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
            {categories.map(cat => {
              const count = cat.id === 'all' 
                ? folderData.items.length 
                : folderData.items.filter(i => i.category === cat.id).length;
              const isSelected = activeCategory === cat.id;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                    isSelected 
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20' 
                      : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {cat.icon}
                  <span>{cat.label}</span>
                  <span className="opacity-70 text-[10px] font-mono">({count})</span>
                </button>
              );
            })}
          </div>

          {/* Search & View Mode */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:w-60">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar en la carpeta..."
                className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500"
              />
            </div>

            <div className="flex items-center p-0.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'grid' 
                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-500' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="Vista cuadrícula"
              >
                <Grid size={15} />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg transition-colors ${
                  viewMode === 'list' 
                    ? 'bg-slate-100 dark:bg-slate-800 text-blue-500' 
                    : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
                title="Vista lista"
              >
                <List size={15} />
              </button>
            </div>
          </div>
        </div>

        {/* Items Explorer */}
        {filteredItems.length === 0 ? (
          <div className="p-12 text-center bg-white dark:bg-slate-900/60 rounded-3xl border border-slate-200 dark:border-slate-800">
            <Folder size={40} className="mx-auto text-slate-300 dark:text-slate-700 mb-3" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-1">
              No hay archivos coincidentes
            </h3>
            <p className="text-xs text-slate-400">
              {searchQuery ? 'Prueba con otro término de búsqueda' : 'Esta carpeta aún no tiene archivos en esta categoría'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {filteredItems.map(item => (
              <ItemCard
                key={item.id}
                item={item}
                onOpen={handleItemClick}
                readOnly={true}
              />
            ))}
          </div>
        ) : (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm divide-y divide-slate-100 dark:divide-slate-800/60">
            {filteredItems.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                onOpen={handleItemClick}
                readOnly={true}
              />
            ))}
          </div>
        )}
      </main>

      {/* Viewers */}
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
            readOnly={true}
          />
        </ViewerErrorBoundary>
      )}

      {activeDoc && (
        <ViewerErrorBoundary onClose={() => setActiveDoc(null)} title="No se pudo abrir el documento">
          <DocumentViewer
            item={activeDoc}
            onClose={() => setActiveDoc(null)}
          />
        </ViewerErrorBoundary>
      )}

      {activeOther && (
        <ViewerErrorBoundary onClose={() => setActiveOther(null)} title="No se pudo abrir el archivo">
          <OtherViewer
            item={activeOther}
            onClose={() => setActiveOther(null)}
          />
        </ViewerErrorBoundary>
      )}

      <PasswordUnlockModal
        isOpen={Boolean(unlockingItem)}
        onClose={() => setUnlockingItem(null)}
        item={unlockingItem}
        onUnlocked={handleUnlockedItem}
      />
    </div>
  );
}

export default function SharedFolderPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-slate-50 dark:bg-black p-4">
          <div className="w-10 h-10 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-xs text-slate-500 font-medium">Cargando carpeta compartida...</p>
        </div>
      }
    >
      <SharedFolderContent />
    </Suspense>
  );
}
