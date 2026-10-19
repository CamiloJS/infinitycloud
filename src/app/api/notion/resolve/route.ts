import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getServerUserSettings, fetchServerItems, updateServerItem } from '@/lib/server/store';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');
    const directBlockId = searchParams.get('blockId');
    const directUrl = searchParams.get('url');

    if (!itemId && !directBlockId && !directUrl) {
      return NextResponse.json({ error: 'Parámetro itemId, blockId o url es requerido' }, { status: 400 });
    }

    const session = getSessionFromRequest(req);
    const userId = session?.userId;

    let item: any = null;
    if (userId && itemId) {
      const items = await fetchServerItems(userId);
      item = items.find(i => i.id === itemId);
    }

    let targetUrl = item?.url || directUrl || '';
    const blockId = item?.metadata?.notionBlockId || directBlockId;
    const pageId = item?.metadata?.notionPageId;

    let freshUrl = targetUrl;
    let freshExpiry: string | undefined = undefined;

    // 1. Try resolving via official Notion API if user has connected token
    if (userId) {
      try {
        const settings = await getServerUserSettings(userId);
        if (settings.notionTokenEncrypted) {
          const token = decryptSecret(settings.notionTokenEncrypted);
          const notion = new Client({ auth: token });

          if (blockId) {
            const block: any = await notion.blocks.retrieve({ block_id: blockId });
            const blockContent = block[block.type];
            if (blockContent?.file?.url) {
              freshUrl = blockContent.file.url;
              freshExpiry = blockContent.file.expiry_time;
            } else if (blockContent?.external?.url) {
              freshUrl = blockContent.external.url;
            }
          } else if (pageId) {
            const page: any = await notion.pages.retrieve({ page_id: pageId });
            if (page.cover?.file?.url) {
              freshUrl = page.cover.file.url;
              freshExpiry = page.cover.file.expiry_time;
            }
          }
        }
      } catch (tokenErr) {
        console.warn('Private token resolution error, trying public API:', tokenErr);
      }
    }

    // 2. Fallback: Resolve via Notion Public API (for public/shared Notion blocks)
    if (freshUrl === targetUrl && blockId && targetUrl) {
      try {
        const signRes = await fetch('https://www.notion.so/api/v3/getSignedFileUrls', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          body: JSON.stringify({
            urls: [{
              url: targetUrl,
              permissionRecord: {
                table: 'block',
                id: blockId
              }
            }]
          })
        });

        if (signRes.ok) {
          const signData = await signRes.json();
          if (signData?.signedUrls?.[0]) {
            freshUrl = signData.signedUrls[0];
          }
        }
      } catch (publicErr) {
        console.warn('Public getSignedFileUrls error:', publicErr);
      }
    }

    // 3. Update item in background store if user is authorized and URL refreshed
    if (userId && itemId && item && freshUrl !== item.url) {
      try {
        await updateServerItem(userId, itemId, {
          url: freshUrl,
          thumbnailUrl: item.category === 'photos' ? freshUrl : item.thumbnailUrl,
          metadata: {
            ...item.metadata,
            expiryTime: freshExpiry,
            lastResolvedAt: Date.now()
          }
        });
      } catch (updateErr) {
        console.warn('Could not update stored item with fresh URL:', updateErr);
      }
    }

    // 4. Redirect to the freshly signed URL
    return NextResponse.redirect(freshUrl || targetUrl, { status: 307 });
  } catch (error: any) {
    console.error('Error resolving Notion signed URL:', error);
    return NextResponse.json({ error: error.message || 'Error al resolver URL de Notion' }, { status: 500 });
  }
}
