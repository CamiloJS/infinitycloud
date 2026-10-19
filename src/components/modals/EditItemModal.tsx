'use client';

import React, { useState, useEffect } from 'react';
import { InfinityItem, CategoryType } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { hashItemPassword } from '@/lib/security/itemPassword';
import { generateAutoVideoThumbnail } from '@/lib/utils/videoThumbnail';
import { 
  X, 
  Check, 
  Lock, 
  Unlock, 
  Image as ImageIcon, 
  FileText, 
  Sparkles,
  Sliders,
  ShieldCheck
} from 'lucide-react';

interface EditItemModalProps {
  item: InfinityItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditItemModal({ item, isOpen, onClose }: EditItemModalProps) {
  const { editItem, collections } = useItems();

  const [activeTab, setActiveTab] = useState<'info' | 'thumbnail' | 'security' | 'metadata'>('info');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<CategoryType>('others');
  const [collectionId, setCollectionId] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  
  // Password security
  const [enablePassword, setEnablePassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [hasExistingPassword, setHasExistingPassword] = useState<boolean>(false);

  const [saving, setSaving] = useState<boolean>(false);
  const [generatingThumb, setGeneratingThumb] = useState<boolean>(false);

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
      setCategory(item.category || 'others');
      setCollectionId(item.collectionId || '');
      setThumbnailUrl(item.thumbnailUrl || '');
      setDescription(item.metadata?.description || '');
      setTags(Array.isArray(item.metadata?.tags) ? item.metadata.tags.join(', ') : (item.metadata?.tags || ''));
      setHasExistingPassword(Boolean(item.isProtected && item.passwordHash));
      setEnablePassword(Boolean(item.isProtected && item.passwordHash));
      setNewPassword('');
      setActiveTab('info');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleAutoThumbnail = async () => {
    setGeneratingThumb(true);
    try {
      if (item.category === 'videos') {
        const generated = await generateAutoVideoThumbnail(item.url);
        if (generated) {
          setThumbnailUrl(generated);
        }
      }
    } finally {
      setGeneratingThumb(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const updates: Partial<InfinityItem> = {
        name: name.trim() || item.name,
        category,
        collectionId: collectionId || null,
        thumbnailUrl: thumbnailUrl.trim() || undefined,
        metadata: {
          ...(item.metadata || {}),
          description: description.trim() || undefined,
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : []
        }
      };

      // Password handling
      if (enablePassword) {
        if (newPassword.trim()) {
          const hash = await hashItemPassword(newPassword.trim());
          updates.isProtected = true;
          updates.passwordHash = hash;
        } else if (hasExistingPassword) {
          // Keep existing password
          updates.isProtected = true;
        }
      } else {
        // Disabled password
        updates.isProtected = false;
        updates.passwordHash = undefined;
      }

      await editItem(item.id, updates);
      onClose();
    } catch (err) {
      console.error('Error saving item metadata:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Editar información y metadatos</h3>
              <p className="text-[11px] text-slate-400">Personaliza nombre, miniatura 16:9 y contraseña</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-100 dark:border-slate-800 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab('info')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'info'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <FileText size={14} />
            <span>General</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('thumbnail')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'thumbnail'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <ImageIcon size={14} />
            <span>Miniatura (16:9)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'security'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Lock size={14} />
            <span>Seguridad</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('metadata')}
            className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
              activeTab === 'metadata'
                ? 'border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
            }`}
          >
            <Sliders size={14} />
            <span>Notas</span>
          </button>
        </div>

        {/* Tab Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {activeTab === 'info' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Nombre del archivo *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as CategoryType)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="photos">Fotos</option>
                    <option value="videos">Videos</option>
                    <option value="music">Música</option>
                    <option value="documents">Documentos</option>
                    <option value="others">Otros</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                    Colección
                  </label>
                  <select
                    value={collectionId}
                    onChange={(e) => setCollectionId(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  >
                    <option value="">Sin colección</option>
                    {collections.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  URL del recurso original
                </label>
                <input
                  type="text"
                  disabled
                  value={item.url}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-950/50 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-500 truncate"
                />
                {item.metadata?.isNotionVideo && (
                  <div className="mt-2.5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
                    <ShieldCheck size={16} className="shrink-0 text-emerald-500" />
                    <span>Video de Notion permanente: El sistema refresca la firma automáticamente para evitar caducidad.</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'thumbnail' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  URL de Miniatura
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://... (enlace a imagen)"
                    className="flex-1 px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-white outline-none focus:border-blue-500"
                  />
                  {item.category === 'videos' && (
                    <button
                      type="button"
                      onClick={handleAutoThumbnail}
                      disabled={generatingThumb}
                      className="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-xs font-medium flex items-center gap-1.5 transition-colors shrink-0 disabled:opacity-50"
                      title="Capturar fotograma automático"
                    >
                      <Sparkles size={14} />
                      <span>{generatingThumb ? 'Capturando...' : 'Auto'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 16:9 Clean Preview Area */}
              <div>
                <span className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                  Vista previa (Formato 16:9 sin franjas)
                </span>
                <div className="relative w-full aspect-video rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-inner">
                  {thumbnailUrl ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={thumbnailUrl}
                      alt="Vista previa"
                      className="w-full h-full object-cover"
                      onError={() => {}}
                    />
                  ) : (
                    <div className="text-center p-4 text-slate-400 text-xs">
                      <ImageIcon size={28} className="mx-auto mb-2 opacity-40" />
                      <span>Sin miniatura asignada</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2">
                  Las miniaturas se adaptan automáticamente a 16:9 en las tarjetas para eliminar cualquier franja negra.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'security' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-3">
                <Lock size={18} className="shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Protección por contraseña individual</h4>
                  <p className="text-[11px] leading-relaxed">
                    Al activar esta opción, cualquier usuario deberá ingresar la clave antes de poder ver o reproducir este archivo.
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                <span className="text-xs font-medium text-slate-800 dark:text-slate-200">
                  {enablePassword ? 'Archivo protegido con contraseña' : 'Sin contraseña (Público en tu cuenta)'}
                </span>
                <button
                  type="button"
                  onClick={() => setEnablePassword(p => !p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    enablePassword 
                      ? 'bg-amber-500 text-white shadow-sm' 
                      : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                  }`}
                >
                  {enablePassword ? 'Activa' : 'Desactivada'}
                </button>
              </div>

              {enablePassword && (
                <div className="space-y-2 pt-2 animate-in fade-in">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {hasExistingPassword ? 'Cambiar contraseña (Dejar en blanco para mantener la actual)' : 'Establecer contraseña para este archivo *'}
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder={hasExistingPassword ? 'Nueva clave opcional...' : 'Escribe una clave segura...'}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-amber-500"
                  />
                </div>
              )}
            </div>
          )}

          {activeTab === 'metadata' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Descripción o notas personales
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Escribe detalles, recordatorios o contexto de este archivo..."
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Etiquetas (Separadas por comas)
                </label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ej. tutorial, diseño, musica, trabajo"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500"
                />
              </div>
            </div>
          )}

          {/* Footer buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-medium text-xs md:text-sm shadow-md flex items-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50"
            >
              {saving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Check size={16} />
                  <span>Guardar información</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
