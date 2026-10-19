import { NextRequest, NextResponse } from 'next/server';
import { 
  createSessionToken, 
  getSessionFromRequest, 
  setSessionCookie, 
  clearSessionCookie 
} from '@/lib/auth/session';
import { getServerUserSettings } from '@/lib/server/store';
import { getAdminAuth, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, email: inputEmail, uid: inputUid } = body;

    let userId = '';
    let email = '';

    if (idToken && isFirebaseAdminConfigured) {
      try {
        const auth = await getAdminAuth();
        if (auth) {
          const decoded = await auth.verifyIdToken(idToken);
          userId = decoded.uid;
          email = decoded.email || '';
        } else {
          userId = inputUid || 'user';
          email = inputEmail || '';
        }
      } catch {
        return NextResponse.json({ error: 'Token de autenticación de Firebase inválido' }, { status: 401 });
      }
    } else if (inputUid) {
      // Fallback for direct authenticated client
      userId = inputUid;
      email = inputEmail || `${inputUid}@infinity.dev`;
    } else {
      return NextResponse.json({ error: 'Credenciales incompletas' }, { status: 400 });
    }

    let twoFactorActive = false;
    try {
      const settings = await getServerUserSettings(userId);
      twoFactorActive = Boolean(settings.twoFactorEnabled && settings.twoFactorSecretEncrypted);
    } catch {
      twoFactorActive = false;
    }

    // If 2FA is active, session starts with twoFactorPending = true
    const sessionToken = createSessionToken({
      userId,
      email,
      twoFactorPending: twoFactorActive,
      twoFactorVerified: !twoFactorActive
    });

    const res = NextResponse.json({
      success: true,
      userId,
      email,
      twoFactorRequired: twoFactorActive,
      sessionToken
    });

    setSessionCookie(res, sessionToken);
    return res;
  } catch (error: any) {
    console.error('Session establishment error:', error);
    return NextResponse.json({ error: 'Error al establecer la sesión' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      userId: session.userId,
      email: session.email,
      twoFactorPending: session.twoFactorPending,
      twoFactorVerified: session.twoFactorVerified
    });
  } catch (err: any) {
    console.error('Session get error:', err);
    return NextResponse.json({ authenticated: false, error: String(err?.message || err) }, { status: 401 });
  }
}

export async function DELETE() {
  try {
    const res = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' });
    clearSessionCookie(res);
    return res;
  } catch (err: any) {
    return NextResponse.json({ success: true }, { status: 200 });
  }
}
