import { NextRequest, NextResponse } from 'next/server';
import { 
  createSessionToken, 
  getSessionFromRequest, 
  setSessionCookie, 
  clearSessionCookie 
} from '@/lib/auth/session';
import { getServerUserSettings } from '@/lib/server/store';
import { adminAuth, isFirebaseAdminConfigured } from '@/lib/firebase/admin';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { idToken, demoUserNum, email: inputEmail, uid: inputUid } = body;

    let userId = '';
    let email = '';

    if (idToken && isFirebaseAdminConfigured && adminAuth) {
      try {
        const decoded = await adminAuth.verifyIdToken(idToken);
        userId = decoded.uid;
        email = decoded.email || '';
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

    const settings = await getServerUserSettings(userId);
    const twoFactorActive = Boolean(settings.twoFactorEnabled && settings.twoFactorSecretEncrypted);

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
}

export async function DELETE() {
  const res = NextResponse.json({ success: true, message: 'Sesión cerrada correctamente' });
  clearSessionCookie(res);
  return res;
}
