'use client';

import React, { useState, useEffect } from 'react';
import { InfinityItem, CategoryType } from '@/types';
import { useItems } from '@/context/ItemsContext';
import { hashItemPassword } from '@/lib/security/itemPassword';
import { generateAutoVideoThumbnail, processUploadedThumbnail } from '@/lib/utils/videoThumbnail';
import { 
  X, 
  Check, 
  Lock, 
  Unlock, 
  Image as ImageIcon, 
  FileText, 
  Sparkles,
  Sliders,
  ShieldCheck,
  Upload,
  Trash2,
  Loader2,
  Music,
  MapPin,
  Calendar,
  Camera,
  Mic2
} from 'lucide-react';
import { parseLRC } from '@/lib/utils/lyrics';

interface EditItemModalProps {
  item: InfinityItem | null;
  isOpen: boolean;
  onClose: () => void;
}

export function EditItemModal({ item, isOpen, onClose }: EditItemModalProps) {
  const { editItem, collections } = useItems();

  const [activeTab, setActiveTab] = useState<'info' | 'thumbnail' | 'security' | 'metadata' | 'lyrics'>('info');
  const [name, setName] = useState<string>('');
  const [category, setCategory] = useState<CategoryType>('others');
  const [collectionId, setCollectionId] = useState<string>('');
  const [thumbnailUrl, setThumbnailUrl] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [tags, setTags] = useState<string>('');
  
  // Music specific metadata
  const [artist, setArtist] = useState<string>('');
  const [album, setAlbum] = useState<string>('');
  const [year, setYear] = useState<string>('');
  const [genre, setGenre] = useState<string>('');
  const [lyrics, setLyrics] = useState<string>('');
  const [lyricsError, setLyricsError] = useState<string | null>(null);

  // Photo specific metadata
  const [photoDate, setPhotoDate] = useState<string>('');
  const [photoLocation, setPhotoLocation] = useState<string>('');
  const [photoCamera, setPhotoCamera] = useState<string>('');

  // Password security
  const [enablePassword, setEnablePassword] = useState<boolean>(false);
  const [newPassword, setNewPassword] = useState<string>('');
  const [hasExistingPassword, setHasExistingPassword] = useState<boolean>(false);

  const [saving, setSaving] = useState<boolean>(false);
  const [generatingThumb, setGeneratingThumb] = useState<boolean>(false);
  const [uploadingThumb, setUploadingThumb] = useState<boolean>(false);
  const [thumbError, setThumbError] = useState<string | null>(null);

  useEffect(() => {
    if (item && isOpen) {
      setName(item.name || '');
      setCategory(item.category || 'others');
      setCollectionId(item.collectionId || '');
      setThumbnailUrl(item.thumbnailUrl || '');
      setDescription(item.metadata?.description || '');
      setTags(Array.isArray(item.metadata?.tags) ? item.metadata.tags.join(', ') : (item.metadata?.tags || ''));
      setArtist(item.metadata?.artist || '');
      setAlbum(item.metadata?.album || '');
      setYear(item.metadata?.year || '');
      setGenre(item.metadata?.genre || '');
      setLyrics(item.metadata?.lyrics || '');
      setLyricsError(null);

      // Load photo metadata
      const d = item.metadata?.date || (item.createdAt ? new Date(item.createdAt).toISOString().split('T')[0] : '');
      setPhotoDate(d);
      setPhotoLocation(item.metadata?.location || '');
      setPhotoCamera(item.metadata?.camera || '');

      setHasExistingPassword(Boolean(item.isProtected && item.passwordHash));
      setEnablePassword(Boolean(item.isProtected && item.passwordHash));
      setNewPassword('');
      setThumbError(null);
      setActiveTab('info');
    }
  }, [item, isOpen]);

  if (!isOpen || !item) return null;

  const handleThumbnailUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumb(true);
    setThumbError(null);
    try {
      const isMusic = category === 'music';
      const dataUrl = await processUploadedThumbnail(
        file, 
        isMusic ? 500 : 640, 
        isMusic ? 500 : 360
      );
      setThumbnailUrl(dataUrl);
    } catch (err: any) {
      setThumbError(err.message || 'Error al procesar la imagen');
    } finally {
      setUploadingThumb(false);
      e.target.value = '';
    }
  };

  const handleAutoThumbnail = async () => {
    setGeneratingThumb(true);
    setThumbError(null);
    try {
      if (item.category === 'videos') {
        const generated = await generateAutoVideoThumbnail(item.url);
        if (generated) {
          setThumbnailUrl(generated);
        } else {
          setThumbError('No se pudo capturar el fotograma automáticamente. Puedes subir una imagen.');
        }
      }
    } finally {
      setGeneratingThumb(false);
    }
  };

  const handleLrcUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLyricsError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        setLyricsError('El archivo seleccionado está vacío.');
        return;
      }
      setLyrics(content);
    };
    reader.onerror = () => {
      setLyricsError('Error al leer el archivo.');
    };
    reader.readAsText(file);
    e.target.value = '';
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
          tags: tags ? tags.split(',').map(t => t.trim()).filter(Boolean) : [],
          artist: artist.trim() || undefined,
          album: album.trim() || undefined,
          year: year.trim() || undefined,
          genre: genre.trim() || undefined,
          lyrics: lyrics.trim() || undefined,
          date: photoDate.trim() || undefined,
          location: photoLocation.trim() || undefined,
          camera: photoCamera.trim() || undefined
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
        updates.passwordHash = null as any;
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
      <div className="relative w-full max-w-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col h-[88vh] max-h-[720px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
              <Sliders size={18} />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base text-slate-800 dark:text-white">Editar información y metadatos</h3>
              <p className="text-[11px] text-slate-400">Personaliza nombre, miniatura, metadatos y contraseña</p>
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
            <span>{category === 'music' ? 'Carátula (1:1)' : 'Miniatura (16:9)'}</span>
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

          {category === 'music' && (
            <button
              type="button"
              onClick={() => setActiveTab('lyrics')}
              className={`pb-2.5 px-3 border-b-2 transition-all flex items-center gap-1.5 ${
                activeTab === 'lyrics'
                  ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 font-semibold'
                  : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <Mic2 size={14} />
              <span>Letras (.lrc)</span>
              {lyrics && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />}
            </button>
          )}
        </div>

        {/* Tab Body */}
        <form onSubmit={handleSubmit} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
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
                      Carpeta
                    </label>
                    <select
                      value={collectionId}
                      onChange={(e) => setCollectionId(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-medium text-slate-800 dark:text-white outline-none focus:border-blue-500"
                    >
                      <option value="">Sin carpeta</option>
                      {collections.map(c => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Photo Specific Metadata */}
                {category === 'photos' && (
                  <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-3">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold text-xs">
                      <Camera size={15} />
                      <span>Metadatos de la Fotografía</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Calendar size={12} /> Fecha
                        </label>
                        <input
                          type="date"
                          value={photoDate}
                          onChange={(e) => setPhotoDate(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <MapPin size={12} /> Ubicación / Lugar
                        </label>
                        <input
                          type="text"
                          value={photoLocation}
                          onChange={(e) => setPhotoLocation(e.target.value)}
                          placeholder="ej. Medellín, París"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1 flex items-center gap-1">
                          <Camera size={12} /> Cámara / Dispositivo
                        </label>
                        <input
                          type="text"
                          value={photoCamera}
                          onChange={(e) => setPhotoCamera(e.target.value)}
                          placeholder="ej. iPhone 15, Sony A7"
                          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

              {/* Music Specific Metadata */}
              {category === 'music' && (
                <div className="p-4 rounded-2xl bg-violet-500/10 border border-violet-500/20 space-y-3">
                  <div className="flex items-center gap-2 text-violet-600 dark:text-violet-400 font-semibold text-xs">
                    <Music size={15} />
                    <span>Metadatos de Música / Canción</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Artista / Intérprete
                      </label>
                      <input
                        type="text"
                        value={artist}
                        onChange={(e) => setArtist(e.target.value)}
                        placeholder="ej. Queen, Daft Punk"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Álbum / Disco
                      </label>
                      <input
                        type="text"
                        value={album}
                        onChange={(e) => setAlbum(e.target.value)}
                        placeholder="ej. Discovery, A Night at the Opera"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Año
                      </label>
                      <input
                        type="text"
                        value={year}
                        onChange={(e) => setYear(e.target.value)}
                        placeholder="ej. 2001"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-violet-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">
                        Género
                      </label>
                      <input
                        type="text"
                        value={genre}
                        onChange={(e) => setGenre(e.target.value)}
                        placeholder="ej. Rock, Pop, Electrónica"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-800 dark:text-white outline-none focus:border-violet-500"
                      />
                    </div>
                  </div>
                </div>
              )}

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
              {/* Local Image File Upload Area */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Subir imagen local {category === 'music' ? '(Carátula 1:1)' : '(Miniatura 16:9)'}
                </label>
                <label className="flex items-center gap-3 p-3.5 rounded-2xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-blue-500 dark:hover:border-blue-400 bg-slate-50/60 dark:bg-slate-950/60 cursor-pointer transition-all group">
                  <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-500 group-hover:scale-110 transition-transform shrink-0">
                    {uploadingThumb ? (
                      <Loader2 size={18} className="animate-spin text-blue-500" />
                    ) : (
                      <Upload size={18} />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      {uploadingThumb 
                        ? (category === 'music' ? 'Ajustando carátula a 1:1...' : 'Ajustando imagen a 16:9...')
                        : 'Elegir imagen desde tu dispositivo'}
                    </p>
                    <p className="text-[11px] text-slate-400 truncate">
                      {category === 'music'
                        ? 'JPG, PNG, WebP — Recorte inteligente 1:1 cuadrado de álbum'
                        : 'JPG, PNG, WebP — Recorte inteligente 16:9 sin franjas negras'}
                    </p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleThumbnailUpload}
                    disabled={uploadingThumb}
                    className="hidden"
                  />
                </label>
                {thumbError && (
                  <p className="mt-1.5 text-xs text-rose-500 font-medium">
                    {thumbError}
                  </p>
                )}
              </div>

              {/* URL or Auto Capture Option */}
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  O vincular por URL / Capturar de video
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={thumbnailUrl}
                    onChange={(e) => setThumbnailUrl(e.target.value)}
                    placeholder="https://... (enlace directo a imagen)"
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

              {/* Clean Preview Area */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {category === 'music' ? 'Vista previa (Formato cuadrado 1:1)' : 'Vista previa (Formato 16:9 sin franjas)'}
                  </span>
                  {thumbnailUrl && (
                    <button
                      type="button"
                      onClick={() => setThumbnailUrl('')}
                      className="text-xs text-rose-500 hover:text-rose-600 flex items-center gap-1 font-medium transition-colors"
                      title="Quitar miniatura"
                    >
                      <Trash2 size={12} />
                      <span>Quitar miniatura</span>
                    </button>
                  )}
                </div>

                <div className={`relative ${category === 'music' ? 'w-48 aspect-square mx-auto' : 'w-full aspect-video'} rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shadow-inner group`}>
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
                      {category === 'music' ? (
                        <Music size={28} className="mx-auto mb-2 opacity-40 text-violet-500" />
                      ) : (
                        <ImageIcon size={28} className="mx-auto mb-2 opacity-40" />
                      )}
                      <span>Sin miniatura asignada</span>
                    </div>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 mt-2 text-center">
                  {category === 'music'
                    ? 'Las pistas de música utilizan carátulas cuadradas 1:1 estilo disco/álbum.'
                    : 'Todas las miniaturas subidas se optimizan en formato 16:9 de alta definición para eliminar franjas negras.'}
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

          {activeTab === 'lyrics' && (
            <div className="space-y-4 animate-in fade-in duration-150">
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-800 dark:text-emerald-300 text-xs flex items-start gap-3">
                <Mic2 size={18} className="shrink-0 mt-0.5 text-emerald-500" />
                <div>
                  <h4 className="font-semibold text-sm mb-1">Letra sincronizada en vivo (Formato LRC)</h4>
                  <p className="text-[11px] leading-relaxed">
                    Sube un archivo <code className="px-1 py-0.5 rounded bg-emerald-500/20 font-mono">.lrc</code> o pega los versos con marcas de tiempo <code className="px-1 py-0.5 rounded bg-emerald-500/20 font-mono">[mm:ss.xx]</code> para que se sincronicen en tiempo real con la canción.
                  </p>
                </div>
              </div>

              {lyricsError && (
                <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs">
                  {lyricsError}
                </div>
              )}

              <div className="flex items-center justify-between">
                <label className="px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 flex items-center gap-2 cursor-pointer transition-colors shadow-sm">
                  <Upload size={14} className="text-emerald-500" />
                  <span>Cargar archivo .lrc / .txt</span>
                  <input
                    type="file"
                    accept=".lrc,.txt"
                    onChange={handleLrcUpload}
                    className="hidden"
                  />
                </label>

                {lyrics && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-emerald-600 dark:text-emerald-400">
                      {parseLRC(lyrics).length} versos detectados
                    </span>
                    <button
                      type="button"
                      onClick={() => setLyrics('')}
                      className="text-xs text-rose-500 hover:text-rose-600 font-medium transition-colors ml-2"
                    >
                      Limpiar
                    </button>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1.5">
                  Contenido de letra LRC
                </label>
                <textarea
                  rows={8}
                  value={lyrics}
                  onChange={(e) => setLyrics(e.target.value)}
                  placeholder="[00:12.50] Primera línea de la canción...&#10;[00:16.80] Segunda línea sincronizada...&#10;[00:21.00] Coro..."
                  className="w-full p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-800 dark:text-white outline-none focus:border-emerald-500 leading-relaxed shadow-inner"
                />
              </div>

              {lyrics && parseLRC(lyrics).length > 0 && (
                <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Vista previa de sincronización (primeros 3 versos)
                  </span>
                  <div className="space-y-1 text-xs">
                    {parseLRC(lyrics).slice(0, 3).map((l, i) => (
                      <div key={i} className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="text-[10px] font-mono text-emerald-500 bg-emerald-500/10 px-1 rounded">
                          {Math.floor(l.time / 60)}:{(Math.floor(l.time % 60)).toString().padStart(2, '0')}
                        </span>
                        <span>{l.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          </div>

          {/* Pinned Footer buttons */}
          <div className="shrink-0 px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-sm flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
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
