'use client';

import React, { useState } from 'react';
import { InfinityItem } from '@/types';
import { X, ExternalLink, Download, Copy, Check, File, Globe, Calendar, Hash } from 'lucide-react';

interface OtherViewerProps {
  item: InfinityItem | null;
  onClose: () => void;
  onPlayVideo?: (item: InfinityItem) => void;
}

export function OtherViewer({ item, onClose, onPlayVideo }: OtherViewerProps) {
  const [copied, setCopied] = useState<boolean>(false);

  React.useEffect(() => {
    if (!item) return;
    if (item.provider === 'notion' || item.url.includes('notion.so') || item.url.includes('notion.site')) {
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
  }, [item?.id]);

  if (!item) return null;

  const copyUrl = () => {
    navigator.clipboard.writeText(item.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formattedDate = new Date(item.createdAt).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl p-6 overflow-hidden">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
            <File size={26} />
          </div>
          <div>
            <h3 className="font-semibold text-lg text-slate-900 dark:text-white truncate max-w-xs">{item.name}</h3>
            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 uppercase tracking-wider font-semibold">
              {item.provider}
            </span>
          </div>
        </div>

        {/* Metadata Details */}
        <div className="space-y-3 mb-6 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200/60 dark:border-slate-800/80 text-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Globe size={15} /> URL</span>
            <button
              onClick={copyUrl}
              className="flex items-center gap-1 text-xs text-blue-500 hover:underline"
            >
              {copied ? <Check size={14} className="text-emerald-500" /> : <Copy size={14} />}
              {copied ? 'Copiado' : 'Copiar'}
            </button>
          </div>
          <p className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all select-all">
            {item.url}
          </p>

          <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5"><Calendar size={15} /> Agregado</span>
            <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">{formattedDate}</span>
          </div>

          {item.mimeType && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <span className="flex items-center gap-1.5"><Hash size={15} /> Tipo MIME</span>
              <span className="text-slate-700 dark:text-slate-300 font-mono text-xs">{item.mimeType}</span>
            </div>
          )}

          {item.size && (
            <div className="flex items-center justify-between pt-2 border-t border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
              <span>Tamaño</span>
              <span className="text-slate-700 dark:text-slate-300 font-medium text-xs">
                {(item.size / 1024).toFixed(1)} KB
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-violet-600 text-white font-medium text-sm hover:opacity-90 transition-opacity"
          >
            <ExternalLink size={16} /> Abrir enlace original
          </a>
          <a
            href={item.url}
            download={item.name}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            title="Descargar"
          >
            <Download size={18} />
          </a>
        </div>
      </div>
    </div>
  );
}
