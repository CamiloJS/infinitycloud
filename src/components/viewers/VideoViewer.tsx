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
  CheckCircle2,
  Film,
  Play,
  Loader2
} from 'lucide-react';

interface VideoViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
  readOnly?: boolean;
}

export function isValidDirectVideoStream(url?: string | null): boolean {
  if (!url) return false;
  const l = url.trim().toLowerCase();
  
  // HTML web pages from Notion or any domain without a direct media format are NEVER direct video streams
  if (
    l.includes('notion.so/') ||
    l.includes('notion.site/') ||
    l.includes('notion.com/') ||
    l.includes('app.notion.com')
  ) {
    const hasVidExt = (
      l.endsWith('.mp4') || l.endsWith('.webm') || l.endsWith('.mov') || l.endsWith('.m4v') || l.endsWith('.ogv') ||
      l.includes('.mp4?') || l.includes('.webm?') || l.includes('.mov?')
    );
    if (!hasVidExt) return false;
  }

  try {
    const parsed = new URL(url);
    if (parsed.pathname === '/' || parsed.pathname === '') return false;
  } catch {
    return false;
  }

  return (
    l.endsWith('.mp4') ||
    l.endsWith('.webm') ||
    l.endsWith('.mov') ||
    l.endsWith('.m4v') ||
    l.endsWith('.ogv') ||
    l.includes('.mp4?') ||
    l.includes('.webm?') ||
    l.includes('.mov?') ||
    l.includes('prod-files-secure.s3') ||
    l.includes('file.notion.so') ||
    l.includes('amazonaws.com') ||
    l.startsWith('blob:') ||
    l.startsWith('data:video/')
  );
}

export function VideoViewer({ item, onClose, readOnly }: VideoViewerProps) {
  const { editItem } = useItems();
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const [volumeBoost, setVolumeBoost] = useState<number>(1.0); // 1.0 (100%), 1.5, 2.0 (2x), 3.0 (3x)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [isLooping, setIsLooping] = useState<boolean>(false);
  const [aspectMode, setAspectMode] = useState<'contain' | 'zoom' | 'stretch'>('contain');
  const [snapshotSuccess, setSnapshotSuccess] = useState<boolean>(false);
  const [isCapturingSnapshot, setIsCapturingSnapshot] = useState<boolean>(false);
  const [snapshotMessage, setSnapshotMessage] = useState<string | null>(null);
  const [corsRetryState, setCorsRetryState] = useState<'initial' | 'proxy' | 'nocors'>('initial');
  const [isExtractingNotion, setIsExtractingNotion] = useState<boolean>(false);
  const [extractedVideo, setExtractedVideo] = useState<any>(null);
  const [notionSiteUrl, setNotionSiteUrl] = useState<string | null>(null);
  const [notionPageTitle, setNotionPageTitle] = useState<string | null>(null);
  const [notionCoverUrl, setNotionCoverUrl] = useState<string | null>(null);
  const [notionVideos, setNotionVideos] = useState<any[]>([]);
  const [linkVideoInput, setLinkVideoInput] = useState<string>('');
  const [isSavingVideoLink, setIsSavingVideoLink] = useState<boolean>(false);
  const [showLinkVideoModal, setShowLinkVideoModal] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const sourceNodeRef = useRef<MediaElementAudioSourceNode | null>(null);

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
    setAspectMode('contain');
    setSnapshotMessage(null);
    setCorsRetryState('initial');
    setExtractedVideo(null);
    setNotionSiteUrl(null);
    setNotionPageTitle(null);
    setNotionCoverUrl(null);
    setNotionVideos([]);
    setLinkVideoInput('');
    setShowLinkVideoModal(false);
    setIsExtractingNotion(false);

    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
      gainNodeRef.current = null;
    }

    if (!item) return;

    // Only bind s3Url if it is actually a valid video stream, not an HTML page!
    const savedS3IsStream = isValidDirectVideoStream(item.metadata?.s3Url);
    if (item.metadata?.s3Url && savedS3IsStream) {
      setExtractedVideo({
        id: item.metadata.notionBlockId || 'saved_video',
        url: item.metadata.s3Url,
        title: item.name
      });
    }

    // Trigger on-demand Notion video isolation if item is from Notion and doesn't have an isolated direct video stream yet
    const isNotion = item.provider === 'notion' || 
                     item.url.includes('notion.so') || 
                     item.url.includes('notion.site') || 
                     item.url.includes('notion.com');

    const hasIsolatedStream = Boolean(item.metadata?.s3Url && savedS3IsStream);

    if (isNotion && !hasIsolatedStream) {
      setIsExtractingNotion(true);
      fetch('/api/notion/extract-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
      })
        .then(r => r.json())
        .then(data => {
          const vids = data.videos || (data.foundVideo && data.video ? [data.video] : []);
          setNotionVideos(vids);
          const playableVid = (data.foundVideo && data.video && isValidDirectVideoStream(data.video.url))
            ? data.video
            : vids.find((v: any) => isValidDirectVideoStream(v?.url));

          if (playableVid) {
            setExtractedVideo(playableVid);
            editItem(item.id, {
              category: 'videos',
              name: playableVid.title || item.name,
              thumbnailUrl: playableVid.coverUrl || item.thumbnailUrl,
              metadata: {
                ...item.metadata,
                isNotionVideo: true,
                s3Url: playableVid.url,
                notionBlockId: playableVid.notionBlockId,
                notionPageId: playableVid.notionPageId,
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
  const applyVolumeBoost = async (boostMultiplier: number) => {
    setVolumeBoost(boostMultiplier);
    const video = videoRef.current;
    if (!video) return;

    if (video.muted) {
      video.muted = false;
    }
    video.volume = 1.0;

    try {
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          audioCtxRef.current = new AudioCtx();
        }
      }

      const ctx = audioCtxRef.current;
      if (!ctx) return;

      if (ctx.state === 'suspended') {
        await ctx.resume();
      }

      if (!(video as any).__audioSourceNode) {
        const source = ctx.createMediaElementSource(video);
        const gain = ctx.createGain();
        source.connect(gain);
        gain.connect(ctx.destination);
        (video as any).__audioSourceNode = source;
        (video as any).__gainNode = gain;
        sourceNodeRef.current = source;
        gainNodeRef.current = gain;
      } else {
        sourceNodeRef.current = (video as any).__audioSourceNode;
        gainNodeRef.current = (video as any).__gainNode;
      }

      if (gainNodeRef.current) {
        gainNodeRef.current.gain.cancelScheduledValues(ctx.currentTime);
        gainNodeRef.current.gain.setValueAtTime(boostMultiplier, ctx.currentTime);
      }
    } catch (err) {
      console.warn('Audio boost error:', err);
      if (video) video.volume = 1.0;
    }
  };

  const changePlaybackSpeed = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
      videoRef.current.defaultPlaybackRate = speed;
    }
  };

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = playbackSpeed;
      videoRef.current.defaultPlaybackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  const toggleLoop = () => {
    const next = !isLooping;
    setIsLooping(next);
    if (videoRef.current) {
      videoRef.current.loop = next;
    }
  };

  const togglePiP = async () => {
    const video = videoRef.current;
    if (!video) return;

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else if ('requestPictureInPicture' in video) {
        if (video.readyState < 1) {
          await new Promise<void>((resolve) => {
            const onMeta = () => {
              video.removeEventListener('loadedmetadata', onMeta);
              resolve();
            };
            video.addEventListener('loadedmetadata', onMeta);
          });
        }
        await video.requestPictureInPicture();
      }
    } catch (err) {
      console.warn('Picture-in-Picture error:', err);
    }
  };

  const captureFrameAsThumbnail = async () => {
    const video = videoRef.current;
    if (!video || !item || isCapturingSnapshot) return;

    setIsCapturingSnapshot(true);
    setSnapshotMessage('Capturando...');

    try {
      if (video.readyState < 2) {
        setSnapshotMessage('Inicia el video primero');
        setTimeout(() => setSnapshotMessage(null), 2500);
        return;
      }

      const canvas = document.createElement('canvas');
      canvas.width = 640;
      canvas.height = 360;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');

      drawCoverCrop(ctx, video, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      await editItem(item.id, { thumbnailUrl: dataUrl });
      setSnapshotSuccess(true);
      setSnapshotMessage('¡Guardada!');
      setTimeout(() => {
        setSnapshotSuccess(false);
        setSnapshotMessage(null);
      }, 3000);
    } catch (err) {
      console.warn('Capture thumbnail frame error:', err);
      setSnapshotMessage('Error de captura');
      setTimeout(() => setSnapshotMessage(null), 3000);
    } finally {
      setIsCapturingSnapshot(false);
    }
  };

  const handleSelectOrLinkVideo = async (videoUrl: string, videoTitle?: string) => {
    if (!videoUrl.trim() || !item) return;
    setIsSavingVideoLink(true);
    try {
      const cleanVidUrl = videoUrl.trim();
      const finalTitle = videoTitle || item.name;
      await editItem(item.id, {
        category: 'videos',
        mimeType: 'video/mp4',
        name: finalTitle,
        metadata: {
          ...item.metadata,
          isNotionVideo: true,
          s3Url: cleanVidUrl,
          originalUrl: item.metadata?.originalUrl || item.url
        }
      });
      setExtractedVideo({
        id: 'custom_linked',
        url: cleanVidUrl,
        title: finalTitle
      });
      setShowLinkVideoModal(false);
    } catch (err) {
      console.error('Error linking video:', err);
    } finally {
      setIsSavingVideoLink(false);
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

  const hasExtractedVideo = Boolean(extractedVideo?.url && isValidDirectVideoStream(extractedVideo.url));
  const hasS3Video = Boolean(item.metadata?.s3Url && isValidDirectVideoStream(item.metadata.s3Url));
  const hasDirectUrlVideo = Boolean(directUrl && isValidDirectVideoStream(directUrl));
  const hasPlayableNotionVideo = hasExtractedVideo || hasS3Video;

  const isDirectVideo = !embedUrl && (
    hasExtractedVideo ||
    hasS3Video ||
    (!isNotion && (hasDirectUrlVideo || item.provider === 'direct' || isVideoExt || Boolean(item.mimeType?.startsWith('video/'))))
  );

  const notionDirectUrl = (hasExtractedVideo ? extractedVideo.url : null) || (hasS3Video ? item.metadata?.s3Url : null) || (
    item.provider === 'notion' && (item.metadata?.notionBlockId || item.metadata?.isNotionVideo)
      ? `/api/notion/resolve?itemId=${encodeURIComponent(item.id)}&url=${encodeURIComponent(item.metadata?.s3Url || item.url)}${item.metadata?.notionBlockId ? `&blockId=${encodeURIComponent(item.metadata.notionBlockId)}` : ''}${item.metadata?.notionPageId ? `&pageId=${encodeURIComponent(item.metadata.notionPageId)}` : ''}`
      : directUrl
  );

  const baseSrc = hasExtractedVideo 
    ? extractedVideo.url 
    : (hasS3Video 
        ? item.metadata!.s3Url 
        : (item.provider === 'notion' ? notionDirectUrl : directUrl));

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
      if (isNotion && !isExtractingNotion) {
        // Attempt fresh signed URL from Notion if previous signed URL expired
        setIsExtractingNotion(true);
        fetch('/api/notion/extract-page', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
        })
          .then(r => r.json())
          .then(data => {
            const playableVid = (data.foundVideo && data.video && isValidDirectVideoStream(data.video.url))
              ? data.video
              : (data.videos || []).find((v: any) => isValidDirectVideoStream(v?.url));

            if (playableVid) {
              setExtractedVideo(playableVid);
              setCorsRetryState('initial');
            } else {
              setEmbedFailed(true);
            }
          })
          .catch(() => setEmbedFailed(true))
          .finally(() => setIsExtractingNotion(false));
      } else if (!isNotion) {
        setEmbedFailed(true);
      }
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
          {isNotion && (
            <button
              onClick={() => setShowLinkVideoModal(true)}
              className="p-2 rounded-xl bg-slate-900/90 hover:bg-blue-600/20 text-slate-300 hover:text-blue-400 transition-all active:scale-95 border border-slate-800/80 flex items-center justify-center"
              title="Elegir o vincular video de Notion"
              aria-label="Elegir o vincular video de Notion"
            >
              <Film size={16} />
            </button>
          )}

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

        {/* Floating Modal to choose/link Notion video at any time */}
        {showLinkVideoModal && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
            <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <Film size={16} className="text-blue-500" />
                  <h4 className="text-sm font-bold text-white">Elegir o vincular video de Notion</h4>
                </div>
                <button
                  onClick={() => setShowLinkVideoModal(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              {notionVideos.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-300 font-medium">Videos encontrados en la página ({notionVideos.length}):</p>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                    {notionVideos.map((vid, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectOrLinkVideo(vid.url, vid.title)}
                        disabled={isSavingVideoLink}
                        className="w-full text-left p-2.5 rounded-lg bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 text-white text-xs flex items-center justify-between transition-colors"
                      >
                        <span className="truncate pr-2 font-medium">{vid.title || `Video ${idx + 1}`}</span>
                        <span className="shrink-0 text-[10px] font-bold bg-blue-600 text-white px-2 py-0.5 rounded">
                          Elegir
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="block text-xs text-slate-300 font-medium">
                  Enlace directo del video (.mp4):
                </label>
                <input
                  type="url"
                  value={linkVideoInput}
                  onChange={(e) => setLinkVideoInput(e.target.value)}
                  placeholder="https://... o enlace S3/mp4 de Notion"
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-xs text-white outline-none focus:border-blue-500 font-mono"
                />
                <p className="text-[10px] text-slate-400">
                  Copia el enlace del video desde Notion y pégalo aquí para reproducirlo.
                </p>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLinkVideoModal(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectOrLinkVideo(linkVideoInput)}
                  disabled={!linkVideoInput.trim() || isSavingVideoLink}
                  className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all flex items-center gap-1.5"
                >
                  {isSavingVideoLink ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                  <span>Guardar y Reproducir</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Video Player Display */}
        <div 
          className={`relative w-full bg-black flex items-center justify-center overflow-hidden ${
            isMaximized ? 'w-full h-full flex-1 min-h-0' : 'aspect-video'
          }`}
        >
          {isExtractingNotion ? (
            <div className="flex flex-col items-center justify-center p-8 gap-3">
              <div className="w-10 h-10 rounded-full border-2 border-blue-500/20 border-t-blue-500 animate-spin" />
              <p className="text-slate-300 font-medium text-sm">Detectando video en Notion...</p>
              <p className="text-slate-500 text-xs">Conectando con el contenido multimedia</p>
            </div>
          ) : isNotion && !hasPlayableNotionVideo ? (
            <div className="text-center p-5 sm:p-7 max-w-lg select-text max-h-[85vh] overflow-y-auto w-full">
              <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shadow-xl">
                {notionCoverUrl || item.thumbnailUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={notionCoverUrl || item.thumbnailUrl} alt="Notion" className="w-full h-full object-cover" />
                ) : (
                  <span className="font-bold text-2xl text-blue-400">N</span>
                )}
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs font-semibold mb-2">
                <Film size={13} />
                <span>Página de Notion</span>
              </div>

              <h3 className="text-white font-bold text-base sm:text-lg mb-1">
                {notionPageTitle || item.name || 'Notion Cloud'}
              </h3>

              {/* Videos found on page */}
              {notionVideos.length > 0 && (
                <div className="my-3 text-left p-3 rounded-xl bg-white/5 border border-white/10 space-y-2">
                  <p className="text-xs font-semibold text-slate-300">
                    Videos detectados en esta página ({notionVideos.length}):
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {notionVideos.map((vid, idx) => (
                      <button
                        key={idx}
                        onClick={() => handleSelectOrLinkVideo(vid.url, vid.title)}
                        disabled={isSavingVideoLink}
                        className="w-full text-left p-2.5 rounded-lg bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/30 text-white text-xs flex items-center justify-between transition-all"
                      >
                        <div className="flex items-center gap-2 truncate pr-2">
                          <Play size={13} className="text-blue-400 fill-blue-400 shrink-0" />
                          <span className="truncate font-medium">{vid.title || `Video ${idx + 1}`}</span>
                        </div>
                        <span className="shrink-0 text-[10px] bg-blue-500 text-white font-bold px-2 py-0.5 rounded">
                          Reproducir
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Direct Video Binder Form */}
              <div className="my-3 text-left p-3.5 rounded-xl bg-white/5 border border-white/10 space-y-2">
                <p className="text-xs font-semibold text-slate-300">
                  {notionVideos.length > 0 
                    ? 'O vincular enlace directo del video (.mp4):' 
                    : 'Elegir o vincular video de Notion (.mp4):'}
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input
                    type="url"
                    value={linkVideoInput}
                    onChange={(e) => setLinkVideoInput(e.target.value)}
                    placeholder="https://... o enlace S3/mp4 del video"
                    className="flex-1 px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white outline-none focus:border-blue-500 font-mono"
                  />
                  <button
                    onClick={() => handleSelectOrLinkVideo(linkVideoInput)}
                    disabled={!linkVideoInput.trim() || isSavingVideoLink}
                    className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shrink-0 flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-blue-600/20"
                  >
                    {isSavingVideoLink ? <Loader2 size={13} className="animate-spin" /> : <Play size={13} />}
                    <span>Guardar y Reproducir</span>
                  </button>
                </div>
                {notionVideos.length === 0 && (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-[11px] leading-relaxed space-y-1.5 text-left">
                    <p className="font-bold text-amber-300 flex items-center gap-1.5">
                      <span>⚠️</span>
                      <span>Página privada de Notion (publicAccessRole: none)</span>
                    </p>
                    <p className="text-slate-300">
                      Notion protege este enlace de forma privada dentro de tu sesión. Para que cualquier plataforma externa pueda leer y reproducir el video directamente:
                    </p>
                    <div className="pl-2 space-y-1 text-slate-300 border-l border-amber-500/30">
                      <p>
                        <strong className="text-white">1. En Notion (automático):</strong> Haz clic en <span className="text-amber-200 font-semibold">Compartir</span> en la esquina superior &gt; ve a la pestaña <span className="text-amber-200 font-semibold">Publicar</span> &gt; y pulsa <span className="text-amber-200 font-semibold">&quot;Publicar en la web&quot;</span>. Con eso Infinity lo detectará y reproducirá solo.
                      </p>
                      <p>
                        <strong className="text-white">2. O enlace directo:</strong> En Notion, haz clic en los 3 puntos del video &gt; <span className="text-amber-200 font-semibold">&quot;Ver original&quot;</span>, copia el link del archivo (.mp4) y pégalo en la casilla de arriba.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-center gap-2.5 flex-wrap pt-1">
                {notionSiteUrl && (
                  <a
                    href={notionSiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all border border-slate-700/80"
                  >
                    <ExternalLink size={13} />
                    Ver en Notion Site público
                  </a>
                )}
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-medium text-xs transition-all border border-slate-700/80"
                >
                  <ExternalLink size={13} />
                  Abrir en Notion
                </a>
              </div>
            </div>
          ) : embedFailed && !isNotion ? (
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
              src={effectiveVideoSrc}
              controls
              autoPlay
              playsInline
              loop={isLooping}
              crossOrigin={corsRetryState === 'nocors' ? undefined : 'anonymous'}
              onError={handleVideoError}
              onLoadedMetadata={() => {
                if (videoRef.current) {
                  videoRef.current.playbackRate = playbackSpeed;
                  videoRef.current.defaultPlaybackRate = playbackSpeed;
                  videoRef.current.loop = isLooping;
                }
              }}
              onPlay={() => {
                if (videoRef.current) {
                  videoRef.current.playbackRate = playbackSpeed;
                  if (volumeBoost > 1.0 && audioCtxRef.current && gainNodeRef.current) {
                    try {
                      gainNodeRef.current.gain.setValueAtTime(volumeBoost, audioCtxRef.current.currentTime);
                    } catch {}
                  }
                }
              }}
              onRateChange={() => {
                if (videoRef.current && videoRef.current.playbackRate !== playbackSpeed) {
                  videoRef.current.playbackRate = playbackSpeed;
                }
              }}
              onEnded={() => {
                if (isLooping && videoRef.current) {
                  videoRef.current.currentTime = 0;
                  videoRef.current.play().catch(() => {});
                }
              }}
              className={`w-full h-full transition-transform duration-300 origin-center ${
                aspectMode === 'zoom' 
                  ? 'object-cover scale-[1.33]' 
                  : aspectMode === 'stretch' 
                    ? 'object-fill scale-100' 
                    : 'object-contain scale-100'
              }`}
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
                onClick={() => {
                  setAspectMode(prev => {
                    if (prev === 'contain') return 'zoom';
                    if (prev === 'zoom') return 'stretch';
                    return 'contain';
                  });
                }}
                className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                  aspectMode !== 'contain' 
                    ? 'bg-blue-600/30 border-blue-500/50 text-blue-300 shadow-sm' 
                    : 'bg-slate-800 border-slate-700/60 text-slate-400 hover:text-white'
                }`}
                title="Ajustar aspecto: 16:9 (normal) -> Zoom (sin franjas negras) -> Estirar"
              >
                <Ratio size={13} className={aspectMode !== 'contain' ? 'text-blue-400' : ''} />
                <span>
                  {aspectMode === 'zoom' 
                    ? 'Zoom (Sin franjas)' 
                    : aspectMode === 'stretch' 
                      ? 'Estirar' 
                      : '16:9'}
                </span>
              </button>

              {/* Snapshot Frame as Thumbnail (only when editable) */}
              {!readOnly && (
                <button
                  onClick={captureFrameAsThumbnail}
                  disabled={isCapturingSnapshot}
                  className={`px-2.5 py-1 rounded-xl border text-[11px] font-medium flex items-center gap-1.5 transition-all ${
                    snapshotSuccess
                      ? 'bg-emerald-500/20 border-emerald-500/30 text-emerald-400'
                      : 'bg-slate-800 border-slate-700/60 text-slate-300 hover:text-white disabled:opacity-60'
                  }`}
                  title="Capturar fotograma actual y usarlo como miniatura del video"
                >
                  {isCapturingSnapshot ? (
                    <Loader2 size={13} className="animate-spin text-blue-400" />
                  ) : snapshotSuccess ? (
                    <Check size={13} />
                  ) : (
                    <Camera size={13} />
                  )}
                  <span>{snapshotMessage || (snapshotSuccess ? '¡Guardada!' : 'Capturar miniatura')}</span>
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
