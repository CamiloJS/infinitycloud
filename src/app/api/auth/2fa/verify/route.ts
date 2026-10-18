import { NextRequest, NextResponse } from 'next/server';
import { verifyTotpToken } from '@/lib/auth/totp';
import { encryptSecret } from '@/lib/crypto/encryption';
import { saveUserSettings } from '@/lib/firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const { userId, secret, token, hashedBackupCodes } = await req.json();

    if (!userId || !secret || !token) {
      return NextResponse.json({ error: 'Faltan parámetros requeridos' }, { status: 400 });
    }

    const isValid = verifyTotpToken(token, secret);
    if (!isValid) {
      return NextResponse.json({ error: 'El código de 6 dígitos es incorrecto o ha expirado.' }, { status: 400 });
    }

    // Encrypt the TOTP secret before persisting
    const encryptedSecret = encryptSecret(secret);

    await saveUserSettings(userId, {
      twoFactorEnabled: true,
      twoFactorSecretEncrypted: encryptedSecret,
      twoFactorBackupCodes: hashedBackupCodes || [],
      twoFactorEnabledAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      message: 'Autenticación en dos pasos activada exitosamente.'
    });
  } catch (error: any) {
    console.error('2FA verify error:', error);
    return NextResponse.json({ error: error.message || 'Error al verificar 2FA' }, { status: 500 });
  }
}
