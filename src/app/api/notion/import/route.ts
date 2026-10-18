import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getUserSettings, fetchUserItems } from '@/lib/firebase/firestore';
import { CategoryType, InfinityItem } from '@/types';

// Rate limiting helper
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface DiscoveredFile {
  name: string;
  url: string;
  category: CategoryType;
  mimeType?: string;
  notionBlockId?: string;
  notionPageId?: string;
  notionPropertyId?: string;
  expiryTime?: string;
  thumbnailUrl?: string;
}

export async function POST(req: NextRequest) {
  try {
    const { userId, targetId, targetType, collectionId } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'Usuario no identificado' }, { status: 401 });
    }

    if (!targetId) {
      return NextResponse.json({ error: 'Debe especificar una página o base de datos' }, { status: 400 });
    }

    const settings = await getUserSettings(userId);
    if (!settings.notionTokenEncrypted) {
      return NextResponse.json({ error: 'Notion no está conectado' }, { status: 400 });
    }

    const token = decryptSecret(settings.notionTokenEncrypted);
    const notion = new Client({ auth: token });

    // Fetch existing user items to prevent duplicates
    const existingItems = await fetchUserItems(userId);
    const existingBlockIds = new Set(
      existingItems
        .filter(i => i.provider === 'notion' && i.metadata?.notionBlockId)
        .map(i => i.metadata!.notionBlockId)
    );
    const existingUrls = new Set(existingItems.map(i => i.url));

    const discoveredFiles: DiscoveredFile[] = [];

    // Helper to extract file data from Notion file object
    const processFileObject = (fileObj: any, defaultName: string, category: CategoryType, blockId?: string, pageId?: string) => {
      if (!fileObj) return;
      let url = '';
      let expiryTime: string | undefined = undefined;

      if (fileObj.type === 'file' && fileObj.file?.url) {
        url = fileObj.file.url;
        expiryTime = fileObj.file.expiry_time;
      } else if (fileObj.type === 'external' && fileObj.external?.url) {
        url = fileObj.external.url;
      }

      if (!url) return;

      // Extract filename from URL or default
      let name = defaultName;
      try {
        const cleanName = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
        if (cleanName && cleanName.length > 2 && !cleanName.includes('untitled')) {
          name = cleanName;
        }
      } catch {
        // keep defaultName
      }

      discoveredFiles.push({
        name,
        url,
        category,
        notionBlockId: blockId,
        notionPageId: pageId,
        expiryTime,
        thumbnailUrl: category === 'photos' ? url : undefined
      });
    };

    // Recursive block scanner
    const scanBlocks = async (blockId: string, depth = 0) => {
      if (depth > 4) return; // Prevent infinite loops in deeply nested blocks
      
      let cursor: string | undefined = undefined;
      do {
        await sleep(150); // Respect Notion rate limits (~3 req/s)
        const response: any = await notion.blocks.children.list({
          block_id: blockId,
          start_cursor: cursor,
          page_size: 50
        });

        for (const block of response.results) {
          if (existingBlockIds.has(block.id)) {
            continue; // Skip already imported block
          }

          if (block.type === 'image') {
            const caption = block.image.caption?.[0]?.plain_text || 'Imagen de Notion';
            processFileObject(block.image, caption, 'photos', block.id);
          } else if (block.type === 'video') {
            const caption = block.video.caption?.[0]?.plain_text || 'Video de Notion';
            processFileObject(block.video, caption, 'videos', block.id);
          } else if (block.type === 'audio') {
            const caption = block.audio.caption?.[0]?.plain_text || 'Audio de Notion';
            processFileObject(block.audio, caption, 'music', block.id);
          } else if (block.type === 'pdf') {
            const caption = block.pdf.caption?.[0]?.plain_text || 'PDF de Notion';
            processFileObject(block.pdf, caption, 'documents', block.id);
          } else if (block.type === 'file') {
            const caption = block.file.caption?.[0]?.plain_text || 'Archivo adjunto de Notion';
            processFileObject(block.file, caption, 'documents', block.id);
          }

          if (block.has_children) {
            await scanBlocks(block.id, depth + 1);
          }
        }

        cursor = response.has_more ? response.next_cursor : undefined;
      } while (cursor);
    };

    if (targetType === 'database') {
      // Query database
      let dbCursor: string | undefined = undefined;
      do {
        await sleep(200);
        const dbResponse: any = await (notion as any).databases.query({
          database_id: targetId,
          start_cursor: dbCursor,
          page_size: 50
        });

        for (const page of dbResponse.results) {
          // Check page cover & icon
          if (page.cover) {
            processFileObject(page.cover, 'Portada de página', 'photos', undefined, page.id);
          }

          // Check database row properties for 'files'
          for (const [propName, propVal] of Object.entries<any>(page.properties || {})) {
            if (propVal.type === 'files' && Array.isArray(propVal.files)) {
              for (const f of propVal.files) {
                const name = f.name || propName;
                const ext = name.split('.').pop()?.toLowerCase();
                let category: CategoryType = 'documents';
                if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '')) category = 'photos';
                else if (['mp4', 'webm', 'mov'].includes(ext || '')) category = 'videos';
                else if (['mp3', 'wav', 'ogg'].includes(ext || '')) category = 'music';

                processFileObject(f, name, category, undefined, page.id);
              }
            }
          }

          // Also scan page blocks
          await scanBlocks(page.id, 0);
        }

        dbCursor = dbResponse.has_more ? dbResponse.next_cursor : undefined;
      } while (dbCursor);
    } else {
      // Target is a single page
      const pageInfo: any = await notion.pages.retrieve({ page_id: targetId });
      if (pageInfo.cover) {
        processFileObject(pageInfo.cover, 'Portada de página', 'photos', undefined, pageInfo.id);
      }
      await scanBlocks(targetId, 0);
    }

    // Filter out items that match already imported URLs or block IDs
    const newItemsToCreate: InfinityItem[] = [];
    const seenLocalKeys = new Set<string>();

    for (const file of discoveredFiles) {
      const uniqueKey = file.notionBlockId || file.url;
      if (seenLocalKeys.has(uniqueKey)) continue;
      seenLocalKeys.add(uniqueKey);

      if (file.notionBlockId && existingBlockIds.has(file.notionBlockId)) continue;
      if (existingUrls.has(file.url)) continue;

      const newItem: InfinityItem = {
        id: `notion_${file.notionBlockId || Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        userId,
        name: file.name,
        url: file.url,
        provider: 'notion',
        category: file.category,
        collectionId: collectionId || null,
        thumbnailUrl: file.thumbnailUrl,
        isFavorite: false,
        isTrash: false,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        metadata: {
          notionBlockId: file.notionBlockId,
          notionPageId: file.notionPageId,
          expiryTime: file.expiryTime,
          sourceType: targetType
        }
      };

      newItemsToCreate.push(newItem);
    }

    return NextResponse.json({
      success: true,
      totalDiscovered: discoveredFiles.length,
      newItemsCount: newItemsToCreate.length,
      items: newItemsToCreate
    });
  } catch (error: any) {
    console.error('Notion import scan error:', error);
    return NextResponse.json({ error: error.message || 'Error al importar desde Notion' }, { status: 500 });
  }
}
