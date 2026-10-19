import { describe, it, expect, beforeEach, vi } from 'vitest';
import { drawCoverCrop } from '@/lib/utils/videoThumbnail';
import { 
  syncSharedFolder, 
  fetchPublicFolder, 
  saveItem, 
  updateItem, 
  moveItemToTrash, 
  permanentlyDeleteItem,
  fetchUserCollections 
} from '@/lib/firebase/firestore';
import { hashItemPassword, verifyItemPassword } from '@/lib/security/itemPassword';
import { findServerItemById, saveServerItem } from '@/lib/server/store';
import { InfinityCollection, InfinityItem } from '@/types';

// Mock localStorage for Node test environment
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (i: number) => Object.keys(store)[i] || null,
  length: 0
};

describe('Bugfixes and Edge Cases Audit', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('16:9 Cover Cropping (drawCoverCrop)', () => {
    it('crops ultrawide video (21:9) on sides without stretching or black bars', () => {
      const mockCtx = {
        drawImage: vi.fn()
      } as unknown as CanvasRenderingContext2D;

      const mockVideo = {
        videoWidth: 2560,
        videoHeight: 1080
      } as HTMLVideoElement;

      drawCoverCrop(mockCtx, mockVideo, 640, 360);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
      const args = vi.mocked(mockCtx.drawImage).mock.calls[0];
      // [video, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight]
      const [_, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight] = args;
      expect(dy).toBe(0);
      expect(sy).toBe(0);
      expect(sHeight).toBe(1080);
      // sWidth = 1080 * (16/9) = 1920
      expect(sWidth).toBeCloseTo(1920);
      // sx = (2560 - 1920) / 2 = 320
      expect(sx).toBeCloseTo(320);
      expect(dWidth).toBe(640);
      expect(dHeight).toBe(360);
    });

    it('crops vertical video (9:16) top and bottom without black bars', () => {
      const mockCtx = {
        drawImage: vi.fn()
      } as unknown as CanvasRenderingContext2D;

      const mockVideo = {
        videoWidth: 1080,
        videoHeight: 1920
      } as HTMLVideoElement;

      drawCoverCrop(mockCtx, mockVideo, 640, 360);

      expect(mockCtx.drawImage).toHaveBeenCalledTimes(1);
      const args = vi.mocked(mockCtx.drawImage).mock.calls[0];
      const [_, sx, sy, sWidth, sHeight, dx, dy, dWidth, dHeight] = args;
      expect(dx).toBe(0);
      expect(sx).toBe(0);
      expect(sWidth).toBe(1080);
      // sHeight = 1080 / (16/9) = 607.5
      expect(sHeight).toBeCloseTo(607.5);
      // sy = (1920 - 607.5) / 2 = 656.25
      expect(sy).toBeCloseTo(656.25);
      expect(dWidth).toBe(640);
      expect(dHeight).toBe(360);
    });
  });

  describe('Shared Folder File Password Protection & Guest Unlocking', () => {
    it('retains password hash on protected items so guests can verify passwords correctly', async () => {
      const userId = 'user_guest_unlock_test';
      const filePassword = 'FileSecret2026';
      const filePasswordHash = await hashItemPassword(filePassword);

      const collection: InfinityCollection = {
        id: 'coll_guest_test_1',
        userId,
        name: 'Shared With Protected File',
        isShared: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      const protectedItem: InfinityItem = {
        id: 'item_protected_shared_1',
        userId,
        name: 'Notas Secretas.pdf',
        url: 'https://example.com/notes.pdf',
        provider: 'direct',
        category: 'documents',
        collectionId: collection.id,
        isProtected: true,
        passwordHash: filePasswordHash,
        isFavorite: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      localStorage.setItem(`infinity_${userId}_items`, JSON.stringify([protectedItem]));
      localStorage.setItem(`infinity_${userId}_collections`, JSON.stringify([collection]));

      await syncSharedFolder(userId, collection);

      const publicFolder = await fetchPublicFolder(collection.id);
      expect(publicFolder).not.toBeNull();
      expect(publicFolder?.items.length).toBe(1);

      const itemInShare = publicFolder?.items[0];
      expect(itemInShare?.isProtected).toBe(true);
      expect(itemInShare?.passwordHash).not.toBe('PROTECTED');
      expect(itemInShare?.passwordHash).toBe(filePasswordHash);

      // Verify guest unlocking succeeds with correct password
      const unlockSuccess = await verifyItemPassword(filePassword, itemInShare?.passwordHash || '');
      expect(unlockSuccess).toBe(true);

      // Verify guest unlocking fails with incorrect password
      const unlockFail = await verifyItemPassword('WrongGuess', itemInShare?.passwordHash || '');
      expect(unlockFail).toBe(false);
    });
  });

  describe('Shared Folder Auto-Sync upon Item Mutations', () => {
    it('automatically updates public share when items are added, updated, or trashed', async () => {
      const userId = 'user_auto_sync_test';
      const collection: InfinityCollection = {
        id: 'coll_auto_sync_1',
        userId,
        name: 'Auto Sync Folder',
        isShared: true,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      localStorage.setItem(`infinity_${userId}_collections`, JSON.stringify([collection]));
      await syncSharedFolder(userId, collection);

      // 1. Initial share has 0 items
      let publicShare = await fetchPublicFolder(collection.id);
      expect(publicShare?.items.length).toBe(0);

      // 2. Add item to shared collection -> public share auto-updates!
      const item1: InfinityItem = {
        id: 'item_auto_1',
        userId,
        name: 'Photo 1.png',
        url: 'https://example.com/p1.png',
        provider: 'direct',
        category: 'photos',
        collectionId: collection.id,
        isFavorite: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await saveItem(userId, item1);

      publicShare = await fetchPublicFolder(collection.id);
      expect(publicShare?.items.length).toBe(1);
      expect(publicShare?.items[0].name).toBe('Photo 1.png');

      // 3. Move item to trash -> public share auto-syncs and removes it!
      await moveItemToTrash(userId, item1.id);
      publicShare = await fetchPublicFolder(collection.id);
      expect(publicShare?.items.length).toBe(0);
    });
  });

  describe('Notion Server Store Item Resolution', () => {
    it('finds items across user stores using findServerItemById', async () => {
      const userId = 'user_notion_finder';
      const item: InfinityItem = {
        id: 'notion_test_item_999',
        userId,
        name: 'Notion Video Test',
        url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/test.mp4',
        provider: 'notion',
        category: 'videos',
        isFavorite: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          notionBlockId: 'block_999_xyz',
          isNotionVideo: true
        }
      };

      await saveServerItem(userId, item);

      const found = await findServerItemById('notion_test_item_999');
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Notion Video Test');
      expect(found?.metadata?.notionBlockId).toBe('block_999_xyz');
    });

    it('finds items contained within cached public shares', async () => {
      const shareItemId = 'item_inside_public_share_456';
      // Simulate cached share in local store
      const fs = await import('fs');
      const path = await import('path');
      const storePath = path.join(process.cwd(), '.server_data.json');
      let currentData: any = { settings: {}, items: {}, collections: {} };
      try {
        if (fs.existsSync(storePath)) {
          currentData = JSON.parse(fs.readFileSync(storePath, 'utf-8'));
        }
      } catch {}

      currentData.shares = {
        'share_coll_789': {
          id: 'share_coll_789',
          name: 'Shared Folder',
          items: [
            {
              id: shareItemId,
              name: 'Video Inside Share',
              url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/share.mp4',
              provider: 'notion',
              category: 'videos'
            }
          ]
        }
      };
      fs.writeFileSync(storePath, JSON.stringify(currentData, null, 2), 'utf-8');

      const found = await findServerItemById(shareItemId);
      expect(found).not.toBeNull();
      expect(found?.name).toBe('Video Inside Share');
    });
  });

  describe('SSRF Public Media Validation (isSafePublicMediaUrl)', () => {
    it('allows valid public HTTPS and HTTP media endpoints', async () => {
      const { isSafePublicMediaUrl } = await import('@/lib/security/ssrf');
      expect(isSafePublicMediaUrl('https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4')).toBe(true);
      expect(isSafePublicMediaUrl('https://cdn.example.com/videos/clip.webm')).toBe(true);
      expect(isSafePublicMediaUrl('http://public-media-server.org/track.mp3')).toBe(true);
    });

    it('blocks private, loopback, and cloud metadata destinations', async () => {
      const { isSafePublicMediaUrl } = await import('@/lib/security/ssrf');
      // Loopback
      expect(isSafePublicMediaUrl('http://127.0.0.1:8000/video.mp4')).toBe(false);
      expect(isSafePublicMediaUrl('http://localhost:3000/api/secret')).toBe(false);
      expect(isSafePublicMediaUrl('http://app.localhost/video.mp4')).toBe(false);
      // AWS / Cloud metadata
      expect(isSafePublicMediaUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
      // RFC1918 Private ranges
      expect(isSafePublicMediaUrl('https://10.0.0.1/stream.mp4')).toBe(false);
      expect(isSafePublicMediaUrl('https://192.168.1.100/stream.mp4')).toBe(false);
      expect(isSafePublicMediaUrl('https://172.20.0.5/stream.mp4')).toBe(false);
      // Non-HTTP schemes
      expect(isSafePublicMediaUrl('ftp://example.com/video.mp4')).toBe(false);
      expect(isSafePublicMediaUrl('javascript:alert(1)')).toBe(false);
      expect(isSafePublicMediaUrl('data:text/plain;base64,AAAA')).toBe(false);
      expect(isSafePublicMediaUrl('not-a-url')).toBe(false);
    });
  });

  describe('Notion Resolve Proxy Redirection', () => {
    it('redirects to /api/proxy/media when proxy=1 query param is provided', async () => {
      const { GET } = await import('@/app/api/notion/resolve/route');
      const { NextRequest } = await import('next/server');

      const s3Url = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/test-bucket/video.mp4';
      const req = new NextRequest(
        `http://localhost:3000/api/notion/resolve?url=${encodeURIComponent(s3Url)}&proxy=1`
      );

      const res = await GET(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toContain('/api/proxy/media?url=');
      expect(location).toContain(encodeURIComponent(s3Url));
    });

    it('falls back to item.metadata.s3Url when item.url is a Notion page URL', async () => {
      const userId = 'user_s3_fallback_test';
      const s3VideoUrl = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/my-workspace/video-file.mp4';
      const pageUrl = 'https://www.notion.so/my-workspace/Video-Page-1234567890abcdef1234567890abcdef';

      const item: InfinityItem = {
        id: 'item_notion_page_with_video',
        userId,
        name: 'Page with Video',
        url: pageUrl,
        provider: 'notion',
        category: 'videos',
        isFavorite: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          s3Url: s3VideoUrl,
          isNotionVideo: true
        }
      };

      await saveServerItem(userId, item);

      const { GET } = await import('@/app/api/notion/resolve/route');
      const { NextRequest } = await import('next/server');

      const req = new NextRequest(
        `http://localhost:3000/api/notion/resolve?itemId=${item.id}`
      );

      const res = await GET(req);
      expect(res.status).toBe(307);
      const location = res.headers.get('location');
      expect(location).toBe(s3VideoUrl);
    });
  });
});
