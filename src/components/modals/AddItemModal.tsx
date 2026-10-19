'use client';

import React, { useState, useEffect } from 'react';
import { useItems } from '@/context/ItemsContext';
import { adapterRegistry } from '@/lib/adapters/registry';
import { CategoryType, ProviderType } from '@/types';
import { X, Link2, Check, Sparkles, Loader2, CheckCircle2, Film, Play } from 'lucide-react';
import { isValidDirectVideoStream } from '@/components/viewers/VideoViewer';

interface AddItemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const { addItemByUrl, collections } = useItems();
  const [url, setUrl] = useState<string>('');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<CategoryType>('others');
  const [collectionId, setCollectionId] = useState<string>('');
  const [detectedProvider, setDetectedProvider] = useState<ProviderType | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [notionVideoDetected, setNotionVideoDetected] = useState<boolean>(false);
  const [notionVideos, setNotionVideos] = useState<any[]>([]);
  const [selectedNotionVideo, setSelectedNotionVideo] = useState<any | null>(null);
  const [directNotionVideoUrl, setDirectNotionVideoUrl] = useState<string>('');
  const [isSearchingNotionVideos, setIsSearchingNotionVideos] = useState<boolean>(false);
  const [userChangedCategory, setUserChangedCategory] = useState<boolean>(false);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setUrl('');
      setName('');
      setCategory('others');
      setCollectionId('');
      setDetectedProvider(null);
      setIsAnalyzing(false);
      setNotionVideoDetected(false);
      setNotionVideos([]);
      setSelectedNotionVideo(null);
      setDirectNotionVideoUrl('');
      setIsSearchingNotionVideos(false);
      setUserChangedCategory(false);
      setError(null);
    }
  }, [isOpen]);

  // Real-time detection when URL changes
  useEffect(() => {
    const trimmed = url.trim();
    if (!trimmed || !trimmed.startsWith('http')) {
      setDetectedProvider(null);
      setIsAnalyzing(false);
      setNotionVideoDetected(false);
      setNotionVideos([]);
      setSelectedNotionVideo(null);
      return;
    }

    setIsAnalyzing(true);
    const timer = setTimeout(async () => {
      setError(null);
      try {
        const detected = await adapterRegistry.detect(trimmed);
        setDetectedProvider(detected.provider);
        const isNotion = detected.provider === 'notion' || trimmed.includes('notion.so') || trimmed.includes('notion.site') || trimmed.includes('notion.com');

        if (isNotion) {
          setIsSearchingNotionVideos(true);
          fetch('/api/notion/extract-page', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: trimmed })
          })
            .then(r => r.json())
            .then(data => {
              const vids = data.videos || (data.foundVideo && data.video ? [data.video] : []);
              setNotionVideos(vids);
              if (vids.length > 0) {
                setSelectedNotionVideo(vids[0]);
                setNotionVideoDetected(true);
                setCategory('videos');
                if (!name.trim() || name === 'Video de YouTube' || name.startsWith('Video (') || name === 'Recurso de Notion' || name === 'Página de Notion' || name === 'Notion') {
                  setName(vids[0].title || data.pageTitle || 'Video de Notion');
                }
              } else {
                setNotionVideoDetected(false);
                if (data.pageTitle && (!name.trim() || name === 'Recurso de Notion' || name === 'Página de Notion')) {
                  setName(data.pageTitle);
                }
              }
            })
            .catch(() => {})
            .finally(() => setIsSearchingNotionVideos(false));
        } else {
          setNotionVideos([]);
          setSelectedNotionVideo(null);
          setIsSearchingNotionVideos(false);
        }

        if (detected.metadata?.isNotionVideo) {
          setNotionVideoDetected(true);
          setCategory('videos');
        } else if (!isNotion) {
          setNotionVideoDetected(false);
          if (!userChangedCategory) {
            setCategory(detected.category);
          }
        }

        if (!name.trim() || name === 'Video de YouTube' || name.startsWith('Video (') || name === 'Recurso de Notion' || name === 'Página de Notion') {
          setName(detected.name);
        }
      } catch {
        // ignore
      } finally {
        setIsAnalyzing(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [url, userChangedCategory, name]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUrl = url.trim();
    if (!cleanUrl) {
      setError('Por favor ingresa una URL válida');
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const isNotion = detectedProvider === 'notion' || cleanUrl.includes('notion');
      const customMeta: Record<string, any> = {};

      if (isNotion) {
        if (directNotionVideoUrl.trim()) {
          customMeta.s3Url = directNotionVideoUrl.trim();
          customMeta.isNotionVideo = true;
          customMeta.originalUrl = cleanUrl;
        } else if (selectedNotionVideo && isValidDirectVideoStream(selectedNotionVideo.url)) {
          customMeta.s3Url = selectedNotionVideo.url;
          customMeta.isNotionVideo = true;
          customMeta.notionBlockId = selectedNotionVideo.notionBlockId;
          customMeta.notionPageId = selectedNotionVideo.notionPageId;
          customMeta.originalUrl = cleanUrl;
        } else {
          customMeta.originalUrl = cleanUrl;
        }
      }

      const finalCat = (customMeta.isNotionVideo || notionVideoDetected) ? 'videos' : (userChangedCategory ? category : undefined);

      await addItemByUrl(
        cleanUrl, 
        name.trim() || selectedNotionVideo?.title || undefined, 
        finalCat, 
        collectionId || null,
        customMeta
      );
      onClose();
    } catch (err: any) {
      setError(err.message || 'Error al agregar el enlace');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Link2 size={20} />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-800 dark:text-white">Añadir nuevo enlace</h3>
              <p className="text-xs text-slate-400">Pega un enlace web, Notion, Drive o archivo directo</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              URL del recurso *
            </label>
            <div className="relative">
              <input
                type="url"
                required
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors font-mono text-xs"
              />
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isAnalyzing && (
                  <Loader2 size={14} className="text-blue-500 animate-spin" />
                )}
                {detectedProvider && (
                  <div className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold uppercase tracking-wider border border-blue-500/20">
                    {detectedProvider === 'youtube' ? 'video' : detectedProvider}
                  </div>
                )}
              </div>
            </div>
            {/* Notion Video Selector and Binder */}
            {(detectedProvider === 'notion' || url.toLowerCase().includes('notion')) && (
              <div className="mt-3 p-3.5 rounded-xl bg-slate-100 dark:bg-slate-950/80 border border-slate-200 dark:border-slate-800 space-y-3 animate-in fade-in duration-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Film size={15} className="text-blue-500" />
                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                      Configuración de video de Notion
                    </span>
                  </div>
                  {isSearchingNotionVideos && (
                    <div className="flex items-center gap-1.5 text-[11px] text-blue-500">
                      <Loader2 size={12} className="animate-spin" />
                      <span>Buscando videos...</span>
                    </div>
                  )}
                </div>

                {/* If multiple or single videos were found automatically in the page */}
                {notionVideos.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Videos detectados ({notionVideos.length}) - Haz clic para elegir el que deseas reproducir:
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {notionVideos.map((vid, idx) => {
                        const isSelected = selectedNotionVideo?.url === vid.url && !directNotionVideoUrl.trim();
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setSelectedNotionVideo(vid);
                              setDirectNotionVideoUrl('');
                              setCategory('videos');
                              setNotionVideoDetected(true);
                              if (vid.title) setName(vid.title);
                            }}
                            className={`w-full text-left p-2.5 rounded-lg border text-xs flex items-center justify-between transition-colors ${
                              isSelected
                                ? 'bg-blue-500/10 border-blue-500/40 text-blue-600 dark:text-blue-300 font-semibold'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-700'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <Play size={13} className={isSelected ? 'text-blue-500 fill-blue-500 shrink-0' : 'text-slate-400 shrink-0'} />
                              <span className="truncate">{vid.title || `Video ${idx + 1}`}</span>
                            </div>
                            {isSelected && (
                              <span className="shrink-0 text-[10px] uppercase font-bold bg-blue-500 text-white px-1.5 py-0.5 rounded">
                                Seleccionado
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Option to paste direct video stream (.mp4) */}
                <div className="pt-1">
                  <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                    {notionVideos.length > 0 
                      ? 'O si prefieres, pega el enlace directo del video (.mp4):' 
                      : 'Elegir / Vincular enlace directo del video (.mp4):'}
                  </label>
                  <input
                    type="url"
                    value={directNotionVideoUrl}
                    onChange={(e) => {
                      const val = e.target.value;
                      setDirectNotionVideoUrl(val);
                      if (val.trim()) {
                        setCategory('videos');
                        setNotionVideoDetected(true);
                        try {
                          const pathname = new URL(val).pathname;
                          const filename = decodeURIComponent(pathname.split('/').pop() || '');
                          if (filename && (!name || name === 'Video de Notion' || name === 'Página de Notion' || name === 'Notion Cloud')) {
                            setName(filename);
                          }
                        } catch {}
                      }
                    }}
                    placeholder="https://... o enlace S3/mp4 del video en Notion"
                    className="w-full px-3 py-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-blue-500 font-mono"
                  />
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                    💡 Copia el enlace del video desde Notion (haz clic en los 3 puntos del video &gt; &quot;Copiar enlace al bloque&quot; o &quot;Ver original&quot;) para aislarlo y reproducirlo directamente.
                  </p>
                </div>

                {notionVideoDetected && (
                  <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[11px] flex items-center gap-2">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" />
                    <span>Video seleccionado. Se reproducirá con el reproductor nativo de Infinity.</span>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
              Nombre o título
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre para identificar el archivo"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                Categoría
              </label>
              <select
                value={category}
                onChange={(e) => {
                  setCategory(e.target.value as CategoryType);
                  setUserChangedCategory(true);
                }}
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
                <option value="">Sin colección (Raíz)</option>
                {collections.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={saving || !url.trim()}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 disabled:opacity-50 text-white font-medium text-xs md:text-sm shadow-md transition-all flex items-center gap-2"
            >
              {saving ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  <Check size={16} />
                  <span>Añadir a Infinity</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
