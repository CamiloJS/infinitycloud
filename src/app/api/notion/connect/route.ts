import { NextRequest, NextResponse } from 'next/server';
import { Client } from '@notionhq/client';
import { encryptSecret } from '@/lib/crypto/encryption';
import { saveUserSettings } from '@/lib/firebase/firestore';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token, userId } = body;

    if (!token || typeof token !== 'string') {
      return NextResponse.json(
        { error: 'El token de integración de Notion es requerido.' },
        { status: 400 }
      );
    }

    if (!userId) {
      return NextResponse.json(
        { error: 'Usuario no identificado.' },
        { status: 401 }
      );
    }

    const trimmedToken = token.trim();

    // Verify token with Notion API
    const notion = new Client({ auth: trimmedToken });
    const botUser = await notion.users.me({});

    const botName = botUser.name || 'Integración de Notion';
    const encryptedToken = encryptSecret(trimmedToken);

    // Persist encrypted token in user settings
    await saveUserSettings(userId, {
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
