import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getUserSettings, fetchUserItems, updateItem } from '@/lib/firebase/firestore';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');
    const itemId = searchParams.get('itemId');

    if (!userId || !itemId) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos (userId, itemId)' }, { status: 400 });
    }

    const items = await fetchUserItems(userId);
    const item = items.find(i => i.id === itemId);

    if (!item) {
      return NextResponse.json({ error: 'Elemento no encontrado' }, { status: 404 });
    }

    const settings = await getUserSettings(userId);
    if (!settings.notionTokenEncrypted) {
      // Return original URL if no Notion token available
      return NextResponse.redirect(item.url);
    }

    const token = decryptSecret(settings.notionTokenEncrypted);
    const notion = new Client({ auth: token });

    let freshUrl = item.url;
    let freshExpiry: string | undefined = undefined;

    const blockId = item.metadata?.notionBlockId;
    const pageId = item.metadata?.notionPageId;

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
      await updateItem(userId, itemId, {
        url: freshUrl,
        thumbnailUrl: item.category === 'photos' ? freshUrl : item.thumbnailUrl,
        metadata: {
          ...item.metadata,
          expiryTime: freshExpiry,
          lastResolvedAt: Date.now()
        }
      });
    }

    // Redirect to the fresh URL
    return NextResponse.redirect(freshUrl);
  } catch (error: any) {
    console.error('Error resolving Notion signed URL:', error);
    return NextResponse.json({ error: error.message || 'Error al resolver URL de Notion' }, { status: 500 });
  }
}
