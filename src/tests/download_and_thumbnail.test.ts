import { describe, it, expect } from 'vitest';
import { canDownloadItem, getDownloadFilename } from '@/lib/utils/download';
import { InfinityItem } from '@/types';

describe('Download and Thumbnail Utilities', () => {
  it('strictly disallows downloading YouTube items', () => {
    const ytItem1: InfinityItem = {
      id: 'yt1',
      userId: 'u1',
      name: 'YouTube Tutorial',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      provider: 'youtube',
      category: 'videos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const ytItem2: InfinityItem = {
      id: 'yt2',
      userId: 'u1',
      name: 'Short clip',
      url: 'https://youtu.be/dQw4w9WgXcQ',
      provider: 'direct', // even if provider was detected as direct
      category: 'videos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(canDownloadItem(ytItem1)).toBe(false);
    expect(canDownloadItem(ytItem2)).toBe(false);
  });

  it('allows downloading Notion files and direct files', () => {
    const notionVideoItem: InfinityItem = {
      id: 'notion1',
      userId: 'u1',
      name: 'Black Widow',
      url: 'https://camilojaimes.notion.site/Black-Widow-5ade5ea5587a42929beb5582a1ef1f1f',
      provider: 'notion',
      category: 'videos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        isNotionVideo: true,
        s3Url: 'https://file.notion.so/f/f/user/video.mp4?exp=123'
      }
    };

    const directItem: InfinityItem = {
      id: 'direct1',
      userId: 'u1',
      name: 'Documento PDF',
      url: 'https://example.com/files/report.pdf',
      provider: 'direct',
      category: 'documents',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(canDownloadItem(notionVideoItem)).toBe(true);
    expect(canDownloadItem(directItem)).toBe(true);
  });

  it('derives correct file extensions when downloading', () => {
    const notionItem: InfinityItem = {
      id: 'notion1',
      userId: 'u1',
      name: 'Black Widow',
      url: 'https://camilojaimes.notion.site/Black-Widow',
      provider: 'notion',
      category: 'videos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: { isNotionVideo: true }
    };

    const filename = getDownloadFilename(notionItem, 'https://file.notion.so/video.mp4?exp=123');
    expect(filename).toBe('Black Widow.mp4');

    const photoItem: InfinityItem = {
      id: 'photo1',
      userId: 'u1',
      name: 'Fotografía Paisaje',
      url: 'https://example.com/photo.jpg',
      provider: 'direct',
      category: 'photos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(getDownloadFilename(photoItem)).toBe('Fotografía Paisaje.jpg');
  });
});
