import { NextRequest, NextResponse } from 'next/server';
import { isSafeNotionMediaUrl } from '@/lib/security/ssrf';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Parámetro url es requerido' }, { status: 400 });
    }

    // SSRF verification
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

    const response = await fetch(targetUrl, {
      headers: fetchHeaders,
      redirect: 'follow',
      cache: 'no-store'
    });

    if (!response.ok && response.status !== 206) {
      return NextResponse.json(
        { error: `Error remoto del proveedor (${response.status})` },
        { status: response.status }
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
