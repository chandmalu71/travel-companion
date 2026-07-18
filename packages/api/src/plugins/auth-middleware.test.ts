/**
 * Tests for auth middleware plugin.
 *
 * Uses a self-signed key pair to generate test JWTs. The JWKS is mocked
 * to return the local public key for verification.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { SignJWT, exportJWK, generateKeyPair } from 'jose';
import { registerAuthMiddleware, extractBearerToken } from './auth-middleware.js';
import { createLocalJWKSet } from 'jose';

// ─── Test Setup ──────────────────────────────────────────────────────────────

let app: FastifyInstance;
let privateKey: CryptoKey;
let publicKey: CryptoKey;
let jwks: ReturnType<typeof createLocalJWKSet>;

beforeAll(async () => {
  // Generate an RSA key pair for testing
  const keyPair = await generateKeyPair('RS256');
  privateKey = keyPair.privateKey as unknown as CryptoKey;
  publicKey = keyPair.publicKey as unknown as CryptoKey;

  // Create a local JWKS set from the public key
  const publicJWK = await exportJWK(publicKey);
  publicJWK.kid = 'test-key-id';
  publicJWK.alg = 'RS256';
  publicJWK.use = 'sig';

  jwks = createLocalJWKSet({
    keys: [publicJWK],
  });

  // Build a minimal Fastify app with the auth middleware
  app = Fastify({ logger: false });

  await app.register(registerAuthMiddleware, {
    jwks: jwks as unknown as ReturnType<typeof import('jose').createRemoteJWKSet>,
  });

  // Add a protected test route
  app.get('/protected', {
    preHandler: app.requireAuth,
  }, async (request) => {
    return { user: request.user };
  });

  // Add an unprotected test route
  app.get('/public', async () => {
    return { message: 'public' };
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── Helper to create test tokens ───────────────────────────────────────────

async function createTestToken(options: {
  sub?: string;
  email?: string;
  expiresIn?: string;
  expired?: boolean;
} = {}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  let jwt = new SignJWT({
    sub: options.sub ?? 'test-user-id-123',
    email: options.email ?? 'test@example.com',
    token_use: 'access',
  })
    .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
    .setIssuedAt(options.expired ? now - 7200 : now)
    .setIssuer('https://cognito-idp.us-east-1.amazonaws.com/us-east-1_test');

  if (options.expired) {
    // Set expiration in the past
    jwt = jwt.setExpirationTime(now - 3600);
  } else {
    jwt = jwt.setExpirationTime(options.expiresIn ?? '1h');
  }

  return jwt.sign(privateKey);
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('extractBearerToken', () => {
  it('should return null for undefined header', () => {
    expect(extractBearerToken(undefined)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(extractBearerToken('')).toBeNull();
  });

  it('should return null for non-Bearer scheme', () => {
    expect(extractBearerToken('Basic abc123')).toBeNull();
  });

  it('should return null for malformed Bearer header (no token)', () => {
    expect(extractBearerToken('Bearer')).toBeNull();
  });

  it('should return null for Bearer with extra parts', () => {
    expect(extractBearerToken('Bearer token extra')).toBeNull();
  });

  it('should extract token from valid Bearer header', () => {
    expect(extractBearerToken('Bearer my-jwt-token')).toBe('my-jwt-token');
  });
});

describe('auth middleware - missing Authorization header', () => {
  it('should return 401 when Authorization header is missing', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('UNAUTHORIZED');
    expect(body.message).toContain('Authorization header');
  });
});

describe('auth middleware - invalid token format', () => {
  it('should return 401 for non-Bearer scheme', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Basic dXNlcjpwYXNz',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('UNAUTHORIZED');
  });

  it('should return 401 for malformed JWT', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: 'Bearer not-a-valid-jwt',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('INVALID_TOKEN');
  });

  it('should return 401 for JWT signed with wrong key', async () => {
    // Generate a different key pair
    const wrongKeyPair = await generateKeyPair('RS256');

    const token = await new SignJWT({
      sub: 'user-123',
      email: 'wrong@example.com',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'wrong-key' })
      .setIssuedAt()
      .setExpirationTime('1h')
      .sign(wrongKeyPair.privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('INVALID_TOKEN');
  });
});

describe('auth middleware - expired token', () => {
  it('should return 401 with TOKEN_EXPIRED error code for expired token', async () => {
    const expiredToken = await createTestToken({ expired: true });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${expiredToken}`,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('TOKEN_EXPIRED');
    expect(body.message).toContain('expired');
  });
});

describe('auth middleware - valid token', () => {
  it('should decode user ID and email from valid token', async () => {
    const token = await createTestToken({
      sub: 'user-abc-123',
      email: 'user@example.com',
    });

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user).toEqual({
      userId: 'user-abc-123',
      email: 'user@example.com',
    });
  });

  it('should not require auth for unprotected routes', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/public',
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.message).toBe('public');
  });

  it('should handle token with cognito:username as email fallback', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      sub: 'user-456',
      'cognito:username': 'jdoe@example.com',
      token_use: 'access',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
      .setIssuedAt(now)
      .setExpirationTime('1h')
      .sign(privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.user.userId).toBe('user-456');
    expect(body.user.email).toBe('jdoe@example.com');
  });
});

describe('auth middleware - token without sub claim', () => {
  it('should return 401 when token has no sub claim', async () => {
    const now = Math.floor(Date.now() / 1000);
    const token = await new SignJWT({
      email: 'nosub@example.com',
      token_use: 'access',
    })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key-id' })
      .setIssuedAt(now)
      .setExpirationTime('1h')
      .sign(privateKey);

    const response = await app.inject({
      method: 'GET',
      url: '/protected',
      headers: {
        authorization: `Bearer ${token}`,
      },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error).toBe('INVALID_TOKEN');
    expect(body.message).toContain('valid user identifier');
  });
});
