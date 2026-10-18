import { describe, it, expect, beforeEach } from 'vitest';
import { isPrivateIp, isSafeNotionMediaUrl } from '@/lib/security/ssrf';
import { encryptSecret, decryptSecret } from '@/lib/crypto/encryption';
import { 
  createSessionToken, 
  verifySessionToken, 
  check2FaRateLimit, 
  record2FaFailedAttempt, 
  reset2FaAttempts, 
  checkAndBurnTotpToken 
} from '@/lib/auth/session';

describe('Security & SSRF Protection', () => {
  describe('isPrivateIp', () => {
    it('identifies loopback addresses', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.1.2.3')).toBe(true);
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('identifies AWS / cloud metadata IP (169.254.169.254)', () => {
      expect(isPrivateIp('169.254.169.254')).toBe(true);
    });

    it('identifies private RFC1918 ranges', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('172.16.0.5')).toBe(true);
      expect(isPrivateIp('192.168.1.100')).toBe(true);
    });

    it('permits public IP addresses', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
    });
  });

  describe('isSafeNotionMediaUrl', () => {
    it('allows legitimate Notion AWS S3 media buckets', () => {
      const valid = 'https://prod-files-secure.s3.us-west-2.amazonaws.com/workspace-id/photo.png?X-Amz-Expires=3600';
      expect(isSafeNotionMediaUrl(valid)).toBe(true);
    });

    it('allows file.notion.so', () => {
      expect(isSafeNotionMediaUrl('https://file.notion.so/f/f/image.jpg')).toBe(true);
    });

    it('rejects arbitrary external domains (SSRF prevention)', () => {
      expect(isSafeNotionMediaUrl('https://malicious-site.com/exploit.jpg')).toBe(false);
      expect(isSafeNotionMediaUrl('https://attacker.amazonaws.com.evil.com/data')).toBe(false);
      expect(isSafeNotionMediaUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
    });

    it('rejects arbitrary attacker S3 buckets in us-west-2', () => {
      expect(isSafeNotionMediaUrl('https://attacker-bucket.s3.us-west-2.amazonaws.com/payload.png')).toBe(false);
      expect(isSafeNotionMediaUrl('https://evil-company.s3.us-west-2.amazonaws.com/data')).toBe(false);
    });

    it('rejects HTTP (non-secure)', () => {
      expect(isSafeNotionMediaUrl('http://file.notion.so/f/f/image.jpg')).toBe(false);
    });
  });

  describe('AES-256-GCM Encryption', () => {
    it('encrypts and decrypts secret tokens accurately', () => {
      const originalToken = 'secret_test_notion_token_1234567890abcdef';
      const encrypted = encryptSecret(originalToken);
      expect(encrypted).not.toBe(originalToken);
      expect(typeof encrypted).toBe('string');

      const decrypted = decryptSecret(encrypted);
      expect(decrypted).toBe(originalToken);
    });

    it('fails when ciphertext is tampered with', () => {
      const original = 'my-token';
      const encrypted = encryptSecret(original);
      const tampered = encrypted.slice(0, -4) + 'AAAA';
      expect(() => decryptSecret(tampered)).toThrow();
    });
  });

  describe('Server-Verified Session Security', () => {
    it('creates and verifies a valid signed session token', () => {
      const token = createSessionToken({
        userId: 'test_user_42',
        email: 'user@test.dev',
        twoFactorVerified: true,
        twoFactorPending: false
      });

      expect(typeof token).toBe('string');
      expect(token).toContain('.');

      const verified = verifySessionToken(token);
      expect(verified).not.toBeNull();
      expect(verified?.userId).toBe('test_user_42');
      expect(verified?.email).toBe('user@test.dev');
      expect(verified?.twoFactorVerified).toBe(true);
      expect(verified?.twoFactorPending).toBe(false);
    });

    it('rejects tampered session tokens', () => {
      const token = createSessionToken({
        userId: 'user_orig',
        email: 'orig@test.dev',
        twoFactorVerified: false,
        twoFactorPending: true
      });

      const parts = token.split('.');
      const tampered = parts[0] + '.tampered_signature_123456789';
      expect(verifySessionToken(tampered)).toBeNull();
    });
  });

  describe('2FA Rate Limiting & Replay Protection', () => {
    const testId = 'user_rate_limit_test';

    beforeEach(() => {
      reset2FaAttempts(testId);
    });

    it('enforces lockout after 5 consecutive failed attempts', () => {
      // 4 attempts allowed
      for (let i = 1; i <= 4; i++) {
        const attempt = record2FaFailedAttempt(testId);
        expect(attempt.locked).toBe(false);
        expect(attempt.remaining).toBe(5 - i);
      }

      // 5th attempt triggers lockout
      const fifth = record2FaFailedAttempt(testId);
      expect(fifth.locked).toBe(true);
      expect(fifth.remaining).toBe(0);

      const check = check2FaRateLimit(testId);
      expect(check.allowed).toBe(false);
      expect(check.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('prevents replay of the same TOTP token within the time window', () => {
      const uId = 'user_replay_test';
      const token = '654321';

      // First consumption: accepted
      const first = checkAndBurnTotpToken(uId, token);
      expect(first).toBe(true);

      // Second consumption (replay attack): rejected!
      const replay = checkAndBurnTotpToken(uId, token);
      expect(replay).toBe(false);
    });
  });
});
