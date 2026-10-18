import { describe, it, expect } from 'vitest';
import { ExportDataSchema, InfinityItemSchema } from '@/lib/validation/schemas';

describe('JSON Metadata Validation (Zod)', () => {
  it('validates a correct InfinityItem schema', () => {
    const validItem = {
      id: 'item_1',
      userId: 'user_123',
      name: 'Mi video favorito',
      url: 'https://youtube.com/watch?v=123',
      provider: 'youtube',
      category: 'videos',
      isFavorite: true,
      isTrash: false,
      createdAt: 1700000000000,
      updatedAt: 1700000000000,
      metadata: { videoId: '123' }
    };

    const parsed = InfinityItemSchema.parse(validItem);
    expect(parsed.name).toBe('Mi video favorito');
    expect(parsed.provider).toBe('youtube');
  });

  it('rejects an item with an invalid URL', () => {
    const invalidItem = {
      id: 'item_2',
      name: 'Sin URL valida',
      url: 'not-a-valid-url',
      provider: 'generic',
      category: 'others'
    };

    expect(() => InfinityItemSchema.parse(invalidItem)).toThrow();
  });

  it('validates a complete export payload', () => {
    const validExport = {
      version: 1,
      exportedAt: Date.now(),
      source: 'infinity',
      collections: [
        {
          id: 'coll_1',
          name: 'Favoritos de Viaje',
          color: '#8b5cf6',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      ],
      items: [
        {
          id: 'item_1',
          name: 'Foto de playa',
          url: 'https://example.com/beach.jpg',
          provider: 'direct',
          category: 'photos',
          collectionId: 'coll_1',
          isFavorite: true,
          isTrash: false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          metadata: {}
        }
      ]
    };

    const parsed = ExportDataSchema.parse(validExport);
    expect(parsed.version).toBe(1);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.collections).toHaveLength(1);
  });

  it('rejects an export with incompatible version', () => {
    const badVersion = {
      version: 99,
      exportedAt: Date.now(),
      source: 'infinity',
      collections: [],
      items: []
    };

    expect(() => ExportDataSchema.parse(badVersion)).toThrow();
  });
});
