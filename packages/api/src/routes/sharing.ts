/**
 * Trip sharing routes: invite via email, generate shareable links, revoke access.
 * All routes require authentication and trip ownership.
 *
 * Routes:
 * - POST /api/trips/:tripId/share — Invite users by email
 * - GET /api/trips/:tripId/share/link — Generate or retrieve a read-only shareable link
 * - DELETE /api/trips/:tripId/share/:memberId — Revoke a member's access
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import crypto from 'node:crypto';

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_RECIPIENTS = 20;
const SHARE_LINK_EXPIRY_DAYS = 30;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── Types ───────────────────────────────────────────────────────────────────

interface TripParams {
  tripId: string;
}

interface MemberParams {
  tripId: string;
  memberId: string;
}

interface ShareTripBody {
  emails: string[];
  accessLevel?: 'view' | 'edit';
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface SharingRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Validate an array of email addresses.
 * Returns an object with valid and invalid emails.
 */
function validateEmails(emails: unknown): { valid: string[]; invalid: string[] } {
  if (!Array.isArray(emails)) {
    return { valid: [], invalid: [] };
  }

  const valid: string[] = [];
  const invalid: string[] = [];

  for (const email of emails) {
    if (typeof email !== 'string') {
      invalid.push(String(email));
      continue;
    }
    const trimmed = email.trim().toLowerCase();
    if (EMAIL_REGEX.test(trimmed)) {
      valid.push(trimmed);
    } else {
      invalid.push(trimmed);
    }
  }

  return { valid, invalid };
}

/**
 * Generate a cryptographically secure random token for shareable links.
 */
function generateShareToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Register all trip sharing routes on the Fastify instance.
 */
export async function registerSharingRoutes(
  app: FastifyInstance,
  options: SharingRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips/:tripId/share ─────────────────────────────────────────
  // Share a trip via email invitation (up to 20 recipients).

  app.post(
    '/api/trips/:tripId/share',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Body: ShareTripBody }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;
      const body = request.body as ShareTripBody;

      // Validate body
      if (!body || !body.emails) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'emails field is required',
        });
      }

      // Validate access level
      const accessLevel = body.accessLevel ?? 'view';
      if (accessLevel !== 'view' && accessLevel !== 'edit') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'accessLevel must be "view" or "edit"',
        });
      }

      // Validate emails
      const { valid: validEmails, invalid: invalidEmails } = validateEmails(body.emails);

      if (invalidEmails.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'One or more email addresses are invalid',
          details: { invalidEmails },
        });
      }

      if (validEmails.length === 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'At least one valid email address is required',
        });
      }

      if (validEmails.length > MAX_RECIPIENTS) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `Cannot share with more than ${MAX_RECIPIENTS} recipients at once`,
        });
      }

      try {
        // Verify trip exists and user is the owner
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (trip.owner_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the trip owner can share this trip',
          });
        }

        // Check existing member count (enforce up to 20 total members)
        const existingMembers = await db
          .selectFrom('trip_members')
          .select('id')
          .where('trip_id', '=', tripId)
          .execute();

        const totalAfterAdd = existingMembers.length + validEmails.length;
        if (totalAfterAdd > MAX_RECIPIENTS) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: `A trip can have at most ${MAX_RECIPIENTS} members. Currently has ${existingMembers.length}, attempting to add ${validEmails.length}.`,
          });
        }

        // Insert new members (skip duplicates)
        const results: Array<{ email: string; status: 'invited' | 'already_member' }> = [];

        for (const email of validEmails) {
          // Check if already a member by email
          const existing = await db
            .selectFrom('trip_members')
            .select('id')
            .where('trip_id', '=', tripId)
            .where('email', '=', email)
            .executeTakeFirst();

          if (existing) {
            results.push({ email, status: 'already_member' });
            continue;
          }

          // Check if there's a user with this email and look up by user_id
          const user = await db
            .selectFrom('users')
            .select(['id', 'email'])
            .where('email', '=', email)
            .executeTakeFirst();

          if (user) {
            // Check if already a member by user_id
            const existingByUserId = await db
              .selectFrom('trip_members')
              .select('id')
              .where('trip_id', '=', tripId)
              .where('user_id', '=', user.id)
              .executeTakeFirst();

            if (existingByUserId) {
              results.push({ email, status: 'already_member' });
              continue;
            }

            await db
              .insertInto('trip_members')
              .values({
                trip_id: tripId,
                user_id: user.id,
                email,
                access_level: accessLevel,
              })
              .execute();
          } else {
            // Invite by email only (user hasn't registered yet)
            await db
              .insertInto('trip_members')
              .values({
                trip_id: tripId,
                user_id: null,
                email,
                access_level: accessLevel,
              })
              .execute();
          }

          results.push({ email, status: 'invited' });
        }

        return reply.status(200).send({
          message: 'Trip shared successfully',
          tripId,
          accessLevel,
          results,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to share trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while sharing the trip',
        });
      }
    },
  );

  // ─── GET /api/trips/:tripId/share/link ─────────────────────────────────────
  // Generate a read-only shareable link expiring in 30 days.

  app.get(
    '/api/trips/:tripId/share/link',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify trip exists and user is the owner
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (trip.owner_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the trip owner can generate share links',
          });
        }

        // Check if a non-expired share link already exists
        const now = new Date();
        const existingLink = await db
          .selectFrom('share_links')
          .selectAll()
          .where('trip_id', '=', tripId)
          .where('expires_at', '>', now)
          .executeTakeFirst();

        if (existingLink) {
          return reply.status(200).send({
            url: `/shared/trip/${existingLink.token}`,
            token: existingLink.token,
            expiresAt: new Date(existingLink.expires_at).toISOString(),
            createdAt: new Date(existingLink.created_at).toISOString(),
          });
        }

        // Generate a new share link
        const token = generateShareToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + SHARE_LINK_EXPIRY_DAYS);

        const shareLink = await db
          .insertInto('share_links')
          .values({
            trip_id: tripId,
            token,
            expires_at: expiresAt,
            created_by: userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(201).send({
          url: `/shared/trip/${shareLink.token}`,
          token: shareLink.token,
          expiresAt: new Date(shareLink.expires_at).toISOString(),
          createdAt: new Date(shareLink.created_at).toISOString(),
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to generate share link');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while generating the share link',
        });
      }
    },
  );

  // ─── DELETE /api/trips/:tripId/share/:memberId ─────────────────────────────
  // Revoke a member's access immediately.

  app.delete(
    '/api/trips/:tripId/share/:memberId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: MemberParams }>, reply: FastifyReply) => {
      const { tripId, memberId } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify trip exists and user is the owner
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (trip.owner_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the trip owner can revoke access',
          });
        }

        // Verify member exists for this trip
        const member = await db
          .selectFrom('trip_members')
          .selectAll()
          .where('id', '=', memberId)
          .where('trip_id', '=', tripId)
          .executeTakeFirst();

        if (!member) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Member not found for this trip',
          });
        }

        // Delete the member immediately
        await db
          .deleteFrom('trip_members')
          .where('id', '=', memberId)
          .where('trip_id', '=', tripId)
          .execute();

        return reply.status(200).send({
          message: 'Access revoked successfully',
          tripId,
          memberId,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to revoke access');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while revoking access',
        });
      }
    },
  );
}
