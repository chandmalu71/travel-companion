/**
 * Activity feed routes: list recent collaborator actions for a trip.
 * Also exports a utility function for recording activities from other routes.
 */

import { type FastifyInstance } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Request Interfaces ──────────────────────────────────────────────────────

interface ActivityFeedParams {
  tripId: string;
}

interface ActivityFeedQuery {
  limit?: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface ActivityFeedRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Record an activity in the activity feed.
 * Utility function for other routes to use when recording collaborator actions.
 */
export async function recordActivity(
  db: Kysely<Database>,
  tripId: string,
  userId: string,
  action: string,
  entityType: string,
  entityId: string | null,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await db
    .insertInto('activity_feed')
    .values({
      trip_id: tripId,
      user_id: userId,
      action,
      entity_type: entityType,
      entity_id: entityId,
      metadata: metadata ?? {},
    })
    .execute();
}

/**
 * Register activity feed routes on the Fastify instance.
 */
export async function registerActivityFeedRoutes(
  app: FastifyInstance,
  options: ActivityFeedRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/activity-feed ────────────────────────────────

  app.get<{ Params: ActivityFeedParams; Querystring: ActivityFeedQuery }>(
    '/api/trips/:tripId/activity-feed',
    { preHandler: [app.requireAuth] },
    async (request, reply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      // Parse and validate limit
      const rawLimit = request.query.limit;
      let limit = 50;
      if (rawLimit !== undefined) {
        const parsed = parseInt(rawLimit, 10);
        if (isNaN(parsed) || parsed < 1) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'limit must be a positive integer',
          });
        }
        limit = Math.min(parsed, 50);
      }

      try {
        // Verify trip exists
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

        // Verify user has access: owner or member
        if (trip.owner_id !== userId) {
          const membership = await db
            .selectFrom('trip_members')
            .select('id')
            .where('trip_id', '=', tripId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

          if (!membership) {
            return reply.status(403).send({
              statusCode: 403,
              error: 'FORBIDDEN',
              message: 'You do not have access to this trip',
            });
          }
        }

        // Query activity feed entries with user display names
        const entries = await db
          .selectFrom('activity_feed')
          .innerJoin('users', 'users.id', 'activity_feed.user_id')
          .select([
            'activity_feed.id',
            'activity_feed.user_id as userId',
            'users.display_name as userName',
            'activity_feed.action',
            'activity_feed.entity_type as entityType',
            'activity_feed.entity_id as entityId',
            'activity_feed.metadata',
            'activity_feed.created_at as timestamp',
          ])
          .where('activity_feed.trip_id', '=', tripId)
          .orderBy('activity_feed.created_at', 'desc')
          .limit(limit)
          .execute();

        return reply.status(200).send(entries);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to fetch activity feed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching the activity feed',
        });
      }
    },
  );
}
