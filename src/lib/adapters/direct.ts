import { CategoryType, DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

const PHOTO_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'avif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'ogv', 'mov', 'm4v']);
const MUSIC_EXTENSIONS = new Set(['mp3', 'wav', 'ogg', 'flac', 'aac', 'm4a']);
const DOC_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'json', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx']);

export class DirectAdapter implements ProviderAdapter {
  id = 'direct' as const;
  name = 'Enlace Directo';

  extractExtension(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      const pathname = url.pathname;
      const lastSegment = pathname.split('/').pop() || '';
      const dotIndex = lastSegment.lastIndexOf('.');
      if (dotIndex !== -1 && dotIndex < lastSegment.length - 1) {
        return lastSegment.slice(dotIndex + 1).toLowerCase();
      }
      return null;
    } catch {
      return null;
    }
  }

  canHandle(urlString: string): boolean {
    const ext = this.extractExtension(urlString);
    if (!ext) return false;
    return (
      PHOTO_EXTENSIONS.has(ext) ||
      VIDEO_EXTENSIONS.has(ext) ||
      MUSIC_EXTENSIONS.has(ext) ||
      DOC_EXTENSIONS.has(ext)
    );
  }

  extractFileName(urlString: string): string {
    try {
      const url = new URL(urlString);
      const lastSegment = decodeURIComponent(url.pathname.split('/').filter(Boolean).pop() || '');
      return lastSegment || 'Archivo sin nombre';
    } catch {
      return 'Archivo';
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    const ext = this.extractExtension(urlString) || '';
    const name = this.extractFileName(urlString);

    let category: CategoryType = 'others';
    let mimeType = 'application/octet-stream';
    let thumbnailUrl: string | undefined = undefined;

    if (PHOTO_EXTENSIONS.has(ext)) {
      category = 'photos';
      mimeType = ext === 'svg' ? 'image/svg+xml' : `image/${ext === 'jpg' ? 'jpeg' : ext}`;
      thumbnailUrl = urlString;
    } else if (VIDEO_EXTENSIONS.has(ext)) {
      category = 'videos';
      mimeType = `video/${ext}`;
    } else if (MUSIC_EXTENSIONS.has(ext)) {
      category = 'music';
      mimeType = `audio/${ext}`;
    } else if (DOC_EXTENSIONS.has(ext)) {
      category = 'documents';
      if (ext === 'pdf') mimeType = 'application/pdf';
      else if (ext === 'json') mimeType = 'application/json';
      else if (ext === 'csv') mimeType = 'text/csv';
      else if (ext === 'txt' || ext === 'md') mimeType = 'text/plain';
      else mimeType = 'application/vnd.openxmlformats-officedocument';
    }

    return {
      name,
      provider: 'direct',
      category,
      mimeType,
      thumbnailUrl,
      metadata: {
        extension: ext
      }
    };
  }

  getDirectUrl(item: InfinityItem): string {
    return item.url;
  }
}
