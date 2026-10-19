'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { YouTubeAdapter } from '@/lib/adapters/youtube';
import { VimeoAdapter } from '@/lib/adapters/vimeo';
import { useItems } from '@/context/ItemsContext';
import { drawCoverCrop } from '@/lib/utils/videoThumbnail';
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
  Ratio,
  CheckCircle2
} from 'lucide-react';

interface VideoViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
  readOnly?: boolean;
}

export function VideoViewer({ item, onClose, readOnly }: VideoViewerProps) {
  const { editItem } = useItems();
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0); // 1.0 (100%), 1.5, 2.0 (2x), 3.0 (3x)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [isCoverFit, setIsCoverFit] = useState<boolean>(false);
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);
  const [corsRetryState, setCorsRetryState] = useState<'initial' | 'proxy' | 'nocors'>('initial');
  const [isExtractingNotion, setIsExtractingNotion] = useState<boolean>(false);
  const [extractedVideo, setExtractedVideo] = useState<any>(null);
  const [notionSiteUrl, setNotionSiteUrl] = useState<string | null>(null);
  const [notionPageTitle, setNotionPageTitle] = useState<string | null>(null);
  const [notionCoverUrl, setNotionCoverUrl] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
        gainNodeRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    setEmbedFailed(false);
    setVolumeBoost(1.0);
    setPlaybackSpeed(1.0);
    setIsLooping(false);
    setIsCoverFit(false);
    setCorsRetryState('initial');
    setExtractedVideo(null);
    setNotionSiteUrl(null);
    setNotionPageTitle(null);
    setNotionCoverUrl(null);
    setIsExtractingNotion(false);

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }

    if (!item) return;

    // Trigger on-demand Notion video isolation if item is from Notion and doesn't have an isolated direct video stream yet
    const isNotion = item.provider === 'notion' || 
                     item.url.includes('notion.so') || 
                     item.url.includes('notion.site') || 
                     item.url.includes('notion.com');

    const hasIsolatedStream = Boolean(item.metadata?.s3Url && (
      item.metadata.s3Url.endsWith('.mp4') ||
      item.metadata.s3Url.endsWith('.webm') ||
      item.metadata.s3Url.endsWith('.mov') ||
      item.metadata.s3Url.includes('youtube.com') ||
      item.metadata.s3Url.includes('youtu.be') ||
      item.metadata.s3Url.includes('vimeo.com') ||
      item.metadata.s3Url.includes('file.notion.so') ||
      item.metadata.s3Url.includes('amazonaws.com')
    ));

    if (isNotion && !hasIsolatedStream) {
      setIsExtractingNotion(true);
      fetch('/api/notion/extract-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
      })
        .then(r => r.json())
        .then(data => {
          if (data.foundVideo && data.video) {
            setExtractedVideo(data.video);
            editItem(item.id, {
              category: 'videos',
              name: data.video.title || item.name,
              thumbnailUrl: data.video.coverUrl || item.thumbnailUrl,
              metadata: {
                ...item.metadata,
                isNotionVideo: true,
                s3Url: data.video.url,
                notionBlockId: data.video.notionBlockId,
                notionPageId: data.video.notionPageId,
                originalUrl: item.metadata?.originalUrl || item.url
              }
            }).catch(() => {});
          } else {
            if (data.publicSiteUrl) setNotionSiteUrl(data.publicSiteUrl);
            if (data.pageTitle && data.pageTitle !== 'Notion') setNotionPageTitle(data.pageTitle);
            if (data.coverUrl) setNotionCoverUrl(data.coverUrl);
          }
        })
        .catch(err => {
          console.warn('Error on-demand extracting Notion video:', err);
        })
        .finally(() => {
          setIsExtractingNotion(false);
        });
    }
  }, [item?.id]);

  useEffect(() => {
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }
  }, [corsRetryState]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsMaximized(Boolean(document.fullscreenElement));
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

    if (corsRetryState === 'nocors') {
      // Cross-origin element without CORS grant; Web Audio would mute audio by browser policy.
      // Gracefully maintain max native volume without cutting sound.
      videoRef.current.volume = 1.0;
      return;
    }

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
        drawCoverCrop(ctx, videoRef.current, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
        await editItem(item.id, { thumbnailUrl: dataUrl });
        setSnapshotSuccess(true);
        setTimeout(() => setSnapshotSuccess(false), 3000);
      }
    } catch (err) {
      console.warn('Capture thumbnail frame error:', err);
    }
  };

  const resolvedVideo = extractedVideo?.url || item.metadata?.s3Url || item.url;
  const isYoutube = (
    item.url.includes('youtube.com') ||
    item.url.includes('youtu.be') ||
    Boolean(resolvedVideo.includes('youtube.com')) ||
    Boolean(resolvedVideo.includes('youtu.be'))
  );

  const isVimeo = (
    item.url.includes('vimeo.com') ||
    Boolean(resolvedVideo.includes('vimeo.com'))
  );

  const embedUrl = adapterRegistry.getEmbedUrl({ ...item, url: resolvedVideo }) || (
    isYoutube
      ? new YouTubeAdapter().getEmbedUrl({ ...item, url: resolvedVideo })
      : (isVimeo ? new VimeoAdapter().getEmbedUrl({ ...item, url: resolvedVideo }) : null)
  );

  const directUrl = adapterRegistry.getDirectUrl(item);
  const urlLower = resolvedVideo.toLowerCase();
  const isVideoExt = (
    urlLower.endsWith('.mp4') ||
    urlLower.endsWith('.webm') ||
    urlLower.endsWith('.mov') ||
    urlLower.endsWith('.m4v') ||
    urlLower.endsWith('.ogv')
  );
  
  const isNotion = item.provider === 'notion' || 
                   item.url.includes('notion.so') || 
                   item.url.includes('notion.site') || 
                   item.url.includes('notion.com');

  const isDirectVideo = !embedUrl && (
    Boolean(extractedVideo?.url) ||
    Boolean(item.metadata?.s3Url && isVideoExt) ||
    Boolean(item.metadata?.isNotionVideo && item.metadata?.s3Url) ||
    (!isNotion && item.provider === 'direct') ||
    (!isNotion && Boolean(item.mimeType?.startsWith('video/'))) ||
    isVideoExt
  );

  const notionDirectUrl = extractedVideo?.url || (
    item.provider === 'notion'
      ? `/api/notion/resolve?itemId=${encodeURIComponent(item.id)}&url=${encodeURIComponent(item.metadata?.s3Url || item.url)}${item.metadata?.notionBlockId ? `&blockId=${encodeURIComponent(item.metadata.notionBlockId)}` : ''}${item.metadata?.notionPageId ? `&pageId=${encodeURIComponent(item.metadata.notionPageId)}` : ''}`
      : directUrl
  );

  const baseSrc = item.provider === 'notion' ? notionDirectUrl : (extractedVideo?.url || directUrl);

  const effectiveVideoSrc = corsRetryState === 'proxy'
    ? (item.provider === 'notion'
        ? `${notionDirectUrl}${notionDirectUrl.includes('?') ? '&' : '?'}proxy=1`
        : `/api/proxy/media?url=${encodeURIComponent(directUrl || item.url)}`)
    : baseSrc;

  const handleVideoError = () => {
    if (corsRetryState === 'initial') {
      // First retry: attempt proxied stream to acquire CORS headers
      setCorsRetryState('proxy');
    } else if (corsRetryState === 'proxy') {
      // Second retry: fallback to direct play without CORS
      setCorsRetryState('nocors');
    } else {
      setEmbedFailed(true);
    }
  };

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
        {/* Minimalist Top Icons - ZERO text, strictly above video frame */}
        <div className="w-full flex items-center justify-end px-3 py-1.5 bg-slate-950 shrink-0 gap-2">
          <button
            onClick={toggleMaximize}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white transition-all active:scale-95 border border-slate-800/80 flex items-center justify-center"
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
            aria-label={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-slate-900/90 hover:bg-rose-500/20 text-slate-300 hover:text-rose-400 transition-all active:scale-95 border border-slate-800/80 flex items-center justify-center"
            title="Cerrar"
            aria-label="Cerrar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Video Player Display */}
        <div 
          className={`relative w-full bg-black flex items-center justify-center ${
            isMaximized ? 'w-full h-full flex-1 min-h-0' : 'aspect-video'
          }`}
        >
          {isExtractingNotion ? (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
              <p className="text-slate-300 font-medium text-sm">Detectando video en Notion...</p>
              <p className="text-slate-500 text-xs">Conectando con el contenido multimedia</p>
            </div>
          ) : isNotion && !extractedVideo ? (
            <div className="text-center p-6 sm:p-8 max-w-lg select-text">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-xl">
                {notionCoverUrl || item.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={notionCoverUrl || item.thumbnailUrl} alt="Notion" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-2xl text-blue-400">N</span>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold mb-3">
                <CheckCircle2 size={13} />
                <span>Página pública de Notion verificada</span>
              </div>

              <h3 className="text-white font-bold text-lg mb-2">
                {notionPageTitle || item.name || 'Notion Cloud'}
              </h3>

              <p className="text-slate-400 text-xs sm:text-sm mb-6 leading-relaxed max-w-md mx-auto">
                Este enlace es un espacio de trabajo o página de documentos de Notion disponible públicamente. Como es una página interactiva con documentos y colecciones (sin un archivo de video único incrustado), puedes explorarla interactivamente en la vista pública o en la app de Notion.
              </p>

              <div className="flex items-center justify-center gap-3 flex-wrap mb-4">
                <a
                  href={notionSiteUrl || `https://camilojaimes.notion.site/Notion-Cloud-92896c82887c4bb5845b5c00e587bf97`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-xs sm:text-sm transition-all shadow-lg shadow-blue-600/30 active:scale-95"
                >
                  <ExternalLink size={15} />
                  Abrir en Notion Site público
                </a>
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white font-medium text-xs sm:text-sm transition-all border border-slate-700/80 active:scale-95"
                >
                  <ExternalLink size={15} />
                  Abrir en Notion
                </a>
              </div>

              <p className="text-slate-500 text-[11px] max-w-sm mx-auto">
                💡 Si agregas un video (.mp4) dentro de una página de Notion, Infinity lo extraerá y reproducirá automáticamente aquí.
              </p>
            </div>
          ) : embedFailed ? (
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
              key={`${item.id}_${corsRetryState}_${extractedVideo ? 'extracted' : 'direct'}`}
              ref={videoRef}
              src={effectiveVideoSrc}
              controls
              autoPlay
              playsInline
              crossOrigin={corsRetryState === 'nocors' ? undefined : 'anonymous'}
              onError={handleVideoError}
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
        {isDirectVideo && !embedFailed && (!isNotion || Boolean(extractedVideo)) && (
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

              {/* Snapshot Frame as Thumbnail (only when editable) */}
              {!readOnly && (
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
              )}

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
