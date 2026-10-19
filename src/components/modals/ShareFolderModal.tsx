'use client';

import React, { useState, useEffect } from 'react';
import { InfinityCollection } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { hashItemPassword } from '@/lib/security/itemPassword';
import { 
  X, 
  Share2, 
  Copy, 
  Check, 
  ExternalLink, 
  Lock, 
  Unlock, 
  Globe, 
  FileText,
  ShieldCheck,
  Folder
} from 'lucide-react';

interface ShareFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  collection: InfinityCollection | null;
}

export function ShareFolderModal({ isOpen, onClose, collection }: ShareFolderModalProps) {
  const { updateCollectionShare, items } = useItems();
  const [isShared, setIsShared] = useState<boolean>(false);
  const [protectWithPassword, setProtectWithPassword] = useState<boolean>(false);
  const [password, setPassword] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen && collection) {
      setIsShared(Boolean(collection.isShared));
      setProtectWithPassword(Boolean(collection.sharePasswordHash));
      setPassword('');
      setDescription(collection.description || '');
      setCopied(false);
      setSaveSuccess(false);
    }
  }, [isOpen, collection]);

  if (!isOpen || !collection) return null;

  const collectionItems = items.filter(i => !i.isTrash && i.collectionId === collection.id);
  const shareOrigin = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${shareOrigin}/share/folder/${collection.id}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);

    try {
      let finalHash: string | undefined = undefined;
      if (isShared && protectWithPassword) {
        if (password.trim()) {
          finalHash = await hashItemPassword(password.trim());
        } else if (collection.sharePasswordHash) {
          finalHash = collection.sharePasswordHash;
        }
      }

      await updateCollectionShare(collection.id, isShared, finalHash, description);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2500);
    } catch (err) {
      console.error('Error sharing collection:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-3">
            <div 
              className="p-2.5 rounded-xl text-white shadow-sm"
              style={{ backgroundColor: collection.color || '#8b5cf6' }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-base text-slate-800 dark:text-white truncate max-w-[240px]">
                  {collection.name}
                </h3>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500">
                  {collectionItems.length} {collectionItems.length === 1 ? 'archivo' : 'archivos'}
                </span>
              </div>
              <p className="text-xs text-slate-400">Compartir carpeta mediante enlace web público</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSave} className="p-6 space-y-5">
          {/* Main Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isShared ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-500/10 text-slate-400'}`}>
                <Globe size={20} />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-800 dark:text-white">
                  Enlace público de carpeta
                </p>
                <p className="text-xs text-slate-400">
                  Cualquier persona con el enlace podrá ver los archivos de esta carpeta
                </p>
              </div>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isShared}
                onChange={(e) => setIsShared(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Share Link Display */}
          {isShared && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Enlace para compartir
                </label>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-600 dark:text-slate-300 truncate select-all">
                    {shareUrl}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className={`px-3.5 py-2.5 rounded-xl font-medium text-xs flex items-center gap-1.5 transition-all active:scale-95 shrink-0 ${
                      copied 
                        ? 'bg-emerald-500 text-white shadow-sm shadow-emerald-500/20' 
                        : 'bg-blue-600 hover:bg-blue-500 text-white shadow-sm shadow-blue-500/20'
                    }`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? '¡Copiado!' : 'Copiar'}</span>
                  </button>
                  <a
                    href={shareUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-800 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                    title="Abrir en pestaña nueva"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              {/* Optional Description */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Descripción o mensaje para los visitantes (opcional)
                </label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ej. Materiales del curso, archivos compartidos de viaje..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Password Protection */}
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-950/60 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
                      <Lock size={16} />
                    </div>
                    <div>
                      <span className="text-xs font-semibold text-slate-800 dark:text-white">
                        Proteger carpeta con contraseña
                      </span>
                      <p className="text-[11px] text-slate-400">
                        Los visitantes deberán ingresar esta clave para ver los archivos
                      </p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={protectWithPassword}
                      onChange={(e) => setProtectWithPassword(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer dark:bg-slate-800 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-amber-500"></div>
                  </label>
                </div>

                {protectWithPassword && (
                  <div className="pt-2">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder={collection.sharePasswordHash ? 'Dejar en blanco para mantener la contraseña actual' : 'Crear contraseña de acceso...'}
                      className="w-full px-3.5 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-amber-500"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-slate-200 dark:border-slate-800">
            <div className="text-xs">
              {saveSuccess && (
                <span className="text-emerald-500 font-medium flex items-center gap-1">
                  <ShieldCheck size={14} /> Configuración guardada
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cerrar
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-semibold transition-all shadow-md shadow-blue-500/20 active:scale-95 flex items-center gap-1.5"
              >
                {saving ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
