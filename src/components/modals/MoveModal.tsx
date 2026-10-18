'use client';

import React, { useState } from 'react';
import { InfinityItem } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { X, FolderInput, Folder, Check } from 'lucide-react';

interface MoveModalProps {
  item: InfinityItem | null;
  onClose: () => void;
}

export function MoveModal({ item, onClose }: MoveModalProps) {
  const { collections, moveToCollection } = useItems();
  const [selectedColl, setSelectedColl] = useState<string | null>(item?.collectionId || null);
  const [saving, setSaving] = useState<boolean>(false);

  if (!item) return null;

  const handleSave = async () => {
    setSaving(true);
    try {
      await moveToCollection(item.id, selectedColl);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-violet-500/10 text-violet-500">
              <FolderInput size={18} />
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white">Mover a colección</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="mt-4 space-y-1.5 max-h-60 overflow-y-auto">
          <button
            onClick={() => setSelectedColl(null)}
            className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
              selectedColl === null
                ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-600 dark:text-blue-400'
                : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Folder size={16} />
              <span>Sin colección (Raíz)</span>
            </div>
            {selectedColl === null && <Check size={16} />}
          </button>

          {collections.map(coll => {
            const isSelected = selectedColl === coll.id;
            return (
              <button
                key={coll.id}
                onClick={() => setSelectedColl(coll.id)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-xs font-medium transition-all ${
                  isSelected
                    ? 'bg-violet-50 dark:bg-violet-950/40 border-violet-500 text-violet-600 dark:text-violet-400'
                    : 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: coll.color || '#8b5cf6' }} />
                  <span className="truncate">{coll.name}</span>
                </div>
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-5 border-t border-slate-100 dark:border-slate-800 mt-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-medium text-xs shadow-md"
          >
            Confirmar movimiento
          </button>
        </div>
      </div>
    </div>
  );
}
