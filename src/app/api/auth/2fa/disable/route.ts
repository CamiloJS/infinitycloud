import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken } from '@/lib/auth/totp';
import { decryptSecret } from '@/lib/crypto/encryption';
import { getUserSettings, saveUserSettings } from '@/lib/firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, code } = await req.json();

    if (!userId || !code) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const settings = await getUserSettings(userId);
    if (!settings.twoFactorEnabled || !settings.twoFactorSecretEncrypted) {
      return NextResponse.json({ success: true, message: '2FA ya estaba desactivado' });
    }

    const secret = decryptSecret(settings.twoFactorSecretEncrypted);
    const isValid = verifyTotpToken(code, secret);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Código incorrecto. Ingresa el código actual de tu aplicación para desactivar 2FA.' },
        { status: 400 }
      );
    }

    await saveUserSettings(userId, {
      twoFactorEnabled: false,
      twoFactorSecretEncrypted: null,
      twoFactorBackupCodes: [],
      twoFactorDisabledAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      message: 'Autenticación en dos pasos desactivada.'
    });
  } catch (error: any) {
    console.error('2FA disable error:', error);
    return NextResponse.json({ error: error.message || 'Error al desactivar 2FA' }, { status: 500 });
  }
}
