import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getSessionFromRequest } from '@/lib/auth/session';
import { getServerUserSettings } from '@/lib/server/store';

function extractNotionId(urlOrId: string): string | null {
  try {
    const raw = urlOrId.trim();
    // Check if directly a 32-char hex string
    if (/^[0-9a-f]{32}$/i.test(raw)) {
      return raw;
    }
    // Check if UUID with hyphens
    const uuidMatch = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      return uuidMatch[0].replace(/-/g, '');
    }
    // Parse URL pathname
    const parsed = new URL(raw);
    const lastPart = parsed.pathname.split('/').filter(Boolean).pop() || '';
    const match = lastPart.match(/[0-9a-f]{32}/i);
    if (match) return match[0];
    const generalMatch = raw.match(/[0-9a-f]{32}/i);
    return generalMatch ? generalMatch[0] : null;
  } catch {
    const match = urlOrId.match(/[0-9a-f]{32}/i);
    return match ? match[0] : null;
  }
}

function formatNotionUuid(clean32: string): string {
  if (clean32.length !== 32) return clean32;
  return `${clean32.slice(0, 8)}-${clean32.slice(8, 12)}-${clean32.slice(12, 16)}-${clean32.slice(16, 20)}-${clean32.slice(20)}`;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Se requiere una URL de Notion' }, { status: 400 });
    }

    const notionId = extractNotionId(url);
    let pageTitle = 'Página de Notion';
    let pageDescription = '';
    let coverUrl: string | undefined = undefined;

    // Check if logged in user has private Notion integration token
    const session = getSessionFromRequest(req);
    let notionClient: Client | null = null;

    if (session?.userId) {
      try {
        const settings = await getServerUserSettings(session.userId);
        if (settings.notionTokenEncrypted) {
          const token = decryptSecret(settings.notionTokenEncrypted);
          notionClient = new Client({ auth: token });
        }
      } catch (err) {
        console.warn('Error obtaining server settings for Notion client:', err);
      }
    }

    // =========================================================================
    // ESTRATEGIA 1: Notion Official API (si el usuario vinculó su Workspace)
    // =========================================================================
    if (notionClient && notionId) {
      try {
        const formattedId = formatNotionUuid(notionId);
        const page: any = await notionClient.pages.retrieve({ page_id: formattedId });
        
        // Extract title
        if (page.properties) {
          for (const prop of Object.values(page.properties) as any[]) {
            if (prop.type === 'title' && prop.title?.[0]?.plain_text) {
              pageTitle = prop.title[0].plain_text;
              break;
            }
          }
        }

        // Extract cover
        if (page.cover?.file?.url) {
          coverUrl = page.cover.file.url;
        } else if (page.cover?.external?.url) {
          coverUrl = page.cover.external.url;
        }

        // Search children blocks for video
        const blocksResponse: any = await notionClient.blocks.children.list({
          block_id: formattedId,
          page_size: 50
        });

        for (const block of blocksResponse.results) {
          if (block.type === 'video') {
            const videoContent = block.video;
            let videoUrl = videoContent?.file?.url || videoContent?.external?.url;
            const caption = videoContent?.caption?.[0]?.plain_text || pageTitle;
            const isS3 = Boolean(videoContent?.file?.url);

            if (videoUrl) {
              return NextResponse.json({
                success: true,
                foundVideo: true,
                video: {
                  url: videoUrl,
                  title: caption || pageTitle,
                  caption,
                  coverUrl: coverUrl || undefined,
                  notionBlockId: block.id,
                  notionPageId: formattedId,
                  isExpiringS3: isS3,
                  expiryTime: videoContent?.file?.expiry_time,
                  sourceType: isS3 ? 'notion_block' : 'embed',
                  pageTitle,
                  pageDescription
                }
              });
            }
          }
        }
      } catch (officialErr) {
        console.warn('Official Notion API lookup failed, falling back to public extraction:', officialErr);
      }
    }

    // =========================================================================
    // ESTRATEGIA 2: Notion Public Chunk API (para páginas públicas o compartidas)
    // =========================================================================
    if (notionId) {
      try {
        const formattedId = formatNotionUuid(notionId);
        const chunkRes = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          body: JSON.stringify({
            pageId: formattedId,
            limit: 60,
            cursor: { stack: [] },
            chunkNumber: 0,
            verticalColumns: false
          })
        });

        if (chunkRes.ok) {
          const chunkData = await chunkRes.json();
          const blockMap = chunkData?.recordMap?.block || {};
          const pageBlock = blockMap[formattedId]?.value;

          if (pageBlock) {
            const rawTitle = pageBlock.properties?.title?.[0]?.[0];
            if (rawTitle && typeof rawTitle === 'string') {
              pageTitle = rawTitle;
            }
            if (pageBlock.format?.page_cover) {
              coverUrl = pageBlock.format.page_cover;
            }
          }

          // Traverse blocks to find video
          for (const [bId, bVal] of Object.entries(blockMap) as [string, any][]) {
            const val = bVal?.value;
            if (!val) continue;

            const isVideoBlock = val.type === 'video';
            const isFileWithVideo = val.type === 'file' && (
              val.properties?.source?.[0]?.[0]?.match(/\.(mp4|mov|webm|m4v)(\?.*)?$/i)
            );

            if (isVideoBlock || isFileWithVideo) {
              let rawSource = val.properties?.source?.[0]?.[0] || val.format?.display_source;
              const caption = val.properties?.caption?.[0]?.[0] || pageTitle;
              let finalVideoUrl = rawSource;
              const isS3 = Boolean(rawSource && (rawSource.includes('amazonaws.com') || rawSource.includes('notion.so')));

              // Request fresh signed URL from Notion public API if it's an S3 link
              if (isS3 && rawSource) {
                try {
                  const signRes = await fetch('https://www.notion.so/api/v3/getSignedFileUrls', {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                    },
                    body: JSON.stringify({
                      urls: [{
                        url: rawSource,
                        permissionRecord: {
                          table: 'block',
                          id: bId
                        }
                      }]
                    })
                  });

                  if (signRes.ok) {
                    const signData = await signRes.json();
                    if (signData?.signedUrls?.[0]) {
                      finalVideoUrl = signData.signedUrls[0];
                    }
                  }
                } catch (signErr) {
                  console.warn('Could not sign S3 URL via public API:', signErr);
                }
              }

              if (finalVideoUrl) {
                return NextResponse.json({
                  success: true,
                  foundVideo: true,
                  video: {
                    url: finalVideoUrl,
                    title: caption || pageTitle,
                    caption,
                    coverUrl: coverUrl || undefined,
                    notionBlockId: bId,
                    notionPageId: formattedId,
                    isExpiringS3: isS3,
                    sourceType: isS3 ? 'notion_block' : 'embed',
                    pageTitle,
                    pageDescription
                  }
                });
              }
            }
          }
        }
      } catch (chunkErr) {
        console.warn('Public loadPageChunk error:', chunkErr);
      }
    }

    // =========================================================================
    // ESTRATEGIA 3: Fallback por HTML / Scraping
    // =========================================================================
    try {
      const htmlRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();

        // Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          pageTitle = titleMatch[1].replace(/\s*\|\s*Notion.*$/i, '').trim();
        }

        // Search for video tags or mp4 links in HTML
        const videoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                           html.match(/https?:\/\/[^"'\s]+\.(?:mp4|webm|mov)(?:\?[^"'\s]*)?/i);

        if (videoMatch && videoMatch[1]) {
          const videoUrl = videoMatch[1] || videoMatch[0];
          return NextResponse.json({
            success: true,
            foundVideo: true,
            video: {
              url: videoUrl,
              title: pageTitle,
              coverUrl,
              notionPageId: notionId ? formatNotionUuid(notionId) : undefined,
              isExpiringS3: videoUrl.includes('amazonaws.com') || videoUrl.includes('notion.so'),
              sourceType: 'notion_block',
              pageTitle,
              pageDescription
            }
          });
        }
      }
    } catch (scrapeErr) {
      console.warn('HTML scraping fallback error:', scrapeErr);
    }

    // No video found on the page
    return NextResponse.json({
      success: true,
      foundVideo: false,
      pageTitle,
      pageDescription,
      coverUrl
    });

  } catch (error: any) {
    console.error('Error extracting Notion video:', error);
    return NextResponse.json({
      error: error.message || 'Error al procesar la página de Notion'
    }, { status: 500 });
  }
}
