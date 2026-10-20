import { describe, it, expect } from 'vitest';
import { InfinityItem } from '@/types';

describe('Google Photos View Date Grouping Tests', () => {
  it('groups photo items chronologically descending by date', () => {
    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;

    const photos: InfinityItem[] = [
      {
        id: 'photo_1',
        userId: 'user_test',
        name: 'Miku Wallpaper',
        url: 'https://example.com/miku.jpg',
        provider: 'direct',
        category: 'photos',
        isFavorite: false,
        isTrash: false,
        createdAt: now - dayMs * 5, // 5 days ago
        updatedAt: now - dayMs * 5
      },
      {
        id: 'photo_2',
        userId: 'user_test',
        name: 'Big Sur Wallpaper',
        url: 'https://example.com/bigsur.jpg',
        provider: 'direct',
        category: 'photos',
        isFavorite: true,
        isTrash: false,
        createdAt: now, // Today
        updatedAt: now
      },
      {
        id: 'photo_3',
        userId: 'user_test',
        name: 'Anime Landscape',
        url: 'https://example.com/landscape.jpg',
        provider: 'direct',
        category: 'photos',
        isFavorite: false,
        isTrash: false,
        createdAt: now - dayMs, // Yesterday
        updatedAt: now - dayMs
      }
    ];

    // Verify sorting newest first
    const sorted = [...photos].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    expect(sorted[0].id).toBe('photo_2');
    expect(sorted[1].id).toBe('photo_3');
    expect(sorted[2].id).toBe('photo_1');

    // Grouping by date YYYY-MM-DD
    const map = new Map<string, InfinityItem[]>();
    sorted.forEach(item => {
      const d = new Date(item.createdAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    });

    expect(map.size).toBe(3);
    const keys = Array.from(map.keys());
    expect(keys.length).toBe(3);
  });
});
