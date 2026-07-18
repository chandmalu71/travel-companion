/**
 * POI (Points of Interest) routes.
 *
 * GET /api/trips/:tripId/pois — Search for nearby points of interest
 *
 * All routes are protected by auth middleware and scoped to the current user.
 * Results are cached in Redis with 24-hour TTL.
 *
 * Implements Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type Redis as RedisClient } from 'ioredis';
import {
  POIService,
  POIApiError,
  buildCacheKey,
  POI_CACHE_TTL,
  type POISearchParams,
  type POIResult,
} from '../services/poi.js';

// ─── Request Interfaces ──────────────────────────────────────────────────────

interface POIQuerystring {
  latitude?: string;
  longitude?: string;
  radius?: string;
  category?: string;
  limit?: string;
}

interface TripParams {
  tripId: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface POIRoutesOptions {
  db: Kysely<Database>;
  redis?: RedisClient;
  /** Google Places API key */
  apiKey?: string;
  /** Custom POI service (for testing) */
  poiService?: POIService;
}

const VALID_CATEGORIES = ['restaurants', 'museums', 'parks', 'landmarks', 'entertainment'] as const;

/**
 * Register POI routes on the Fastify instance.
 */
export async function registerPOIRoutes(
  app: FastifyInstance,
  options: POIRoutesOptions,
): Promise<void> {
  const { db } = options;

  // Resolve POI service: injected (for testing) or constructed from API key
  const poiService =
    options.poiService ??
    new POIService({ apiKey: options.apiKey ?? app.config.GOOGLE_PLACES_API_KEY });

  // Resolve Redis client
  const redis = options.redis ?? (app as unknown as { redis?: RedisClient }).redis;

  // ─── GET /api/trips/:tripId/pois ───────────────────────────────────────

  app.get(
    '/api/trips/:tripId/pois',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Querystring: POIQuerystring }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;
      const query = request.query;

      // ─── Validate trip access ────────────────────────────────────────

      try {
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

        // Check access: owner or member
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
      } catch (error: unknown) {
        request.log.error(error, 'Failed to verify trip access');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred',
        });
      }

      // ─── Validate query parameters ──────────────────────────────────

      const latitude = parseFloat(query.latitude ?? '');
      const longitude = parseFloat(query.longitude ?? '');

      if (isNaN(latitude) || isNaN(longitude)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'latitude and longitude are required and must be valid numbers',
        });
      }

      if (latitude < -90 || latitude > 90) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'latitude must be between -90 and 90',
        });
      }

      if (longitude < -180 || longitude > 180) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'longitude must be between -180 and 180',
        });
      }

      // Parse and validate radius (1-50 km, default 5)
      const radiusStr = query.radius;
      let radius = 5; // default
      if (radiusStr !== undefined && radiusStr !== '') {
        radius = parseFloat(radiusStr);
        if (isNaN(radius) || radius < 1 || radius > 50) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'radius must be between 1 and 50 km',
          });
        }
      }

      // Validate category
      const category = query.category as POISearchParams['category'] | undefined;
      if (category && !VALID_CATEGORIES.includes(category as (typeof VALID_CATEGORIES)[number])) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `category must be one of: ${VALID_CATEGORIES.join(', ')}`,
        });
      }

      // Parse and validate limit (max 20)
      let limit = 20;
      if (query.limit !== undefined && query.limit !== '') {
        limit = parseInt(query.limit, 10);
        if (isNaN(limit) || limit < 1) {
          limit = 20;
        } else {
          limit = Math.min(limit, 20);
        }
      }

      // ─── Build search params ─────────────────────────────────────────

      const searchParams: POISearchParams = {
        latitude,
        longitude,
        radius,
        category,
        limit,
      };

      // ─── Check Redis cache ───────────────────────────────────────────

      const cacheKey = buildCacheKey(searchParams);
      let cachedResults: POIResult[] | null = null;

      if (redis) {
        try {
          const cached = await redis.get(cacheKey);
          if (cached) {
            cachedResults = JSON.parse(cached) as POIResult[];
          }
        } catch (cacheError: unknown) {
          request.log.warn(cacheError, 'Redis cache read failed, proceeding without cache');
        }
      }

      if (cachedResults) {
        // Apply limit to cached results (in case limit changed)
        const limited = cachedResults.slice(0, limit);
        return reply.status(200).send({
          results: limited,
          total: limited.length,
          cached: true,
        });
      }

      // ─── Call Google Places API ──────────────────────────────────────

      try {
        const results = await poiService.searchNearby(searchParams);

        // Cache results in Redis
        if (redis && results.length > 0) {
          try {
            await redis.setex(cacheKey, POI_CACHE_TTL, JSON.stringify(results));
          } catch (cacheError: unknown) {
            request.log.warn(cacheError, 'Redis cache write failed');
          }
        }

        // Handle no results (Req 5.7)
        if (results.length === 0) {
          return reply.status(200).send({
            results: [],
            total: 0,
            cached: false,
            message: 'No points of interest found within the specified radius. Try increasing the search radius.',
          });
        }

        return reply.status(200).send({
          results,
          total: results.length,
          cached: false,
        });
      } catch (error: unknown) {
        // Handle Google Places API errors (Req 5.6)
        if (error instanceof POIApiError) {
          request.log.error(error, 'Google Places API error');
          return reply.status(502).send({
            statusCode: 502,
            error: 'EXTERNAL_SERVICE_ERROR',
            message: 'Points of interest cannot be loaded at this time. Please try again later.',
            retryable: error.retryable,
          });
        }

        request.log.error(error, 'Unexpected error in POI search');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while searching for points of interest',
        });
      }
    },
  );
}
