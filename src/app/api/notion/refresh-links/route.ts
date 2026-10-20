import { NextRequest, NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/session';
import { updateServerItem, fetchServerItems } from '@/lib/server/store';
import { extractNotionMedia } from '../extract-page/route';
import { isNotionUrlExpiredOrNearExpiry } from '@/lib/utils/notionUrl';

export const maxDuration = 45;

export async function POST(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    const userId = session?.userId;

    const body = await req.json().catch(() => ({}));
    const clientItems = Array.isArray(body?.items) ? body.items : [];

    // If no client items provided and user is authenticated, check user's stored items
    let candidateItems: any[] = clientItems;
    if (candidateItems.length === 0 && userId) {
      candidateItems = await fetchServerItems(userId);
    }

    if (candidateItems.length === 0) {
      return NextResponse.json({ success: true, refreshed: 0, items: [] });
    }

    // Filter items that are Notion media and whose links are expired or near expiry
    const expiredItems = candidateItems.filter(item => {
      const isNotion = item.provider === 'notion' ||
        String(item.url || '').includes('notion') ||
        Boolean(item.metadata?.isNotionVideo) ||
        Boolean(item.metadata?.isNotionAudio) ||
        Boolean(item.metadata?.s3Url);

      if (!isNotion) return false;

      const s3Url = item.metadata?.s3Url || item.url;
      const lastResolvedAt = item.metadata?.lastResolvedAt;
      return isNotionUrlExpiredOrNearExpiry(s3Url, lastResolvedAt);
    });

    if (expiredItems.length === 0) {
      return NextResponse.json({ success: true, refreshed: 0, items: [] });
    }

    // Process up to 10 items concurrently to stay fast and avoid rate limits
    const itemsToProcess = expiredItems.slice(0, 10);
    const refreshedResults: Array<{ id: string; s3Url: string; lastResolvedAt: number }> = [];

    await Promise.allSettled(
      itemsToProcess.map(async (item) => {
        try {
          const originalUrl = item.metadata?.originalUrl || item.url;
          if (!originalUrl) return;

          const extraction = await extractNotionMedia(originalUrl, { refresh: true });
          const blockId = item.metadata?.notionBlockId;
          const isAudio = item.category === 'music' || item.metadata?.isNotionAudio;
          const isVideo = item.category === 'videos' || item.metadata?.isNotionVideo;

          let freshUrl = '';
          if (isVideo) {
            const matchedVid = (extraction.videos || []).find((v: any) => blockId && v.notionBlockId === blockId)
              || extraction.video
              || extraction.videos?.[0];
            if (matchedVid?.url) freshUrl = matchedVid.url;
          } else if (isAudio) {
            const matchedAud = (extraction.audios || []).find((a: any) => blockId && a.notionBlockId === blockId)
              || extraction.audio
              || extraction.audios?.[0];
            if (matchedAud?.url) freshUrl = matchedAud.url;
          } else {
            if (extraction.video?.url) freshUrl = extraction.video.url;
            else if (extraction.audio?.url) freshUrl = extraction.audio.url;
            else if (extraction.coverUrl) freshUrl = extraction.coverUrl;
          }

          if (freshUrl && freshUrl !== item.metadata?.s3Url) {
            const now = Date.now();
            refreshedResults.push({
              id: item.id,
              s3Url: freshUrl,
              lastResolvedAt: now
            });

            // Update on server if userId is available
            const targetUserId = userId || item.userId;
            if (targetUserId && item.id) {
              await updateServerItem(targetUserId, item.id, {
                metadata: {
                  ...item.metadata,
                  s3Url: freshUrl,
                  lastResolvedAt: now
                }
              }).catch(err => console.warn('Could not update server item in refresh-links:', err));
            }
          }
        } catch (itemErr) {
          console.warn(`Error refreshing Notion link for item ${item.id}:`, itemErr);
        }
      })
    );

    return NextResponse.json({
      success: true,
      refreshed: refreshedResults.length,
      items: refreshedResults
    });
  } catch (error: any) {
    console.error('Error in /api/notion/refresh-links:', error);
    return NextResponse.json({ error: error.message || 'Error al refrescar enlaces de Notion' }, { status: 500 });
  }
}
