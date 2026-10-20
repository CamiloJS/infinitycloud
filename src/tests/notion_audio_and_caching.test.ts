import { describe, it, expect, vi, beforeEach } from 'vitest';

describe('Notion Audio & Caching Suite', () => {
  it('validates common audio extensions and streaming urls', () => {
    const audioUrls = [
      'https://file.notion.so/f/f/abc/podcast.mp3',
      'https://prod-files-secure.s3.us-west-2.amazonaws.com/xyz/audio.wav?X-Amz-Signature=123',
      'https://example.com/recording.m4a',
      'https://notion.site/sample.ogg'
    ];

    const isAudioUrl = (url: string) => {
      const l = url.toLowerCase();
      return (
        l.endsWith('.mp3') ||
        l.endsWith('.wav') ||
        l.endsWith('.ogg') ||
        l.endsWith('.m4a') ||
        l.includes('.mp3?') ||
        l.includes('.wav?') ||
        l.includes('.ogg?') ||
        l.includes('.m4a?')
      );
    };

    audioUrls.forEach(url => {
      expect(isAudioUrl(url)).toBe(true);
    });

    expect(isAudioUrl('https://example.com/movie.mp4')).toBe(false);
  });

  it('handles in-memory TTL caching correctly', () => {
    const cache = new Map<string, { data: any; timestamp: number }>();
    const TTL = 500; // 500ms for test

    const setCache = (key: string, data: any) => {
      cache.set(key, { data, timestamp: Date.now() });
    };

    const getCache = (key: string) => {
      const entry = cache.get(key);
      if (entry && Date.now() - entry.timestamp < TTL) {
        return entry.data;
      }
      return null;
    };

    setCache('notion:page:123', { foundAudio: true, audio: { title: 'Track 1' } });
    expect(getCache('notion:page:123')).toEqual({ foundAudio: true, audio: { title: 'Track 1' } });
  });

  it('ensures version payload returns version string and timestamp', async () => {
    const { GET } = await import('@/app/api/version/route');
    const res = await GET();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data).toHaveProperty('version');
    expect(data).toHaveProperty('timestamp');
    expect(typeof data.version).toBe('string');
    expect(data.version.length).toBeGreaterThan(0);
  });
});
