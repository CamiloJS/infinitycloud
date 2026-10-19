'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCcw, 
  ChevronLeft, 
  ChevronRight, 
  ExternalLink, 
  Download,
  Maximize2,
  Minimize2,
  Loader2
} from 'lucide-react';
import { canDownloadItem, downloadItem } from '@/lib/utils/download';

interface PhotoViewerProps {
  item: InfinityItem | null;
  itemsList: InfinityItem[];
  onClose: () => void;
  onSelectNext: () => void;
  onSelectPrev: () => void;
}

export function PhotoViewer({ item, itemsList, onClose, onSelectNext, onSelectPrev }: PhotoViewerProps) {
  const [zoom, setZoom] = useState<number>(1);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setZoom(1);
  }, [item?.id]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
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
        } else {
          onClose();
        }
      }
      if (e.key === 'ArrowRight') onSelectNext();
      if (e.key === 'ArrowLeft') onSelectPrev();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose, onSelectNext, onSelectPrev]);

  if (!item) return null;

  const handleZoomIn = () => setZoom(z => Math.min(3, z + 0.25));
  const handleZoomOut = () => setZoom(z => Math.max(0.5, z - 0.25));
  const handleResetZoom = () => setZoom(1);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn('Fullscreen error:', err);
    }
  };

  const directUrl = adapterRegistry.getDirectUrl(item);

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 backdrop-blur-md select-none animate-in fade-in duration-200"
    >
      {/* Top Bar */}
      <div className="absolute top-0 inset-x-0 h-16 flex items-center justify-between px-6 bg-gradient-to-b from-black/80 to-transparent z-10">
        <div className="flex items-center gap-3 text-white truncate max-w-lg">
          <span className="font-medium text-sm md:text-base truncate">{item.name}</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-white/20 uppercase tracking-wider font-semibold">
            {item.provider}
          </span>
        </div>

        {/* Toolbar Controls */}
        <div className="flex items-center gap-2 text-white">
          <button
            onClick={handleZoomOut}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Reducir zoom (-)"
          >
            <ZoomOut size={18} />
          </button>
          <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
          <button
            onClick={handleZoomIn}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Aumentar zoom (+)"
          >
            <ZoomIn size={18} />
          </button>
          <button
            onClick={handleResetZoom}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Restablecer zoom"
          >
            <RotateCcw size={18} />
          </button>

          {/* Fullscreen Toggle */}
          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
          >
            {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>

          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            title="Abrir original"
          >
            <ExternalLink size={18} />
          </a>

          {canDownloadItem(item) && (
            <button
              onClick={async () => {
                if (isDownloading) return;
                setIsDownloading(true);
                try {
                  await downloadItem(item);
                } catch (err) {
                  console.warn('Download error:', err);
                } finally {
                  setIsDownloading(false);
                }
              }}
              disabled={isDownloading}
              className="p-2 rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Descargar archivo"
            >
              {isDownloading ? <Loader2 size={18} className="animate-spin text-white" /> : <Download size={18} />}
            </button>
          )}

          <button
            onClick={onClose}
            className="p-2 ml-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
            title="Cerrar (Esc)"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Prev Navigation Button */}
      {itemsList.length > 1 && (
        <button
          onClick={onSelectPrev}
          className="absolute left-4 z-10 p-3 rounded-full bg-black/40 text-white hover:bg-black/70 hover:scale-110 transition-all"
          title="Imagen anterior"
        >
          <ChevronLeft size={28} />
        </button>
      )}

      {/* Image Stage */}
      <div className="w-full h-full flex items-center justify-center p-8 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={directUrl}
          alt={item.name}
          style={{ transform: `scale(${zoom})` }}
          className="max-h-[85vh] max-w-[90vw] object-contain transition-transform duration-150 ease-out shadow-2xl rounded-sm"
          draggable={false}
        />
      </div>

      {/* Next Navigation Button */}
      {itemsList.length > 1 && (
        <button
          onClick={onSelectNext}
          className="absolute right-4 z-10 p-3 rounded-full bg-black/40 text-white hover:bg-black/70 hover:scale-110 transition-all"
          title="Siguiente imagen"
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  );
}
