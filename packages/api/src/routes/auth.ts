/**
 * Authentication routes: register, login, OAuth, password reset, refresh.
 * Integrates with AWS Cognito and local PostgreSQL users table.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { registrationSchema, loginSchema } from '@travel-companion/shared';
import { type CognitoService } from '../services/cognito.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { checkLockout, recordFailedAttempt, resetLockout } from '../services/lockout.js';

// ─── Request/Response Interfaces ─────────────────────────────────────────────

interface RegisterRequest {
  email: string;
  password: string;
}

interface RegisterResponse {
  userId: string;
  verificationRequired: boolean;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    display_name: string;
    avatar_url: string | null;
    email_verified: boolean;
  };
}

interface OAuthRequest {
  provider: 'google' | 'apple' | 'yahoo' | 'amazon';
  idToken: string;
}

interface PasswordResetRequest {
  email: string;
}

interface RefreshRequest {
  refreshToken: string;
}

// ─── Route Registration ──────────────────────────────────────────────────────

export interface AuthRoutesOptions {
  cognitoService: CognitoService;
  db: Kysely<Database>;
}

/**
 * Register all authentication routes on the Fastify instance.
 */
export async function registerAuthRoutes(
  app: FastifyInstance,
  options: AuthRoutesOptions,
): Promise<void> {
  const { cognitoService, db } = options;

  // ─── POST /api/auth/register ─────────────────────────────────────────────

  app.post(
    '/api/auth/register',
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
      const parseResult = registrationSchema.safeParse(request.body);

      if (!parseResult.success) {
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

      try {
        // Register user in Cognito (sends verification email automatically)
        const cognitoResult = await cognitoService.signUp(email, password);

        // Store user record in local PostgreSQL users table
        const displayName = email.split('@')[0] ?? email;

        const newUser = await db
          .insertInto('users')
          .values({
            email,
            cognito_sub: cognitoResult.userSub,
            display_name: displayName,
            email_verified: cognitoResult.userConfirmed,
          })
          .returning(['id'])
          .executeTakeFirstOrThrow();

        const response: RegisterResponse = {
          userId: newUser.id,
          verificationRequired: !cognitoResult.userConfirmed,
        };

        return reply.status(201).send(response);
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };

        // Handle Cognito-specific errors
        if (err.name === 'UsernameExistsException') {
          return reply.status(409).send({
            statusCode: 409,
            error: 'EMAIL_EXISTS',
            message: 'An account with this email address already exists',
          });
        }

        if (err.name === 'InvalidPasswordException') {
          return reply.status(400).send({
            statusCode: 400,
            error: 'INVALID_PASSWORD',
            message: 'Password does not meet requirements',
          });
        }

        request.log.error(error, 'Registration failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during registration',
        });
      }
    },
  );

  // ─── POST /api/auth/login ────────────────────────────────────────────────

  app.post(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      const parseResult = loginSchema.safeParse(request.body);

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
        // Check if account is locked before attempting authentication
        if (app.redis) {
          const lockoutStatus = await checkLockout(app.redis, email);
          if (lockoutStatus.locked) {
            return reply.status(423).send({
              statusCode: 423,
              error: 'ACCOUNT_LOCKED',
              message: lockoutStatus.message,
              remainingSeconds: lockoutStatus.remainingSeconds,
            });
          }
        }

        // Authenticate with Cognito
        const authResult = await cognitoService.initiateAuth(email, password);

        // Successful login — reset lockout counter
        if (app.redis) {
          await resetLockout(app.redis, email);
        }

        // Fetch user profile from local DB
        const user = await db
          .selectFrom('users')
          .select(['id', 'email', 'display_name', 'avatar_url', 'email_verified'])
          .where('email', '=', email)
          .executeTakeFirst();

        if (!user) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'USER_NOT_FOUND',
            message: 'User profile not found',
          });
        }

        const response: LoginResponse = {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            display_name: user.display_name,
            avatar_url: user.avatar_url,
            email_verified: user.email_verified,
          },
        };

        return reply.status(200).send(response);
      } catch (error: unknown) {
        const err = error as { name?: string; message?: string };

        if (err.name === 'NotAuthorizedException' || err.name === 'UserNotFoundException') {
          // Record failed attempt for lockout tracking
          if (app.redis) {
            const lockoutStatus = await recordFailedAttempt(app.redis, email);
            if (lockoutStatus.locked) {
              return reply.status(423).send({
                statusCode: 423,
                error: 'ACCOUNT_LOCKED',
                message: lockoutStatus.message,
                remainingSeconds: lockoutStatus.remainingSeconds,
              });
            }
          }

          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        if (err.name === 'UserNotConfirmedException') {
          return reply.status(403).send({
            statusCode: 403,
            error: 'EMAIL_NOT_VERIFIED',
            message: 'Please verify your email before logging in',
          });
        }

        request.log.error(error, 'Login failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during login',
        });
      }
    },
  );

  // ─── POST /api/auth/oauth ────────────────────────────────────────────────

  app.post(
    '/api/auth/oauth',
    async (request: FastifyRequest<{ Body: OAuthRequest }>, reply: FastifyReply) => {
      const { provider, idToken } = request.body ?? {};

      if (!provider || !idToken) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Provider and idToken are required',
        });
      }

      const validProviders = ['google', 'apple', 'yahoo', 'amazon'];
      if (!validProviders.includes(provider)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'INVALID_PROVIDER',
          message: `Provider must be one of: ${validProviders.join(', ')}`,
        });
      }

      // OAuth flow is handled by Cognito hosted UI / federated identity
      // This endpoint would validate the idToken with the provider and create/link accounts
      // For now, return a placeholder as the full OAuth flow requires Cognito federated setup
      return reply.status(501).send({
        statusCode: 501,
        error: 'NOT_IMPLEMENTED',
        message: 'OAuth authentication is not yet fully implemented. Use Cognito hosted UI for OAuth flows.',
      });
    },
  );

  // ─── POST /api/auth/password-reset ───────────────────────────────────────

  app.post(
    '/api/auth/password-reset',
    async (request: FastifyRequest<{ Body: PasswordResetRequest }>, reply: FastifyReply) => {
      const { email } = request.body ?? {};

      if (!email || typeof email !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'A valid email address is required',
        });
      }

      try {
        // Initiate password reset in Cognito (sends reset code to email)
        await cognitoService.forgotPassword(email);

        // Always return success to prevent email enumeration
        return reply.status(200).send({
          message: 'If an account with that email exists, a password reset link has been sent',
        });
      } catch (error: unknown) {
        const err = error as { name?: string };

        // Cognito may throw UserNotFoundException, but we don't reveal that
        if (err.name === 'UserNotFoundException') {
          return reply.status(200).send({
            message: 'If an account with that email exists, a password reset link has been sent',
          });
        }

        if (err.name === 'LimitExceededException') {
          return reply.status(429).send({
            statusCode: 429,
            error: 'RATE_LIMITED',
            message: 'Too many password reset attempts. Please try again later.',
          });
        }

        request.log.error(error, 'Password reset failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        });
      }
    },
  );

  // ─── POST /api/auth/refresh ──────────────────────────────────────────────

  app.post(
    '/api/auth/refresh',
    async (request: FastifyRequest<{ Body: RefreshRequest }>, reply: FastifyReply) => {
      const { refreshToken } = request.body ?? {};

      if (!refreshToken || typeof refreshToken !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Refresh token is required',
        });
      }

      try {
        const authResult = await cognitoService.refreshAuth(refreshToken);

        return reply.status(200).send({
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
          expiresIn: authResult.expiresIn,
        });
      } catch (error: unknown) {
        const err = error as { name?: string };

        if (err.name === 'NotAuthorizedException') {
          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_TOKEN',
            message: 'Refresh token is invalid or expired',
          });
        }

        request.log.error(error, 'Token refresh failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred during token refresh',
        });
      }
    },
  );
}
