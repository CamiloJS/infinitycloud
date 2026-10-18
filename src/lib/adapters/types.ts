import { DetectedMetadata, InfinityItem, ProviderType } from '@/types';

export interface ProviderAdapter {
  id: ProviderType;
  name: string;
  canHandle(url: string): boolean;
  detect(url: string): Promise<DetectedMetadata>;
  getEmbedUrl?(item: InfinityItem): string | null;
  getDirectUrl?(item: InfinityItem): string;
}
