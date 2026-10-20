'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { InfinityItem } from '@/types';
import { usePlayer } from '@/context/PlayerContext';
import { useItems } from '@/context/ItemsContext';
import { useAuth } from '@/context/AuthContext';
import { downloadItem } from '@/lib/utils/download';
import {
  Play,
  Pause,
  Shuffle,
  Music,
  Disc,
  ListMusic,
  Plus,
  Clock,
  Star,
  MoreVertical,
  Edit2,
  Trash2,
  Download,
  FolderPlus,
  Check,
  X,
  ArrowLeft,
  Search,
  Upload,
  Image as ImageIcon,
  Mic2
} from 'lucide-react';

export interface CustomPlaylist {
  id: string;
  name: string;
  description?: string;
  coverUrl?: string;
  itemIds: string[];
  createdAt: number;
}

export type MusicTab = 'canciones' | 'albumes' | 'playlists';

interface SpotifyMusicViewProps {
  items: InfinityItem[];
  onEdit: (item: InfinityItem) => void;
  onMove?: (item: InfinityItem) => void;
}

export function SpotifyMusicView({ items, onEdit }: SpotifyMusicViewProps) {
  const { user } = useAuth();
  const { currentTrack, isPlaying, playTrack, togglePlayPause } = usePlayer();
  const { toggleFavorite, moveToTrash } = useItems();

  const [activeTab, setActiveTab] = useState<MusicTab>('canciones');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAlbum, setSelectedAlbum] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);

  // Playlists persistence
  const storageKey = `infinity_playlists_${user?.uid || 'local'}`;
  const [playlists, setPlaylists] = useState<CustomPlaylist[]>([]);
  const [isLoadedPlaylists, setIsLoadedPlaylists] = useState(false);

  // Modals state
  const [isCreatePlaylistOpen, setIsCreatePlaylistOpen] = useState(false);
  const [editingPlaylist, setEditingPlaylist] = useState<CustomPlaylist | null>(null);
  const [playlistFormName, setPlaylistFormName] = useState('');
  const [playlistFormDesc, setPlaylistFormDesc] = useState('');
  const [playlistFormCover, setPlaylistFormCover] = useState('');

  // Add song to playlist modal
  const [itemToAddToPlaylist, setItemToAddToPlaylist] = useState<InfinityItem | null>(null);
  const [activeMenuTrackId, setActiveMenuTrackId] = useState<string | null>(null);

  // Load playlists from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setPlaylists(JSON.parse(saved));
      } else {
        // Sample starter playlist if empty
        const sample: CustomPlaylist = {
          id: 'favorites-playlist',
          name: 'Mis Favoritas',
          description: 'Canciones destacadas de mi biblioteca',
          coverUrl: '',
          itemIds: items.filter(i => i.isFavorite).map(i => i.id),
          createdAt: Date.now()
        };
        setPlaylists([sample]);
      }
    } catch {
      // fallback
    } finally {
      setIsLoadedPlaylists(true);
    }
  }, [storageKey, items]);

  // Save playlists to localStorage
  const savePlaylists = (newPlaylists: CustomPlaylist[]) => {
    setPlaylists(newPlaylists);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newPlaylists));
    } catch (e) {
      console.error('Error saving playlists:', e);
    }
  };

  // Filter songs
  const musicSongs = useMemo(() => {
    return items.filter(i => (i.category === 'music' || i.metadata?.isNotionAudio) && !i.isTrash);
  }, [items]);

  const filteredSongs = useMemo(() => {
    if (!searchQuery.trim()) return musicSongs;
    const q = searchQuery.toLowerCase();
    return musicSongs.filter(item => {
      const name = item.name.toLowerCase();
      const artist = (item.metadata?.artist || '').toLowerCase();
      const album = (item.metadata?.album || '').toLowerCase();
      return name.includes(q) || artist.includes(q) || album.includes(q);
    });
  }, [musicSongs, searchQuery]);

  // Group by Album
  const albumsMap = useMemo(() => {
    const map = new Map<string, { albumName: string; artist: string; cover?: string; tracks: InfinityItem[] }>();

    musicSongs.forEach(song => {
      const albumName = song.metadata?.album?.trim() || 'Sencillos & Varios';
      const artist = song.metadata?.artist?.trim() || 'Varios Artistas';
      const cover = song.thumbnailUrl;

      if (!map.has(albumName)) {
        map.set(albumName, {
          albumName,
          artist,
          cover,
          tracks: []
        });
      }
      const albumEntry = map.get(albumName)!;
      albumEntry.tracks.push(song);
      if (!albumEntry.cover && cover) {
        albumEntry.cover = cover;
      }
    });

    return Array.from(map.values());
  }, [musicSongs]);

  // Selected Album tracks
  const currentAlbumData = useMemo(() => {
    if (!selectedAlbum) return null;
    return albumsMap.find(a => a.albumName === selectedAlbum) || null;
  }, [selectedAlbum, albumsMap]);

  // Selected Playlist
  const currentPlaylist = useMemo(() => {
    if (!selectedPlaylistId) return null;
    return playlists.find(p => p.id === selectedPlaylistId) || null;
  }, [selectedPlaylistId, playlists]);

  const currentPlaylistTracks = useMemo(() => {
    if (!currentPlaylist) return [];
    return currentPlaylist.itemIds
      .map(id => musicSongs.find(s => s.id === id))
      .filter((s): s is InfinityItem => Boolean(s));
  }, [currentPlaylist, musicSongs]);

  // Handle Play track
  const handlePlaySong = (song: InfinityItem, queueList: InfinityItem[]) => {
    if (currentTrack?.id === song.id) {
      togglePlayPause();
    } else {
      playTrack(song, queueList);
    }
  };

  // Play All in current queue
  const handlePlayAll = (queueList: InfinityItem[], shuffle = false) => {
    if (queueList.length === 0) return;
    const listToPlay = shuffle ? [...queueList].sort(() => Math.random() - 0.5) : queueList;
    playTrack(listToPlay[0], listToPlay);
  };

  // Format track duration
  const formatDuration = (item: InfinityItem) => {
    if (item.metadata?.duration) {
      const dur = item.metadata.duration;
      if (typeof dur === 'number') {
        const mins = Math.floor(dur / 60);
        const secs = Math.floor(dur % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
      }
      return dur;
    }
    return '--:--';
  };

  // Playlist Create/Edit actions
  const openCreatePlaylistModal = () => {
    setEditingPlaylist(null);
    setPlaylistFormName('');
    setPlaylistFormDesc('');
    setPlaylistFormCover('');
    setIsCreatePlaylistOpen(true);
  };

  const openEditPlaylistModal = (pl: CustomPlaylist) => {
    setEditingPlaylist(pl);
    setPlaylistFormName(pl.name);
    setPlaylistFormDesc(pl.description || '');
    setPlaylistFormCover(pl.coverUrl || '');
    setIsCreatePlaylistOpen(true);
  };

  const handleSavePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playlistFormName.trim()) return;

    if (editingPlaylist) {
      const updated = playlists.map(p =>
        p.id === editingPlaylist.id
          ? {
              ...p,
              name: playlistFormName.trim(),
              description: playlistFormDesc.trim() || undefined,
              coverUrl: playlistFormCover.trim() || undefined
            }
          : p
      );
      savePlaylists(updated);
    } else {
      const newPl: CustomPlaylist = {
        id: `pl_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        name: playlistFormName.trim(),
        description: playlistFormDesc.trim() || undefined,
        coverUrl: playlistFormCover.trim() || undefined,
        itemIds: [],
        createdAt: Date.now()
      };
      savePlaylists([newPl, ...playlists]);
      setSelectedPlaylistId(newPl.id);
    }

    setIsCreatePlaylistOpen(false);
  };

  const handleDeletePlaylist = (id: string) => {
    if (window.confirm('¿Eliminar esta playlist? Las canciones originales no se borrarán.')) {
      savePlaylists(playlists.filter(p => p.id !== id));
      if (selectedPlaylistId === id) {
        setSelectedPlaylistId(null);
      }
    }
  };

  const handleAddSongToPlaylist = (playlistId: string, songId: string) => {
    const updated = playlists.map(p => {
      if (p.id === playlistId) {
        const exists = p.itemIds.includes(songId);
        return {
          ...p,
          itemIds: exists ? p.itemIds : [...p.itemIds, songId]
        };
      }
      return p;
    });
    savePlaylists(updated);
    setItemToAddToPlaylist(null);
  };

  const handleRemoveFromPlaylist = (playlistId: string, songId: string) => {
    const updated = playlists.map(p => {
      if (p.id === playlistId) {
        return {
          ...p,
          itemIds: p.itemIds.filter(id => id !== songId)
        };
      }
      return p;
    });
    savePlaylists(updated);
  };

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPlaylistFormCover(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      {/* Spotify-style Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-emerald-900/40 via-violet-950/40 to-slate-900 border border-slate-200/80 dark:border-slate-800 p-6 md:p-8 shadow-xl">
        {/* Glow circles */}
        <div className="absolute -top-12 -left-12 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 right-0 w-80 h-80 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-700 shadow-xl flex items-center justify-center text-white shrink-0">
              <Music size={40} className="drop-shadow" />
            </div>

            <div>
              <span className="text-xs uppercase font-bold tracking-widest text-emerald-500">
                Reproductor de Música
              </span>
              <h1 className="text-2xl md:text-4xl font-extrabold text-slate-900 dark:text-white mt-1">
                Tu Biblioteca Musical
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
                {musicSongs.length} canciones • {albumsMap.length} álbumes • {playlists.length} playlists
              </p>
            </div>
          </div>

          {/* Quick Play & Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => handlePlayAll(musicSongs, false)}
              disabled={musicSongs.length === 0}
              className="px-5 py-3 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-sm shadow-lg hover:shadow-emerald-500/25 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <Play size={18} fill="currentColor" />
              <span>Reproducir todo</span>
            </button>

            <button
              onClick={() => handlePlayAll(musicSongs, true)}
              disabled={musicSongs.length === 0}
              className="p-3 rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors shadow-sm disabled:opacity-50"
              title="Reproducción aleatoria"
            >
              <Shuffle size={18} />
            </button>

            <button
              onClick={openCreatePlaylistModal}
              className="px-4 py-3 rounded-full bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:border-emerald-500 text-slate-700 dark:text-slate-200 font-medium text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-sm"
            >
              <Plus size={16} />
              <span>Crear playlist</span>
            </button>
          </div>
        </div>
      </div>

      {/* Detail View Breadcrumb / Back button */}
      {(selectedAlbum || selectedPlaylistId) && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setSelectedAlbum(null);
              setSelectedPlaylistId(null);
            }}
            className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver a {selectedAlbum ? 'Álbumes' : 'Playlists'}</span>
          </button>
          <span className="text-xs text-slate-400">•</span>
          <span className="text-xs font-bold text-slate-900 dark:text-white">
            {selectedAlbum || currentPlaylist?.name}
          </span>
        </div>
      )}

      {/* Sub Tabs Navigation (when not in sub-detail) */}
      {!selectedAlbum && !selectedPlaylistId && (
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('canciones')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'canciones'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Music size={15} />
              <span>Canciones</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeTab === 'canciones' ? 'bg-black/20 text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {musicSongs.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('albumes')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'albumes'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Disc size={15} />
              <span>Álbumes</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeTab === 'albumes' ? 'bg-black/20 text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {albumsMap.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('playlists')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition-all flex items-center gap-2 ${
                activeTab === 'playlists'
                  ? 'bg-emerald-500 text-black shadow-md'
                  : 'bg-slate-100 dark:bg-slate-800/80 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <ListMusic size={15} />
              <span>Playlists</span>
              <span className={`text-[11px] px-1.5 py-0.2 rounded-full ${activeTab === 'playlists' ? 'bg-black/20 text-black' : 'bg-slate-200 dark:bg-slate-700 text-slate-500'}`}>
                {playlists.length}
              </span>
            </button>
          </div>

          {/* Quick Search in Songs */}
          {activeTab === 'canciones' && (
            <div className="relative w-full sm:w-64">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Buscar canciones o artistas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3.5 py-1.5 text-xs rounded-xl bg-slate-100 dark:bg-slate-800/90 border border-slate-200/80 dark:border-slate-700 text-slate-800 dark:text-white placeholder:text-slate-400 outline-none focus:border-emerald-500"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* 1. CANCIONES TAB */}
      {!selectedAlbum && !selectedPlaylistId && activeTab === 'canciones' && (
        <div className="space-y-2">
          {filteredSongs.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-2">
              <Music size={28} className="mx-auto text-slate-400 opacity-60" />
              <p>No se encontraron canciones.</p>
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="text-emerald-500 underline">
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200/80 dark:border-slate-800/80 overflow-hidden bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm">
              {/* Table Header */}
              <div className="grid grid-cols-12 gap-2 px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                <div className="col-span-1 text-center">#</div>
                <div className="col-span-6 sm:col-span-5">Título</div>
                <div className="hidden sm:block sm:col-span-3">Álbum</div>
                <div className="col-span-5 sm:col-span-3 text-right flex items-center justify-end gap-1">
                  <Clock size={13} />
                </div>
              </div>

              {/* Table Rows */}
              <div className="divide-y divide-slate-100 dark:divide-slate-800/60">
                {filteredSongs.map((song, index) => {
                  const isCurrent = currentTrack?.id === song.id;
                  const isMenuOpen = activeMenuTrackId === song.id;

                  return (
                    <div
                      key={song.id}
                      onClick={() => handlePlaySong(song, filteredSongs)}
                      className={`grid grid-cols-12 gap-2 px-4 py-2.5 items-center group cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'hover:bg-slate-100/70 dark:hover:bg-slate-800/60 text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {/* Track number or play icon */}
                      <div className="col-span-1 text-center flex items-center justify-center text-xs font-semibold">
                        <span className="group-hover:hidden">
                          {isCurrent && isPlaying ? (
                            <span className="flex items-center gap-0.5 justify-center">
                              <span className="w-1 h-3 bg-emerald-500 animate-pulse" />
                              <span className="w-1 h-4 bg-emerald-500 animate-pulse delay-75" />
                              <span className="w-1 h-2 bg-emerald-500 animate-pulse delay-150" />
                            </span>
                          ) : (
                            index + 1
                          )}
                        </span>
                        <span className="hidden group-hover:flex items-center justify-center text-emerald-500">
                          {isCurrent && isPlaying ? <Pause size={14} /> : <Play size={14} fill="currentColor" />}
                        </span>
                      </div>

                      {/* Title & Artist with Square Cover */}
                      <div className="col-span-6 sm:col-span-5 flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-800 shrink-0 overflow-hidden relative shadow-sm ring-1 ring-black/5">
                          {song.thumbnailUrl ? (
                            /* eslint-disable-next-line @next/next/no-img-element */
                            <img
                              src={song.thumbnailUrl}
                              alt={song.name}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <Music size={18} />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className={`text-xs sm:text-sm font-semibold truncate ${isCurrent ? 'text-emerald-500' : ''}`}>
                            {song.name}
                          </p>
                          <p className="text-[11px] text-slate-400 truncate">
                            {song.metadata?.artist || 'Artista desconocido'}
                          </p>
                        </div>
                      </div>

                      {/* Album Name */}
                      <div className="hidden sm:block sm:col-span-3 text-xs text-slate-400 truncate">
                        {song.metadata?.album || '—'}
                      </div>

                      {/* Duration & Actions */}
                      <div className="col-span-5 sm:col-span-3 flex items-center justify-end gap-2 text-xs">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(song.id);
                          }}
                          className={`p-1.5 rounded-lg transition-colors ${
                            song.isFavorite
                              ? 'text-amber-500'
                              : 'text-slate-400 opacity-0 group-hover:opacity-100 hover:text-amber-500'
                          }`}
                          title={song.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
                        >
                          <Star size={14} fill={song.isFavorite ? 'currentColor' : 'none'} />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setItemToAddToPlaylist(song);
                          }}
                          className="p-1.5 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-emerald-500 transition-colors"
                          title="Añadir a playlist"
                        >
                          <FolderPlus size={14} />
                        </button>

                        {song.metadata?.lyrics && (
                          <span title="Letra sincronizada disponible" className="text-emerald-500 shrink-0">
                            <Mic2 size={13} />
                          </span>
                        )}

                        <span className="text-slate-400 font-mono text-[11px] w-12 text-right">
                          {formatDuration(song)}
                        </span>

                        {/* More Track Menu */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveMenuTrackId(prev => prev === song.id ? null : song.id);
                            }}
                            className="p-1 rounded-lg text-slate-400 opacity-0 group-hover:opacity-100 hover:text-slate-200 transition-colors"
                          >
                            <MoreVertical size={14} />
                          </button>

                          {isMenuOpen && (
                            <div
                              onClick={(e) => e.stopPropagation()}
                              className="absolute right-0 bottom-6 z-30 w-48 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in"
                            >
                              <button
                                onClick={() => {
                                  setActiveMenuTrackId(null);
                                  onEdit(song);
                                }}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Mic2 size={13} className="text-emerald-500" />
                                <span>{song.metadata?.lyrics ? 'Ver / Editar letra' : 'Añadir letra (.lrc)'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuTrackId(null);
                                  onEdit(song);
                                }}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Edit2 size={13} />
                                <span>Editar información</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuTrackId(null);
                                  setItemToAddToPlaylist(song);
                                }}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <FolderPlus size={13} />
                                <span>Añadir a playlist</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuTrackId(null);
                                  downloadItem(song);
                                }}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                              >
                                <Download size={13} />
                                <span>Descargar</span>
                              </button>
                              <button
                                onClick={() => {
                                  setActiveMenuTrackId(null);
                                  moveToTrash(song.id);
                                }}
                                className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-500"
                              >
                                <Trash2 size={13} />
                                <span>Mover a papelera</span>
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. ÁLBUMES TAB */}
      {!selectedAlbum && !selectedPlaylistId && activeTab === 'albumes' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {albumsMap.map(album => (
            <div
              key={album.albumName}
              onClick={() => setSelectedAlbum(album.albumName)}
              className="group p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
            >
              <div className="relative aspect-square w-full rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden mb-3 shadow">
                {album.cover ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={album.cover}
                    alt={album.albumName}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-violet-950/40 to-slate-900">
                    <Disc size={36} />
                  </div>
                )}

                {/* Floating Play Album button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayAll(album.tracks, false);
                  }}
                  className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all"
                  title="Reproducir álbum"
                >
                  <Play size={18} fill="currentColor" className="ml-0.5" />
                </button>
              </div>

              <div>
                <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate group-hover:text-emerald-500 transition-colors">
                  {album.albumName}
                </h3>
                <p className="text-[11px] text-slate-400 truncate mt-0.5">
                  {album.artist} • {album.tracks.length} {album.tracks.length === 1 ? 'canción' : 'canciones'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 3. PLAYLISTS TAB */}
      {!selectedAlbum && !selectedPlaylistId && activeTab === 'playlists' && (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Create Playlist Card */}
          <div
            onClick={openCreatePlaylistModal}
            className="group p-5 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-emerald-500 dark:hover:border-emerald-500 flex flex-col items-center justify-center text-center cursor-pointer transition-colors aspect-square"
          >
            <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center group-hover:scale-110 transition-transform mb-3">
              <Plus size={24} />
            </div>
            <span className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white">
              Crear playlist
            </span>
            <span className="text-[11px] text-slate-400 mt-0.5">
              Con portada propia
            </span>
          </div>

          {/* Playlist Cards */}
          {playlists.map(pl => {
            const trackCount = pl.itemIds.length;
            const firstSong = musicSongs.find(s => s.id === pl.itemIds[0]);
            const coverImage = pl.coverUrl || firstSong?.thumbnailUrl;

            return (
              <div
                key={pl.id}
                onClick={() => setSelectedPlaylistId(pl.id)}
                className="group relative p-3.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 hover:border-emerald-500/50 shadow-sm hover:shadow-xl transition-all cursor-pointer flex flex-col justify-between"
              >
                <div className="relative aspect-square w-full rounded-xl bg-slate-100 dark:bg-slate-950 overflow-hidden mb-3 shadow">
                  {coverImage ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={coverImage}
                      alt={pl.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 bg-gradient-to-br from-emerald-950/50 via-slate-900 to-slate-950">
                      <ListMusic size={36} />
                    </div>
                  )}

                  {/* Play Playlist Overlay Button */}
                  {trackCount > 0 && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const tracks = pl.itemIds
                          .map(id => musicSongs.find(s => s.id === id))
                          .filter((s): s is InfinityItem => Boolean(s));
                        handlePlayAll(tracks, false);
                      }}
                      className="absolute bottom-2.5 right-2.5 w-10 h-10 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all"
                      title="Reproducir playlist"
                    >
                      <Play size={18} fill="currentColor" className="ml-0.5" />
                    </button>
                  )}
                </div>

                <div className="flex items-start justify-between gap-1">
                  <div className="min-w-0 flex-1">
                    <h3 className="font-bold text-xs sm:text-sm text-slate-800 dark:text-white truncate group-hover:text-emerald-500 transition-colors">
                      {pl.name}
                    </h3>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">
                      {trackCount} {trackCount === 1 ? 'canción' : 'canciones'}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      openEditPlaylistModal(pl);
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-200 transition-colors opacity-0 group-hover:opacity-100"
                    title="Editar playlist"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 4. SELECTED ALBUM DETAIL VIEW */}
      {selectedAlbum && currentAlbumData && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-800 shadow-xl shrink-0">
              {currentAlbumData.cover ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentAlbumData.cover}
                  alt={currentAlbumData.albumName}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <Disc size={48} />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-500">Álbum</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {currentAlbumData.albumName}
              </h2>
              <p className="text-xs sm:text-sm text-slate-300 mt-1">
                {currentAlbumData.artist} • {currentAlbumData.tracks.length} canciones
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                <button
                  onClick={() => handlePlayAll(currentAlbumData.tracks, false)}
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm shadow flex items-center gap-2 transition-all active:scale-95"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Reproducir álbum</span>
                </button>
              </div>
            </div>
          </div>

          {/* Tracks list */}
          <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/50 dark:bg-slate-900/50">
            {currentAlbumData.tracks.map((track, i) => (
              <div
                key={track.id}
                onClick={() => handlePlaySong(track, currentAlbumData.tracks)}
                className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center group cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800/60"
              >
                <div className="col-span-1 text-center text-xs font-semibold text-slate-400">
                  <span className="group-hover:hidden">{i + 1}</span>
                  <span className="hidden group-hover:inline text-emerald-500">
                    <Play size={13} fill="currentColor" />
                  </span>
                </div>
                <div className="col-span-8 min-w-0">
                  <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white truncate">
                    {track.name}
                  </p>
                  <p className="text-[11px] text-slate-400 truncate">
                    {track.metadata?.artist || currentAlbumData.artist}
                  </p>
                </div>
                <div className="col-span-3 text-right text-xs text-slate-400 font-mono">
                  {formatDuration(track)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. SELECTED PLAYLIST DETAIL VIEW */}
      {selectedPlaylistId && currentPlaylist && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-6 p-6 rounded-3xl bg-slate-900/60 border border-slate-800">
            <div className="w-36 h-36 rounded-2xl overflow-hidden bg-slate-800 shadow-xl shrink-0">
              {currentPlaylist.coverUrl || currentPlaylistTracks[0]?.thumbnailUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={currentPlaylist.coverUrl || currentPlaylistTracks[0]?.thumbnailUrl}
                  alt={currentPlaylist.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-slate-500">
                  <ListMusic size={48} />
                </div>
              )}
            </div>

            <div className="flex-1 text-center sm:text-left">
              <span className="text-[11px] uppercase tracking-wider font-bold text-emerald-500">Playlist</span>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-white mt-1">
                {currentPlaylist.name}
              </h2>
              {currentPlaylist.description && (
                <p className="text-xs text-slate-300 mt-1">{currentPlaylist.description}</p>
              )}
              <p className="text-xs text-slate-400 mt-1">
                {currentPlaylistTracks.length} canciones
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-3 mt-4">
                <button
                  onClick={() => handlePlayAll(currentPlaylistTracks, false)}
                  disabled={currentPlaylistTracks.length === 0}
                  className="px-5 py-2.5 rounded-full bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs sm:text-sm shadow flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
                >
                  <Play size={16} fill="currentColor" />
                  <span>Reproducir playlist</span>
                </button>

                <button
                  onClick={() => openEditPlaylistModal(currentPlaylist)}
                  className="px-4 py-2.5 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Edit2 size={14} />
                  <span>Editar</span>
                </button>

                <button
                  onClick={() => handleDeletePlaylist(currentPlaylist.id)}
                  className="px-4 py-2.5 rounded-full bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold transition-colors flex items-center gap-1.5"
                >
                  <Trash2 size={14} />
                  <span>Eliminar playlist</span>
                </button>
              </div>
            </div>
          </div>

          {/* Playlist Tracks List */}
          {currentPlaylistTracks.length === 0 ? (
            <div className="p-12 text-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-800 text-slate-400 text-xs space-y-2">
              <p>Esta playlist aún no tiene canciones.</p>
              <button
                onClick={() => {
                  setSelectedPlaylistId(null);
                  setActiveTab('canciones');
                }}
                className="text-emerald-500 font-semibold underline"
              >
                Ir a canciones y agregar
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden bg-white/50 dark:bg-slate-900/50">
              {currentPlaylistTracks.map((track, i) => (
                <div
                  key={track.id}
                  onClick={() => handlePlaySong(track, currentPlaylistTracks)}
                  className="grid grid-cols-12 gap-2 px-4 py-2.5 items-center group cursor-pointer hover:bg-slate-100/70 dark:hover:bg-slate-800/60 transition-colors border-b last:border-0 border-slate-100 dark:border-slate-800/60"
                >
                  <div className="col-span-1 text-center text-xs font-semibold text-slate-400">
                    <span className="group-hover:hidden">{i + 1}</span>
                    <span className="hidden group-hover:inline text-emerald-500">
                      <Play size={13} fill="currentColor" />
                    </span>
                  </div>
                  <div className="col-span-8 min-w-0 flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      {track.thumbnailUrl ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img src={track.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <Music size={14} className="m-auto text-slate-500" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs sm:text-sm font-semibold text-slate-800 dark:text-white truncate">
                        {track.name}
                      </p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {track.metadata?.artist || 'Artista desconocido'}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-3 flex items-center justify-end gap-3 text-xs text-slate-400">
                    <span className="font-mono text-[11px]">{formatDuration(track)}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleRemoveFromPlaylist(currentPlaylist.id, track.id);
                      }}
                      className="p-1 rounded hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      title="Quitar de la playlist"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CREATE / EDIT PLAYLIST MODAL */}
      {isCreatePlaylistOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base text-slate-900 dark:text-white">
                {editingPlaylist ? 'Editar Playlist' : 'Nueva Playlist'}
              </h3>
              <button
                onClick={() => setIsCreatePlaylistOpen(false)}
                className="p-1.5 rounded-xl text-slate-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSavePlaylist} className="space-y-4">
              {/* Cover Preview & Upload */}
              <div className="flex items-center gap-4">
                <div className="relative w-24 h-24 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700">
                  {playlistFormCover ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={playlistFormCover} alt="Cover" className="w-full h-full object-cover" />
                  ) : (
                    <ImageIcon size={28} className="text-slate-400" />
                  )}
                </div>

                <div className="space-y-2 flex-1">
                  <label className="block text-xs font-semibold text-slate-500">
                    Imagen de portada
                  </label>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-medium text-slate-700 dark:text-slate-200 flex items-center gap-1.5 transition-colors"
                  >
                    <Upload size={13} />
                    <span>Subir imagen</span>
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleCoverUpload}
                    className="hidden"
                  />
                  <input
                    type="url"
                    value={playlistFormCover}
                    onChange={(e) => setPlaylistFormCover(e.target.value)}
                    placeholder="O pega URL de imagen..."
                    className="w-full px-3 py-1.5 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none text-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Nombre de la playlist *
                </label>
                <input
                  type="text"
                  required
                  value={playlistFormName}
                  onChange={(e) => setPlaylistFormName(e.target.value)}
                  placeholder="ej. Éxitos en español, Rock clásico..."
                  className="w-full px-3.5 py-2 text-sm rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none text-slate-800 dark:text-white focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1">
                  Descripción (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={playlistFormDesc}
                  onChange={(e) => setPlaylistFormDesc(e.target.value)}
                  placeholder="Descripción de la playlist..."
                  className="w-full px-3.5 py-2 text-xs rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 outline-none text-slate-800 dark:text-white focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsCreatePlaylistOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-xs shadow transition-colors"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADD SONG TO PLAYLIST MODAL */}
      {itemToAddToPlaylist && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  Añadir a playlist
                </h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[220px]">
                  {itemToAddToPlaylist.name}
                </p>
              </div>
              <button
                onClick={() => setItemToAddToPlaylist(null)}
                className="p-1 rounded-xl text-slate-400 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-1.5 max-h-60 overflow-y-auto">
              {playlists.map(pl => {
                const isAlreadyIn = pl.itemIds.includes(itemToAddToPlaylist.id);
                return (
                  <button
                    key={pl.id}
                    onClick={() => handleAddSongToPlaylist(pl.id, itemToAddToPlaylist.id)}
                    className="w-full p-2.5 rounded-xl border border-slate-200/60 dark:border-slate-800 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 dark:text-white truncate">
                        {pl.name}
                      </p>
                      <p className="text-[10px] text-slate-400">
                        {pl.itemIds.length} canciones
                      </p>
                    </div>

                    {isAlreadyIn ? (
                      <span className="text-emerald-500 text-xs flex items-center gap-1 font-medium">
                        <Check size={14} /> Añadida
                      </span>
                    ) : (
                      <span className="text-xs text-blue-500 font-medium">
                        + Añadir
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setItemToAddToPlaylist(null);
                openCreatePlaylistModal();
              }}
              className="w-full py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 hover:border-emerald-500 text-xs font-semibold text-emerald-500 flex items-center justify-center gap-1.5 transition-colors"
            >
              <Plus size={14} />
              <span>Crear nueva playlist</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
