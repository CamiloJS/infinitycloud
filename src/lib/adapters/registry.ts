import { DetectedMetadata, InfinityItem, ProviderType } from '@/types';
import { ProviderAdapter } from './types';
import { YouTubeAdapter } from './youtube';
import { DriveAdapter } from './drive';
import { VimeoAdapter } from './vimeo';
import { SoundCloudAdapter } from './soundcloud';
import { DirectAdapter } from './direct';
import { NotionAdapter } from './notion';
import { GenericAdapter } from './generic';

class AdapterRegistry {
  private adapters: ProviderAdapter[] = [
    new YouTubeAdapter(),
    new DriveAdapter(),
    new VimeoAdapter(),
    new SoundCloudAdapter(),
    new DirectAdapter(),
    new NotionAdapter(),
    new GenericAdapter(), // Fallback
  ];

  getAdapter(provider: ProviderType): ProviderAdapter | undefined {
    return this.adapters.find(a => a.id === provider);
  }

  findAdapterForUrl(url: string): ProviderAdapter {
    for (const adapter of this.adapters) {
      if (adapter.canHandle(url)) {
        return adapter;
      }
    }
    return this.adapters[this.adapters.length - 1]; // GenericAdapter
  }

  async detect(url: string): Promise<DetectedMetadata> {
    const adapter = this.findAdapterForUrl(url);
    return adapter.detect(url);
  }

  getEmbedUrl(item: InfinityItem): string | null {
    const adapter = this.getAdapter(item.provider);
    if (adapter?.getEmbedUrl) {
      return adapter.getEmbedUrl(item);
    }
    return null;
  }

  getDirectUrl(item: InfinityItem): string {
    const adapter = this.getAdapter(item.provider);
    if (adapter?.getDirectUrl) {
      return adapter.getDirectUrl(item);
    }
    return item.url;
  }
}

export const adapterRegistry = new AdapterRegistry();
