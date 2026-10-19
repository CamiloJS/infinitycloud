'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { X, ExternalLink, AlertCircle, Maximize2, Minimize2 } from 'lucide-react';

interface VideoViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
}

export function VideoViewer({ item, onClose }: VideoViewerProps) {
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);
  const [isMaximized, setIsMaximized] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEmbedFailed(false);
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
      // In-window fullscreen fallback works directly through isMaximized state
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
        className={`relative bg-black transition-all duration-200 overflow-hidden flex flex-col items-center justify-center shadow-2xl ${
          isMaximized 
            ? 'w-full h-full max-w-none max-h-none rounded-none border-0' 
            : 'w-full max-w-5xl rounded-2xl border border-slate-800'
        }`}
      >
        {/* Minimal Floating Controls at Top Right */}
        <div className="absolute top-3 right-3 z-30 flex items-center gap-2">
          <button
            onClick={toggleMaximize}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 shadow-lg transition-all active:scale-95"
            title={isMaximized ? 'Restaurar tamaño (Esc)' : 'Maximizar / Pantalla completa'}
          >
            {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <button
            onClick={onClose}
            className="p-2 rounded-xl bg-black/60 hover:bg-black/90 text-white/80 hover:text-white backdrop-blur-md border border-white/10 shadow-lg transition-all active:scale-95"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>

        {/* Video Player Container */}
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
              src={directUrl}
              controls
              autoPlay
              playsInline
              className="w-full h-full object-contain"
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
      </div>
    </div>
  );
}
