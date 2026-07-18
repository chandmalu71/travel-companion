/**
 * Voting routes for collaborative trip planning.
 * Supports upvote/downvote on favorites and timeline events.
 * Enforces one vote per user per item (upsert on conflict).
 *
 * All routes require authentication and trip membership (owner or collaborator).
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { voteCreationSchema } from '@travel-companion/shared';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TripParams {
  tripId: string;
}

interface VoteParams {
  tripId: string;
  voteId: string;
}

interface VoteQueryParams {
  entity_type?: string;
  entity_id?: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface VoteRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Check if a user is the trip owner or a trip member (any access level).
 * Returns true if the user has access, false otherwise.
 */
async function verifyTripMembership(
  db: Kysely<Database>,
  tripId: string,
  userId: string,
): Promise<{ hasAccess: boolean; trip: { id: string; owner_id: string } | null }> {
  const trip = await db
    .selectFrom('trips')
    .select(['id', 'owner_id'])
    .where('id', '=', tripId)
    .executeTakeFirst();

  if (!trip) {
    return { hasAccess: false, trip: null };
  }

  if (trip.owner_id === userId) {
    return { hasAccess: true, trip };
  }

  const membership = await db
    .selectFrom('trip_members')
    .select('id')
    .where('trip_id', '=', tripId)
    .where('user_id', '=', userId)
    .executeTakeFirst();

  return { hasAccess: !!membership, trip };
}

/**
 * Calculate the net vote count for an entity (sum of all vote_values).
 */
async function getNetVoteCount(
  db: Kysely<Database>,
  entityType: string,
  entityId: string,
): Promise<number> {
  const result = await db
    .selectFrom('votes')
    .select(sql<string>`COALESCE(SUM(vote_value), 0)`.as('net_count'))
    .where('entity_type', '=', entityType as 'favorite' | 'timeline_event')
    .where('entity_id', '=', entityId)
    .executeTakeFirstOrThrow();

  return Number(result.net_count);
}

/**
 * Register all voting routes on the Fastify instance.
 */
export async function registerVoteRoutes(
  app: FastifyInstance,
  options: VoteRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips/:tripId/votes ───────────────────────────────────────
  // Create or update a vote (upsert). If user already voted on this item,
  // update the vote_value.

  app.post(
    '/api/trips/:tripId/votes',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      // Validate request body
      const parseResult = voteCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Vote validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { entity_type, entity_id, vote_value } = parseResult.data;

      try {
        // Verify trip membership
        const { hasAccess, trip } = await verifyTripMembership(db, tripId, userId);

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (!hasAccess) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'You must be a trip member to vote',
          });
        }

        // Check if user already voted on this item
        const existingVote = await db
          .selectFrom('votes')
          .selectAll()
          .where('user_id', '=', userId)
          .where('entity_type', '=', entity_type)
          .where('entity_id', '=', entity_id)
          .executeTakeFirst();

        let vote;
        if (existingVote) {
          // Update existing vote
          vote = await db
            .updateTable('votes')
            .set({ vote_value })
            .where('id', '=', existingVote.id)
            .returningAll()
            .executeTakeFirstOrThrow();
        } else {
          // Create new vote
          vote = await db
            .insertInto('votes')
            .values({
              trip_id: tripId,
              user_id: userId,
              entity_type,
              entity_id,
              vote_value,
            })
            .returningAll()
            .executeTakeFirstOrThrow();
        }

        // Calculate net vote count for the entity
        const netVoteCount = await getNetVoteCount(db, entity_type, entity_id);

        return reply.status(existingVote ? 200 : 201).send({
          vote: {
            id: vote.id,
            trip_id: vote.trip_id,
            user_id: vote.user_id,
            entity_type: vote.entity_type,
            entity_id: vote.entity_id,
            vote_value: vote.vote_value,
            created_at: new Date(vote.created_at).toISOString(),
          },
          net_vote_count: netVoteCount,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create/update vote');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while processing the vote',
        });
      }
    },
  );

  // ─── GET /api/trips/:tripId/votes ────────────────────────────────────────
  // Get all votes for a trip, optionally filtered by entity_type/entity_id.

  app.get(
    '/api/trips/:tripId/votes',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Querystring: VoteQueryParams }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;
      const { entity_type, entity_id } = request.query;

      try {
        // Verify trip membership
        const { hasAccess, trip } = await verifyTripMembership(db, tripId, userId);

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (!hasAccess) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'You must be a trip member to view votes',
          });
        }

        // Build query with optional filters
        let query = db
          .selectFrom('votes')
          .selectAll()
          .where('trip_id', '=', tripId);

        if (entity_type) {
          query = query.where('entity_type', '=', entity_type as 'favorite' | 'timeline_event');
        }

        if (entity_id) {
          query = query.where('entity_id', '=', entity_id);
        }

        const votes = await query.orderBy('created_at', 'desc').execute();

        // Group votes by entity and calculate net counts
        const entityCounts = new Map<string, number>();
        for (const vote of votes) {
          const key = `${vote.entity_type}:${vote.entity_id}`;
          entityCounts.set(key, (entityCounts.get(key) || 0) + vote.vote_value);
        }

        const netCounts: Record<string, number> = {};
        for (const [key, count] of entityCounts) {
          netCounts[key] = count;
        }

        return reply.status(200).send({
          votes: votes.map((v) => ({
            id: v.id,
            trip_id: v.trip_id,
            user_id: v.user_id,
            entity_type: v.entity_type,
            entity_id: v.entity_id,
            vote_value: v.vote_value,
            created_at: new Date(v.created_at).toISOString(),
          })),
          net_counts: netCounts,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list votes');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing votes',
        });
      }
    },
  );

  // ─── DELETE /api/trips/:tripId/votes/:voteId ─────────────────────────────
  // Remove a vote. Only the vote owner can remove their vote.

  app.delete(
    '/api/trips/:tripId/votes/:voteId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: VoteParams }>, reply: FastifyReply) => {
      const { tripId, voteId } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify trip membership
        const { hasAccess, trip } = await verifyTripMembership(db, tripId, userId);

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (!hasAccess) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'You must be a trip member to manage votes',
          });
        }

        // Fetch the vote to verify ownership and get entity info
        const vote = await db
          .selectFrom('votes')
          .selectAll()
          .where('id', '=', voteId)
          .where('trip_id', '=', tripId)
          .executeTakeFirst();

        if (!vote) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Vote not found',
          });
        }

        // Only the vote owner can delete their vote
        if (vote.user_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the vote owner can remove their vote',
          });
        }

        const entityType = vote.entity_type;
        const entityId = vote.entity_id;

        // Delete the vote
        await db
          .deleteFrom('votes')
          .where('id', '=', voteId)
          .execute();

        // Calculate updated net vote count
        const netVoteCount = await getNetVoteCount(db, entityType, entityId);

        return reply.status(200).send({
          message: 'Vote removed successfully',
          net_vote_count: netVoteCount,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete vote');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the vote',
        });
      }
    },
  );
}
