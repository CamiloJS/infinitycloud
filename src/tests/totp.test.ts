import { describe, it, expect } from 'vitest';
import { generateSecret, generateSync } from 'otplib';
import { 
  generateTotpSetup, 
  verifyTotpToken, 
  verifyAndBurnBackupCode,
  hashBackupCode 
} from '@/lib/auth/totp';

describe('Two-Factor Authentication (TOTP & Backup Codes)', () => {
  it('generates secret, valid QR code and 8 backup codes', async () => {
    const email = 'user@infinity.dev';
    const setup = await generateTotpSetup(email);

    expect(setup.secret).toBeDefined();
    expect(setup.secret.length).toBeGreaterThan(10);
    expect(setup.qrCodeUrl).toContain('data:image/png;base64');
    expect(setup.backupCodes).toHaveLength(8);
    expect(setup.hashedBackupCodes).toHaveLength(8);
  });

  it('verifies valid TOTP token and rejects invalid token', () => {
    const secret = generateSecret();
    const validToken = generateSync({ secret });

    expect(verifyTotpToken(validToken, secret)).toBe(true);
    expect(verifyTotpToken('000000', secret)).toBe(false);
    expect(verifyTotpToken('invalid', secret)).toBe(false);
  });

  it('verifies and burns single-use backup recovery codes', () => {
    const rawCodes = ['AAAA-1111', 'BBBB-2222', 'CCCC-3333'];
    const hashedCodes = rawCodes.map(c => hashBackupCode(c));

    // First use: valid
    const res1 = verifyAndBurnBackupCode('AAAA-1111', hashedCodes);
    expect(res1.valid).toBe(true);
    expect(res1.remainingHashedCodes).toHaveLength(2);

    // Replay attack / reuse of the burned code: invalid
    const res2 = verifyAndBurnBackupCode('AAAA-1111', res1.remainingHashedCodes);
    expect(res2.valid).toBe(false);
    expect(res2.remainingHashedCodes).toHaveLength(2);

    // Case-insensitivity check (with spaces or lowercase)
    const res3 = verifyAndBurnBackupCode('bbbb-2222', res1.remainingHashedCodes);
    expect(res3.valid).toBe(true);
    expect(res3.remainingHashedCodes).toHaveLength(1);
  });
});
