import { NextRequest, NextResponse } from 'next/server';

export const maxDuration = 30;

interface ExtractedNotionDetails {
  pageId: string | null;
  blockId: string | null;
  isDirectVideoUrl: boolean;
}

function extractNotionDetails(urlOrId: string): ExtractedNotionDetails {
  const clean = urlOrId.trim();
  const lower = clean.toLowerCase();

  const isVideoExt = (
    lower.endsWith('.mp4') ||
    lower.endsWith('.mov') ||
    lower.endsWith('.webm') ||
    lower.endsWith('.m4v') ||
    lower.endsWith('.ogv')
  );

  const isDirectVideoUrl = isVideoExt || (
    (lower.includes('amazonaws.com') || lower.includes('file.notion.so')) &&
    (lower.includes('.mp4') || lower.includes('.mov') || lower.includes('.webm') || lower.includes('/video'))
  );

  let pageId: string | null = null;
  let blockId: string | null = null;

  try {
    const parsed = new URL(clean);

    // 1. Check query parameters (Notion database views use ?p=...)
    const queryP = parsed.searchParams.get('p');
    if (queryP && /^[0-9a-f]{32}$/i.test(queryP)) {
      pageId = queryP;
    }

    // 2. Check hash (Notion block links use #<block_id>)
    if (parsed.hash) {
      const hashClean = parsed.hash.replace(/^#/, '');
      const hashMatch = hashClean.match(/[0-9a-f]{32}/i);
      if (hashMatch) {
        blockId = hashMatch[0];
      }
    }

    // 3. Check pathname
    if (!pageId) {
      const segments = parsed.pathname.split('/').filter(Boolean);
      for (let i = segments.length - 1; i >= 0; i--) {
        const seg = segments[i];
        const segMatch = seg.match(/[0-9a-f]{32}/i);
        if (segMatch) {
          pageId = segMatch[0];
          break;
        }
      }
    }
  } catch {
    // If not a full URL, attempt direct 32-hex match
    const generalMatch = clean.match(/[0-9a-f]{32}/i);
    if (generalMatch) {
      pageId = generalMatch[0];
    }
  }

  // UUID with hyphens fallback
  if (!pageId) {
    const uuidMatch = clean.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    if (uuidMatch) {
      pageId = uuidMatch[0].replace(/-/g, '');
    }
  }

  return {
    pageId,
    blockId,
    isDirectVideoUrl
  };
}

function formatNotionUuid(clean32: string): string {
  if (clean32.length !== 32) return clean32;
  return `${clean32.slice(0, 8)}-${clean32.slice(8, 12)}-${clean32.slice(12, 16)}-${clean32.slice(16, 20)}-${clean32.slice(20)}`;
}

function isVideoUrl(url: string): boolean {
  if (!url) return false;
  const l = url.toLowerCase();
  return (
    l.includes('youtube.com/watch') ||
    l.includes('youtube.com/embed') ||
    l.includes('youtu.be/') ||
    l.includes('vimeo.com/') ||
    l.includes('loom.com/share') ||
    l.includes('drive.google.com/file') ||
    l.endsWith('.mp4') ||
    l.endsWith('.mov') ||
    l.endsWith('.webm') ||
    l.endsWith('.m4v') ||
    l.endsWith('.ogv') ||
    ((l.includes('amazonaws.com') || l.includes('file.notion.so')) && (l.includes('.mp4') || l.includes('.mov') || l.includes('.webm')))
  );
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || typeof url !== 'string') {
      return NextResponse.json({ error: 'Se requiere una URL de Notion' }, { status: 400 });
    }

    const { pageId, blockId, isDirectVideoUrl } = extractNotionDetails(url);

    // =========================================================================
    // CASO DIRECTO: La URL ya es un video directo de Notion / S3
    // =========================================================================
    if (isDirectVideoUrl) {
      let title = 'Video de Notion';
      try {
        const cleanName = decodeURIComponent(new URL(url).pathname.split('/').pop() || '');
        if (cleanName && cleanName.length > 2) {
          title = cleanName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        }
      } catch {
        // fallback
      }

      const vid = {
        id: 'direct_video',
        url,
        title,
        caption: title,
        isExpiringS3: url.includes('amazonaws.com') || url.includes('notion.so'),
        sourceType: 'notion_block',
        pageTitle: title,
        pageDescription: 'Video extraído de Notion'
      };

      return NextResponse.json({
        success: true,
        foundVideo: true,
        video: vid,
        videos: [vid]
      });
    }

    let pageTitle = 'Página de Notion';
    let pageDescription = '';
    let coverUrl: string | undefined = undefined;
    const extractedVideos: any[] = [];

    function addExtractedVideo(v: any) {
      if (!v || !v.url) return;
      if (!extractedVideos.some(existing => existing.url === v.url)) {
        extractedVideos.push({
          id: v.id || `vid_${extractedVideos.length}_${Date.now()}`,
          url: v.url,
          title: v.title || pageTitle,
          caption: v.caption || v.title || pageTitle,
          coverUrl: v.coverUrl || coverUrl,
          notionBlockId: v.notionBlockId,
          notionPageId: v.notionPageId,
          isExpiringS3: v.isExpiringS3,
          sourceType: v.sourceType || 'notion_block',
          pageTitle,
          pageDescription
        });
      }
    }

    // Check if logged in user has private Notion integration token
    let notionClient: any = null;
    const cookieHeader = req.headers.get('cookie') || '';
    if (cookieHeader.includes('infinity_session')) {
      try {
        const { getSessionFromRequest } = await import('@/lib/auth/session');
        const session = getSessionFromRequest(req);
        if (session?.userId) {
          const { getServerUserSettings } = await import('@/lib/server/store');
          const settings = await getServerUserSettings(session.userId);
          if (settings.notionTokenEncrypted) {
            const { decryptSecret } = await import('@/lib/crypto/encryption');
            const token = decryptSecret(settings.notionTokenEncrypted);
            const { Client } = await import('@notionhq/client');
            notionClient = new Client({ auth: token });
          }
        }
      } catch (err) {
        console.warn('Error obtaining server settings for Notion client:', err);
      }
    }

    // =========================================================================
    // ESTRATEGIA 1: Notion Official API (si el usuario conectó su integración)
    // =========================================================================
    if (notionClient && pageId) {
      try {
        const formattedId = formatNotionUuid(pageId);
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

        // Recursively inspect blocks for video
        const scanBlocksRecursive = async (parentId: string, depth = 0): Promise<any | null> => {
          if (depth > 3) return null;
          const blocksRes: any = await notionClient!.blocks.children.list({
            block_id: parentId,
            page_size: 50
          });

          for (const block of blocksRes.results) {
            // Check for specific block if blockId was requested in anchor
            const isTargetBlock = blockId && block.id.replace(/-/g, '') === blockId;

            if (block.type === 'video') {
              const videoContent = block.video;
              const videoUrl = videoContent?.file?.url || videoContent?.external?.url;
              const caption = videoContent?.caption?.[0]?.plain_text || pageTitle;
              const isS3 = Boolean(videoContent?.file?.url);

              if (videoUrl) {
                return {
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
                };
              }
            } else if (block.type === 'embed' && block.embed?.url && isVideoUrl(block.embed.url)) {
              return {
                url: block.embed.url,
                title: pageTitle,
                caption: pageTitle,
                coverUrl: coverUrl || undefined,
                notionBlockId: block.id,
                notionPageId: formattedId,
                isExpiringS3: false,
                sourceType: 'embed',
                pageTitle,
                pageDescription
              };
            } else if (block.type === 'file') {
              const fileContent = block.file;
              const fileUrl = fileContent?.file?.url || fileContent?.external?.url;
              if (fileUrl && isVideoUrl(fileUrl)) {
                return {
                  url: fileUrl,
                  title: fileContent?.caption?.[0]?.plain_text || pageTitle,
                  caption: fileContent?.caption?.[0]?.plain_text || pageTitle,
                  coverUrl: coverUrl || undefined,
                  notionBlockId: block.id,
                  notionPageId: formattedId,
                  isExpiringS3: Boolean(fileContent?.file?.url),
                  expiryTime: fileContent?.file?.expiry_time,
                  sourceType: 'notion_block',
                  pageTitle,
                  pageDescription
                };
              }
            }

            if (block.has_children) {
              const childVideo = await scanBlocksRecursive(block.id, depth + 1);
              if (childVideo) return childVideo;
            }
          }
          return null;
        };

        const foundOfficial = await scanBlocksRecursive(formattedId);
        if (foundOfficial) {
          addExtractedVideo(foundOfficial);
        }
      } catch (officialErr) {
        console.warn('Official Notion API lookup error, falling back to public extraction:', officialErr);
      }
    }

    // =========================================================================
    // ESTRATEGIA 2: Notion Public Chunk API (para páginas públicas o compartidas)
    // =========================================================================
    if (pageId) {
      try {
        const formattedId = formatNotionUuid(pageId);
        const chunkRes = await fetch('https://www.notion.so/api/v3/loadPageChunk', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          signal: AbortSignal.timeout(4000),
          body: JSON.stringify({
            pageId: formattedId,
            limit: 100,
            cursor: { stack: [] },
            chunkNumber: 0,
            verticalColumns: false
          })
        });

        if (chunkRes.ok) {
          const chunkData = await chunkRes.json();
          const blockMap = chunkData?.recordMap?.block || {};
          const rawPageBlock = blockMap[formattedId]?.value;
          const pageBlock = rawPageBlock?.value || rawPageBlock;

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
            const val = bVal?.value?.value || bVal?.value;
            if (!val) continue;

            const isVideoBlock = val.type === 'video';
            const isFileWithVideo = val.type === 'file' && (
              val.properties?.source?.[0]?.[0]?.match(/\.(mp4|mov|webm|m4v)(\?.*)?$/i)
            );
            const isEmbedWithVideo = (val.type === 'embed' || val.type === 'bookmark') && (
              isVideoUrl(val.properties?.source?.[0]?.[0] || val.format?.display_source || '')
            );

            // Also check properties for embedded attachments
            let propVideoUrl: string | null = null;
            if (val.properties) {
              for (const pVal of Object.values(val.properties) as any[]) {
                if (Array.isArray(pVal)) {
                  for (const seg of pVal) {
                    if (Array.isArray(seg)) {
                      if (typeof seg[0] === 'string' && isVideoUrl(seg[0])) {
                        propVideoUrl = seg[0];
                        break;
                      }
                      if (Array.isArray(seg[1])) {
                        for (const sub of seg[1]) {
                          if (Array.isArray(sub) && sub[0] === 'a' && typeof sub[1] === 'string' && isVideoUrl(sub[1])) {
                            propVideoUrl = sub[1];
                            break;
                          }
                        }
                      }
                    }
                  }
                }
                if (propVideoUrl) break;
              }
            }

            if (isVideoBlock || isFileWithVideo || isEmbedWithVideo || propVideoUrl) {
              let rawSource = propVideoUrl || val.properties?.source?.[0]?.[0] || val.format?.display_source;
              const caption = val.properties?.caption?.[0]?.[0] || val.properties?.title?.[0]?.[0] || pageTitle;
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
                    signal: AbortSignal.timeout(3000),
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
                addExtractedVideo({
                  id: bId,
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
                });
              }
            }
          }

          // If no video in root blocks, check collection views inside recordMap
          if (chunkData?.recordMap?.collection_view) {
            let checkedCollections = 0;
            const defaultSpaceId = chunkData?.recordMap?.block?.[formattedId]?.value?.spaceId || 
                                   chunkData?.recordMap?.block?.[formattedId]?.value?.value?.spaceId ||
                                   (Object.values(chunkData?.recordMap?.block || {})[0] as any)?.value?.spaceId ||
                                   (Object.values(chunkData?.recordMap?.block || {})[0] as any)?.value?.value?.spaceId;

            for (const [cvId, cv] of Object.entries(chunkData.recordMap.collection_view) as [string, any][]) {
              if (checkedCollections >= 2) break;
              const cvVal = cv?.value?.value || cv?.value;
              const cId = cvVal?.format?.collection_pointer?.id || Object.keys(chunkData?.recordMap?.collection || {})[0];
              const spaceId = cvVal?.format?.collection_pointer?.spaceId || defaultSpaceId;
              if (!cId) continue;

              checkedCollections++;
              try {
                const qRes = await fetch('https://www.notion.so/api/v3/queryCollection', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                  },
                  signal: AbortSignal.timeout(3000),
                  body: JSON.stringify({
                    collection: { id: cId, ...(spaceId ? { spaceId } : {}) },
                    collectionView: { id: cvId, ...(spaceId ? { spaceId } : {}) },
                    loader: {
                      type: 'reducer',
                      reducers: { collection_group_results: { type: 'results', limit: 25 } },
                      sort: [],
                      searchQuery: '',
                      userTimeZone: 'UTC'
                    }
                  })
                });

                if (qRes.ok) {
                  const qData = await qRes.json();
                  const qBlocks = qData?.recordMap?.block || {};
                  for (const [qId, qBVal] of Object.entries(qBlocks) as [string, any][]) {
                    const qVal = qBVal?.value?.value || qBVal?.value;
                    if (!qVal) continue;

                    let qSource: string | null = null;
                    const isQVideo = qVal.type === 'video' ||
                      (qVal.type === 'file' && qVal.properties?.source?.[0]?.[0]?.match(/\.(mp4|mov|webm|m4v)/i)) ||
                      ((qVal.type === 'embed' || qVal.type === 'bookmark') && isVideoUrl(qVal.properties?.source?.[0]?.[0] || ''));

                    if (isQVideo) {
                      qSource = qVal.properties?.source?.[0]?.[0] || qVal.format?.display_source;
                    }

                    // Also inspect all properties for video links
                    if (!qSource && qVal.properties) {
                      for (const pVal of Object.values(qVal.properties) as any[]) {
                        if (Array.isArray(pVal)) {
                          for (const seg of pVal) {
                            if (Array.isArray(seg)) {
                              if (typeof seg[0] === 'string' && isVideoUrl(seg[0])) {
                                qSource = seg[0];
                                break;
                              }
                              if (Array.isArray(seg[1])) {
                                for (const sub of seg[1]) {
                                  if (Array.isArray(sub) && sub[0] === 'a' && typeof sub[1] === 'string' && isVideoUrl(sub[1])) {
                                    qSource = sub[1];
                                    break;
                                  }
                                }
                              }
                            }
                          }
                        }
                        if (qSource) break;
                      }
                    }

                    if (qSource) {
                      const caption = qVal.properties?.title?.[0]?.[0] || pageTitle;
                      let finalVideoUrl = qSource;
                      const isS3 = Boolean(qSource && (qSource.includes('amazonaws.com') || qSource.includes('notion.so')));

                      if (isS3) {
                        try {
                          const signRes = await fetch('https://www.notion.so/api/v3/getSignedFileUrls', {
                            method: 'POST',
                            headers: {
                              'Content-Type': 'application/json',
                              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                            },
                            signal: AbortSignal.timeout(2000),
                            body: JSON.stringify({
                              urls: [{
                                url: qSource,
                                permissionRecord: { table: 'block', id: qId }
                              }]
                            })
                          });
                          if (signRes.ok) {
                            const signData = await signRes.json();
                            if (signData?.signedUrls?.[0]) {
                              finalVideoUrl = signData.signedUrls[0];
                            }
                          }
                        } catch {
                          // keep original url
                        }
                      }

                      addExtractedVideo({
                        id: qId,
                        url: finalVideoUrl,
                        title: caption,
                        caption,
                        coverUrl: coverUrl || undefined,
                        notionBlockId: qId,
                        notionPageId: formattedId,
                        isExpiringS3: isS3,
                        sourceType: isS3 ? 'notion_block' : 'embed',
                        pageTitle,
                        pageDescription
                      });
                    }
                  }
                }
              } catch {
                // ignore collection query errors
              }
            }
          }
        }
      } catch (chunkErr) {
        console.warn('Public loadPageChunk error:', chunkErr);
      }
    }

    // Try retrieving public Notion page metadata (e.g. Notion site domain)
    let publicSiteUrl: string | undefined = undefined;
    if (pageId) {
      try {
        const pubRes = await fetch('https://www.notion.so/api/v3/getPublicPageData', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          signal: AbortSignal.timeout(3000),
          body: JSON.stringify({
            type: 'block-space',
            name: 'page',
            blockId: formatNotionUuid(pageId)
          })
        });
        if (pubRes.ok) {
          const pubData = await pubRes.json();
          if (pubData?.requireInterstitial && typeof pubData.requireInterstitial === 'string') {
            publicSiteUrl = pubData.requireInterstitial;
          } else if (pubData?.publicDomainName) {
            publicSiteUrl = `https://${pubData.publicDomainName}.notion.site/${pageId}`;
          }
          if (pubData?.spaceName && (!pageTitle || pageTitle === 'Página de Notion')) {
            pageTitle = pubData.spaceName;
          }
        }
      } catch {
        // ignore public metadata lookup error
      }
    }

    // =========================================================================
    // ESTRATEGIA 3: Fallback por HTML / Scraping y Análisis de NEXT_DATA
    // =========================================================================
    try {
      const htmlRes = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        redirect: 'follow'
      });

      if (htmlRes.ok) {
        const html = await htmlRes.text();

        // 1. Extract title
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        if (titleMatch && titleMatch[1]) {
          const parsed = titleMatch[1].replace(/\s*\|\s*Notion.*$/i, '').trim();
          if (parsed && parsed !== 'Notion' && parsed.length > 1) {
            pageTitle = parsed;
          }
        }

        // 2. Extract cover / og:image
        const ogImageMatch = html.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
        if (ogImageMatch && ogImageMatch[1]) {
          coverUrl = ogImageMatch[1];
        }

        // 3. Check for Next.js embedded data (__NEXT_DATA__)
        const nextDataMatch = html.match(/<script\s+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i);
        if (nextDataMatch && nextDataMatch[1]) {
          try {
            const nextJson = JSON.parse(nextDataMatch[1]);
            const blocks = nextJson?.props?.pageProps?.recordMap?.block || {};

            for (const [bId, bVal] of Object.entries(blocks) as [string, any][]) {
              const val = bVal?.value;
              if (!val) continue;

              const isVideo = val.type === 'video' ||
                (val.type === 'file' && val.properties?.source?.[0]?.[0]?.match(/\.(mp4|mov|webm|m4v)/i)) ||
                ((val.type === 'embed' || val.type === 'bookmark') && isVideoUrl(val.properties?.source?.[0]?.[0] || ''));

              if (isVideo) {
                const videoSrc = val.properties?.source?.[0]?.[0] || val.format?.display_source;
                const caption = val.properties?.caption?.[0]?.[0] || pageTitle;

                if (videoSrc) {
                  addExtractedVideo({
                    id: bId,
                    url: videoSrc,
                    title: caption || pageTitle,
                    caption,
                    coverUrl: coverUrl || undefined,
                    notionBlockId: bId,
                    notionPageId: pageId ? formatNotionUuid(pageId) : undefined,
                    isExpiringS3: videoSrc.includes('amazonaws.com') || videoSrc.includes('notion.so'),
                    sourceType: 'notion_block',
                    pageTitle,
                    pageDescription
                  });
                }
              }
            }
          } catch {
            // ignore JSON parse error
          }
        }

        // 4. Check for direct S3 / Notion video links in HTML
        const s3VideoMatch = html.match(/https?:\/\/(?:prod-files-secure\.s3\.us-west-2\.amazonaws\.com|file\.notion\.so\/f\/f\/)[^"'\s<>]+\.(?:mp4|webm|mov|m4v)(?:\?[^"'\s<>]*)?/i);
        if (s3VideoMatch && s3VideoMatch[0]) {
          addExtractedVideo({
            id: 'scrape_s3',
            url: s3VideoMatch[0],
            title: pageTitle,
            caption: pageTitle,
            coverUrl,
            notionPageId: pageId ? formatNotionUuid(pageId) : undefined,
            isExpiringS3: true,
            sourceType: 'notion_block',
            pageTitle,
            pageDescription
          });
        }

        // 5. Check for embedded YouTube / Vimeo in Notion page HTML
        const ytMatch = html.match(/https?:\/\/(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)[a-zA-Z0-9_-]{11}/i);
        if (ytMatch && ytMatch[0]) {
          addExtractedVideo({
            id: 'scrape_yt',
            url: ytMatch[0],
            title: pageTitle,
            caption: pageTitle,
            coverUrl,
            notionPageId: pageId ? formatNotionUuid(pageId) : undefined,
            isExpiringS3: false,
            sourceType: 'youtube',
            pageTitle,
            pageDescription
          });
        }

        const vimeoMatch = html.match(/https?:\/\/(?:player\.)?vimeo\.com\/(?:video\/)?\d+/i);
        if (vimeoMatch && vimeoMatch[0]) {
          addExtractedVideo({
            id: 'scrape_vimeo',
            url: vimeoMatch[0],
            title: pageTitle,
            caption: pageTitle,
            coverUrl,
            notionPageId: pageId ? formatNotionUuid(pageId) : undefined,
            isExpiringS3: false,
            sourceType: 'embed',
            pageTitle,
            pageDescription
          });
        }

        // 6. Generic HTML video tags or direct MP4 match
        const genericVideoMatch = html.match(/<video[^>]+src=["']([^"']+)["']/i) ||
                                  html.match(/https?:\/\/[^"'\s<>]+\.(?:mp4|webm|mov|m4v)(?:\?[^"'\s<>]*)?/i);

        if (genericVideoMatch) {
          const videoUrl = genericVideoMatch[1] || genericVideoMatch[0];
          addExtractedVideo({
            id: 'scrape_generic',
            url: videoUrl,
            title: pageTitle,
            caption: pageTitle,
            coverUrl,
            notionPageId: pageId ? formatNotionUuid(pageId) : undefined,
            isExpiringS3: videoUrl.includes('amazonaws.com') || videoUrl.includes('notion.so'),
            sourceType: 'notion_block',
            pageTitle,
            pageDescription
          });
        }
      }
    } catch (scrapeErr) {
      console.warn('HTML scraping fallback error:', scrapeErr);
    }

    // Return all extracted videos and page metadata
    return NextResponse.json({
      success: true,
      foundVideo: extractedVideos.length > 0,
      video: extractedVideos[0] || null,
      videos: extractedVideos,
      pageTitle,
      pageDescription,
      coverUrl,
      publicSiteUrl,
      isNotionSite: Boolean(publicSiteUrl)
    });

  } catch (error: any) {
    console.error('Error extracting Notion video:', error);
    return NextResponse.json({
      error: error.message || 'Error al procesar la página de Notion'
    }, { status: 500 });
  }
}
