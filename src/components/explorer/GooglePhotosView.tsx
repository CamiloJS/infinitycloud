'use client';

import React, { useState } from 'react';
import { InfinityItem } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { 
  Star, 
  MoreVertical, 
  Lock, 
  Edit2, 
  FolderInput, 
  Trash2, 
  Download,
  Image as ImageIcon,
  Calendar
} from 'lucide-react';
import { downloadItem } from '@/lib/utils/download';

interface GooglePhotosViewProps {
  items: InfinityItem[];
  onOpen: (item: InfinityItem) => void;
  onEdit: (item: InfinityItem) => void;
  onMove: (item: InfinityItem) => void;
}

interface DateGroup {
  dateKey: string;
  displayTitle: string;
  formattedSub: string;
  items: InfinityItem[];
}

export function GooglePhotosView({
  items,
  onOpen,
  onEdit,
  onMove
}: GooglePhotosViewProps) {
  const { toggleFavorite, moveToTrash } = useItems();
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Group items by date (YYYY-MM-DD)
  const groupItemsByDate = (): DateGroup[] => {
    const map = new Map<string, InfinityItem[]>();

    // Sort all items newest first
    const sorted = [...items].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    sorted.forEach(item => {
      const d = new Date(item.createdAt || Date.now());
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(dateKey)) {
        map.set(dateKey, []);
      }
      map.get(dateKey)!.push(item);
    });

    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;

    const groups: DateGroup[] = [];

    map.forEach((groupItems, dateKey) => {
      const sampleDate = new Date(groupItems[0].createdAt || Date.now());
      let displayTitle = '';

      if (dateKey === todayKey) {
        displayTitle = 'Hoy';
      } else if (dateKey === yesterdayKey) {
        displayTitle = 'Ayer';
      } else {
        const weekday = sampleDate.toLocaleDateString('es-ES', { weekday: 'long' });
        const capitalizedWeekday = weekday.charAt(0).toUpperCase() + weekday.slice(1);
        const day = sampleDate.getDate();
        const month = sampleDate.toLocaleDateString('es-ES', { month: 'long' });
        const year = sampleDate.getFullYear();

        if (year === now.getFullYear()) {
          displayTitle = `${capitalizedWeekday}, ${day} de ${month}`;
        } else {
          displayTitle = `${capitalizedWeekday}, ${day} de ${month} de ${year}`;
        }
      }

      const formattedSub = sampleDate.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short',
        year: sampleDate.getFullYear() !== now.getFullYear() ? 'numeric' : undefined
      });

      groups.push({
        dateKey,
        displayTitle,
        formattedSub,
        items: groupItems
      });
    });

    return groups;
  };

  const groups = groupItemsByDate();

  if (items.length === 0) {
    return (
      <div className="p-12 text-center rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
        <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
          <ImageIcon size={24} />
        </div>
        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          No hay fotos guardadas
        </p>
        <p className="text-xs text-slate-400 max-w-sm mx-auto">
          Añade enlaces directos a imágenes, fotos de Notion o Google Drive para verlas aquí organizadas por fecha.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-200 pb-12">
      {groups.map(group => (
        <section key={group.dateKey} className="space-y-3">
          {/* Date Header (Google Photos style sticky/clean header) */}
          <div className="flex items-baseline justify-between px-1">
            <div className="flex items-center gap-2">
              <Calendar size={15} className="text-emerald-500" />
              <h2 className="text-sm sm:text-base font-bold text-slate-800 dark:text-slate-100">
                {group.displayTitle}
              </h2>
              <span className="text-xs text-slate-400 font-medium">
                • {group.formattedSub}
              </span>
            </div>

            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-full">
              {group.items.length} {group.items.length === 1 ? 'foto' : 'fotos'}
            </span>
          </div>

          {/* Unified Photos Grid (dense, minimal gaps, aspect-square tiles) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5 sm:gap-2">
            {group.items.map(item => {
              const thumbSrc = item.thumbnailUrl || item.url;
              const isMenuOpen = activeMenuId === item.id;

              return (
                <div
                  key={item.id}
                  onClick={() => onOpen(item)}
                  draggable={!item.isTrash}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('text/plain', item.id);
                    e.dataTransfer.effectAllowed = 'move';
                  }}
                  className="group relative aspect-square rounded-xl sm:rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 cursor-pointer shadow-sm hover:shadow-lg transition-all duration-200 select-none active:scale-[0.98]"
                >
                  {/* Photo Thumbnail */}
                  {thumbSrc ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbSrc}
                      alt={item.name}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400">
                      <ImageIcon size={28} className="opacity-40" />
                    </div>
                  )}

                  {/* Top Overlay Badges */}
                  <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none z-10">
                    {item.isProtected ? (
                      <span className="p-1 rounded-lg bg-black/60 backdrop-blur-md text-amber-400 shadow pointer-events-auto" title="Foto protegida">
                        <Lock size={12} />
                      </span>
                    ) : (
                      <span />
                    )}

                    {/* Favorite Star Button */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(item.id);
                      }}
                      className={`p-1.5 rounded-lg backdrop-blur-md transition-all pointer-events-auto ${
                        item.isFavorite
                          ? 'bg-amber-500 text-white shadow-md'
                          : 'bg-black/40 text-white/80 opacity-0 group-hover:opacity-100 hover:bg-black/70 hover:text-white'
                      }`}
                      title={item.isFavorite ? 'Quitar de favoritos' : 'Marcar favorito'}
                    >
                      <Star size={13} fill={item.isFavorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Bottom Hover Gradient with Title & Menu Button */}
                  <div className="absolute inset-x-0 bottom-0 p-2.5 pt-6 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-between gap-1 z-10">
                    <p className="text-[11px] font-medium text-white truncate drop-shadow-sm min-w-0 flex-1">
                      {item.name}
                    </p>

                    <div className="relative">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveMenuId(prev => prev === item.id ? null : item.id);
                        }}
                        className="p-1 rounded-lg bg-black/40 hover:bg-black/70 text-white/90 transition-colors shrink-0"
                        title="Opciones"
                      >
                        <MoreVertical size={13} />
                      </button>

                      {/* Options Dropdown */}
                      {isMenuOpen && (
                        <div
                          className="absolute right-0 bottom-7 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xl py-1 text-xs animate-in fade-in duration-150"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onEdit(item);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <Edit2 size={13} />
                            <span>Editar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              onMove(item);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <FolderInput size={13} />
                            <span>Mover a carpeta</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              downloadItem(item);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                          >
                            <Download size={13} />
                            <span>Descargar</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveMenuId(null);
                              moveToTrash(item.id);
                            }}
                            className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
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
        </section>
      ))}
    </div>
  );
}
