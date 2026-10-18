import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export interface SessionData {
  userId: string;
  email: string;
  twoFactorVerified: boolean;
  twoFactorPending: boolean;
  createdAt: number;
  expiresAt: number;
}

const SESSION_COOKIE_NAME = 'infinity_session';
const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function getSecretKey(): Buffer {
  const secret = process.env.SESSION_SECRET || process.env.NOTION_ENCRYPTION_KEY || 'infinity_super_secret_session_key_32_bytes_len';
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Creates a cryptographically signed session token using HMAC-SHA256
 */
export function createSessionToken(data: Omit<SessionData, 'createdAt' | 'expiresAt'>): string {
  const now = Date.now();
  const session: SessionData = {
    ...data,
    createdAt: now,
    expiresAt: now + SESSION_DURATION_MS,
  };

  const payload = Buffer.from(JSON.stringify(session)).toString('base64url');
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(payload);
  const signature = hmac.digest('base64url');

  return `${payload}.${signature}`;
}

/**
 * Verifies and parses a signed session token
 */
export function verifySessionToken(token: string): SessionData | null {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payload, signature] = parts;
  const hmac = crypto.createHmac('sha256', getSecretKey());
  hmac.update(payload);
  const expectedSignature = hmac.digest('base64url');

  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);

  // Constant-time comparison
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const session: SessionData = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8'));
    if (Date.now() > session.expiresAt) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

/**
 * Extracts and verifies session from NextRequest (via cookie or Authorization header)
 */
export function getSessionFromRequest(req: NextRequest): SessionData | null {
  // 1. Try HTTP cookie
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    const session = verifySessionToken(cookie.value);
    if (session) return session;
  }

  // 2. Try Authorization Bearer
  const authHeader = req.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const bearerToken = authHeader.substring(7).trim();
    const session = verifySessionToken(bearerToken);
    if (session) return session;
  }

  return null;
}

/**
 * Attaches the session cookie to a NextResponse
 */
export function setSessionCookie(res: NextResponse, token: string): void {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60, // 7 days in seconds
  });
}

/**
 * Clears the session cookie
 */
export function clearSessionCookie(res: NextResponse): void {
  res.cookies.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

/**
 * Middleware helper for API routes: enforces session authentication and 2FA protection
 */
export function requireServerAuth(
  req: NextRequest, 
  options: { allow2FaPending?: boolean } = {}
): { authorized: true; session: SessionData } | { authorized: false; response: NextResponse } {
  const session = getSessionFromRequest(req);

  if (!session) {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Sesión no válida o no autenticada. Inicia sesión para continuar.' },
        { status: 401 }
      )
    };
  }

  // If 2FA is pending and this route requires completed 2FA verification
  if (session.twoFactorPending && !options.allow2FaPending) {
    return {
      authorized: false,
      response: NextResponse.json(
        { 
          error: 'Acceso restringido: Se requiere verificación en dos pasos (2FA). Completa el desafío antes de acceder a las operaciones de la cuenta.',
          twoFactorRequired: true
        },
        { status: 403 }
      )
    };
  }

  return { authorized: true, session };
}

// In-memory rate limiter for 2FA challenge attempts
interface AttemptRecord {
  count: number;
  lastAttempt: number;
  lockedUntil: number;
}
const rateLimitMap = new Map<string, AttemptRecord>();
const MAX_2FA_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes

export function check2FaRateLimit(identifier: string): { allowed: boolean; remaining: number; retryAfterSeconds: number } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier);

  if (!record) {
    return { allowed: true, remaining: MAX_2FA_ATTEMPTS, retryAfterSeconds: 0 };
  }

  if (record.lockedUntil > now) {
    const retryAfterSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { allowed: false, remaining: 0, retryAfterSeconds };
  }

  // Reset after 10 minutes of inactivity
  if (now - record.lastAttempt > 10 * 60 * 1000) {
    rateLimitMap.delete(identifier);
    return { allowed: true, remaining: MAX_2FA_ATTEMPTS, retryAfterSeconds: 0 };
  }

  const remaining = Math.max(0, MAX_2FA_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remaining, retryAfterSeconds: 0 };
}

export function record2FaFailedAttempt(identifier: string): { remaining: number; locked: boolean } {
  const now = Date.now();
  const record = rateLimitMap.get(identifier) || { count: 0, lastAttempt: now, lockedUntil: 0 };

  record.count += 1;
  record.lastAttempt = now;

  if (record.count >= MAX_2FA_ATTEMPTS) {
    record.lockedUntil = now + LOCKOUT_DURATION_MS;
    rateLimitMap.set(identifier, record);
    return { remaining: 0, locked: true };
  }

  rateLimitMap.set(identifier, record);
  return { remaining: MAX_2FA_ATTEMPTS - record.count, locked: false };
}

export function reset2FaAttempts(identifier: string): void {
  rateLimitMap.delete(identifier);
}

// In-memory replay protection for TOTP tokens (preventing token reuse within 90s window)
const usedTotpTokens = new Map<string, number>();

export function checkAndBurnTotpToken(userId: string, token: string): boolean {
  const key = `${userId}:${token.trim()}`;
  const now = Date.now();

  // Clean old tokens older than 90 seconds
  for (const [k, timestamp] of usedTotpTokens.entries()) {
    if (now - timestamp > 90 * 1000) {
      usedTotpTokens.delete(k);
    }
  }

  if (usedTotpTokens.has(key)) {
    return false; // Already used (replay attack)
  }

  usedTotpTokens.set(key, now);
  return true;
}
