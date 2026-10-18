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
    } else if (demoUserNum === 1 || demoUserNum === 2) {
      userId = demoUserNum === 1 ? 'demo_user_alpha_1' : 'demo_user_beta_2';
      email = demoUserNum === 1 ? 'camilo@infinity.dev' : 'test.account@infinity.dev';
    } else if (inputUid) {
      // Fallback for direct authenticated client when Firebase Admin keys aren't yet populated
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
