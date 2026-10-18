import { NextRequest, NextResponse } from 'next/server';
import { generateTotpSetup } from '@/lib/auth/totp';

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json({ error: 'Correo requerido para configurar 2FA' }, { status: 400 });
    }

    const setup = await generateTotpSetup(email);

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
