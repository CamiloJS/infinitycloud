'use client';

import React from 'react';
import { useItems } from '@/context/ItemsContext';
import { Layers, Star, Trash2, Search, Plus, Sparkles } from 'lucide-react';

interface EmptyStateProps {
  onOpenAddModal: () => void;
  onOpenNotionModal: () => void;
}

export function EmptyState({ onOpenAddModal, onOpenNotionModal }: EmptyStateProps) {
  const { activeView, searchQuery, activeCategory, activeCollectionId, collections } = useItems();

  let icon = <Layers size={40} className="text-blue-500" />;
  let title = 'Tu biblioteca está vacía';
  let description = 'Comienza agregando enlaces de YouTube, Google Drive, Notion, o archivos directos.';
  let showActions = true;

  if (searchQuery.trim()) {
    icon = <Search size={40} className="text-slate-400" />;
    title = 'No se encontraron resultados';
    description = `No hay archivos que coincidan con "${searchQuery}". Intenta con otros términos.`;
    showActions = false;
  } else if (activeView === 'favorites') {
    icon = <Star size={40} className="text-amber-400" />;
    title = 'Sin archivos favoritos';
    description = 'Haz clic en la estrella de cualquier tarjeta para fijar aquí tus archivos destacados.';
    showActions = false;
  } else if (activeView === 'trash') {
    icon = <Trash2 size={40} className="text-slate-400" />;
    title = 'La papelera está limpia';
    description = 'Los elementos que envíes a la papelera aparecerán aquí para restaurarlos o eliminarlos.';
    showActions = false;
  } else if (activeCollectionId) {
    const coll = collections.find(c => c.id === activeCollectionId);
    title = `Colección vacía (${coll?.name || ''})`;
    description = 'Añade archivos a esta colección desde la biblioteca o usando el botón añadir.';
    showActions = true;
  } else if (activeCategory !== 'all') {
    title = `Sin archivos en esta categoría`;
    description = 'Añade enlaces o archivos correspondientes para verlos aquí.';
    showActions = true;
  }

  return (
    <div className="flex flex-col items-center justify-center p-12 text-center my-8 rounded-3xl border border-dashed border-slate-200 dark:border-slate-800 bg-white/40 dark:bg-slate-900/30">
      <div className="p-4 rounded-2xl bg-slate-100 dark:bg-slate-800/80 mb-4 shadow-sm">
        {icon}
      </div>

      <h3 className="text-base md:text-lg font-bold text-slate-800 dark:text-white mb-1.5">
        {title}
      </h3>

      <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 max-w-md mb-6 leading-relaxed">
        {description}
      </p>

      {showActions && (
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white font-medium text-xs md:text-sm shadow-md transition-all active:scale-95"
          >
            <Plus size={16} />
            <span>Añadir enlace</span>
          </button>

          <button
            onClick={onOpenNotionModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium text-xs md:text-sm border border-slate-200 dark:border-slate-700 transition-all"
          >
            <Sparkles size={16} className="text-cyan-500" />
            <span>Importar de Notion</span>
          </button>
        </div>
      )}
    </div>
  );
}
