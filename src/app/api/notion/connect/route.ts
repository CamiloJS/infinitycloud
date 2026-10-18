import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { encryptSecret } from '@/lib/crypto/encryption';
import { requireServerAuth } from '@/lib/auth/session';
import { saveServerUserSettings } from '@/lib/server/store';

export async function POST(req: NextRequest) {
  try {
    const authCheck = requireServerAuth(req);
    if (!authCheck.authorized) {
      return authCheck.response;
    }

    const { session } = authCheck;
    const userId = session.userId;

    const body = await req.json();
    const { token } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'El token de integración de Notion es requerido.' },
        { status: 400 }
      );
    }

    const trimmedToken = token.trim();

    // Verify token with official Notion API
    const notion = new Client({ auth: trimmedToken });
    const botUser = await notion.users.me({});

    const botName = botUser.name || 'Integración de Notion';
    const encryptedToken = encryptSecret(trimmedToken);

    // Persist encrypted token in server settings
    await saveServerUserSettings(userId, {
      notionConnected: true,
      notionBotName: botName,
      notionTokenEncrypted: encryptedToken,
      notionConnectedAt: Date.now()
    });

    return NextResponse.json({
      success: true,
      botName,
      message: `Integración "${botName}" conectada correctamente.`
    });
  } catch (error: any) {
    console.error('Notion connection error:', error);
    const message = error.message || 'No se pudo conectar con Notion. Verifica que el token sea correcto.';
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
