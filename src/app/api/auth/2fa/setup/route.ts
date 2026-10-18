import { NextRequest, NextResponse } from 'next/server';
import { generateTotpSetup } from '@/lib/auth/totp';
import { encryptSecret } from '@/lib/crypto/encryption';
import { requireServerAuth } from '@/lib/auth/session';
import { saveServerUserSettings } from '@/lib/server/store';

export async function POST(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req, { allow2FaPending: true });
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userEmail = session.email || 'user@infinity.dev';

    const setup = await generateTotpSetup(userEmail);

    // Save pending setup on server side so client cannot tamper with secret
    await saveServerUserSettings(session.userId, {
      twoFactorPendingSecretEncrypted: encryptSecret(setup.secret),
      twoFactorPendingBackupCodes: setup.hashedBackupCodes,
      twoFactorPendingCreatedAt: Date.now()
    });

    return NextResponse.json({
      secret: setup.secret,
      qrCodeUrl: setup.qrCodeUrl,
      backupCodes: setup.backupCodes,
      hashedBackupCodes: setup.hashedBackupCodes
    });
  } catch (error: any) {
    console.error('2FA setup error:', error);
    return NextResponse.json({ error: error.message || 'Error al iniciar 2FA' }, { status: 500 });
  }
}
