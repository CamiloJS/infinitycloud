import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken, verifyAndBurnBackupCode } from '@/lib/auth/totp';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getServerUserSettings, saveServerUserSettings } from '@/lib/server/store';
import { 
  requireServerAuth, 
  check2FaRateLimit, 
  record2FaFailedAttempt, 
  reset2FaAttempts, 
  checkAndBurnTotpToken, 
  createSessionToken, 
  setSessionCookie 
} from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req, { allow2FaPending: true });
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userId = session.userId;

    const body = await req.json();
    const { code, isBackupCode } = body;

    if (!code || typeof code !== 'string') {
      return NextResponse.json({ error: 'El código de verificación es requerido' }, { status: 400 });
    }

    // 1. Rate limiting & Lockout check
    const rateLimit = check2FaRateLimit(userId);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { 
          error: `Demasiados intentos fallidos. Tu cuenta está temporalmente bloqueada. Intenta de nuevo en ${rateLimit.retryAfterSeconds} segundos.`,
          retryAfterSeconds: rateLimit.retryAfterSeconds
        }, 
        { status: 429 }
      );
    }

    const settings = await getServerUserSettings(userId);
    if (!settings.twoFactorEnabled || !settings.twoFactorSecretEncrypted) {
      // 2FA not enabled
      const sessionToken = createSessionToken({
        userId,
        email: session.email,
        twoFactorPending: false,
        twoFactorVerified: true
      });
      const res = NextResponse.json({ success: true, message: '2FA no está activo' });
      setSessionCookie(res, sessionToken);
      return res;
    }

    if (isBackupCode) {
      // Recovery code path
      const storedHashes = settings.twoFactorBackupCodes || [];
      const result = verifyAndBurnBackupCode(code, storedHashes);

      if (!result.valid) {
        const attempt = record2FaFailedAttempt(userId);
        const remainingMsg = attempt.locked 
          ? 'Has excedido el número de intentos. Cuenta bloqueada por 5 minutos.'
          : `Código inválido. Te quedan ${attempt.remaining} intentos.`;
        return NextResponse.json({ error: remainingMsg }, { status: 400 });
      }

      reset2FaAttempts(userId);

      // Burn the code in server settings
      await saveServerUserSettings(userId, {
        twoFactorBackupCodes: result.remainingHashedCodes
      });

      // Upgrade session to twoFactorVerified: true
      const sessionToken = createSessionToken({
        userId,
        email: session.email,
        twoFactorPending: false,
        twoFactorVerified: true
      });

      const res = NextResponse.json({
        success: true,
        method: 'backup_code',
        remainingCodesCount: result.remainingHashedCodes.length
      });
      setSessionCookie(res, sessionToken);
      return res;
    } else {
      // TOTP token path
      const secret = decryptSecret(settings.twoFactorSecretEncrypted);
      const cleanCode = code.trim().replace(/\s+/g, '');

      // Check replay attack prevention
      if (!checkAndBurnTotpToken(userId, cleanCode)) {
        return NextResponse.json(
          { error: 'Este código temporal ya fue utilizado. Espera al siguiente código generado en tu aplicación.' },
          { status: 400 }
        );
      }

      const isValid = verifyTotpToken(cleanCode, secret);
      if (!isValid) {
        const attempt = record2FaFailedAttempt(userId);
        const remainingMsg = attempt.locked 
          ? 'Has excedido el número de intentos. Cuenta bloqueada por 5 minutos.'
          : `Código de autenticación incorrecto. Te quedan ${attempt.remaining} intentos.`;
        return NextResponse.json({ error: remainingMsg }, { status: 400 });
      }

      reset2FaAttempts(userId);

      // Upgrade session
      const sessionToken = createSessionToken({
        userId,
        email: session.email,
        twoFactorPending: false,
        twoFactorVerified: true
      });

      const res = NextResponse.json({
        success: true,
        method: 'totp'
      });
      setSessionCookie(res, sessionToken);
      return res;
    }
  } catch (error: any) {
    console.error('2FA challenge error:', error);
    return NextResponse.json({ error: error.message || 'Error al validar 2FA' }, { status: 500 });
  }
}
