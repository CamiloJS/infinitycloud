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

interface ItemRowProps {
  item: InfinityItem;
  onOpen: (item: InfinityItem) => void;
  onEdit?: (item: InfinityItem) => void;
  onMove?: (item: InfinityItem) => void;
}

export function ItemRow({ item, onOpen, onEdit, onMove }: ItemRowProps) {
  const { toggleFavorite, moveToTrash, restoreFromTrash, deletePermanently, collections } = useItems();
  const { playTrack, currentTrack, isPlaying } = usePlayer();
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [thumbSrc, setThumbSrc] = useState<string | undefined>(item.thumbnailUrl);
  const [copied, setCopied] = useState<boolean>(false);

  React.useEffect(() => {
    setThumbSrc(item.thumbnailUrl);
  }, [item.thumbnailUrl]);

  const handleImageError = () => {
    if (thumbSrc && thumbSrc.includes('maxresdefault.jpg')) {
      setThumbSrc(thumbSrc.replace('maxresdefault.jpg', 'mqdefault.jpg'));
    }
  };

  const isCurrentPlaying = currentTrack?.id === item.id && isPlaying;
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
      case 'photos': return <ImageIcon size={18} className="text-emerald-500" />;
      case 'videos': return <VideoIcon size={18} className="text-rose-500" />;
      case 'music': return <MusicIcon size={18} className="text-violet-500" />;
      case 'documents': return <FileIcon size={18} className="text-amber-500" />;
      default: return <ArchiveIcon size={18} className="text-slate-500" />;
    }
  };

  return (
    <div
      onClick={() => onOpen(item)}
      className={`group flex items-center justify-between p-3 rounded-xl bg-white dark:bg-slate-900 border ${
        isCurrentPlaying
          ? 'border-violet-500/60 ring-1 ring-violet-500/40 bg-violet-50/20 dark:bg-violet-950/20'
          : 'border-slate-200/80 dark:border-slate-800/80 hover:border-blue-500/40'
      } hover:shadow-md transition-all cursor-pointer select-none text-xs sm:text-sm`}
    >
      {/* Left: Thumbnail & Title */}
      <div className="flex items-center gap-3 min-w-0 flex-1 pr-4">
        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-950 flex items-center justify-center shrink-0 overflow-hidden relative">
          {thumbSrc ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={thumbSrc} alt={item.name} onError={handleImageError} className="w-full h-full object-cover" />
          ) : (
            getCategoryIcon()
          )}

          {(item.category === 'music' || item.category === 'videos') && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpen(item);
              }}
              className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            >
              <Play size={14} className="ml-0.5" />
            </button>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 dark:text-white truncate">
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
            <span className="uppercase text-[10px] font-semibold tracking-wider font-mono">
              {item.category === 'videos' || item.provider === 'youtube' ? 'video' : (item.category === 'music' && item.provider === 'direct' ? 'audio' : item.provider)}
            </span>
            {item.isProtected && (
              <span className="text-[10px] text-amber-500 flex items-center gap-0.5 font-semibold">
                <Lock size={10} /> Protegido
              </span>
            )}
            {coll && (
              <>
                <span>•</span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: coll.color || '#8b5cf6' }} />
                  {coll.name}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Date */}
      <div className="hidden md:block w-32 text-slate-400 text-xs font-mono">
        {new Date(item.createdAt).toLocaleDateString('es-ES', { day: '2-digit', month: 'short', year: 'numeric' })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!item.isTrash && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(item.id);
            }}
            className={`p-1.5 rounded-lg transition-colors ${
              item.isFavorite
                ? 'text-amber-500'
                : 'text-slate-300 dark:text-slate-600 hover:text-amber-400'
            }`}
            title="Favorito"
          >
            <Star size={16} fill={item.isFavorite ? 'currentColor' : 'none'} />
          </button>
        )}

        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(prev => !prev);
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <MoreVertical size={16} />
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150"
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
              ) : (
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
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
