import { InfinityItem } from '@/types';
import { isValidDirectVideoStream } from '@/components/viewers/VideoViewer';

/**
 * Checks whether an item supports downloading.
 * STRICT RULE: YouTube videos are explicitly excluded and can NEVER be downloaded.
 * Notion files (videos, photos, documents, attachments) are fully supported.
 */
export function canDownloadItem(item?: InfinityItem | null): boolean {
  if (!item || !item.url) return false;

  const urlLower = String(item.url || '').toLowerCase();
  const provider = item.provider;

  // 1. YouTube videos are strictly non-downloadable
  if (
    provider === 'youtube' ||
    urlLower.includes('youtube.com') ||
    urlLower.includes('youtu.be')
  ) {
    return false;
  }

  // 2. Third-party streaming services without file endpoints
  if (provider === 'vimeo' || provider === 'soundcloud') {
    return false;
  }

  // 3. Notion items (Notion supports direct file access and downloads)
  if (
    provider === 'notion' ||
    Boolean(item.metadata?.isNotionVideo) ||
    Boolean(item.metadata?.s3Url) ||
    urlLower.includes('notion.so') ||
    urlLower.includes('notion.site') ||
    urlLower.includes('notion.com')
  ) {
    return true;
  }

  // 4. Direct files, photos, documents, or direct media streams
  if (
    provider === 'direct' ||
    item.category === 'photos' ||
    item.category === 'documents' ||
    Boolean(item.mimeType?.startsWith('video/')) ||
    Boolean(item.mimeType?.startsWith('audio/')) ||
    Boolean(item.mimeType?.startsWith('image/')) ||
    urlLower.endsWith('.mp4') ||
    urlLower.endsWith('.mov') ||
    urlLower.endsWith('.webm') ||
    urlLower.endsWith('.pdf') ||
    urlLower.endsWith('.jpg') ||
    urlLower.endsWith('.png') ||
    urlLower.endsWith('.webp')
  ) {
    return true;
  }

  return false;
}

/**
 * Derives a clean filename with an appropriate extension for downloading
 */
export function getDownloadFilename(item: InfinityItem, resolvedUrl?: string): string {
  let name = (item.name || 'archivo').trim();

  // If name already contains a common extension, return it
  if (/\.[a-zA-Z0-9]{2,5}$/.test(name)) {
    return name;
  }

  // Try to inspect extension from resolvedUrl or item.url
  const targetUrl = resolvedUrl || item.metadata?.s3Url || item.url;
  try {
    const pathname = new URL(targetUrl).pathname;
    const urlFilename = pathname.split('/').pop() || '';
    const match = urlFilename.match(/\.([a-zA-Z0-9]{2,5})(?:\?|$)/);
    if (match && match[1]) {
      return `${name}.${match[1].toLowerCase()}`;
    }
  } catch {}

  // Fallback by category
  if (item.category === 'videos' || item.metadata?.isNotionVideo) {
    return `${name}.mp4`;
  }
  if (item.category === 'photos') {
    return `${name}.jpg`;
  }
  if (item.category === 'music') {
    return `${name}.mp3`;
  }
  if (item.category === 'documents') {
    return `${name}.pdf`;
  }

  return name;
}

/**
 * Initiates the download of an item to the user's computer.
 * For Notion and remote files, uses the proxy with Content-Disposition: attachment
 * so the browser reliably triggers the download without navigating away.
 */
export async function downloadItem(item: InfinityItem): Promise<void> {
  if (!canDownloadItem(item)) {
    throw new Error('Este archivo no admite descarga directa (ej. enlaces de YouTube o proveedores protegidos).');
  }

  let downloadUrl = item.metadata?.s3Url || item.url;
  const isNotion = (
    item.provider === 'notion' ||
    item.url.includes('notion.so') ||
    item.url.includes('notion.site') ||
    item.url.includes('notion.com')
  );

  // If it's a Notion page and we don't have the isolated direct media stream yet, extract it on-demand
  if (isNotion && !isValidDirectVideoStream(downloadUrl) && !downloadUrl.includes('prod-files-secure') && !downloadUrl.includes('file.notion.so')) {
    try {
      const res = await fetch('/api/notion/extract-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: item.metadata?.originalUrl || item.url })
      });
      if (res.ok) {
        const data = await res.json();
        const vid = data.video || (data.videos && data.videos[0]);
        if (vid?.url) {
          downloadUrl = vid.url;
        }
      }
    } catch (err) {
      console.warn('Error extracting direct Notion file for download:', err);
    }
  }

  const filename = getDownloadFilename(item, downloadUrl);

  // If local blob/data URL
  if (downloadUrl.startsWith('data:') || downloadUrl.startsWith('blob:')) {
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a);
    }, 500);
    return;
  }

  // Use the server media proxy with download=1 to enforce Content-Disposition: attachment
  const proxyUrl = `/api/proxy/media?url=${encodeURIComponent(downloadUrl)}&download=1&filename=${encodeURIComponent(filename)}`;

  const a = document.createElement('a');
  a.href = proxyUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    if (document.body.contains(a)) document.body.removeChild(a);
  }, 500);
}
