'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { useItems } from '@/context/ItemsContext';
import { 
  X, 
  ExternalLink, 
  AlertCircle, 
  Maximize2, 
  Minimize2,
  Volume2,
  VolumeX,
  Gauge,
  Repeat,
  Camera,
  PictureInPicture,
  Check,
  Zap,
  Ratio
} from 'lucide-react';

interface VideoViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
}

export function VideoViewer({ item, onClose }: VideoViewerProps) {
  const { editItem } = useItems();
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0); // 1.0 (100%), 1.5, 2.0 (2x), 3.0 (3x)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isCoverFit, setIsCoverFit] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    setEmbedFailed(false);
    setVolumeBoost(1.0);
    setPlaybackSpeed(1.0);
    setIsLooping(false);
    setIsCoverFit(false);
  }, [item?.id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      const inFullscreen = Boolean(document.fullscreenElement);
      if (inFullscreen) {
        setIsMaximized(true);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        } else if (isMaximized) {
          setIsMaximized(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, isMaximized, onClose]);

  if (!item) return null;

  const toggleMaximize = async () => {
    const next = !isMaximized;
    setIsMaximized(next);

    try {
      if (next) {
        if (!document.fullscreenElement && containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch {
      // In-window fullscreen fallback
    }
  };

  // Web Audio Booster for HTML5 Video
  const applyVolumeBoost = (boostMultiplier: number) => {
    setVolumeBoost(boostMultiplier);
    if (!videoRef.current) return;

    try {
      if (!audioCtxRef.current) {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          const ctx = new AudioCtx();
          const source = ctx.createMediaElementSource(videoRef.current);
          const gainNode = ctx.createGain();
          source.connect(gainNode);
          gainNode.connect(ctx.destination);
          audioCtxRef.current = ctx;
          gainNodeRef.current = gainNode;
        }
      }

      if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.gain.value = boostMultiplier;
      }
    } catch (err) {
      console.warn('Audio boost error:', err);
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (videoRef.current) {
      videoRef.current.loop = next;
    }
  };

  const togglePiP = async () => {
    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if (videoRef.current && 'requestPictureInPicture' in videoRef.current) {
        await videoRef.current.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  };

  const captureFrameAsThumbnail = async () => {
    if (!videoRef.current || !item) return;

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        await editItem(item.id, { thumbnailUrl: dataUrl });
        setSnapshotSuccess(true);
        setTimeout(() => setSnapshotSuccess(false), 3000);
      }
    } catch (err) {
      console.warn('Capture thumbnail frame error:', err);
    }
  };

  const embedUrl = adapterRegistry.getEmbedUrl(item);
  const directUrl = adapterRegistry.getDirectUrl(item);
  const urlLower = item.url.toLowerCase();
  const isVideoExt = (
    urlLower.endsWith('.mp4') ||
    urlLower.endsWith('.webm') ||
    urlLower.endsWith('.mov') ||
    urlLower.endsWith('.m4v') ||
    urlLower.endsWith('.ogv')
  );
  
  const isDirectVideo = (
    item.provider === 'direct' ||
    (item.provider === 'notion' && item.category === 'videos') ||
    Boolean(item.mimeType?.startsWith('video/')) ||
    isVideoExt
  );

  return (
    <div 
      ref={containerRef}
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md transition-all duration-200 select-none ${
        isMaximized ? 'p-0 w-screen h-screen' : 'p-3 sm:p-6'
      }`}
    >
      <div 
        className={`relative bg-slate-950 transition-all duration-200 overflow-hidden flex flex-col shadow-2xl ${
          isMaximized 
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0' 
            : 'w-full max-w-5xl rounded-3xl border border-slate-800'
        }`}
      >
        {/* Header Bar STRICTLY ABOVE the Video Frame */}
        <div className="w-full flex items-center justify-between px-5 py-3 bg-slate-900 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-400 uppercase tracking-wider">
              VIDEO
            </span>
            <span className="text-xs sm:text-sm font-semibold text-slate-200 truncate max-w-xs sm:max-w-lg">
              {item.name}
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={toggleMaximize}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-all active:scale-95 flex items-center gap-1.5 text-xs"
              title={isMaximized ? 'Restaurar tamaño (Esc)' : 'Maximizar pantalla completa'}
            >
              {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
              <span className="hidden sm:inline text-[11px] font-medium">
                {isMaximized ? 'Restaurar' : 'Maximizar'}
              </span>
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-all active:scale-95"
              title="Cerrar (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Video Player Display */}
        <div 
          className={`relative w-full bg-black flex items-center justify-center ${
            isMaximized ? 'w-full h-full flex-1' : 'aspect-video'
          }`}
        >
          {embedFailed ? (
            <div className="text-center p-8 max-w-md">
              <AlertCircle size={48} className="mx-auto text-amber-400 mb-3" />
              <h4 className="text-white font-medium text-lg mb-2">Inserción restringida por el proveedor</h4>
              <p className="text-slate-400 text-sm mb-5">
                La plataforma original restringe la reproducción incrustada de este video debido a permisos o configuración del propietario.
              </p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium hover:opacity-90 transition-opacity"
              >
                <ExternalLink size={16} />
                Abrir en la plataforma original
              </a>
            </div>
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={item.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share; fullscreen"
              allowFullScreen
              className="w-full h-full border-0"
              onError={() => setEmbedFailed(true)}
            />
          ) : isDirectVideo ? (
            <video
              ref={videoRef}
              src={directUrl}
              controls
              autoPlay
              playsInline
              crossOrigin="anonymous"
              onError={(e) => {
                const target = e.currentTarget;
                if (target.getAttribute('crossOrigin')) {
                  target.removeAttribute('crossOrigin');
                  target.load();
                }
              }}
              className={`w-full h-full ${isCoverFit ? 'object-cover' : 'object-contain'}`}
            />
          ) : (
            <div className="text-center p-8">
              <p className="text-slate-400 mb-4">No se puede reproducir directamente este formato en el navegador.</p>
              <a
                href={item.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm"
              >
                <ExternalLink size={16} /> Abrir original
              </a>
            </div>
          )}
        </div>

        {/* Enhanced Player Controls Bar (Features & Audio Booster) */}
        {isDirectVideo && (
          <div className="w-full px-4 py-2.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-300">
            {/* Volume Booster Controls */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 text-slate-400 font-semibold text-[11px] uppercase tracking-wider">
                <Volume2 size={15} className="text-blue-400" />
                <span>Volumen:</span>
              </div>
              <div className="flex items-center bg-slate-800 p-0.5 rounded-xl border border-slate-700/60">
                <button
                  onClick={() => applyVolumeBoost(1.0)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    volumeBoost === 1.0 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  100%
                </button>
                <button
                  onClick={() => applyVolumeBoost(1.5)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-semibold transition-all ${
                    volumeBoost === 1.5 
                      ? 'bg-blue-600 text-white shadow' 
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  150%
                </button>
                <button
                  onClick={() => applyVolumeBoost(2.0)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 transition-all ${
                    volumeBoost === 2.0 
                      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow' 
                      : 'text-amber-400 hover:text-amber-300'
                  }`}
                  title="Duplicar volumen del video (200%)"
                >
                  <Zap size={11} />
                  <span>2x</span>
                </button>
                <button
                  onClick={() => applyVolumeBoost(3.0)}
                  className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-0.5 transition-all ${
                    volumeBoost === 3.0 
                      ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow' 
                      : 'text-rose-400 hover:text-rose-300'
                  }`}
                  title="Triplicar volumen del video (300%)"
                >
                  <Zap size={11} />
                  <span>3x</span>
                </button>
              </div>
            </div>

            {/* Playback Speed, Loop, Fit, Screenshot & PiP */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Speed */}
              <div className="flex items-center gap-1 bg-slate-800 px-2 py-1 rounded-xl border border-slate-700/60">
                <Gauge size={13} className="text-slate-400" />
                <select
                  value={playbackSpeed}
                  onChange={(e) => changePlaybackSpeed(parseFloat(e.target.value))}
                  className="bg-transparent text-[11px] font-semibold text-slate-200 outline-none cursor-pointer"
                >
                  <option value="0.5" className="bg-slate-900">0.5x</option>
                  <option value="0.75" className="bg-slate-900">0.75x</option>
                  <option value="1.0" className="bg-slate-900">1x (Normal)</option>
                  <option value="1.25" className="bg-slate-900">1.25x</option>
                  <option value="1.5" className="bg-slate-900">1.5x</option>
                  <option value="2.0" className="bg-slate-900">2x</option>
                </select>
              </div>

              {/* Loop */}
              <button
                onClick={toggleLoop}
                className={`p-1.5 rounded-xl border transition-all ${
                  isLooping 
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                    : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
                title={isLooping ? 'Repetición activada' : 'Repetir video'}
              >
                <Repeat size={14} />
              </button>

              {/* Aspect Ratio Fit */}
              <button
                onClick={() => setIsCoverFit(f => !f)}
                className={`px-2 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1 transition-all ${
                  isCoverFit 
                    ? 'bg-blue-500/20 border-blue-500/30 text-blue-400' 
                    : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
                title="Alternar entre ajustar a pantalla o rellenar"
              >
                <Ratio size={13} />
                <span>{isCoverFit ? 'Rellenar' : '16:9'}</span>
              </button>

              {/* Snapshot Frame as Thumbnail */}
              <button
                onClick={captureFrameAsThumbnail}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1 transition-all ${
                  snapshotSuccess
                    ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                    : 'bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white'
                }`}
                title="Capturar fotograma actual y usarlo como miniatura del video"
              >
                {snapshotSuccess ? <Check size={13} /> : <Camera size={13} />}
                <span>{snapshotSuccess ? '¡Guardada!' : 'Capturar miniatura'}</span>
              </button>

              {/* Picture in Picture */}
              <button
                onClick={togglePiP}
                className="p-1.5 rounded-xl bg-slate-800 border border-slate-700/60 text-slate-400 hover:text-white transition-all"
                title="Ventana flotante (Picture-in-Picture)"
              >
                <PictureInPicture size={14} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
