import { DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

export class SoundCloudAdapter implements ProviderAdapter {
  id = 'soundcloud' as const;
  name = 'SoundCloud';

  canHandle(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      const host = url.hostname.toLowerCase();
      return host === 'soundcloud.com' ||
        host.endsWith('.soundcloud.com');
    } catch {
      return false;
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    let name = 'Pista de SoundCloud';
    try {
      const url = new URL(urlString);
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.length >= 2) {
        name = `${parts[1].replace(/-/g, ' ')} (${parts[0]})`;
      }
    } catch {
      // ignore
    }

    const embedUrl = `https://w.soundcloud.com/player/?url=${encodeURIComponent(urlString)}&color=%238b5cf6&auto_play=false&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;

    return {
      name,
      provider: 'soundcloud',
      category: 'music',
      embedUrl,
      metadata: {
        trackUrl: urlString
      }
    };
  }

  getEmbedUrl(item: InfinityItem): string | null {
    return `https://w.soundcloud.com/player/?url=${encodeURIComponent(item.url)}&color=%238b5cf6&auto_play=true&hide_related=true&show_comments=false&show_user=true&show_reposts=false&show_teaser=false`;
  }
}
