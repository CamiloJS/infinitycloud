export type ProviderType = 
  | 'notion'
  | 'youtube'
  | 'drive'
  | 'vimeo'
  | 'soundcloud'
  | 'direct'
  | 'generic';

export type CategoryType = 
  | 'photos'
  | 'videos'
  | 'music'
  | 'documents'
  | 'others';

export interface InfinityItem {
  id: string;
  userId: string;
  name: string;
  url: string;
  provider: ProviderType;
  category: CategoryType;
  mimeType?: string;
  size?: number; // bytes, ONLY when authentic
  thumbnailUrl?: string;
  collectionId?: string | null;
  isFavorite: boolean;
  isTrash: boolean;
  trashedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  isProtected?: boolean;
  passwordHash?: string;
  metadata?: Record<string, any>;
}

export interface InfinityCollection {
  id: string;
  userId: string;
  name: string;
  color?: string;
  icon?: string;
  createdAt: number;
  updatedAt: number;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  twoFactorEnabled: boolean;
  createdAt: number;
  notionConnected?: boolean;
  notionWorkspaceName?: string;
}

export interface TwoFactorSecret {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
}

export interface DetectedMetadata {
  name: string;
  provider: ProviderType;
  category: CategoryType;
  mimeType?: string;
  thumbnailUrl?: string;
  embedUrl?: string;
  metadata?: Record<string, any>;
}

export type ViewMode = 'grid' | 'list';
export type SortOption = 'date-desc' | 'date-asc' | 'name-asc' | 'name-desc';
