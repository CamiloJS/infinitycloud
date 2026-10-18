import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken, verifyAndBurnBackupCode } from '@/lib/auth/totp';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getUserSettings, saveUserSettings } from '@/lib/firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, code, isBackupCode } = await req.json();

    if (!userId || !code) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const settings = await getUserSettings(userId);
    if (!settings.twoFactorEnabled || !settings.twoFactorSecretEncrypted) {
      return NextResponse.json({ success: true, message: '2FA no está activo' });
    }

    if (isBackupCode) {
      // Recovery code path
      const storedHashes = settings.twoFactorBackupCodes || [];
      const result = verifyAndBurnBackupCode(code, storedHashes);

      if (!result.valid) {
        return NextResponse.json({ error: 'Código de recuperación inválido o ya utilizado.' }, { status: 400 });
      }

      // Update burned codes in settings
      await saveUserSettings(userId, {
        twoFactorBackupCodes: result.remainingHashedCodes
      });

      return NextResponse.json({
        success: true,
        method: 'backup_code',
        remainingCodesCount: result.remainingHashedCodes.length
      });
    } else {
      // Standard TOTP token
      const secret = decryptSecret(settings.twoFactorSecretEncrypted);
      const isValid = verifyTotpToken(code, secret);

      if (!isValid) {
        return NextResponse.json({ error: 'Código de autenticación incorrecto.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        method: 'totp'
      });
    }
  } catch (error: any) {
    console.error('2FA challenge error:', error);
    return NextResponse.json({ error: error.message || 'Error al validar 2FA' }, { status: 500 });
  }
}
