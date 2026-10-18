import { DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

export class GenericAdapter implements ProviderAdapter {
  id = 'generic' as const;
  name = 'Enlace Web';

  canHandle(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    let name = 'Enlace externo';
    try {
      const url = new URL(urlString);
      const cleanPath = url.pathname.split('/').filter(Boolean).pop();
      if (cleanPath && cleanPath.length > 1) {
        name = decodeURIComponent(cleanPath).slice(0, 60);
      } else {
        name = url.hostname;
      }
    } catch {
      // ignore
    }

    return {
      name,
      provider: 'generic',
      category: 'others',
      metadata: {
        rawUrl: urlString
      }
    };
  }

  getDirectUrl(item: InfinityItem): string {
    return item.url;
  }
}
