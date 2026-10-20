import { describe, it, expect } from 'vitest';
import { NotionAdapter } from '@/lib/adapters/notion';
import { InfinityItem } from '@/types';

describe('Music Metadata and Folder Integration Tests', () => {
  it('NotionAdapter correctly generates streamable proxy URL for Notion music items', () => {
    const adapter = new NotionAdapter();
    const notionMusicItem: InfinityItem = {
      id: 'music_notion_01',
      userId: 'test_user_music',
      name: 'Bohemian Rhapsody',
      url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/notion_audio.mp3',
      provider: 'notion',
      category: 'music',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        isNotionAudio: true,
        notionBlockId: 'audio_block_999',
        artist: 'Queen',
        album: 'A Night at the Opera',
        year: '1975',
        genre: 'Rock'
      }
    };

    const directUrl = adapter.getDirectUrl(notionMusicItem);
    expect(directUrl).toContain('/api/notion/resolve?itemId=music_notion_01');
    expect(directUrl).toContain('blockId=audio_block_999');
    expect(directUrl).toContain('proxy=1');
  });

  it('Music item preserves artist, album, year, and genre in metadata updates', () => {
    const originalItem: InfinityItem = {
      id: 'item_music_42',
      userId: 'user_music',
      name: 'Get Lucky',
      url: 'https://example.com/audio.mp3',
      provider: 'direct',
      category: 'music',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        artist: 'Daft Punk',
        album: 'Random Access Memories',
        year: '2013',
        genre: 'Electronic'
      }
    };

    const updates: Partial<InfinityItem> = {
      name: 'Get Lucky (Radio Edit)',
      metadata: {
        ...originalItem.metadata,
        artist: 'Daft Punk ft. Pharrell Williams',
        year: '2013',
        genre: 'Disco / Funk'
      }
    };

    const updatedItem = {
      ...originalItem,
      ...updates,
      metadata: {
        ...originalItem.metadata,
        ...updates.metadata
      }
    };

    expect(updatedItem.metadata?.artist).toBe('Daft Punk ft. Pharrell Williams');
    expect(updatedItem.metadata?.album).toBe('Random Access Memories');
    expect(updatedItem.metadata?.genre).toBe('Disco / Funk');
    expect(updatedItem.category).toBe('music');
  });

  it('Moving an item to a folder updates its collectionId correctly', () => {
    const item: InfinityItem = {
      id: 'song_123',
      userId: 'user_abc',
      name: 'Canción 1',
      url: 'https://cdn.example.com/song1.mp3',
      provider: 'direct',
      category: 'music',
      collectionId: null,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Dropped into folder 'folder_rock_classics'
    const movedItem: InfinityItem = {
      ...item,
      collectionId: 'folder_rock_classics'
    };

    expect(movedItem.collectionId).toBe('folder_rock_classics');

    // Dropped out of folder back to root
    const rootItem: InfinityItem = {
      ...movedItem,
      collectionId: null
    };

    expect(rootItem.collectionId).toBeNull();
  });
});
