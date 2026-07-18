/**
 * Authentication middleware for Fastify.
 *
 * Provides JWT verification against AWS Cognito JWKS endpoint.
 * Extracts user identity from the token and attaches to request context.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

// ─── Request User Interface ──────────────────────────────────────────────────

export interface RequestUser {
  userId: string; // Cognito sub (also used as user ID)
  email: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: RequestUser;
  }
}

// ─── Cognito JWT Payload ─────────────────────────────────────────────────────

interface CognitoJWTPayload extends JWTPayload {
  sub?: string;
  email?: string;
  'cognito:username'?: string;
  token_use?: 'access' | 'id';
}

// ─── Plugin Options ──────────────────────────────────────────────────────────

export interface AuthMiddlewareOptions {
  /** Cognito User Pool ID (e.g., us-east-1_abc123) */
  userPoolId?: string;
  /** AWS region (default: us-east-1) */
  region?: string;
  /** Explicit JWKS URL (overrides userPoolId/region derivation) */
  jwksUrl?: string;
  /** Custom JWKS fetcher (for testing) */
  jwks?: ReturnType<typeof createRemoteJWKSet>;
}

// ─── Auth Plugin ─────────────────────────────────────────────────────────────

let cachedJWKS: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(options: AuthMiddlewareOptions): ReturnType<typeof createRemoteJWKSet> {
  // Allow injecting a custom JWKS for testing
  if (options.jwks) {
    return options.jwks;
  }

  if (cachedJWKS) {
    return cachedJWKS;
  }

  let jwksUrl: string;
  if (options.jwksUrl) {
    jwksUrl = options.jwksUrl;
  } else {
    const region = options.region ?? 'us-east-1';
    const userPoolId = options.userPoolId ?? '';
    jwksUrl = `https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`;
  }

  cachedJWKS = createRemoteJWKSet(new URL(jwksUrl));
  return cachedJWKS;
}

/**
 * Extract the Bearer token from the Authorization header.
 * Returns null if the header is missing or not in the expected format.
 */
function extractBearerToken(authHeader: string | undefined): string | null {
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') return null;
  return parts[1] || null;
}

/**
 * Auth middleware plugin for Fastify.
 *
 * Decorates the instance with `requireAuth` preHandler hook that:
 * 1. Extracts the Bearer token from the Authorization header
 * 2. Verifies the JWT signature against Cognito JWKS
 * 3. Decodes user identity (sub, email) from the token
 * 4. Attaches `request.user` with userId and email
 * 5. Returns 401 for missing, malformed, or expired tokens
 */
async function authMiddlewarePlugin(
  app: FastifyInstance,
  options: AuthMiddlewareOptions,
): Promise<void> {
  const jwks = getJWKS(options);

  // Decorate request with user field
  app.decorateRequest('user', undefined);

  /**
   * preHandler hook that validates JWT and attaches user context.
   * Use this as a route-level preHandler to protect endpoints.
   */
  const requireAuth = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const token = extractBearerToken(request.headers.authorization);

    if (!token) {
      reply.status(401).send({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Authorization header with Bearer token is required',
      });
      return;
    }

    try {
      const { payload } = await jwtVerify(token, jwks) as { payload: CognitoJWTPayload };

      const userId = payload.sub;
      const email = payload.email ?? payload['cognito:username'] ?? '';

      if (!userId) {
        reply.status(401).send({
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Token does not contain a valid user identifier',
        });
        return;
      }

      request.user = {
        userId,
        email,
      };
    } catch (error: unknown) {
      const err = error as { code?: string; message?: string };

      if (err.code === 'ERR_JWT_EXPIRED') {
        reply.status(401).send({
          statusCode: 401,
          error: 'TOKEN_EXPIRED',
          message: 'Access token has expired. Please refresh your token.',
        });
        return;
      }

      // Handle all other JWT verification errors (invalid signature, malformed, etc.)
      reply.status(401).send({
        statusCode: 401,
        error: 'INVALID_TOKEN',
        message: 'The provided token is invalid',
      });
      return;
    }
  };

  // Decorate app with the requireAuth hook so routes can use it
  app.decorate('requireAuth', requireAuth);
}

declare module 'fastify' {
  interface FastifyInstance {
    requireAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export const registerAuthMiddleware = fp(authMiddlewarePlugin, {
  name: 'auth-middleware',
  fastify: '>=4.0.0',
});

// Also export the helper for testing
export { extractBearerToken };
