import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const secret = process.env.NOTION_ENCRYPTION_KEY || process.env.SESSION_SECRET || 'infinity-fallback-dev-secret-key-32b';
  return crypto.scryptSync(secret, 'infinity-salt-2026', 32);
}

export function encryptSecret(plainText: string): string {
  if (!plainText) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine IV + Tag + EncryptedData into base64
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decryptSecret(cipherTextBase64: string): string {
  if (!cipherTextBase64) return '';
  const buffer = Buffer.from(cipherTextBase64, 'base64');
  
  if (buffer.length < IV_LENGTH + TAG_LENGTH) {
    throw new Error('Texto cifrado inválido');
  }

  const iv = buffer.subarray(0, IV_LENGTH);
  const tag = buffer.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buffer.subarray(IV_LENGTH + TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
  return decrypted.toString('utf8');
}
