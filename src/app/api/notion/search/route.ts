import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getUserSettings } from '@/lib/firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, query = '' } = await req.json();

    if (!userId) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const settings = await getUserSettings(userId);
    if (!settings.notionTokenEncrypted) {
      return NextResponse.json(
        { error: 'No has conectado tu integración de Notion aún.' },
        { status: 400 }
      );
    }

    const token = decryptSecret(settings.notionTokenEncrypted);
    const notion = new Client({ auth: token });

    const response = await notion.search({
      query: query.trim() || undefined,
      sort: {
        direction: 'descending',
        timestamp: 'last_edited_time'
      },
      page_size: 20
    });

    const results = response.results.map((item: any) => {
      let title = 'Sin título';
      if (item.object === 'page') {
        const titleProp = Object.values(item.properties || {}).find((p: any) => p.type === 'title') as any;
        if (titleProp?.title?.[0]?.plain_text) {
          title = titleProp.title[0].plain_text;
        }
      } else if (item.object === 'database') {
        if (item.title?.[0]?.plain_text) {
          title = item.title[0].plain_text;
        }
      }

      return {
        id: item.id,
        type: item.object, // 'page' | 'database'
        title,
        url: item.url,
        lastEditedTime: item.last_edited_time
      };
    });

    return NextResponse.json({ results });
  } catch (error: any) {
    console.error('Notion search error:', error);
    return NextResponse.json({ error: error.message || 'Error al buscar en Notion' }, { status: 500 });
  }
}
