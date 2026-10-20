'use client';

import React, { useState } from 'react';
import { InfinityCollection } from '@/types';
import { Folder, MoreVertical, Share2, Edit2, Trash2, Globe } from 'lucide-react';

interface FolderCardProps {
  collection: InfinityCollection;
  itemCount: number;
  onClick: () => void;
  onDropItem: (itemId: string, collectionId: string) => void;
  onEdit?: (collection: InfinityCollection) => void;
  onDelete?: (collection: InfinityCollection) => void;
  onShare?: (collection: InfinityCollection) => void;
}

export function FolderCard({
  collection,
  itemCount,
  onClick,
  onDropItem,
  onEdit,
  onDelete,
  onShare
}: FolderCardProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'move';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const itemId = e.dataTransfer.getData('text/plain');
    if (itemId) {
      onDropItem(itemId, collection.id);
    }
  };

  const folderColor = collection.color || '#8b5cf6';

  return (
    <div
      onClick={onClick}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`group relative p-4 rounded-2xl border transition-all duration-200 cursor-pointer select-none flex flex-col justify-between ${
        isDragOver
          ? 'border-blue-500 bg-blue-500/10 dark:bg-blue-500/20 ring-2 ring-blue-500/60 scale-[1.03] shadow-xl'
          : 'bg-white dark:bg-slate-900 border-slate-200/90 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 hover:shadow-md'
      }`}
    >
      {/* Top Bar: Folder Icon & Actions */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div 
          className="w-11 h-11 rounded-xl flex items-center justify-center transition-transform group-hover:scale-105"
          style={{ backgroundColor: `${folderColor}20` }}
        >
          <Folder size={24} style={{ color: folderColor }} fill="currentColor" fillOpacity={0.25} />
        </div>

        <div className="flex items-center gap-1">
          {collection.isShared && (
            <span 
              className="p-1 rounded-lg bg-blue-500/10 text-blue-500" 
              title="Carpeta compartida con enlace público"
            >
              <Globe size={13} />
            </span>
          )}

          <div className="relative">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowMenu(prev => !prev);
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              title="Opciones de carpeta"
              aria-label="Opciones de carpeta"
            >
              <MoreVertical size={15} />
            </button>

            {showMenu && (
              <div 
                className="absolute right-0 top-8 z-30 w-44 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl py-1 text-xs animate-in fade-in duration-150"
                onClick={(e) => e.stopPropagation()}
              >
                {onShare && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onShare(collection);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <Share2 size={13} className="text-blue-500" />
                    <span>Compartir carpeta</span>
                  </button>
                )}
                {onEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onEdit(collection);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300"
                  >
                    <Edit2 size={13} />
                    <span>Renombrar</span>
                  </button>
                )}
                {onDelete && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowMenu(false);
                      onDelete(collection);
                    }}
                    className="w-full px-3 py-2 text-left flex items-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                  >
                    <Trash2 size={13} />
                    <span>Eliminar carpeta</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Middle: Folder Name */}
      <div>
        <h4 className="font-semibold text-sm text-slate-900 dark:text-white truncate mb-1" title={collection.name}>
          {collection.name}
        </h4>
        <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>{itemCount} {itemCount === 1 ? 'archivo' : 'archivos'}</span>
          {isDragOver && (
            <span className="text-[10px] font-bold text-blue-500 dark:text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded animate-pulse">
              Soltar para mover
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
