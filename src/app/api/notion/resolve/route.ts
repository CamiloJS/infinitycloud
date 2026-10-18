import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { requireServerAuth } from '@/lib/auth/session';
import { getServerUserSettings, fetchServerItems, updateServerItem } from '@/lib/server/store';

export async function GET(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userId = session.userId;

    const { searchParams } = new URL(req.url);
    const itemId = searchParams.get('itemId');

    if (!itemId) {
      return NextResponse.json({ error: 'Parámetro itemId es requerido' }, { status: 400 });
    }

    const items = await fetchServerItems(userId);
    const item = items.find(i => i.id === itemId);

    if (!item) {
      return NextResponse.json({ error: 'Elemento no encontrado en tu biblioteca' }, { status: 404 });
    }

    const settings = await getServerUserSettings(userId);
    if (!settings.notionTokenEncrypted) {
      return NextResponse.redirect(item.url);
    }

    let freshUrl = item.url;
    let freshExpiry: string | undefined = undefined;

    const blockId = item.metadata?.notionBlockId;
    const pageId = item.metadata?.notionPageId;

    try {
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

      // Update item in background with fresh URL
      if (freshUrl !== item.url) {
        await updateServerItem(userId, itemId, {
          url: freshUrl,
          thumbnailUrl: item.category === 'photos' ? freshUrl : item.thumbnailUrl,
          metadata: {
            ...item.metadata,
            expiryTime: freshExpiry,
            lastResolvedAt: Date.now()
          }
        });
      }
    } catch (apiErr) {
      console.warn('Could not re-resolve from Notion API, using stored URL:', apiErr);
    }

    // Redirect to the fresh URL
    return NextResponse.redirect(freshUrl);
  } catch (error: any) {
    console.error('Error resolving Notion signed URL:', error);
    return NextResponse.json({ error: error.message || 'Error al resolver URL de Notion' }, { status: 500 });
  }
}
