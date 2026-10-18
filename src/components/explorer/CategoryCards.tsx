'use client';

import React from 'react';
import { useItems } from '@/context/ItemsContext';
import { CategoryType } from '@/types';
import { Image, Video, Music, FileText, Archive, Layers } from 'lucide-react';

export function CategoryCards() {
  const { items, activeCategory, setActiveCategory, activeView } = useItems();

  if (activeView !== 'library') return null;

  const categories: {
    id: CategoryType | 'all';
    label: string;
    icon: React.ReactNode;
    color: string;
    border: string;
  }[] = [
    {
      id: 'all',
      label: 'Todos',
      icon: <Layers size={20} className="text-blue-500" />,
      color: 'from-blue-500/10 to-indigo-500/10 hover:border-blue-500/40',
      border: 'border-blue-500/20'
    },
    {
      id: 'photos',
      label: 'Fotos',
      icon: <Image size={20} className="text-emerald-500" />,
      color: 'from-emerald-500/10 to-teal-500/10 hover:border-emerald-500/40',
      border: 'border-emerald-500/20'
    },
    {
      id: 'videos',
      label: 'Videos',
      icon: <Video size={20} className="text-rose-500" />,
      color: 'from-rose-500/10 to-red-500/10 hover:border-rose-500/40',
      border: 'border-rose-500/20'
    },
    {
      id: 'music',
      label: 'Música',
      icon: <Music size={20} className="text-violet-500" />,
      color: 'from-violet-500/10 to-purple-500/10 hover:border-violet-500/40',
      border: 'border-violet-500/20'
    },
    {
      id: 'documents',
      label: 'Documentos',
      icon: <FileText size={20} className="text-amber-500" />,
      color: 'from-amber-500/10 to-orange-500/10 hover:border-amber-500/40',
      border: 'border-amber-500/20'
    },
    {
      id: 'others',
      label: 'Otros',
      icon: <Archive size={20} className="text-slate-500" />,
      color: 'from-slate-500/10 to-gray-500/10 hover:border-slate-500/40',
      border: 'border-slate-500/20'
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6 select-none">
      {categories.map(cat => {
        const count = cat.id === 'all'
          ? items.filter(i => !i.isTrash).length
          : items.filter(i => !i.isTrash && i.category === cat.id).length;

        const isSelected = activeCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id)}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left bg-gradient-to-br ${cat.color} ${
              isSelected
                ? 'ring-2 ring-blue-500 shadow-md bg-white dark:bg-slate-900 border-blue-500/50'
                : `bg-white/50 dark:bg-slate-900/40 border-slate-200/80 dark:border-slate-800/80`
            }`}
          >
            <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm shrink-0">
              {cat.icon}
            </div>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                {cat.label}
              </div>
              <div className="text-[11px] text-slate-400 font-mono">
                {count} {count === 1 ? 'archivo' : 'archivos'}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}
