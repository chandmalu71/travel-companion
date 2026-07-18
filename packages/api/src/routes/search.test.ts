import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { registerSearchRoutes } from './search.js';
import {
  AISearchService,
  type AISearchRequest,
  type AISearchResponse,
  type UserPreferences,
  type TripAccommodation,
} from '../services/ai-search.js';
import { POIService, type POIResult } from '../services/poi.js';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function createMockDb() {
  const trips = new Map<string, { id: string; owner_id: string }>();
  trips.set('trip-1', { id: 'trip-1', owner_id: 'user-1' });

  const userPreferences = new Map<string, { interests: string[]; dietary_preferences: string[]; allergies: string[] }>();
  userPreferences.set('user-1', {
    interests: ['history', 'art'],
    dietary_preferences: ['vegetarian'],
    allergies: [],
  });

  return {
    selectFrom: (table: string) => {
      if (table === 'trips') {
        return {
          select: () => ({
            where: (col: string, op: string, val: string) => ({
              executeTakeFirst: async () => trips.get(val) ?? null,
            }),
          }),
        };
      }
      if (table === 'user_preferences') {
        return {
          select: () => ({
            where: (col: string, op: string, val: string) => ({
              executeTakeFirst: async () => userPreferences.get(val) ?? null,
            }),
          }),
        };
      }
      if (table === 'bookings') {
        return {
          innerJoin: () => ({
            select: () => ({
              where: () => ({
                where: () => ({
                  where: () => ({
                    where: () => ({
                      executeTakeFirst: async () => ({
                        latitude: '48.8566',
                        longitude: '2.3522',
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      // trip_members
      return {
        select: () => ({
          where: () => ({
            where: () => ({
              executeTakeFirst: async () => null,
            }),
          }),
        }),
      };
    },
  } as any;
}

function createMockAISearchService(): AISearchService {
  const mockPOIs: POIResult[] = [
    {
      placeId: 'place1',
      name: 'Italian Trattoria',
      category: 'restaurants',
      rating: 4.5,
      distanceKm: 1.5,
      openingHours: { openNow: true },
      priceLevel: 2,
      location: { lat: 48.857, lng: 2.352 },
    },
    {
      placeId: 'place2',
      name: 'Louvre Museum',
      category: 'museums',
      rating: 4.8,
      distanceKm: 3,
      openingHours: null,
      priceLevel: 2,
      location: { lat: 48.86, lng: 2.34 },
    },
    {
      placeId: 'place3',
      name: 'Luxembourg Gardens',
      category: 'parks',
      rating: 4.3,
      distanceKm: 2,
      openingHours: { openNow: true },
      priceLevel: 0,
      location: { lat: 48.855, lng: 2.35 },
    },
  ];

  const mockPOIService = {
    searchNearby: async () => mockPOIs,
  } as unknown as POIService;

  return new AISearchService({
    poiService: mockPOIService,
  });
}

// ─── App Setup ───────────────────────────────────────────────────────────────

let app: FastifyInstance;

beforeAll(async () => {
  app = Fastify({ logger: false });

  // Decorate with mock config
  app.decorate('config', {
    GOOGLE_PLACES_API_KEY: 'test-key',
  });

  // Mock request.user decorator
  app.decorateRequest('user', undefined);

  // Mock requireAuth that sets user
  app.decorate('requireAuth', async (request: any) => {
    request.user = { userId: 'user-1', email: 'test@example.com' };
  });

  await registerSearchRoutes(app, {
    db: createMockDb(),
    aiSearchService: createMockAISearchService(),
  });

  await app.ready();
});

afterAll(async () => {
  await app.close();
});

// ─── Route Tests ─────────────────────────────────────────────────────────────

describe('POST /api/search', () => {
  it('returns 400 for missing query', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for query shorter than 2 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'a', tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('at least 2 characters');
  });

  it('returns 400 for query longer than 500 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'x'.repeat(501), tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('500 characters');
  });

  it('returns 400 for missing tripId', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'restaurants' },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('tripId');
  });

  it('returns 404 for non-existent trip', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'restaurants', tripId: 'non-existent' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 200 with search results for valid request', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'restaurants near me', tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.results).toBeDefined();
    expect(Array.isArray(body.results)).toBe(true);
    expect(body.results.length).toBeLessThanOrEqual(20);
    expect(body.personalizationApplied).toBeDefined();
    expect(body.suggestBroaden).toBeDefined();
  });

  it('accepts query at exactly 2 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'ab', tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('accepts query at exactly 500 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'x'.repeat(500), tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('accepts optional filters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'things to do',
        tripId: 'trip-1',
        filters: {
          category: ['restaurants'],
          priceRange: [10, 50],
          minRating: 4.0,
          maxDistance: 5,
        },
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('returns 400 for invalid priceRange filter format', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'restaurants',
        tripId: 'trip-1',
        filters: {
          priceRange: [10], // Should be [min, max]
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for invalid minRating (out of range)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'restaurants',
        tripId: 'trip-1',
        filters: {
          minRating: 6, // Max is 5
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for invalid maxDistance (non-positive)', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: {
        query: 'restaurants',
        tripId: 'trip-1',
        filters: {
          maxDistance: -1,
        },
      },
    });

    expect(response.statusCode).toBe(400);
  });

  it('results include required fields', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'restaurants', tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    if (body.results.length > 0) {
      const result = body.results[0];
      expect(result.name).toBeDefined();
      expect(result.description).toBeDefined();
      expect(result.category).toBeDefined();
      expect(result.rating).toBeDefined();
      expect(result.estimatedCost).toBeDefined();
      expect(result.location).toBeDefined();
      expect(result.matchScore).toBeDefined();
    }
  });

  it('descriptions are max 200 characters', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/search',
      payload: { query: 'things to do', tripId: 'trip-1' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    for (const result of body.results) {
      expect(result.description.length).toBeLessThanOrEqual(200);
    }
  });
});
