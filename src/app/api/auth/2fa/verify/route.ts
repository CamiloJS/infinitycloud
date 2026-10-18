import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken } from '@/lib/auth/totp';
import { encryptSecret, decryptSecret } from '@/lib/crypto/encryption';
import { getServerUserSettings, saveServerUserSettings } from '@/lib/server/store';
import { requireServerAuth, createSessionToken, setSessionCookie } from '@/lib/auth/session';

export async function POST(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req, { allow2FaPending: true });
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userId = session.userId;

    const body = await req.json();
    const { token, secret: clientSecret, hashedBackupCodes: clientHashedBackupCodes } = body;

    if (!token) {
      return NextResponse.json({ error: 'Código de 6 dígitos requerido' }, { status: 400 });
    }

    const settings = await getServerUserSettings(userId);
    let secretToVerify = '';
    let backupCodesToSave = clientHashedBackupCodes || [];

    if (settings.twoFactorPendingSecretEncrypted) {
      secretToVerify = decryptSecret(settings.twoFactorPendingSecretEncrypted);
      if (settings.twoFactorPendingBackupCodes) {
        backupCodesToSave = settings.twoFactorPendingBackupCodes;
      }
    } else if (clientSecret) {
      secretToVerify = clientSecret;
    } else {
      return NextResponse.json({ error: 'No hay configuración de 2FA pendiente para verificar.' }, { status: 400 });
    }

    const isValid = verifyTotpToken(token, secretToVerify);
    if (!isValid) {
      return NextResponse.json({ error: 'El código de 6 dígitos es incorrecto o ha expirado.' }, { status: 400 });
    }

    // Persist activated 2FA on server
    const encryptedSecret = encryptSecret(secretToVerify);
    await saveServerUserSettings(userId, {
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: encryptedSecret,
      twoFactorBackupCodes: backupCodesToSave,
      twoFactorEnabledAt: Date.now(),
      twoFactorPendingSecretEncrypted: null,
      twoFactorPendingBackupCodes: null
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
      message: 'Autenticación en dos pasos activada exitosamente.'
    });
    setSessionCookie(res, sessionToken);
    return res;
  } catch (error: any) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ error: error.message || 'Error al verificar 2FA' }, { status: 500 });
  }
}
