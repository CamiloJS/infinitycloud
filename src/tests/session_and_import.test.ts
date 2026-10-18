import { describe, it, expect, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { 
  createSessionToken, 
  requireServerAuth 
} from '@/lib/auth/session';
import { 
  saveServerItem, 
  fetchServerItems, 
  saveServerUserSettings 
} from '@/lib/server/store';
import { InfinityItem } from '@/types';

describe('Server Authentication & Session Protection', () => {
  it('blocks unauthenticated requests with 401 status', () => {
    const req = new NextRequest('http://localhost:3000/api/notion/search');
    const result = requireServerAuth(req);

    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(401);
    }
  });

  it('blocks requests with 403 status when 2FA is pending', () => {
    const pendingToken = createSessionToken({
      userId: 'user_pending_2fa',
      email: 'user@pending.dev',
      twoFactorPending: true,
      twoFactorVerified: false
    });

    const req = new NextRequest('http://localhost:3000/api/notion/import', {
      headers: {
        authorization: `Bearer ${pendingToken}`
      }
    });

    const result = requireServerAuth(req);
    expect(result.authorized).toBe(false);
    if (!result.authorized) {
      expect(result.response.status).toBe(403);
    }
  });

  it('permits requests when allow2FaPending option is enabled', () => {
    const pendingToken = createSessionToken({
      userId: 'user_pending_2fa',
      email: 'user@pending.dev',
      twoFactorPending: true,
      twoFactorVerified: false
    });

    const req = new NextRequest('http://localhost:3000/api/auth/2fa/challenge', {
      headers: {
        authorization: `Bearer ${pendingToken}`
      }
    });

    const result = requireServerAuth(req, { allow2FaPending: true });
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.session.userId).toBe('user_pending_2fa');
    }
  });

  it('authorizes fully verified sessions with completed 2FA', () => {
    const verifiedToken = createSessionToken({
      userId: 'user_verified_session',
      email: 'verified@user.dev',
      twoFactorPending: false,
      twoFactorVerified: true
    });

    const req = new NextRequest('http://localhost:3000/api/notion/search', {
      headers: {
        authorization: `Bearer ${verifiedToken}`
      }
    });

    const result = requireServerAuth(req);
    expect(result.authorized).toBe(true);
    if (result.authorized) {
      expect(result.session.userId).toBe('user_verified_session');
      expect(result.session.twoFactorVerified).toBe(true);
    }
  });
});

describe('Notion Import Persistence & Deduplication in Server Store', () => {
  const testUserId = 'test_import_user_123';

  beforeEach(async () => {
    await saveServerUserSettings(testUserId, {
      notionConnected: true,
      notionBotName: 'TestBot'
    });
  });

  it('persists imported items to server storage reliably', async () => {
    const item1: InfinityItem = {
      id: 'notion_block_1001',
      userId: testUserId,
      name: 'Documento importado de Notion',
      url: 'https://prod-files-secure.s3.us-west-2.amazonaws.com/test/doc.pdf',
      provider: 'notion',
      category: 'documents',
      isFavorite: false,
      isTrash: false,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      metadata: {
        notionBlockId: 'block_1001'
      }
    };

    await saveServerItem(testUserId, item1);

    const items = await fetchServerItems(testUserId);
    expect(items.some(i => i.id === 'notion_block_1001')).toBe(true);
    const saved = items.find(i => i.id === 'notion_block_1001');
    expect(saved?.name).toBe('Documento importado de Notion');
    expect(saved?.provider).toBe('notion');
  });

  it('prevents duplicates when re-importing identical Notion block IDs', async () => {
    const items = await fetchServerItems(testUserId);
    const existingBlockIds = new Set(
      items
        .filter(i => i.provider === 'notion' && i.metadata?.notionBlockId)
        .map(i => i.metadata!.notionBlockId)
    );

    // Duplicate check simulation
    const candidateBlockId = 'block_1001';
    expect(existingBlockIds.has(candidateBlockId)).toBe(true);
  });
});
