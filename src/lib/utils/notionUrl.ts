/**
 * Notion S3 Signed URL Expiry & Freshness Helpers
 * 
 * Notion's uploaded files (audio, video, photos, docs) are hosted on AWS S3 
 * with presigned URLs that expire strictly after 3600 seconds (1 hour).
 * This utility detects when a URL has expired or is nearing expiration (within 5 minutes)
 * so the application can proactively refresh it without breaking user playback or modifying metadata.
 */

export function isNotionUrlExpiredOrNearExpiry(url?: string | null, lastResolvedAt?: number | null): boolean {
  if (!url || typeof url !== 'string') return false;

  const clean = url.trim();
  const lower = clean.toLowerCase();

  // Non-S3 URLs (YouTube, Vimeo, SoundCloud, generic direct links) do not have 1-hour expiry
  const isNotionS3 = (
    lower.includes('prod-files-secure.s3') ||
    lower.includes('file.notion.so') ||
    lower.includes('notion-static.com') ||
    (lower.includes('amazonaws.com') && (lower.includes('notion') || clean.includes('table=block')))
  );

  if (!isNotionS3) {
    return false;
  }

  const now = Date.now();

  // 1. Check expirationTimestamp in URL query params (Notion's modern file proxy)
  try {
    const parsed = new URL(clean);
    const expParam = parsed.searchParams.get('expirationTimestamp');
    if (expParam) {
      const expNum = Number(expParam);
      if (!isNaN(expNum) && expNum > 0) {
        const expMs = expNum > 1e11 ? expNum : expNum * 1000;
        // Expired or within 5 minutes of expiring
        return now >= expMs - 5 * 60 * 1000;
      }
    }

    // 2. Check AWS SigV4 query params: X-Amz-Date and X-Amz-Expires
    const amzDateParam = parsed.searchParams.get('X-Amz-Date');
    const amzExpiresParam = parsed.searchParams.get('X-Amz-Expires');
    if (amzDateParam && amzDateParam.length >= 15) {
      // Format: YYYYMMDDTHHMMSSZ (e.g. 20261020T170000Z)
      const y = parseInt(amzDateParam.slice(0, 4), 10);
      const m = parseInt(amzDateParam.slice(4, 6), 10) - 1;
      const d = parseInt(amzDateParam.slice(6, 8), 10);
      const hh = parseInt(amzDateParam.slice(9, 11), 10);
      const mm = parseInt(amzDateParam.slice(11, 13), 10);
      const ss = parseInt(amzDateParam.slice(13, 15), 10);
      const dateUtc = Date.UTC(y, m, d, hh, mm, ss);

      const ttlSec = amzExpiresParam ? parseInt(amzExpiresParam, 10) : 3600;
      const expireMs = dateUtc + ttlSec * 1000;
      // Expired or within 5 minutes of expiring
      return now >= expireMs - 5 * 60 * 1000;
    }
  } catch {
    // URL parsing failed
  }

  // 3. Check lastResolvedAt timestamp
  if (lastResolvedAt && typeof lastResolvedAt === 'number' && lastResolvedAt > 0) {
    // Expired if resolved more than 50 minutes ago (50 * 60 * 1000 ms)
    return (now - lastResolvedAt) > 50 * 60 * 1000;
  }

  return false;
}

/**
 * Checks if a given item is a Notion media item (video or audio)
 */
export function isNotionMediaItem(item?: { provider?: string; url?: string; metadata?: any } | null): boolean {
  if (!item) return false;
  if (item.provider === 'notion') return true;
  const url = String(item.url || '').toLowerCase();
  const s3Url = String(item.metadata?.s3Url || '').toLowerCase();
  return (
    url.includes('notion.so') ||
    url.includes('notion.site') ||
    url.includes('notion.com') ||
    Boolean(item.metadata?.isNotionVideo) ||
    Boolean(item.metadata?.isNotionAudio) ||
    Boolean(item.metadata?.notionBlockId) ||
    Boolean(item.metadata?.notionPageId) ||
    s3Url.includes('file.notion.so') ||
    s3Url.includes('prod-files-secure.s3')
  );
}
