/**
 * Email integration routes: connect, list, and disconnect email accounts.
 * All routes are protected by auth middleware.
 *
 * POST /api/email/connect - Exchange OAuth code for tokens and store connection
 * GET /api/email/connections - List user's connected email accounts
 * DELETE /api/email/connections/:id - Disconnect an email account
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  type EmailProvider,
  type EmailConnectionConfig,
  exchangeCodeForTokens,
  refreshAccessToken,
  encryptToken,
  decryptToken,
} from '../services/email-connection.js';

// ─── Request Interfaces ──────────────────────────────────────────────────────

interface ConnectEmailBody {
  provider: EmailProvider;
  authCode: string;
  redirectUri: string;
}

interface ConnectionParams {
  id: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface EmailRoutesOptions {
  db: Kysely<Database>;
  config: EmailConnectionConfig;
}

/**
 * Register all email connection routes on the Fastify instance.
 */
export async function registerEmailRoutes(
  app: FastifyInstance,
  options: EmailRoutesOptions,
): Promise<void> {
  const { db, config } = options;

  // ─── POST /api/email/connect ───────────────────────────────────────────────

  app.post(
    '/api/email/connect',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Body: ConnectEmailBody }>, reply: FastifyReply) => {
      const body = request.body as ConnectEmailBody;
      const userId = request.user!.userId;

      // Validate required fields
      if (!body.provider || !['gmail', 'outlook'].includes(body.provider)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'provider must be "gmail" or "outlook"',
        });
      }

      if (!body.authCode || typeof body.authCode !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'authCode is required and must be a string',
        });
      }

      if (!body.redirectUri || typeof body.redirectUri !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'redirectUri is required and must be a string',
        });
      }

      try {
        // Exchange authorization code for tokens
        const tokenResponse = await exchangeCodeForTokens(
          body.provider,
          body.authCode,
          body.redirectUri,
          config,
        );

        // Encrypt tokens for storage
        const accessTokenEncrypted = encryptToken(tokenResponse.access_token, config.encryptionKey);
        const refreshTokenEncrypted = encryptToken(tokenResponse.refresh_token, config.encryptionKey);

        // Calculate token expiration
        const tokenExpiresAt = new Date(Date.now() + tokenResponse.expires_in * 1000);

        // Upsert connection (one per provider per user)
        // Check if connection already exists
        const existing = await db
          .selectFrom('email_connections')
          .select('id')
          .where('user_id', '=', userId)
          .where('provider', '=', body.provider)
          .executeTakeFirst();

        let connection;

        if (existing) {
          // Update existing connection
          connection = await db
            .updateTable('email_connections')
            .set({
              email_address: tokenResponse.email ?? '',
              access_token_encrypted: accessTokenEncrypted,
              refresh_token_encrypted: refreshTokenEncrypted,
              token_expires_at: tokenExpiresAt,
              updated_at: new Date(),
            })
            .where('id', '=', existing.id)
            .returningAll()
            .executeTakeFirstOrThrow();
        } else {
          // Create new connection
          connection = await db
            .insertInto('email_connections')
            .values({
              user_id: userId,
              provider: body.provider,
              email_address: tokenResponse.email ?? '',
              access_token_encrypted: accessTokenEncrypted,
              refresh_token_encrypted: refreshTokenEncrypted,
              token_expires_at: tokenExpiresAt,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        }

        // Return connection info (without encrypted tokens)
        return reply.status(201).send({
          id: connection.id,
          provider: connection.provider,
          email_address: connection.email_address,
          token_expires_at: connection.token_expires_at,
          last_sync_at: connection.last_sync_at,
          created_at: connection.created_at,
          updated_at: connection.updated_at,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        request.log.error(error, 'Failed to connect email');

        // Distinguish between OAuth errors and internal errors
        if (err.message?.includes('token exchange failed') || err.message?.includes('did not return')) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'OAUTH_ERROR',
            message: err.message,
          });
        }

        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while connecting email',
        });
      }
    },
  );

  // ─── GET /api/email/connections ────────────────────────────────────────────

  app.get(
    '/api/email/connections',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.userId;

      try {
        const connections = await db
          .selectFrom('email_connections')
          .select([
            'id',
            'provider',
            'email_address',
            'token_expires_at',
            'last_sync_at',
            'created_at',
            'updated_at',
          ])
          .where('user_id', '=', userId)
          .orderBy('created_at', 'asc')
          .execute();

        return reply.status(200).send({ connections });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list email connections');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing email connections',
        });
      }
    },
  );

  // ─── DELETE /api/email/connections/:id ──────────────────────────────────────

  app.delete(
    '/api/email/connections/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: ConnectionParams }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify connection exists and belongs to user
        const connection = await db
          .selectFrom('email_connections')
          .select(['id', 'user_id', 'provider'])
          .where('id', '=', id)
          .executeTakeFirst();

        if (!connection) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Email connection not found',
          });
        }

        if (connection.user_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'You do not have access to this email connection',
          });
        }

        await db
          .deleteFrom('email_connections')
          .where('id', '=', id)
          .execute();

        return reply.status(200).send({
          message: 'Email connection disconnected successfully',
          id,
          provider: connection.provider,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to disconnect email');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while disconnecting email',
        });
      }
    },
  );

  // ─── POST /api/email/connections/:id/refresh ───────────────────────────────

  app.post(
    '/api/email/connections/:id/refresh',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: ConnectionParams }>, reply: FastifyReply) => {
      const { id } = request.params;
      const userId = request.user!.userId;

      try {
        // Fetch connection with encrypted tokens
        const connection = await db
          .selectFrom('email_connections')
          .selectAll()
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!connection) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Email connection not found',
          });
        }

        // Decrypt the refresh token
        const refreshToken = decryptToken(connection.refresh_token_encrypted, config.encryptionKey);

        // Refresh the access token
        const refreshResult = await refreshAccessToken(
          connection.provider,
          refreshToken,
          config,
        );

        // Encrypt new tokens
        const newAccessTokenEncrypted = encryptToken(refreshResult.accessToken, config.encryptionKey);
        const newTokenExpiresAt = new Date(Date.now() + refreshResult.expiresIn * 1000);

        // Build update fields
        const updateFields: Record<string, unknown> = {
          access_token_encrypted: newAccessTokenEncrypted,
          token_expires_at: newTokenExpiresAt,
          updated_at: new Date(),
        };

        // If provider rotated the refresh token, update it too
        if (refreshResult.newRefreshToken) {
          updateFields['refresh_token_encrypted'] = encryptToken(
            refreshResult.newRefreshToken,
            config.encryptionKey,
          );
        }

        await db
          .updateTable('email_connections')
          .set(updateFields)
          .where('id', '=', id)
          .execute();

        return reply.status(200).send({
          message: 'Token refreshed successfully',
          id: connection.id,
          provider: connection.provider,
          token_expires_at: newTokenExpiresAt,
        });
      } catch (error: unknown) {
        const err = error as { message?: string };
        request.log.error(error, 'Failed to refresh email token');

        if (err.message?.includes('refresh failed')) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'TOKEN_REFRESH_ERROR',
            message: 'Failed to refresh token. The user may need to reconnect their email.',
          });
        }

        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while refreshing the token',
        });
      }
    },
  );
}
