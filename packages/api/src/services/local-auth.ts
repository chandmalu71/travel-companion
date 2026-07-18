/**
 * Local Authentication Service (Development Only)
 *
 * Bypasses AWS Cognito for local development.
 * Uses simple crypto hashing for passwords (NOT for production).
 * Generates JWT tokens locally.
 */

import { createHash, randomUUID } from 'node:crypto';

export interface LocalSignUpResult {
  userSub: string;
  userConfirmed: boolean;
}

export interface LocalAuthResult {
  accessToken: string;
  refreshToken: string;
  idToken: string;
  expiresIn: number;
}

/**
 * Hash a password using SHA-256 (sufficient for local dev; use bcrypt in production).
 */
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

/**
 * Generate a mock JWT token for local development.
 */
function generateLocalToken(userId: string, email: string, expiresInSec: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({
    sub: userId,
    email,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
    iss: 'local-dev',
  })).toString('base64url');
  const signature = createHash('sha256').update(`${header}.${payload}.local-secret`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}

/**
 * Local auth service that mimics CognitoService interface for development.
 */
export class LocalAuthService {
  async signUp(_email: string, _password: string): Promise<LocalSignUpResult> {
    return {
      userSub: randomUUID(),
      userConfirmed: true, // Auto-confirm in local dev
    };
  }

  async signIn(email: string, userId: string): Promise<LocalAuthResult> {
    const accessToken = generateLocalToken(userId, email, 3600);
    const refreshToken = generateLocalToken(userId, email, 30 * 24 * 3600);
    const idToken = generateLocalToken(userId, email, 3600);

    return {
      accessToken,
      refreshToken,
      idToken,
      expiresIn: 3600,
    };
  }

  hashPassword(password: string): string {
    return hashPassword(password);
  }

  verifyPassword(password: string, hash: string): boolean {
    return hashPassword(password) === hash;
  }
}

/**
 * Decode a local dev JWT to extract user info.
 * Returns null if token is invalid or expired.
 */
export function decodeLocalToken(token: string): { sub: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const payload = JSON.parse(Buffer.from(parts[1]!, 'base64url').toString('utf8'));

    // Check expiry
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return { sub: payload.sub, email: payload.email };
  } catch {
    return null;
  }
}
