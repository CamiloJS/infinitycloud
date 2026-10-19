import { NextRequest, NextResponse } from 'next/server';
import { fetchPublicFolder } from '@/lib/firebase/firestore';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: folderId } = await params;

    if (!folderId) {
      return NextResponse.json({ error: 'ID de carpeta requerido' }, { status: 400 });
    }

    const { searchParams } = new URL(req.url);
    const pwdHash = searchParams.get('pwdHash') || undefined;

    const folder = await fetchPublicFolder(folderId, pwdHash);

    if (!folder) {
      return NextResponse.json({ 
        error: 'Esta carpeta no existe o no ha sido habilitada para compartir públicamente.' 
      }, { status: 404 });
    }

    return NextResponse.json({ folder }, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching public shared folder:', error);
    return NextResponse.json({ 
      error: error.message || 'Error al obtener la carpeta compartida' 
    }, { status: 500 });
  }
}
