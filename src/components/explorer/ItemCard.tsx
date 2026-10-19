'use client';

import React, { useState } from 'react';
import { InfinityItem } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { usePlayer } from '@/context/PlayerContext';
import { 
  Star, 
  Trash2, 
  MoreVertical, 
  Play, 
  Edit3, 
  FolderInput, 
  RotateCcw, 
  ExternalLink, 
  Copy, 
  Check, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  Music as MusicIcon, 
  FileText as FileIcon,
  Archive as ArchiveIcon,
  Lock,
  Sliders
} from 'lucide-react';

interface ItemCardProps {
  item: InfinityItem;
  onOpen: (item: InfinityItem) => void;
  onEdit?: (item: InfinityItem) => void;
  onMove?: (item: InfinityItem) => void;
  readOnly?: boolean;
}

export function ItemCard({ item, onOpen, onEdit, onMove, readOnly }: ItemCardProps) {
  const isReadOnly = readOnly ?? (!onEdit && !onMove);
  const { toggleFavorite, moveToTrash, restoreFromTrash, deletePermanently, collections } = useItems();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [thumbSrc, setThumbSrc] = useState<string | undefined>(item.thumbnailUrl);
  const [imgError, setImgError] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  React.useEffect(() => {
    setThumbSrc(item.thumbnailUrl);
    setImgError(false);
  }, [item.thumbnailUrl]);

  const handleImageError = () => {
    if (thumbSrc && thumbSrc.includes('maxresdefault.jpg')) {
      // YouTube videos that lack 1080p maxresdefault fallback to mqdefault (16:9, guaranteed)
      setThumbSrc(thumbSrc.replace('maxresdefault.jpg', 'mqdefault.jpg'));
    } else {
      setImgError(true);
    }
  };

  const isCurrentPlayingAudio = currentTrack?.id === item.id && isPlaying;
  const coll = collections.find(c => c.id === item.collectionId);

  const copyUrl = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    setShowMenu(false);
  };

  const getCategoryIcon = () => {
    switch (item.category) {
      case 'photos': return <ImageIcon size={28} className="text-emerald-500" />;
      case 'videos': return <VideoIcon size={28} className="text-rose-500" />;
      case 'music': return <MusicIcon size={28} className="text-violet-500" />;
      case 'documents': return <FileIcon size={28} className="text-amber-500" />;
      default: return <ArchiveIcon size={28} className="text-slate-500" />;
    }
  };

  const getProviderBadgeColor = () => {
    switch (item.provider) {
      case 'youtube': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      case 'drive': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'notion': return 'bg-slate-800/10 text-slate-800 dark:bg-white/10 dark:text-white border-slate-500/20';
      case 'soundcloud': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'vimeo': return 'bg-teal-500/10 text-teal-500 border-teal-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div
      onClick={() => onOpen(item)}
      className="group relative bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm hover:shadow-xl hover:border-blue-500/40 transition-all duration-200 flex flex-col cursor-pointer"
    >
      {/* Thumbnail / Preview Area */}
      <div className="relative w-full aspect-video bg-slate-100 dark:bg-slate-950 flex items-center justify-center overflow-hidden">
        {thumbSrc && !imgError ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={thumbSrc}
            alt={item.name}
            onError={handleImageError}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-4">
            {getCategoryIcon()}
          </div>
        )}

        {/* Category Overlay Icon */}
        <div className="absolute top-2.5 left-2.5 p-1.5 rounded-lg bg-black/50 backdrop-blur-md text-white text-xs shadow">
          {item.category === 'photos' && <ImageIcon size={13} />}
          {item.category === 'videos' && <VideoIcon size={13} />}
          {item.category === 'music' && <MusicIcon size={13} />}
          {item.category === 'documents' && <FileIcon size={13} />}
          {item.category === 'others' && <ArchiveIcon size={13} />}
        </div>

        {/* Favorite Button (only when not in trash and editable) */}
        {!item.isTrash && !isReadOnly && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className={`absolute top-2.5 right-2.5 p-1.5 rounded-lg backdrop-blur-md transition-all ${
              item.isFavorite
                ? 'bg-amber-500/90 text-white shadow-md'
                : 'bg-black/40 text-white/80 opacity-0 group-hover:opacity-100 hover:text-white hover:bg-black/70'
            }`}
            title={item.isFavorite ? 'Quitar de favoritos' : 'Añadir a favoritos'}
          >
            <Star size={14} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}

        {/* Play Overlay for Audio & Video */}
        {(item.category === 'music' || item.category === 'videos') && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onOpen(item);
            }}
            className={`absolute inset-0 m-auto w-12 h-12 rounded-full bg-black/60 backdrop-blur-md text-white flex items-center justify-center transition-all ${
              isCurrentPlayingAudio
                ? 'ring-2 ring-violet-500 scale-105'
                : 'opacity-0 group-hover:opacity-100 group-hover:scale-105 hover:bg-violet-600'
            }`}
            title="Reproducir"
          >
            <Play size={20} className="ml-0.5" />
          </button>
        )}
      </div>

      {/* Card Body */}
      <div className="p-3.5 flex-1 flex flex-col justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border uppercase tracking-wider ${getProviderBadgeColor()}`}>
              {item.category === 'videos' || item.provider === 'youtube' ? 'video' : (item.category === 'music' && item.provider === 'direct' ? 'audio' : item.provider)}
            </span>

            {item.isProtected && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1" title="Protegido con contraseña">
                <Lock size={10} />
                <span>Bloqueado</span>
              </span>
            )}

            {coll && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1 truncate max-w-[120px]">
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: coll.color || '#8b5cf6' }} />
                <span className="truncate">{coll.name}</span>
              </span>
            )}
          </div>

          <h3 className="font-medium text-xs sm:text-sm text-slate-900 dark:text-white line-clamp-2 title-hover group-hover:text-blue-500 transition-colors" title={item.name}>
            {item.name}
          </h3>
        </div>

        {/* Footer with Menu Actions */}
        <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between">
          <span className="text-[11px] text-slate-400 font-mono">
            {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })}
          </span>

          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(prev => !prev);
              }}
              className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Más opciones"
            >
              <MoreVertical size={16} />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute right-0 bottom-8 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150"
              >
                {!item.isTrash ? (
                  <>
                    <button
                      onClick={() => {
                        setShowMenu(false);
                        onOpen(item);
                      }}
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <Play size={13} /> Abrir visor
                    </button>
                    {onEdit && (
                      <>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onEdit(item);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          <Sliders size={13} /> Editar información
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            onEdit(item);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                        >
                          <Edit3 size={13} /> Editar nombre
                        </button>
                      </>
                    )}
                    {onMove && (
                      <button
                        onClick={() => {
                          setShowMenu(false);
                          onMove(item);
                        }}
                        className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                      >
                        <FolderInput size={13} /> Mover a colección
                      </button>
                    )}
                    <button
                      onClick={copyUrl}
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      {copied ? <Check size={13} className="text-emerald-500" /> : <Copy size={13} />}
                      Copiar enlace
                    </button>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200"
                    >
                      <ExternalLink size={13} /> Abrir original
                    </a>
                    {!isReadOnly && (
                      <>
                        <div className="border-t border-slate-100 dark:border-slate-800 my-1" />
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            moveToTrash(item.id);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
                        >
                          <Trash2 size={13} /> Mover a papelera
                        </button>
                      </>
                    )}
                  </>
                ) : (
                  <>
                    {!isReadOnly ? (
                      <>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            restoreFromTrash(item.id);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 text-emerald-600"
                        >
                          <RotateCcw size={13} /> Restaurar
                        </button>
                        <button
                          onClick={() => {
                            setShowMenu(false);
                            deletePermanently(item.id);
                          }}
                          className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600"
                        >
                          <Trash2 size={13} /> Eliminar definitivo
                        </button>
                      </>
                    ) : (
                      <div className="px-3 py-1.5 text-slate-400 text-[11px]">En papelera</div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
