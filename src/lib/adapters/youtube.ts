import { DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

export class YouTubeAdapter implements ProviderAdapter {
  id = 'youtube' as const;
  name = 'YouTube';

  canHandle(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      const host = url.hostname.toLowerCase();
      return host === 'youtube.com' ||
        host.endsWith('.youtube.com') ||
        host === 'youtu.be' ||
        host.endsWith('.youtu.be');
    } catch {
      return false;
    }
  }

  extractVideoId(urlString: string): string | null {
    try {
      const url = new URL(urlString);
      const host = url.hostname.toLowerCase();

      if (host === 'youtu.be' || host.endsWith('.youtu.be')) {
        const id = url.pathname.slice(1).split('/')[0];
        return id || null;
      }

      if (host.includes('youtube.com')) {
        if (url.pathname.startsWith('/shorts/')) {
          return url.pathname.split('/shorts/')[1]?.split('/')[0] || null;
        }
        if (url.pathname.startsWith('/embed/')) {
          return url.pathname.split('/embed/')[1]?.split('/')[0] || null;
        }
        return url.searchParams.get('v');
      }

      return null;
    } catch {
      return null;
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    const videoId = this.extractVideoId(urlString);
    const title = videoId ? `Video de YouTube (${videoId})` : 'Video de YouTube';
    const thumbnailUrl = videoId 
      ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
      : undefined;

    return {
      name: title,
      provider: 'youtube',
      category: 'videos',
      thumbnailUrl,
      embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0` : undefined,
      metadata: {
        videoId: videoId || undefined
      }
    };
  }

  getEmbedUrl(item: InfinityItem): string | null {
    const videoId = item.metadata?.videoId || this.extractVideoId(item.url);
    if (!videoId) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1`;
  }
}
