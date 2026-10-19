import { describe, it, expect, beforeEach } from 'vitest';
import { NotionAdapter } from '@/lib/adapters/notion';
import { syncSharedFolder, fetchPublicFolder } from '@/lib/firebase/firestore';
import { hashItemPassword, verifyItemPassword } from '@/lib/security/itemPassword';
import { InfinityCollection, InfinityItem } from '@/types';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
global.localStorage = {
  getItem: (key: string) => store[key] || null,
  setItem: (key: string, val: string) => { store[key] = val; },
  removeItem: (key: string) => { delete store[key]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); },
  key: (i: number) => Object.keys(store)[i] || null,
  length: 0
};

describe('Folder Sharing and Notion Video Extraction', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('shares a public folder and allows reading items without password', async () => {
    const userId = 'user_test_share_1';
    const collection: InfinityCollection = {
      id: 'coll_test_public_1',
      userId,
      name: 'Carpeta Pública',
      description: 'Archivos abiertos',
      color: '#3b82f6',
      isShared: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    // Store dummy items in local storage
    const testItem: InfinityItem = {
      id: 'item_in_folder_1',
      userId,
      name: 'Video Demo',
      url: 'https://example.com/video.mp4',
      provider: 'direct',
      category: 'videos',
      collectionId: collection.id,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    localStorage.setItem(`infinity_${userId}_items`, JSON.stringify([testItem]));

    // Sync public share
    await syncSharedFolder(userId, collection);

    // Fetch public folder without password
    const publicFolder = await fetchPublicFolder(collection.id);
    expect(publicFolder).not.toBeNull();
    expect(publicFolder?.name).toBe('Carpeta Pública');
    expect(publicFolder?.isShared).toBe(true);
    expect(publicFolder?.isProtected).toBe(false);
    expect(publicFolder?.items.length).toBe(1);
    expect(publicFolder?.items[0].name).toBe('Video Demo');
  });

  it('protects shared folder with password and requires valid hash to reveal items', async () => {
    const userId = 'user_test_share_2';
    const folderPassword = 'SuperSecretFolderPassword123';
    const passwordHash = await hashItemPassword(folderPassword);

    const collection: InfinityCollection = {
      id: 'coll_test_protected_2',
      userId,
      name: 'Carpeta Protegida',
      color: '#ef4444',
      isShared: true,
      sharePasswordHash: passwordHash,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const privateItem: InfinityItem = {
      id: 'item_private_doc',
      userId,
      name: 'Documento Confidencial',
      url: 'https://example.com/doc.pdf',
      provider: 'direct',
      category: 'documents',
      collectionId: collection.id,
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    localStorage.setItem(`infinity_${userId}_items`, JSON.stringify([privateItem]));
    await syncSharedFolder(userId, collection);

    // 1. Fetching without password returns metadata but EMPTY items list
    const unauthenticated = await fetchPublicFolder(collection.id);
    expect(unauthenticated).not.toBeNull();
    expect(unauthenticated?.isProtected).toBe(true);
    expect(unauthenticated?.requiresPassword).toBe(true);
    expect(unauthenticated?.items.length).toBe(0);

    // 2. Fetching with invalid password fails
    const wrongHash = await hashItemPassword('WrongPassword');
    const wrongAttempt = await fetchPublicFolder(collection.id, wrongHash);
    expect(wrongAttempt?.requiresPassword).toBe(true);
    expect(wrongAttempt?.items.length).toBe(0);

    // 3. Fetching with correct password reveals items
    const authenticated = await fetchPublicFolder(collection.id, passwordHash);
    expect(authenticated?.requiresPassword).toBe(false);
    expect(authenticated?.items.length).toBe(1);
    expect(authenticated?.items[0].name).toBe('Documento Confidencial');
  });

  it('unsharing folder removes public accessibility', async () => {
    const userId = 'user_test_share_3';
    const collection: InfinityCollection = {
      id: 'coll_test_unshare_3',
      userId,
      name: 'Temporal',
      isShared: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    await syncSharedFolder(userId, collection);
    expect(await fetchPublicFolder(collection.id)).not.toBeNull();

    // Now unshare
    await syncSharedFolder(userId, { ...collection, isShared: false });
    expect(await fetchPublicFolder(collection.id)).toBeNull();
  });

  it('NotionAdapter identifies Notion video URLs and routes through permanent resolver', async () => {
    const adapter = new NotionAdapter();

    // Direct S3 video link from Notion
    const notionS3Video = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/1234/test-video.mp4?X-Amz-Expires=86400';
    expect(adapter.canHandle(notionS3Video)).toBe(true);

    const detectedS3 = await adapter.detect(notionS3Video);
    expect(detectedS3.provider).toBe('notion');
    expect(detectedS3.category).toBe('videos');

    // Routing item through getDirectUrl
    const dummyItem: InfinityItem = {
      id: 'item_notion_vid_123',
      userId: 'user_notion_1',
      name: 'Clase Magistral',
      url: notionS3Video,
      provider: 'notion',
      category: 'videos',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        isNotionVideo: true,
        notionBlockId: 'block_abc_123'
      }
    };

    const directUrl = adapter.getDirectUrl(dummyItem);
    expect(directUrl).toBe('/api/notion/resolve?itemId=item_notion_vid_123');
  });
});
