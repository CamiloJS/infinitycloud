import { NextRequest, NextResponse } from 'next/server';
import { isSafeNotionMediaUrl } from '@/lib/security/ssrf';
import { requireServerAuth } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Parámetro url es requerido' }, { status: 400 });
    }

    // SSRF verification on incoming URL
    if (!isSafeNotionMediaUrl(targetUrl)) {
      return NextResponse.json(
        { error: 'Destino no permitido por la política de seguridad SSRF.' },
        { status: 403 }
      );
    }

    const rangeHeader = req.headers.get('range');
    const fetchHeaders: HeadersInit = {};
    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    // Manual redirect handling to avoid open redirect SSRF attacks
    let currentUrl = targetUrl;
    let redirectCount = 0;
    const MAX_REDIRECTS = 3;
    let response: Response | null = null;

    while (redirectCount < MAX_REDIRECTS) {
      response = await fetch(currentUrl, {
        headers: fetchHeaders,
        redirect: 'manual',
        cache: 'no-store'
      });

      // Handle HTTP redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (!location) break;

        const resolvedLocation = new URL(location, currentUrl).toString();
        // Check redirected target against SSRF whitelist
        if (!isSafeNotionMediaUrl(resolvedLocation)) {
          return NextResponse.json(
            { error: 'Redirección rechazada: El destino remoto no está en la lista autorizada.' },
            { status: 403 }
          );
        }

        currentUrl = resolvedLocation;
        redirectCount++;
        continue;
      }

      break;
    }

    if (!response || (!response.ok && response.status !== 206)) {
      return NextResponse.json(
        { error: `Error remoto del proveedor (${response?.status || 500})` },
        { status: response?.status || 500 }
      );
    }

    const resHeaders = new Headers();
    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const contentLength = response.headers.get('content-length');
    const contentRange = response.headers.get('content-range');
    const acceptRanges = response.headers.get('accept-ranges') || 'bytes';

    resHeaders.set('Content-Type', contentType);
    resHeaders.set('Accept-Ranges', acceptRanges);
    if (contentLength) resHeaders.set('Content-Length', contentLength);
    if (contentRange) resHeaders.set('Content-Range', contentRange);
    resHeaders.set('Cache-Control', 'public, max-age=3600');

    return new NextResponse(response.body, {
      status: response.status,
      headers: resHeaders
    });
  } catch (error: any) {
    console.error('Media proxy error:', error);
    return NextResponse.json({ error: 'Error al obtener el recurso remoto' }, { status: 500 });
  }
}
