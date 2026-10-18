import { DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

export class VimeoAdapter implements ProviderAdapter {
  id = 'vimeo' as const;
  name = 'Vimeo';

  canHandle(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      const host = url.hostname.toLowerCase();
      return host === 'vimeo.com' ||
        host.endsWith('.vimeo.com');
    } catch {
      return false;
    }
  }

  extractVideoId(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      const parts = url.pathname.split('/').filter(Boolean);
      const id = parts[parts.length - 1];
      return /^\d+$/.test(id) ? id : null;
    } catch {
      return null;
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    const videoId = this.extractVideoId(urlString);
    return {
      name: videoId ? `Video de Vimeo (${videoId})` : 'Video de Vimeo',
      provider: 'vimeo',
      category: 'videos',
      embedUrl: videoId ? `https://player.vimeo.com/video/${videoId}` : undefined,
      metadata: {
        videoId: videoId || undefined
      }
    };
  }

  getEmbedUrl(item: InfinityItem): string | null {
    const videoId = item.metadata?.videoId || this.extractVideoId(item.url);
    if (!videoId) return null;
    return `https://player.vimeo.com/video/${videoId}?autoplay=1`;
  }
}
