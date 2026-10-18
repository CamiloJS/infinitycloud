import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken, verifyAndBurnBackupCode } from '@/lib/auth/totp';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getServerUserSettings, saveServerUserSettings } from '@/lib/server/store';
import { 
  requireServerAuth, 
  check2FaRateLimit, 
  record2FaFailedAttempt, 
  reset2FaAttempts, 
  createSessionToken, 
  setSessionCookie 
} from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userId = session.userId;

    const body = await req.json();
    const { code, isBackupCode } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'Código de confirmación requerido' }, { status: 400 });
    }

    // Rate limit
    const rateLimit = check2FaRateLimit(`disable_${userId}`);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: `Demasiados intentos fallidos. Intenta nuevamente en ${rateLimit.retryAfterSeconds} segundos.` },
        { status: 429 }
      );
    }

    const settings = await getServerUserSettings(userId);
    if (!settings.twoFactorEnabled || !settings.twoFactorSecretEncrypted) {
      return NextResponse.json({ success: true, message: '2FA ya estaba desactivado' });
    }

    let isValid = false;
    const cleanCode = code.trim();

    // Check if recovery code is provided (e.g. 4A8F-9B2C) or requested via isBackupCode
    if (isBackupCode || cleanCode.includes('-') || cleanCode.length > 6) {
      const storedHashes = settings.twoFactorBackupCodes || [];
      const burnResult = verifyAndBurnBackupCode(cleanCode, storedHashes);
      if (burnResult.valid) {
        isValid = true;
      }
    } else {
      const secret = decryptSecret(settings.twoFactorSecretEncrypted);
      isValid = verifyTotpToken(cleanCode, secret);
    }

    if (!isValid) {
      const attempt = record2FaFailedAttempt(`disable_${userId}`);
      const remainingMsg = attempt.locked
        ? 'Límite de intentos excedido. Bloqueado temporalmente.'
        : `Código incorrecto. Te quedan ${attempt.remaining} intentos.`;
      return NextResponse.json({ error: remainingMsg }, { status: 400 });
    }

    reset2FaAttempts(`disable_${userId}`);

    // Disable 2FA in user settings
    await saveServerUserSettings(userId, {
      twoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorBackupCodes: [],
      twoFactorDisabledAt: Date.now()
    });

    // Update active session cookie
    const sessionToken = createSessionToken({
      userId,
      email: session.email,
      twoFactorPending: false,
      twoFactorVerified: true
    });

    const res = NextResponse.json({
      success: true,
      message: 'Autenticación en dos pasos desactivada exitosamente.'
    });
    setSessionCookie(res, sessionToken);
    return res;
  } catch (error: any) {
    console.error('2FA disable error:', error);
    return NextResponse.json({ error: error.message || 'Error al desactivar 2FA' }, { status: 500 });
  }
}
