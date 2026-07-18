/**
 * AI Search routes.
 *
 * POST /api/search — AI-powered activity search with personalization
 *
 * All routes are protected by auth middleware and scoped to the current user.
 * Validates query length (2-500 chars) and applies personalization pipeline.
 *
 * Implements Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type Redis as RedisClient } from 'ioredis';
import {
  AISearchService,
  type AISearchRequest,
  type UserPreferences,
  type TripAccommodation,
} from '../services/ai-search.js';
import { POIService } from '../services/poi.js';

// ─── Route Options ───────────────────────────────────────────────────────────

export interface SearchRoutesOptions {
  db: Kysely<Database>;
  redis?: RedisClient;
  /** Google Places API key */
  apiKey?: string;
  /** Custom AI search service (for testing) */
  aiSearchService?: AISearchService;
}

// ─── Request Body Interface ──────────────────────────────────────────────────

interface SearchRequestBody {
  query: string;
  tripId: string;
  filters?: {
    category?: string[];
    priceRange?: [number, number];
    minRating?: number;
    maxDistance?: number;
  };
}

/**
 * Register AI search routes on the Fastify instance.
 */
export async function registerSearchRoutes(
  app: FastifyInstance,
  options: SearchRoutesOptions,
): Promise<void> {
  const { db } = options;

  // Resolve AI search service: injected (for testing) or constructed
  const aiSearchService =
    options.aiSearchService ??
    new AISearchService({
      poiService: new POIService({
        apiKey: options.apiKey ?? app.config.GOOGLE_PLACES_API_KEY,
      }),
    });

  // ─── POST /api/search ──────────────────────────────────────────────────

  app.post(
    '/api/search',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Body: SearchRequestBody }>,
      reply: FastifyReply,
    ) => {
      const userId = request.user!.userId;
      const body = request.body;

      // ─── Validate request body ───────────────────────────────────────

      if (!body || typeof body !== 'object') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Request body is required',
        });
      }

      const { query, tripId, filters } = body;

      // Validate query
      if (!query || typeof query !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'query is required and must be a string',
        });
      }

      if (query.length < 2) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Query must be at least 2 characters long',
        });
      }

      if (query.length > 500) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Query must not exceed 500 characters',
        });
      }

      // Validate tripId
      if (!tripId || typeof tripId !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'tripId is required',
        });
      }

      // Validate filters if provided
      if (filters) {
        if (filters.category && !Array.isArray(filters.category)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'filters.category must be an array of strings',
          });
        }

        if (filters.priceRange) {
          if (
            !Array.isArray(filters.priceRange) ||
            filters.priceRange.length !== 2 ||
            typeof filters.priceRange[0] !== 'number' ||
            typeof filters.priceRange[1] !== 'number'
          ) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'VALIDATION_ERROR',
              message: 'filters.priceRange must be an array of two numbers [min, max]',
            });
          }
        }

        if (filters.minRating !== undefined && (typeof filters.minRating !== 'number' || filters.minRating < 0 || filters.minRating > 5)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'filters.minRating must be a number between 0 and 5',
          });
        }

        if (filters.maxDistance !== undefined && (typeof filters.maxDistance !== 'number' || filters.maxDistance <= 0)) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'filters.maxDistance must be a positive number',
          });
        }
      }

      // ─── Verify trip access ──────────────────────────────────────────

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

      // ─── Retrieve user preferences ──────────────────────────────────

      let preferences: UserPreferences = {
        interests: [],
        dietaryPreferences: [],
        allergies: [],
      };

      try {
        const userPrefs = await db
          .selectFrom('user_preferences')
          .select(['interests', 'dietary_preferences', 'allergies'])
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (userPrefs) {
          preferences = {
            interests: userPrefs.interests ?? [],
            dietaryPreferences: userPrefs.dietary_preferences ?? [],
            allergies: userPrefs.allergies ?? [],
          };
        }
      } catch (error: unknown) {
        request.log.warn(error, 'Failed to retrieve user preferences, continuing without personalization');
      }

      // ─── Get trip accommodation location ─────────────────────────────

      let accommodation: TripAccommodation | null = null;

      try {
        const hotel = await db
          .selectFrom('bookings')
          .innerJoin('hotel_details', 'hotel_details.booking_id', 'bookings.id')
          .select(['hotel_details.latitude', 'hotel_details.longitude'])
          .where('bookings.trip_id', '=', tripId)
          .where('bookings.type', '=', 'hotel')
          .where('hotel_details.latitude', 'is not', null)
          .where('hotel_details.longitude', 'is not', null)
          .executeTakeFirst();

        if (hotel && hotel.latitude && hotel.longitude) {
          accommodation = {
            latitude: parseFloat(hotel.latitude),
            longitude: parseFloat(hotel.longitude),
          };
        }
      } catch (error: unknown) {
        request.log.warn(error, 'Failed to retrieve accommodation location');
      }

      // ─── Execute AI search ───────────────────────────────────────────

      try {
        const searchRequest: AISearchRequest = {
          query,
          tripId,
          filters,
        };

        const response = await aiSearchService.search(
          searchRequest,
          preferences,
          accommodation,
        );

        return reply.status(200).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'AI search failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Search could not be completed. Please try again.',
        });
      }
    },
  );
}
