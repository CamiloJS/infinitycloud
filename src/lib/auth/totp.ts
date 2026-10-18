import { generateSecret, generateURI, verifySync } from 'otplib';
import QRCode from 'qrcode';
import crypto from 'crypto';

export interface GenerateTotpResult {
  secret: string;
  qrCodeUrl: string;
  backupCodes: string[];
  hashedBackupCodes: string[];
}

export function hashBackupCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim().toUpperCase()).digest('hex');
}

export async function generateTotpSetup(userEmail: string): Promise<GenerateTotpResult> {
  const secret = generateSecret();
  const issuer = 'Infinity Cloud';
  const otpauth = generateURI({
    secret,
    label: userEmail,
    issuer
  });
  
  const qrCodeUrl = await QRCode.toDataURL(otpauth, {
    margin: 2,
    width: 256,
    color: {
      dark: '#1e1b4b',
      light: '#ffffff'
    }
  });

  // Generate 8 alphanumeric 8-character backup recovery codes
  const backupCodes: string[] = [];
  const hashedBackupCodes: string[] = [];

  for (let i = 0; i < 8; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. 4A8F-9B2C
    const formatted = `${raw.slice(0, 4)}-${raw.slice(4)}`;
    backupCodes.push(formatted);
    hashedBackupCodes.push(hashBackupCode(formatted));
  }

  return {
    secret,
    qrCodeUrl,
    backupCodes,
    hashedBackupCodes
  };
}

export function verifyTotpToken(token: string, secret: string): boolean {
  try {
    const cleanToken = token.replace(/\s+/g, '');
    const result = verifySync({
      token: cleanToken,
      secret,
      epochTolerance: 30
    });
    return Boolean(result?.valid);
  } catch {
    return false;
  }
}

export function verifyAndBurnBackupCode(
  inputCode: string,
  storedHashedCodes: string[]
): { valid: boolean; remainingHashedCodes: string[] } {
  const inputHash = hashBackupCode(inputCode);
  const index = storedHashedCodes.indexOf(inputHash);

  if (index === -1) {
    return { valid: false, remainingHashedCodes: storedHashedCodes };
  }

  // Remove the burned single-use code
  const remaining = storedHashedCodes.filter((_, i) => i !== index);
  return { valid: true, remainingHashedCodes: remaining };
}
