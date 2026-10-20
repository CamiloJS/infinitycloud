'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { usePlayer } from '@/context/PlayerContext';
import { useItems } from '@/context/ItemsContext';
import { parseLRC, findActiveLyricIndex, LyricLine } from '@/lib/utils/lyrics';
import { 
  X, 
  Mic2, 
  Upload, 
  Edit3, 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Check, 
  AlertCircle,
  FileText,
  RotateCcw,
  Music,
  ExternalLink
} from 'lucide-react';

interface LiveLyricsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LiveLyricsModal({ isOpen, onClose }: LiveLyricsModalProps) {
  const { 
    currentTrack, 
    isPlaying, 
    togglePlayPause, 
    currentTime, 
    duration, 
    seekTo, 
    nextTrack, 
    prevTrack 
  } = usePlayer();
  const { items, editItem } = useItems();

  // Find up-to-date item from ItemsContext if available
  const liveTrack = useMemo(() => {
    if (!currentTrack) return null;
    return items.find(i => i.id === currentTrack.id) || currentTrack;
  }, [items, currentTrack]);

  // Lyrics raw content
  const rawLyrics = liveTrack?.metadata?.lyrics || '';
  
  // Parsed lyrics
  const parsedLyrics = useMemo<LyricLine[]>(() => {
    return parseLRC(rawLyrics);
  }, [rawLyrics]);

  // Active lyric line index
  const activeIndex = useMemo(() => {
    return findActiveLyricIndex(parsedLyrics, currentTime);
  }, [parsedLyrics, currentTime]);

  // Scroll ref and state
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const activeLineRef = useRef<HTMLDivElement | null>(null);
  const [userScrolled, setUserScrolled] = useState<boolean>(false);
  const userScrollTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Editor mode state
  const [isEditing, setIsEditing] = useState<boolean>(false);
  const [editorText, setEditorText] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fileError, setFileError] = useState<string | null>(null);

  // Initialize editor text when opening editor
  useEffect(() => {
    if (isEditing) {
      setEditorText(rawLyrics);
    }
  }, [isEditing, rawLyrics]);

  // Reset user scrolled state when song changes
  useEffect(() => {
    setUserScrolled(false);
  }, [currentTrack?.id]);

  // Smooth auto-scroll to active line
  useEffect(() => {
    if (userScrolled || !isOpen || isEditing) return;

    if (activeLineRef.current && scrollContainerRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  }, [activeIndex, userScrolled, isOpen, isEditing]);

  // Detect user manual scrolling
  const handleScroll = () => {
    if (isEditing) return;
    setUserScrolled(true);

    if (userScrollTimeoutRef.current) {
      clearTimeout(userScrollTimeoutRef.current);
    }

    // Auto-resume sync after 6 seconds of no user scrolling
    userScrollTimeoutRef.current = setTimeout(() => {
      setUserScrolled(false);
    }, 6000);
  };

  const handleRecenter = () => {
    setUserScrolled(false);
    if (activeLineRef.current) {
      activeLineRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center'
      });
    }
  };

  // Upload LRC file
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileError(null);
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      if (!content || !content.trim()) {
        setFileError('El archivo seleccionado está vacío.');
        return;
      }

      const parsed = parseLRC(content);
      if (parsed.length === 0) {
        setFileError('No se encontraron marcas de tiempo válidas ([mm:ss.xx]) en el archivo .lrc');
      }

      setEditorText(content);
      setIsEditing(true);
    };

    reader.onerror = () => {
      setFileError('Error al leer el archivo.');
    };

    reader.readAsText(file);
    e.target.value = '';
  };

  // Save lyrics to item metadata
  const handleSaveLyrics = async () => {
    if (!liveTrack) return;
    setIsSaving(true);
    try {
      await editItem(liveTrack.id, {
        metadata: {
          ...(liveTrack.metadata || {}),
          lyrics: editorText.trim()
        }
      });
      setIsEditing(false);
      setUserScrolled(false);
    } catch (err) {
      console.error('Error saving lyrics:', err);
      setFileError('No se pudo guardar la letra.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen || !liveTrack) return null;

  const trackTitle = liveTrack.name.replace(/\.[^/.]+$/, '');
  const trackArtist = liveTrack.metadata?.artist || liveTrack.metadata?.album || 'Infinity Music';
  const coverUrl = liveTrack.thumbnailUrl;

  const formatSeconds = (sec: number) => {
    if (isNaN(sec) || sec < 0) return '0:00';
    const mins = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-slate-950 text-white animate-in fade-in duration-200 select-none overflow-hidden">
      {/* Blurred Album Art Background */}
      <div 
        className="absolute inset-0 bg-cover bg-center filter blur-3xl opacity-20 scale-125 pointer-events-none transition-all duration-700"
        style={{
          backgroundImage: coverUrl ? `url(${coverUrl})` : 'none',
          backgroundColor: '#090d16'
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-slate-950/80 via-slate-950/90 to-slate-950 pointer-events-none" />

      {/* TOP BAR */}
      <div className="relative z-10 shrink-0 px-4 sm:px-8 py-4 border-b border-white/10 flex items-center justify-between backdrop-blur-md bg-slate-900/40">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-white/10 shrink-0 shadow-lg relative group">
            {coverUrl ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={coverUrl} alt={trackTitle} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-violet-400">
                <Music size={22} />
              </div>
            )}
          </div>
          <div className="truncate">
            <h2 className="font-bold text-sm sm:text-base text-white truncate tracking-wide">
              {trackTitle}
            </h2>
            <div className="flex items-center gap-2 text-xs text-white/60">
              <span className="font-medium text-emerald-400 truncate">{trackArtist}</span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Mic2 size={12} className={parsedLyrics.length > 0 ? "text-emerald-400" : "text-slate-400"} />
                {parsedLyrics.length > 0 ? `${parsedLyrics.length} versos sincronizados` : 'Sin letra sincronizada'}
              </span>
            </div>
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <label 
            className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-medium text-white flex items-center gap-1.5 cursor-pointer transition-colors shadow-sm"
            title="Subir archivo .lrc"
          >
            <Upload size={14} className="text-emerald-400" />
            <span className="hidden sm:inline">Cargar archivo (.lrc)</span>
            <input 
              type="file" 
              accept=".lrc,.txt" 
              onChange={handleFileUpload} 
              className="hidden" 
            />
          </label>

          <button
            onClick={() => setIsEditing(v => !v)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm ${
              isEditing 
                ? 'bg-emerald-500 text-slate-950 font-semibold' 
                : 'bg-white/10 hover:bg-white/20 text-white'
            }`}
            title="Editar letra directamente"
          >
            <Edit3 size={14} />
            <span className="hidden sm:inline">{isEditing ? 'Ver en vivo' : 'Editar letra'}</span>
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors ml-1"
            title="Cerrar letra"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* MAIN BODY AREA */}
      <div className="relative z-10 flex-1 flex flex-col min-h-0 overflow-hidden">
        {/* Recenter Floating Pill */}
        {userScrolled && !isEditing && parsedLyrics.length > 0 && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 animate-in fade-in slide-in-from-top-3 duration-200">
            <button
              onClick={handleRecenter}
              className="px-4 py-2 rounded-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-xl flex items-center gap-2 transition-transform active:scale-95"
            >
              <RotateCcw size={14} />
              <span>Sincronizar con la reproducción</span>
            </button>
          </div>
        )}

        {isEditing ? (
          /* LRC EDITOR MODE */
          <div className="flex-1 flex flex-col p-4 sm:p-8 max-w-4xl mx-auto w-full min-h-0">
            <div className="flex items-center justify-between pb-3">
              <div>
                <h3 className="font-semibold text-sm sm:text-base text-white flex items-center gap-2">
                  <FileText size={16} className="text-emerald-400" />
                  Editor de letra sincronizada (.lrc)
                </h3>
                <p className="text-xs text-white/60">
                  Formato estándar: [minutos:segundos.centésimas] Línea de la canción (ej: [01:23.45] Hola mundo)
                </p>
              </div>
              <div className="text-xs text-emerald-400 font-mono">
                {parseLRC(editorText).length} líneas detectadas
              </div>
            </div>

            {fileError && (
              <div className="p-3 mb-3 rounded-xl bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle size={16} className="shrink-0" />
                <span>{fileError}</span>
              </div>
            )}

            <textarea
              value={editorText}
              onChange={(e) => setEditorText(e.target.value)}
              placeholder="[00:05.00] Intro&#10;[00:15.30] Primera línea cantada...&#10;[00:19.45] Segunda línea sincronizada..."
              className="flex-1 w-full p-4 rounded-2xl bg-black/60 border border-white/10 text-white font-mono text-xs sm:text-sm leading-relaxed resize-none focus:outline-none focus:border-emerald-500 shadow-inner"
            />

            <div className="pt-4 flex items-center justify-between">
              <label className="text-xs text-white/60 hover:text-white cursor-pointer flex items-center gap-1.5">
                <Upload size={14} className="text-emerald-400" />
                <span>Cargar otro archivo</span>
                <input type="file" accept=".lrc,.txt" onChange={handleFileUpload} className="hidden" />
              </label>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl text-xs font-medium text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveLyrics}
                  disabled={isSaving}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSaving ? (
                    <div className="w-4 h-4 border-2 border-slate-950/30 border-t-slate-950 rounded-full animate-spin" />
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Guardar letra</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        ) : parsedLyrics.length === 0 ? (
          /* NO LYRICS STATE */
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-md mx-auto">
            <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-white/40 mb-4">
              <Mic2 size={32} />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">
              Esta pista aún no tiene letra sincronizada
            </h3>
            <p className="text-xs text-white/60 mb-6 leading-relaxed">
              Puedes cargar un archivo de letras en formato estándar <span className="text-emerald-400 font-mono">.lrc</span> o pegar los tiempos directamente para disfrutar de la experiencia karaoke en vivo.
            </p>

            <div className="flex flex-col sm:flex-row items-center gap-3 w-full">
              <label className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 cursor-pointer transition-all shadow-lg active:scale-95">
                <Upload size={16} />
                <span>Cargar archivo .lrc</span>
                <input type="file" accept=".lrc,.txt" onChange={handleFileUpload} className="hidden" />
              </label>

              <button
                onClick={() => setIsEditing(true)}
                className="w-full sm:flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium text-xs flex items-center justify-center gap-2 transition-colors active:scale-95"
              >
                <Edit3 size={16} />
                <span>Pegar letra</span>
              </button>
            </div>
          </div>
        ) : (
          /* LIVE KARAOKE SCROLL CONTAINER */
          <div 
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto px-4 sm:px-12 py-32 space-y-8 text-center scroll-smooth no-scrollbar"
            style={{ scrollBehavior: 'smooth' }}
          >
            {parsedLyrics.map((line, idx) => {
              const isActive = idx === activeIndex;
              const isPast = idx < activeIndex;

              return (
                <div
                  key={`${line.time}-${idx}`}
                  ref={isActive ? activeLineRef : null}
                  onClick={() => seekTo(line.time)}
                  className={`group cursor-pointer transition-all duration-300 py-1.5 px-4 rounded-2xl mx-auto max-w-3xl ${
                    isActive
                      ? 'scale-105 sm:scale-110 text-white font-extrabold text-2xl sm:text-3xl md:text-4xl drop-shadow-[0_0_25px_rgba(16,185,129,0.35)]'
                      : isPast
                      ? 'text-white/40 hover:text-white/80 font-medium text-lg sm:text-xl md:text-2xl'
                      : 'text-white/20 hover:text-white/70 font-medium text-lg sm:text-xl md:text-2xl'
                  }`}
                >
                  <span className="inline-block relative">
                    {line.text || '♪'}
                    {/* Tiny timestamp indicator on hover */}
                    <span className="absolute -left-12 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-mono text-emerald-400 bg-black/60 px-1.5 py-0.5 rounded">
                      {formatSeconds(line.time)}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* BOTTOM PLAYBACK CONTROLS (Always available inside Lyrics view) */}
      <div className="relative z-10 shrink-0 px-6 py-4 bg-slate-900/60 backdrop-blur-md border-t border-white/10 flex flex-col items-center gap-2 max-w-3xl mx-auto w-full">
        {/* Progress bar */}
        <div className="w-full flex items-center gap-3 text-xs text-white/50 font-mono">
          <span>{formatSeconds(currentTime)}</span>
          <div
            className="flex-1 h-1.5 bg-white/10 hover:h-2 transition-all rounded-full cursor-pointer relative group"
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect();
              const clickX = e.clientX - rect.left;
              const ratio = clickX / rect.width;
              seekTo(ratio * duration);
            }}
          >
            <div
              className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full relative"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
          <span>{formatSeconds(duration)}</span>
        </div>

        {/* Playback buttons */}
        <div className="flex items-center gap-6 mt-1">
          <button
            onClick={prevTrack}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Anterior"
          >
            <SkipBack size={20} />
          </button>

          <button
            onClick={togglePlayPause}
            className="w-12 h-12 rounded-full bg-white text-slate-950 flex items-center justify-center shadow-lg hover:scale-105 active:scale-95 transition-all"
            title={isPlaying ? 'Pausar' : 'Reproducir'}
          >
            {isPlaying ? <Pause size={22} /> : <Play size={22} className="ml-0.5" fill="currentColor" />}
          </button>

          <button
            onClick={nextTrack}
            className="p-2 rounded-full text-white/70 hover:text-white hover:bg-white/10 transition-colors"
            title="Siguiente"
          >
            <SkipForward size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}
