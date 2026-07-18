/**
 * Local Development Authentication Routes
 *
 * Bypasses AWS Cognito for local testing.
 * Uses SHA-256 password hashing and local JWT generation.
 * NOT for production use.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { registrationSchema, loginSchema } from '@travel-companion/shared';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { LocalAuthService, decodeLocalToken } from '../services/local-auth.js';

export interface LocalAuthRoutesOptions {
  db: Kysely<Database>;
}

export async function registerLocalAuthRoutes(
  app: FastifyInstance,
  options: LocalAuthRoutesOptions,
): Promise<void> {
  const { db } = options;
  const localAuth = new LocalAuthService();

  // ─── POST /api/auth/register ─────────────────────────────────────────

  app.post(
    '/api/auth/register',
    async (request: FastifyRequest<{ Body: { email: string; password: string; displayName?: string } }>, reply: FastifyReply) => {
      const body = request.body ?? {};

      const parseResult = registrationSchema.safeParse(body);
      if (!parseResult.success) {
        request.log.warn({ body, issues: parseResult.error.issues }, 'Registration validation failed');
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Registration validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { email, password } = parseResult.data;
      const displayName = (body as any).displayName ?? email.split('@')[0] ?? email;

      try {
        // Check if user already exists
        const existing = await db
          .selectFrom('users')
          .select('id')
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst();

        if (existing) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'EMAIL_EXISTS',
            message: 'An account with this email address already exists',
          });
        }

        // Create user with hashed password
        const passwordHash = localAuth.hashPassword(password);
        const signUpResult = await localAuth.signUp(email, password);

        const newUser = await db
          .insertInto('users')
          .values({
            email: email.toLowerCase(),
            cognito_sub: signUpResult.userSub,
            display_name: displayName,
            email_verified: true,
            password_hash: passwordHash,
          })
          .returning(['id', 'email', 'display_name'])
          .executeTakeFirstOrThrow();

        return reply.status(201).send({
          statusCode: 201,
          data: {
            userId: newUser.id,
            email: newUser.email,
            displayName: newUser.display_name,
            verificationRequired: false,
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Local registration failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Registration failed',
        });
      }
    },
  );

  // ─── POST /api/auth/login ────────────────────────────────────────────

  app.post(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const body = request.body ?? {};

      const parseResult = loginSchema.safeParse(body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Login validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { email, password } = parseResult.data;

      try {
        // Look up user
        const user = await db
          .selectFrom('users')
          .select(['id', 'email', 'display_name', 'password_hash', 'avatar_url', 'email_verified'])
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst();

        if (!user || !user.password_hash) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        // Verify password
        if (!localAuth.verifyPassword(password, user.password_hash)) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        // Generate tokens
        const authResult = await localAuth.signIn(user.email, user.id);

        return reply.send({
          statusCode: 200,
          data: {
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken,
            userId: user.id,
            user: {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
              email_verified: user.email_verified,
            },
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Local login failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Login failed',
        });
      }
    },
  );

  // ─── POST /api/auth/refresh ──────────────────────────────────────────

  app.post(
    '/api/auth/refresh',
    async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
      const { refreshToken } = request.body ?? {};

      if (!refreshToken) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
        });
      }

      const decoded = decodeLocalToken(refreshToken);
      if (!decoded) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }

      // Generate new tokens
      const authResult = await localAuth.signIn(decoded.email, decoded.sub);

      return reply.send({
        statusCode: 200,
        data: {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
        },
      });
    },
  );
}
