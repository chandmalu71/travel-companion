/**
 * Favorites and Collections CRUD routes.
 * Favorites: save places/activities to a user's list (max 500 per user).
 * Collections: organize favorites into named groups.
 * Junction table favorite_collections links favorites to collections.
 *
 * All routes require authentication via app.requireAuth preHandler.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import {
  favoriteCreationSchema,
  favoriteUpdateSchema,
  collectionCreationSchema,
  collectionUpdateSchema,
  LIMITS,
} from '@travel-companion/shared';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Route Options ───────────────────────────────────────────────────────────

export interface FavoriteRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register all favorites and collections routes on the Fastify instance.
 */
export async function registerFavoriteRoutes(
  app: FastifyInstance,
  options: FavoriteRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORITES ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── POST /api/favorites ─────────────────────────────────────────────────

  app.post(
    '/api/favorites',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = favoriteCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Favorite validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const userId = request.user!.userId;
      const { name, trip_id, category, place_id, location_lat, location_lng, rating, notes } =
        parseResult.data;

      // trip_id is required — must be provided as a UUID or explicitly null
      if (trip_id === undefined) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'trip_id is required. Provide a trip UUID or null for unassigned.',
        });
      }

      try {
        // Check favorites count limit
        const countResult = await db
          .selectFrom('favorites')
          .select(db.fn.countAll().as('count'))
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow();

        const currentCount = Number(countResult.count);
        if (currentCount >= LIMITS.MAX_FAVORITES_PER_USER) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'LIMIT_REACHED',
            message: `Maximum of ${LIMITS.MAX_FAVORITES_PER_USER} favorites per user reached`,
          });
        }

        // Insert the favorite
        const favorite = await db
          .insertInto('favorites')
          .values({
            user_id: userId,
            trip_id: trip_id,
            name,
            category: category ?? null,
            place_id: place_id ?? null,
            location_lat: location_lat != null ? String(location_lat) : null,
            location_lng: location_lng != null ? String(location_lng) : null,
            rating: rating != null ? String(rating) : null,
            notes: notes ?? null,
            added_by: userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(201).send(favorite);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create favorite');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the favorite',
        });
      }
    },
  );

  // ─── GET /api/favorites ──────────────────────────────────────────────────

  app.get(
    '/api/favorites',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Querystring: { trip_id?: string; collection_id?: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.userId;
      const { trip_id, collection_id } = request.query;

      try {
        let query = db
          .selectFrom('favorites')
          .selectAll()
          .where('user_id', '=', userId);

        if (trip_id) {
          if (trip_id === 'null' || trip_id === 'unassigned') {
            query = query.where('trip_id', 'is', null);
          } else {
            query = query.where('trip_id', '=', trip_id);
          }
        }

        if (collection_id) {
          // Filter by collection via junction table
          const favoriteIds = await db
            .selectFrom('favorite_collections')
            .select('favorite_id')
            .where('collection_id', '=', collection_id)
            .execute();

          const ids = favoriteIds.map((fc) => fc.favorite_id);
          if (ids.length === 0) {
            return reply.status(200).send({ favorites: [] });
          }
          query = query.where('id', 'in', ids);
        }

        const favorites = await query.orderBy('created_at', 'desc').execute();

        return reply.status(200).send({ favorites });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list favorites');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing favorites',
        });
      }
    },
  );

  // ─── GET /api/favorites/:id ──────────────────────────────────────────────

  app.get(
    '/api/favorites/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { id } = request.params;

      try {
        const favorite = await db
          .selectFrom('favorites')
          .selectAll()
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!favorite) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite not found',
          });
        }

        return reply.status(200).send(favorite);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to get favorite');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching the favorite',
        });
      }
    },
  );

  // ─── PUT /api/favorites/:id ──────────────────────────────────────────────

  app.put(
    '/api/favorites/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { id } = request.params;

      const parseResult = favoriteUpdateSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Favorite update validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      try {
        // Verify ownership
        const existing = await db
          .selectFrom('favorites')
          .select('id')
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!existing) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite not found',
          });
        }

        const data = parseResult.data;
        const updateFields: Record<string, unknown> = {};

        if (data.notes !== undefined) updateFields.notes = data.notes;
        if (data.trip_id !== undefined) updateFields.trip_id = data.trip_id;
        if (data.name !== undefined) updateFields.name = data.name;
        if (data.category !== undefined) updateFields.category = data.category;
        if (data.rating !== undefined) updateFields.rating = data.rating != null ? String(data.rating) : null;

        if (Object.keys(updateFields).length === 0) {
          // Nothing to update, return current
          const current = await db
            .selectFrom('favorites')
            .selectAll()
            .where('id', '=', id)
            .executeTakeFirstOrThrow();
          return reply.status(200).send(current);
        }

        const updated = await db
          .updateTable('favorites')
          .set(updateFields)
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(200).send(updated);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update favorite');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the favorite',
        });
      }
    },
  );

  // ─── DELETE /api/favorites/:id ───────────────────────────────────────────

  app.delete(
    '/api/favorites/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { id } = request.params;

      try {
        const result = await db
          .deleteFrom('favorites')
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (result.numDeletedRows === 0n) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite not found',
          });
        }

        return reply.status(204).send();
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete favorite');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the favorite',
        });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLECTIONS ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── POST /api/collections ───────────────────────────────────────────────

  app.post(
    '/api/collections',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = collectionCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Collection validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const userId = request.user!.userId;
      const { name } = parseResult.data;

      try {
        const collection = await db
          .insertInto('collections')
          .values({
            user_id: userId,
            name,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(201).send(collection);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create collection');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the collection',
        });
      }
    },
  );

  // ─── GET /api/collections ────────────────────────────────────────────────

  app.get(
    '/api/collections',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.userId;

      try {
        const collections = await db
          .selectFrom('collections')
          .selectAll()
          .where('user_id', '=', userId)
          .orderBy('created_at', 'desc')
          .execute();

        return reply.status(200).send({ collections });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list collections');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing collections',
        });
      }
    },
  );

  // ─── PUT /api/collections/:id ────────────────────────────────────────────

  app.put(
    '/api/collections/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { id } = request.params;

      const parseResult = collectionUpdateSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Collection update validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { name } = parseResult.data;

      try {
        const existing = await db
          .selectFrom('collections')
          .select('id')
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!existing) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Collection not found',
          });
        }

        const updated = await db
          .updateTable('collections')
          .set({ name })
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(200).send(updated);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update collection');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the collection',
        });
      }
    },
  );

  // ─── DELETE /api/collections/:id ─────────────────────────────────────────
  // Deleting a collection keeps favorites (junction records cascade via ON DELETE CASCADE)

  app.delete(
    '/api/collections/:id',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { id } = request.params;

      try {
        const result = await db
          .deleteFrom('collections')
          .where('id', '=', id)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (result.numDeletedRows === 0n) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Collection not found',
          });
        }

        return reply.status(204).send();
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete collection');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the collection',
        });
      }
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORITE-COLLECTION ASSOCIATION ROUTES
  // ═══════════════════════════════════════════════════════════════════════════

  // ─── POST /api/favorites/:id/collections/:collectionId ───────────────────
  // Add a favorite to a collection

  app.post(
    '/api/favorites/:id/collections/:collectionId',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string; collectionId: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.userId;
      const { id: favoriteId, collectionId } = request.params;

      try {
        // Verify ownership of both favorite and collection
        const favorite = await db
          .selectFrom('favorites')
          .select('id')
          .where('id', '=', favoriteId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!favorite) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite not found',
          });
        }

        const collection = await db
          .selectFrom('collections')
          .select('id')
          .where('id', '=', collectionId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!collection) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Collection not found',
          });
        }

        // Check if already exists
        const existing = await db
          .selectFrom('favorite_collections')
          .select('favorite_id')
          .where('favorite_id', '=', favoriteId)
          .where('collection_id', '=', collectionId)
          .executeTakeFirst();

        if (existing) {
          return reply.status(200).send({
            message: 'Favorite is already in this collection',
            favorite_id: favoriteId,
            collection_id: collectionId,
          });
        }

        await db
          .insertInto('favorite_collections')
          .values({
            favorite_id: favoriteId,
            collection_id: collectionId,
          })
          .execute();

        return reply.status(201).send({
          message: 'Favorite added to collection',
          favorite_id: favoriteId,
          collection_id: collectionId,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to add favorite to collection');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while adding favorite to collection',
        });
      }
    },
  );

  // ─── DELETE /api/favorites/:id/collections/:collectionId ─────────────────
  // Remove a favorite from a collection (keeps the favorite in user's list)

  app.delete(
    '/api/favorites/:id/collections/:collectionId',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: { id: string; collectionId: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.userId;
      const { id: favoriteId, collectionId } = request.params;

      try {
        // Verify ownership of the favorite
        const favorite = await db
          .selectFrom('favorites')
          .select('id')
          .where('id', '=', favoriteId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!favorite) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite not found',
          });
        }

        const result = await db
          .deleteFrom('favorite_collections')
          .where('favorite_id', '=', favoriteId)
          .where('collection_id', '=', collectionId)
          .executeTakeFirst();

        if (result.numDeletedRows === 0n) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Favorite is not in this collection',
          });
        }

        return reply.status(204).send();
      } catch (error: unknown) {
        request.log.error(error, 'Failed to remove favorite from collection');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while removing favorite from collection',
        });
      }
    },
  );
}
