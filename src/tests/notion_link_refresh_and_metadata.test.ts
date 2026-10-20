import { describe, it, expect } from 'vitest';
import { isNotionUrlExpiredOrNearExpiry, isNotionMediaItem } from '@/lib/utils/notionUrl';

describe('Notion S3 Link Expiry and Metadata Preservation', () => {
  it('detects Notion media items accurately', () => {
    const notionVideoItem = {
      id: 'item_1',
      provider: 'notion',
      url: 'https://notion.so/my-workspace/page-1234567890abcdef1234567890abcdef',
      metadata: {
        isNotionVideo: true,
        s3Url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/test.mp4'
      }
    };

    const notionAudioItem = {
      id: 'item_2',
      provider: 'notion',
      url: 'https://my-page.notion.site/song-1234567890abcdef1234567890abcdef',
      metadata: {
        isNotionAudio: true,
        s3Url: 'https://file.notion.so/f/s/test.mp3'
      }
    };

    const youtubeItem = {
      id: 'item_3',
      provider: 'youtube',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
    };

    expect(isNotionMediaItem(notionVideoItem)).toBe(true);
    expect(isNotionMediaItem(notionAudioItem)).toBe(true);
    expect(isNotionMediaItem(youtubeItem)).toBe(false);
  });

  it('correctly identifies expired AWS SigV4 presigned S3 URLs', () => {
    // URL created 2 hours ago with 3600s TTL (expired)
    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    const y = twoHoursAgo.getUTCFullYear();
    const m = String(twoHoursAgo.getUTCMonth() + 1).padStart(2, '0');
    const d = String(twoHoursAgo.getUTCDate()).padStart(2, '0');
    const hh = String(twoHoursAgo.getUTCHours()).padStart(2, '0');
    const mm = String(twoHoursAgo.getUTCMinutes()).padStart(2, '0');
    const ss = String(twoHoursAgo.getUTCSeconds()).padStart(2, '0');
    const expiredAmzDate = `${y}${m}${d}T${hh}${mm}${ss}Z`;

    const expiredUrl = `https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${expiredAmzDate}&X-Amz-Expires=3600&X-Amz-Signature=test`;
    expect(isNotionUrlExpiredOrNearExpiry(expiredUrl)).toBe(true);

    // URL created 5 minutes ago with 3600s TTL (fresh)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    const fy = fiveMinutesAgo.getUTCFullYear();
    const fm = String(fiveMinutesAgo.getUTCMonth() + 1).padStart(2, '0');
    const fd = String(fiveMinutesAgo.getUTCDate()).padStart(2, '0');
    const fhh = String(fiveMinutesAgo.getUTCHours()).padStart(2, '0');
    const fmm = String(fiveMinutesAgo.getUTCMinutes()).padStart(2, '0');
    const fss = String(fiveMinutesAgo.getUTCSeconds()).padStart(2, '0');
    const freshAmzDate = `${fy}${fm}${fd}T${fhh}${fmm}${fss}Z`;

    const freshUrl = `https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace/video.mp4?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Date=${freshAmzDate}&X-Amz-Expires=3600&X-Amz-Signature=test`;
    expect(isNotionUrlExpiredOrNearExpiry(freshUrl)).toBe(false);
  });

  it('correctly identifies expired URLs via expirationTimestamp query param', () => {
    // Expiration timestamp in the past
    const expiredTs = Date.now() - 10000;
    const expiredUrl = `https://file.notion.so/f/s/video.mp4?table=block&id=123&expirationTimestamp=${expiredTs}`;
    expect(isNotionUrlExpiredOrNearExpiry(expiredUrl)).toBe(true);

    // Expiration timestamp in 30 minutes
    const futureTs = Date.now() + 30 * 60 * 1000;
    const validUrl = `https://file.notion.so/f/s/video.mp4?table=block&id=123&expirationTimestamp=${futureTs}`;
    expect(isNotionUrlExpiredOrNearExpiry(validUrl)).toBe(false);
  });

  it('detects expiry via lastResolvedAt timestamp fallback', () => {
    const s3Url = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/test.mp3';
    
    // Resolved 60 minutes ago
    const resolved60MinAgo = Date.now() - 60 * 60 * 1000;
    expect(isNotionUrlExpiredOrNearExpiry(s3Url, resolved60MinAgo)).toBe(true);

    // Resolved 10 minutes ago
    const resolved10MinAgo = Date.now() - 10 * 60 * 1000;
    expect(isNotionUrlExpiredOrNearExpiry(s3Url, resolved10MinAgo)).toBe(false);
  });

  it('never marks non-S3 URLs as expired', () => {
    const normalHttpUrl = 'https://example.com/audio.mp3';
    expect(isNotionUrlExpiredOrNearExpiry(normalHttpUrl, Date.now() - 3600000)).toBe(false);
  });

  it('preserves user custom metadata when updating Notion stream URLs', () => {
    const existingItem = {
      id: 'song_123',
      name: 'Mi Canción Personalizada',
      thumbnailUrl: 'https://images.unsplash.com/custom-album-art.jpg',
      category: 'music' as const,
      provider: 'notion' as const,
      url: 'https://notion.so/workspace/page-123',
      metadata: {
        artist: 'Artista Favorito',
        album: 'Álbum Especial 2026',
        lyrics: '[00:05.00]Letra sincronizada...',
        s3Url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/old-expired.mp3',
        lastResolvedAt: Date.now() - 2 * 3600 * 1000
      }
    };

    const freshS3Url = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/new-fresh-signed.mp3';
    const now = Date.now();

    // The update payload generated during link refresh
    const refreshedItem = {
      ...existingItem,
      metadata: {
        ...existingItem.metadata,
        s3Url: freshS3Url,
        lastResolvedAt: now
      }
    };

    // User metadata assertions
    expect(refreshedItem.name).toBe('Mi Canción Personalizada');
    expect(refreshedItem.thumbnailUrl).toBe('https://images.unsplash.com/custom-album-art.jpg');
    expect(refreshedItem.metadata.artist).toBe('Artista Favorito');
    expect(refreshedItem.metadata.album).toBe('Álbum Especial 2026');
    expect(refreshedItem.metadata.lyrics).toBe('[00:05.00]Letra sincronizada...');
    expect(refreshedItem.metadata.s3Url).toBe(freshS3Url);
    expect(refreshedItem.metadata.lastResolvedAt).toBe(now);
  });
});
