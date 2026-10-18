import { describe, it, expect } from 'vitest';
import { YouTubeAdapter } from '@/lib/adapters/youtube';
import { DriveAdapter } from '@/lib/adapters/drive';
import { VimeoAdapter } from '@/lib/adapters/vimeo';
import { SoundCloudAdapter } from '@/lib/adapters/soundcloud';
import { DirectAdapter } from '@/lib/adapters/direct';
import { NotionAdapter } from '@/lib/adapters/notion';
import { adapterRegistry } from '@/lib/adapters/registry';

describe('Provider Adapters', () => {
  const youtube = new YouTubeAdapter();
  const drive = new DriveAdapter();
  const vimeo = new VimeoAdapter();
  const soundcloud = new SoundCloudAdapter();
  const direct = new DirectAdapter();
  const notion = new NotionAdapter();

  describe('YouTubeAdapter', () => {
    it('handles standard watch URLs', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      expect(youtube.canHandle(url)).toBe(true);
      expect(youtube.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('handles short youtu.be URLs', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      expect(youtube.canHandle(url)).toBe(true);
      expect(youtube.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('handles shorts URLs', () => {
      const url = 'https://youtube.com/shorts/dQw4w9WgXcQ?feature=share';
      expect(youtube.canHandle(url)).toBe(true);
      expect(youtube.extractVideoId(url)).toBe('dQw4w9WgXcQ');
    });

    it('generates nocookie embed URL and thumbnail', async () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const detected = await youtube.detect(url);
      expect(detected.provider).toBe('youtube');
      expect(detected.category).toBe('videos');
      expect(detected.thumbnailUrl).toContain('dQw4w9WgXcQ');
      expect(detected.embedUrl).toContain('youtube-nocookie.com/embed/dQw4w9WgXcQ');
    });

    it('rejects malicious or spoofed domains', () => {
      expect(youtube.canHandle('https://not-youtube.com/watch?v=123')).toBe(false);
      expect(youtube.canHandle('https://youtube.com.attacker.com/watch?v=123')).toBe(false);
    });
  });

  describe('DriveAdapter', () => {
    it('handles Google Drive file links', async () => {
      const url = 'https://drive.google.com/file/d/1A2B3C4D5E6F/view';
      expect(drive.canHandle(url)).toBe(true);
      const detected = await drive.detect(url);
      expect(detected.provider).toBe('drive');
      expect(detected.category).toBe('documents');
      expect(detected.metadata?.fileId).toBe('1A2B3C4D5E6F');
    });

    it('handles Google Docs links', async () => {
      const url = 'https://docs.google.com/document/d/9Z8Y7X6W5V/edit';
      expect(drive.canHandle(url)).toBe(true);
      const detected = await drive.detect(url);
      expect(detected.provider).toBe('drive');
      expect(detected.category).toBe('documents');
      expect(detected.name).toContain('Google Docs');
    });

    it('handles Google Spreadsheets links', async () => {
      const url = 'https://docs.google.com/spreadsheets/d/sheet123/edit';
      const detected = await drive.detect(url);
      expect(detected.metadata?.driveType).toBe('sheets');
    });
  });

  describe('VimeoAdapter', () => {
    it('detects Vimeo videos and extracts embed URL', async () => {
      const url = 'https://vimeo.com/76979871';
      expect(vimeo.canHandle(url)).toBe(true);
      const detected = await vimeo.detect(url);
      expect(detected.provider).toBe('vimeo');
      expect(detected.category).toBe('videos');
      expect(detected.embedUrl).toContain('player.vimeo.com/video/76979871');
    });
  });

  describe('SoundCloudAdapter', () => {
    it('detects SoundCloud tracks and extracts player widget', async () => {
      const url = 'https://soundcloud.com/artist/great-song';
      expect(soundcloud.canHandle(url)).toBe(true);
      const detected = await soundcloud.detect(url);
      expect(detected.provider).toBe('soundcloud');
      expect(detected.category).toBe('music');
      expect(detected.embedUrl).toContain('w.soundcloud.com/player');
    });
  });

  describe('DirectAdapter', () => {
    it('detects photos with mime type', async () => {
      const url = 'https://example.com/assets/photo.jpg';
      expect(direct.canHandle(url)).toBe(true);
      const detected = await direct.detect(url);
      expect(detected.category).toBe('photos');
      expect(detected.mimeType).toBe('image/jpeg');
    });

    it('detects audio with mime type', async () => {
      const url = 'https://example.com/audio/song.mp3';
      expect(direct.canHandle(url)).toBe(true);
      const detected = await direct.detect(url);
      expect(detected.category).toBe('music');
      expect(detected.mimeType).toBe('audio/mp3');
    });

    it('detects video with mime type', async () => {
      const url = 'https://example.com/videos/movie.mp4';
      expect(direct.canHandle(url)).toBe(true);
      const detected = await direct.detect(url);
      expect(detected.category).toBe('videos');
      expect(detected.mimeType).toBe('video/mp4');
    });

    it('detects pdf documents', async () => {
      const url = 'https://example.com/docs/manual.pdf';
      expect(direct.canHandle(url)).toBe(true);
      const detected = await direct.detect(url);
      expect(detected.category).toBe('documents');
      expect(detected.mimeType).toBe('application/pdf');
    });
  });

  describe('NotionAdapter', () => {
    it('handles notion.so page URLs', () => {
      expect(notion.canHandle('https://www.notion.so/workspace/My-Project-7c6c742f-d465-44d5-87b3-0520067dc051')).toBe(true);
    });

    it('handles notion s3 media URLs', () => {
      expect(notion.canHandle('https://prod-files-secure.s3.us-west-2.amazonaws.com/abc/file.pdf')).toBe(true);
    });
  });

  describe('AdapterRegistry', () => {
    it('routes URLs to appropriate adapter in registry', async () => {
      const youtubeDet = await adapterRegistry.detect('https://youtu.be/test12345');
      expect(youtubeDet.provider).toBe('youtube');

      const genericDet = await adapterRegistry.detect('https://news.ycombinator.com');
      expect(genericDet.provider).toBe('generic');
    });
  });
});
