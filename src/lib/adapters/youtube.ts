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
    let title = videoId ? `Video (${videoId})` : 'Video';
    let thumbnailUrl = videoId 
      ? `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`
      : undefined;

    if (videoId) {
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(urlString)}&format=json`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(3000) });
        if (res.ok) {
          const data = await res.json();
          if (data?.title) title = data.title;
          // Keep maxresdefault as primary 16:9 thumbnail, or fallback to oembed
          thumbnailUrl = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
        } else {
          throw new Error('Direct oembed failed');
        }
      } catch {
        try {
          if (typeof window !== 'undefined') {
            const localRes = await fetch(`/api/oembed?url=${encodeURIComponent(urlString)}`, { signal: AbortSignal.timeout(3000) });
            if (localRes.ok) {
              const data = await localRes.json();
              if (data?.title) title = data.title;
              if (data?.thumbnail_url) thumbnailUrl = data.thumbnail_url;
            }
          }
        } catch {
          // Keep fallback
        }
      }
    }

    return {
      name: title,
      provider: 'youtube',
      category: 'videos',
      thumbnailUrl,
      embedUrl: videoId ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1&playsinline=1&iv_load_policy=3` : undefined,
      metadata: {
        videoId: videoId || undefined
      }
    };
  }

  getEmbedUrl(item: InfinityItem): string | null {
    const videoId = item.metadata?.videoId || this.extractVideoId(item.url);
    if (!videoId) return null;
    return `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&autoplay=1&modestbranding=1&playsinline=1&iv_load_policy=3`;
  }
}
