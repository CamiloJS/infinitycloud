import { describe, it, expect } from 'vitest';
import { isPrivateIp, isSafeNotionMediaUrl } from '@/lib/security/ssrf';
import { encryptSecret, decryptSecret } from '@/lib/crypto/encryption';

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

    it('rejects HTTP (non-secure)', () => {
      expect(isSafeNotionMediaUrl('http://file.notion.so/f/f/image.jpg')).toBe(false);
    });

    it('rejects arbitrary external domains (SSRF prevention)', () => {
      expect(isSafeNotionMediaUrl('https://malicious-site.com/exploit.jpg')).toBe(false);
      expect(isSafeNotionMediaUrl('https://attacker.amazonaws.com.evil.com/data')).toBe(false);
      expect(isSafeNotionMediaUrl('https://169.254.169.254/latest/meta-data')).toBe(false);
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
});
