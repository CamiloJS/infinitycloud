'use client';

import React, { useState, useEffect } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { X, ExternalLink, AlertCircle } from 'lucide-react';

interface VideoViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
}

export function VideoViewer({ item, onClose }: VideoViewerProps) {
  const [embedFailed, setEmbedFailed] = useState<boolean>(false);

  useEffect(() => {
    setEmbedFailed(false);
  }, [item?.id]);

  useEffect(() => {
    if (!item) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

  const embedUrl = adapterRegistry.getEmbedUrl(item);
  const isDirectVideo = item.provider === 'direct';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-5xl bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800/80 bg-slate-900/50">
          <div className="flex items-center gap-3 truncate max-w-lg">
            <span className="font-semibold text-white truncate text-base">{item.name}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 uppercase tracking-wider font-semibold">
              {item.provider}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Abrir en plataforma original"
            >
              <ExternalLink size={18} />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Video Player Container */}
        <div className="relative w-full aspect-video bg-black flex items-center justify-center">
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
          ) : isDirectVideo ? (
            <video
              src={item.url}
              controls
              autoPlay
              className="w-full h-full object-contain"
            />
          ) : embedUrl ? (
            <iframe
              src={embedUrl}
              title={item.name}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
              className="w-full h-full border-0"
              onError={() => setEmbedFailed(true)}
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
