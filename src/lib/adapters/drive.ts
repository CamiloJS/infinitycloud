import { DetectedMetadata, InfinityItem } from '@/types';
import { ProviderAdapter } from './types';

export class DriveAdapter implements ProviderAdapter {
  id = 'drive' as const;
  name = 'Google Drive';

  canHandle(urlString: string): boolean {
    try {
      const url = new URL(urlString);
      const host = url.hostname.toLowerCase();
      return host === 'drive.google.com' ||
        host.endsWith('.drive.google.com') ||
        host === 'docs.google.com' ||
        host.endsWith('.docs.google.com');
    } catch {
      return false;
    }
  }

  extractFileId(urlString: string): { fileId: string | null; driveType: string } {
    try {
      const url = new URL(urlString);
      const pathname = url.pathname;

      if (pathname.includes('/file/d/')) {
        const parts = pathname.split('/file/d/')[1]?.split('/');
        return { fileId: parts?.[0] || null, driveType: 'file' };
      }
      if (pathname.includes('/document/d/')) {
        const parts = pathname.split('/document/d/')[1]?.split('/');
        return { fileId: parts?.[0] || null, driveType: 'docs' };
      }
      if (pathname.includes('/spreadsheets/d/')) {
        const parts = pathname.split('/spreadsheets/d/')[1]?.split('/');
        return { fileId: parts?.[0] || null, driveType: 'sheets' };
      }
      if (pathname.includes('/presentation/d/')) {
        const parts = pathname.split('/presentation/d/')[1]?.split('/');
        return { fileId: parts?.[0] || null, driveType: 'slides' };
      }
      if (url.searchParams.get('id')) {
        return { fileId: url.searchParams.get('id'), driveType: 'file' };
      }

      return { fileId: null, driveType: 'generic_drive' };
    } catch {
      return { fileId: null, driveType: 'generic_drive' };
    }
  }

  async detect(urlString: string): Promise<DetectedMetadata> {
    const { fileId, driveType } = this.extractFileId(urlString);
    let title = 'Archivo de Google Drive';
    if (driveType === 'docs') title = 'Documento de Google Docs';
    else if (driveType === 'sheets') title = 'Hoja de cálculo de Google';
    else if (driveType === 'slides') title = 'Presentación de Google';
    else if (fileId) title = `Archivo de Drive (${fileId.slice(0, 8)}...)`;

    const thumbnailUrl = fileId 
      ? `https://drive.google.com/thumbnail?id=${fileId}&sz=w600`
      : undefined;

    return {
      name: title,
      provider: 'drive',
      category: 'documents',
      thumbnailUrl,
      embedUrl: fileId ? `https://drive.google.com/file/d/${fileId}/preview` : undefined,
      metadata: {
        fileId: fileId || undefined,
        driveType
      }
    };
  }

  getEmbedUrl(item: InfinityItem): string | null {
    const fileId = item.metadata?.fileId;
    const driveType = item.metadata?.driveType;

    if (driveType === 'docs' && fileId) {
      return `https://docs.google.com/document/d/${fileId}/preview`;
    }
    if (driveType === 'sheets' && fileId) {
      return `https://docs.google.com/spreadsheets/d/${fileId}/preview`;
    }
    if (driveType === 'slides' && fileId) {
      return `https://docs.google.com/presentation/d/${fileId}/preview`;
    }
    if (fileId) {
      return `https://drive.google.com/file/d/${fileId}/preview`;
    }
    return null;
  }
}
