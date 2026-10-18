import net from 'net';

const ALLOWED_NOTION_HOSTS = [
  'prod-files-secure.s3.us-west-2.amazonaws.com',
  's3.us-west-2.amazonaws.com',
  'file.notion.so',
  'notion.so',
  'www.notion.so'
];

/**
 * Validates if an IP address is private/loopback/link-local
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return false;

  // IPv4 private ranges:
  // 10.0.0.0/8
  // 172.16.0.0/12
  // 192.168.0.0/16
  // 127.0.0.0/8 (loopback)
  // 169.254.0.0/16 (link-local, cloud metadata)
  // 0.0.0.0/8
  const parts = ip.split('.').map(Number);
  if (parts.length === 4) {
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
  }

  // IPv6 loopback and private
  if (ip === '::1' || ip === '::' || ip.toLowerCase().startsWith('fe80:') || ip.toLowerCase().startsWith('fc00:')) {
    return true;
  }

  return false;
}

/**
 * Checks if a URL is strictly safe for server-side proxying of Notion media files
 */
export function isSafeNotionMediaUrl(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // Only HTTPS
    if (url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();

    // Prevent direct IP address access
    if (net.isIP(hostname)) {
      return false;
    }

    // Check against allowed Notion file hosting domains
    const isAllowedHost = ALLOWED_NOTION_HOSTS.some(allowed => 
      hostname === allowed || hostname.endsWith(`.${allowed}`)
    );

    if (!isAllowedHost) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}
