'use client';

import React, { useState, useEffect, useRef } from 'react';
import { InfinityItem } from '@/types';
import { adapterRegistry } from '@/lib/adapters/registry';
import { 
  X, 
  ExternalLink, 
  Download, 
  FileText, 
  AlertCircle, 
  Check, 
  Copy, 
  Maximize2, 
  Minimize2,
  Loader2,
  Edit3
} from 'lucide-react';
import { canDownloadItem, downloadItem } from '@/lib/utils/download';

interface DocumentViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
  onPlayVideo?: (item: InfinityItem) => void;
  onEditDocument?: (item: InfinityItem) => void;
}

export function DocumentViewer({ item, onClose, onPlayVideo, onEditDocument }: DocumentViewerProps) {
  const [textContent, setTextContent] = useState<string | null>(null);
  const [parsedCsv, setParsedCsv] = useState<string[][] | null>(null);
  const [loadingText, setLoadingText] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isDownloading, setIsDownloading] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    setTextContent(null);
    setParsedCsv(null);
    setLoadingText(false);

    if (!item) return;

    if (item.metadata?.content !== undefined && item.metadata?.content !== null) {
      setTextContent(item.metadata.content);
      return;
    }

    const directUrl = adapterRegistry.getDirectUrl(item);
    const itemUrl = String(item.url || '');
    const urlLower = itemUrl.toLowerCase();
    const isTextual = (
      urlLower.endsWith('.txt') ||
      urlLower.endsWith('.md') ||
      urlLower.endsWith('.json') ||
      urlLower.endsWith('.csv')
    );

    if (item.provider === 'notion' || itemUrl.includes('notion.so') || itemUrl.includes('notion.site') || itemUrl.includes('notion.com') || itemUrl.includes('notion')) {
      fetch('/api/notion/extract-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
      })
        .then(r => r.json())
        .then(data => {
          if (data.foundVideo && data.video && onPlayVideo) {
            const videoItem: InfinityItem = {
              ...item,
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
            };
            onPlayVideo(videoItem);
          }
        })
        .catch(() => {});
    }

    if (isTextual) {
      setLoadingText(true);
      fetch(directUrl)
        .then(res => res.text())
        .then(text => {
          setTextContent(text);
          if (urlLower.endsWith('.csv')) {
            // Robust CSV parser
            const lines = text.split(/\r?\n/).filter(l => l.trim().length > 0);
            const rows = lines.map(line => {
              const row: string[] = [];
              let insideQuote = false;
              let currentVal = '';
              for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                  insideQuote = !insideQuote;
                } else if (char === ',' && !insideQuote) {
                  row.push(currentVal.trim());
                  currentVal = '';
                } else {
                  currentVal += char;
                }
              }
              row.push(currentVal.trim());
              return row;
            });
            setParsedCsv(rows);
          }
        })
        .catch(err => {
          console.warn('Error fetching text document:', err);
          setTextContent(null);
        })
        .finally(() => setLoadingText(false));
    }
  }, [item?.id]);

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
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [item, onClose]);

  if (!item) return null;

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
  const itemUrl = String(item.url || '');
  const driveEmbedUrl = adapterRegistry.getEmbedUrl(item) || (item.url ? item.url.replace(/\/edit(\?.*)?$/, '/preview').replace(/\/view(\?.*)?$/, '/preview') : '');

  const urlLower = itemUrl.toLowerCase();
  const isPdf = urlLower.endsWith('.pdf') || item.mimeType === 'application/pdf';
  const isOffice = (
    urlLower.endsWith('.doc') ||
    urlLower.endsWith('.docx') ||
    urlLower.endsWith('.xls') ||
    urlLower.endsWith('.xlsx') ||
    urlLower.endsWith('.ppt') ||
    urlLower.endsWith('.pptx')
  );
  const isDriveDoc = item.provider === 'drive';

  const copyText = () => {
    if (textContent) {
      navigator.clipboard.writeText(textContent);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200"
    >
      <div className="relative w-full max-w-5xl h-[85vh] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80">
          <div className="flex items-center gap-3 truncate max-w-lg">
            <FileText className="text-blue-500 shrink-0" size={20} />
            <span className="font-semibold text-slate-800 dark:text-white truncate text-base">{item.name}</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-300 uppercase tracking-wider font-semibold">
              {item.provider}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {onEditDocument && (item.metadata?.isLocalDocument || item.mimeType === 'text/markdown' || item.mimeType === 'text/plain' || textContent !== null) && (
              <button
                onClick={() => {
                  onClose();
                  onEditDocument(item);
                }}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Editar documento"
              >
                <Edit3 size={18} className="text-blue-500" />
              </button>
            )}

            {textContent && (
              <button
                onClick={copyText}
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
                title="Copiar contenido"
              >
                {copied ? <Check size={18} className="text-emerald-500" /> : <Copy size={18} />}
              </button>
            )}

            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title={isFullscreen ? 'Salir de pantalla completa' : 'Pantalla completa'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>

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
                className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors disabled:opacity-50"
                title="Descargar archivo"
              >
                {isDownloading ? <Loader2 size={18} className="animate-spin text-blue-500" /> : <Download size={18} />}
              </button>
            )}

            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Abrir en pestaña nueva"
            >
              <ExternalLink size={18} />
            </a>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800 transition-colors"
              title="Cerrar (Esc)"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content Viewer Area */}
        <div className="flex-1 bg-slate-100 dark:bg-slate-950 overflow-hidden relative">
          {isPdf ? (
            <iframe
              src={directUrl}
              title={item.name}
              className="w-full h-full border-0"
            />
          ) : isDriveDoc ? (
            <iframe
              src={driveEmbedUrl}
              title={item.name}
              className="w-full h-full border-0"
              allowFullScreen
            />
          ) : isOffice ? (
            <div className="flex flex-col h-full">
              <div className="bg-amber-500/10 border-b border-amber-500/20 px-4 py-2 flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400">
                <AlertCircle size={15} />
                <span>
                  Vista previa externa generada mediante visor de documentos. Para la versión exacta original, utiliza el botón Descargar.
                </span>
              </div>
              <iframe
                src={`https://docs.google.com/viewer?embedded=true&url=${encodeURIComponent(directUrl)}`}
                title={item.name}
                className="w-full flex-1 border-0"
              />
            </div>
          ) : loadingText ? (
            <div className="flex items-center justify-center h-full text-slate-500">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
          ) : parsedCsv ? (
            <div className="h-full overflow-auto p-4">
              <table className="min-w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                    {parsedCsv[0]?.map((col, idx) => (
                      <th key={idx} className="p-2.5 font-semibold border border-slate-300 dark:border-slate-700">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsedCsv.slice(1).map((row, rIdx) => (
                    <tr
                      key={rIdx}
                      className="hover:bg-slate-200/50 dark:hover:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800"
                    >
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="p-2 border border-slate-300 dark:border-slate-700/60 font-mono text-slate-800 dark:text-slate-200">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : textContent !== null ? (
            <div className="h-full overflow-auto p-6 font-mono text-xs md:text-sm text-slate-800 dark:text-slate-200 whitespace-pre-wrap select-text">
              {textContent}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center">
              <FileText size={48} className="text-slate-400 mb-3" />
              <h4 className="text-slate-800 dark:text-white font-medium mb-1">Vista previa no disponible para este formato</h4>
              <p className="text-slate-500 text-sm mb-5 max-w-sm">
                Puedes abrir el documento directamente en su plataforma de origen o descargarlo a tu equipo.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  Abrir enlace original
                </a>
                <a
                  href={directUrl}
                  download={item.name}
                  className="px-4 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-white text-sm font-medium hover:opacity-90 transition-opacity"
                >
                  Descargar
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
