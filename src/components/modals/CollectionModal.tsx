'use client';

import React, { useState, useEffect } from 'react';
import { useItems } from '@/context/ItemsContext';
import { X, FolderPlus, Edit2, Check } from 'lucide-react';

interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  collIdToEdit?: string | null;
  initialName?: string;
}

const PRESET_COLORS = [
  '#8b5cf6', // Violet
  '#3b82f6', // Blue
  '#06b6d4', // Cyan
  '#10b981', // Emerald
  '#f59e0b', // Amber
  '#ef4444', // Red
  '#ec4899', // Pink
  '#64748b', // Slate
];

export function CollectionModal({
  isOpen,
  onClose,
  collIdToEdit,
  initialName = ''
}: CollectionModalProps) {
  const { createCollection, renameCollection } = useItems();
  const [name, setName] = useState<string>('');
  const [color, setColor] = useState<string>('#8b5cf6');
  const [saving, setSaving] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      setName(initialName);
      setColor('#8b5cf6');
    }
  }, [isOpen, initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      if (collIdToEdit) {
        await renameCollection(collIdToEdit, name);
      } else {
        await createCollection(name, color);
      }
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
              {collIdToEdit ? <Edit2 size={18} /> : <FolderPlus size={18} />}
            </div>
            <h3 className="font-bold text-base text-slate-800 dark:text-white">
              {collIdToEdit ? 'Renombrar colección' : 'Nueva colección'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Nombre de la colección
            </label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Proyectos, Vacaciones, Música 2026..."
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-violet-500"
            />
          </div>

          {!collIdToEdit && (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                Color identificador
              </label>
              <div className="flex items-center gap-2.5">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`w-7 h-7 rounded-full flex items-center justify-center transition-all ${
                      color === c ? 'ring-2 ring-offset-2 ring-violet-500 scale-110' : 'hover:scale-105'
                    }`}
                    style={{ backgroundColor: c }}
                  >
                    {color === c && <Check size={14} className="text-white drop-shadow" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium text-xs shadow-md"
            >
              {collIdToEdit ? 'Guardar' : 'Crear colección'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
