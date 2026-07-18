import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerTripRoutes } from './trips.js';

// ─── Mock Database Helpers ───────────────────────────────────────────────────

const testUserId = 'user-123-uuid';
const testTripId = 'trip-456-uuid';
const otherUserId = 'other-789-uuid';

function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: testTripId,
    owner_id: testUserId,
    name: 'Summer Vacation',
    start_date: '2025-07-01',
    end_date: '2025-07-15',
    budget: null,
    budget_currency: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

/**
 * Creates a mock Kysely DB that supports chained builder methods.
 * Each test configures what the final execute methods return.
 */
function createMockDb() {
  // Track what operations return
  const returns = {
    insertReturningAll: vi.fn(),
    selectAll: vi.fn(),
    selectExecute: vi.fn(),
    selectTakeFirst: vi.fn(),
    updateReturningAll: vi.fn(),
    updateExecute: vi.fn(),
    deleteExecute: vi.fn(),
  };

  const createChainableSelect = () => {
    const chain: any = {};
    chain.selectAll = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.execute = returns.selectExecute;
    chain.executeTakeFirst = returns.selectTakeFirst;
    chain.executeTakeFirstOrThrow = vi.fn(async () => {
      const result = await returns.selectTakeFirst();
      if (!result) throw new Error('No result');
      return result;
    });
    return chain;
  };

  const createChainableInsert = () => {
    const chain: any = {};
    chain.values = vi.fn(() => chain);
    chain.returning = vi.fn(() => chain);
    chain.returningAll = vi.fn(() => chain);
    chain.executeTakeFirstOrThrow = returns.insertReturningAll;
    chain.execute = returns.insertReturningAll;
    return chain;
  };

  const createChainableUpdate = () => {
    const chain: any = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returningAll = vi.fn(() => chain);
    chain.executeTakeFirstOrThrow = returns.updateReturningAll;
    chain.execute = returns.updateExecute;
    return chain;
  };

  const createChainableDelete = () => {
    const chain: any = {};
    chain.where = vi.fn(() => chain);
    chain.execute = returns.deleteExecute;
    return chain;
  };

  const db = {
    selectFrom: vi.fn(() => createChainableSelect()),
    insertInto: vi.fn(() => createChainableInsert()),
    updateTable: vi.fn(() => createChainableUpdate()),
    deleteFrom: vi.fn(() => createChainableDelete()),
  } as unknown as Kysely<Database>;

  return { db, returns };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Trip CRUD Routes', () => {
  let app: FastifyInstance;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeAll(async () => {
    mockDb = createMockDb();

    // Create a minimal Fastify instance with just what we need for trip routes
    app = Fastify({ logger: false });

    // Decorate with user property and a mock requireAuth that injects the test user
    app.decorateRequest('user', undefined);
    app.decorate('requireAuth', async (request: any) => {
      request.user = { userId: testUserId, email: 'test@example.com' };
    });

    // Register trip routes
    await registerTripRoutes(app, { db: mockDb.db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── POST /api/trips ─────────────────────────────────────────────────────

  describe('POST /api/trips', () => {
    it('creates a trip with valid name and dates', async () => {
      const newTrip = createMockTrip();
      mockDb.returns.insertReturningAll.mockResolvedValueOnce(newTrip);

      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: {
          name: 'Summer Vacation',
          start_date: '2025-07-01',
          end_date: '2025-07-15',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.name).toBe('Summer Vacation');
      expect(body.owner_id).toBe(testUserId);
      expect(mockDb.db.insertInto).toHaveBeenCalledWith('trips');
    });

    it('creates a trip with only a name (no dates)', async () => {
      const newTrip = createMockTrip({ start_date: null, end_date: null });
      mockDb.returns.insertReturningAll.mockResolvedValueOnce(newTrip);

      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: { name: 'Weekend Getaway' },
      });

      expect(response.statusCode).toBe(201);
    });

    it('rejects empty trip name', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('rejects trip name exceeding 100 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: { name: 'A'.repeat(101) },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('accepts trip name of exactly 100 characters', async () => {
      const newTrip = createMockTrip({ name: 'A'.repeat(100) });
      mockDb.returns.insertReturningAll.mockResolvedValueOnce(newTrip);

      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: { name: 'A'.repeat(100) },
      });

      expect(response.statusCode).toBe(201);
    });

    it('rejects trip with end_date before start_date', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: {
          name: 'Bad Trip',
          start_date: '2025-07-15',
          end_date: '2025-07-01',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('accepts trip with same start and end date', async () => {
      const newTrip = createMockTrip({ start_date: '2025-07-01', end_date: '2025-07-01' });
      mockDb.returns.insertReturningAll.mockResolvedValueOnce(newTrip);

      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: {
          name: 'Day Trip',
          start_date: '2025-07-01',
          end_date: '2025-07-01',
        },
      });

      expect(response.statusCode).toBe(201);
    });

    it('rejects invalid date format', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/trips',
        payload: {
          name: 'Trip',
          start_date: 'not-a-date',
        },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── GET /api/trips ──────────────────────────────────────────────────────

  describe('GET /api/trips', () => {
    it('returns list of trips', async () => {
      const trips = [
        createMockTrip({ id: 'trip-1', name: 'Trip A', start_date: '2025-06-01' }),
        createMockTrip({ id: 'trip-2', name: 'Trip B', start_date: '2025-08-01' }),
      ];
      mockDb.returns.selectExecute
        .mockResolvedValueOnce(trips) // owned trips
        .mockResolvedValueOnce([]);   // member trip ids

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.trips).toHaveLength(2);
    });

    it('returns empty list when user has no trips', async () => {
      mockDb.returns.selectExecute
        .mockResolvedValueOnce([]) // owned trips
        .mockResolvedValueOnce([]); // member trip ids

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.trips).toEqual([]);
    });

    it('sorts trips: dated first by start_date, undated last', async () => {
      const trips = [
        createMockTrip({ id: 'trip-1', name: 'No Date', start_date: null }),
        createMockTrip({ id: 'trip-2', name: 'Later', start_date: '2025-08-01' }),
        createMockTrip({ id: 'trip-3', name: 'Earlier', start_date: '2025-06-01' }),
      ];
      mockDb.returns.selectExecute
        .mockResolvedValueOnce(trips) // owned trips (DB may not sort correctly, we sort in JS)
        .mockResolvedValueOnce([]); // member trip ids

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      // The route sorts: start_date ASC, NULLS LAST
      expect(body.trips[0].name).toBe('Earlier');
      expect(body.trips[1].name).toBe('Later');
      expect(body.trips[2].name).toBe('No Date');
    });
  });

  // ─── GET /api/trips/:tripId ──────────────────────────────────────────────

  describe('GET /api/trips/:tripId', () => {
    it('returns a trip for the owner', async () => {
      const trip = createMockTrip();
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Summer Vacation');
    });

    it('returns 404 for non-existent trip', async () => {
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 403 when user is not owner and not a member', async () => {
      const trip = createMockTrip({ owner_id: otherUserId });
      mockDb.returns.selectTakeFirst
        .mockResolvedValueOnce(trip)  // trip found
        .mockResolvedValueOnce(undefined); // no membership

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('allows access for trip member', async () => {
      const trip = createMockTrip({ owner_id: otherUserId });
      mockDb.returns.selectTakeFirst
        .mockResolvedValueOnce(trip)  // trip found
        .mockResolvedValueOnce({ id: 'membership-id' }); // membership found

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}`,
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ─── PUT /api/trips/:tripId ──────────────────────────────────────────────

  describe('PUT /api/trips/:tripId', () => {
    it('updates trip name', async () => {
      const trip = createMockTrip();
      const updatedTrip = { ...trip, name: 'Updated Name', updated_at: new Date() };
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip); // trip exists + owner check
      mockDb.returns.updateReturningAll.mockResolvedValueOnce(updatedTrip);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Updated Name');
    });

    it('updates trip dates', async () => {
      const trip = createMockTrip();
      const updatedTrip = { ...trip, start_date: '2025-08-01', end_date: '2025-08-15' };
      mockDb.returns.selectTakeFirst
        .mockResolvedValueOnce(trip)  // owner check
        .mockResolvedValueOnce(trip); // fetch existing dates
      mockDb.returns.updateReturningAll.mockResolvedValueOnce(updatedTrip);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: {
          start_date: '2025-08-01',
          end_date: '2025-08-15',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.start_date).toBe('2025-08-01');
      expect(body.end_date).toBe('2025-08-15');
    });

    it('rejects update with end_date before start_date', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: {
          start_date: '2025-08-15',
          end_date: '2025-08-01',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 404 for non-existent trip', async () => {
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'PUT',
        url: '/api/trips/non-existent-id',
        payload: { name: 'Nope' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 403 when non-owner tries to update', async () => {
      const trip = createMockTrip({ owner_id: otherUserId });
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: { name: 'Hacked' },
      });

      expect(response.statusCode).toBe(403);
    });

    it('rejects invalid name (too long)', async () => {
      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: { name: 'X'.repeat(101) },
      });

      expect(response.statusCode).toBe(400);
    });

    it('allows clearing dates with null', async () => {
      const trip = createMockTrip();
      const updatedTrip = { ...trip, start_date: null, end_date: null };
      mockDb.returns.selectTakeFirst
        .mockResolvedValueOnce(trip)  // owner check
        .mockResolvedValueOnce(trip); // existing dates
      mockDb.returns.updateReturningAll.mockResolvedValueOnce(updatedTrip);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}`,
        payload: { start_date: null, end_date: null },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.start_date).toBeNull();
      expect(body.end_date).toBeNull();
    });
  });

  // ─── DELETE /api/trips/:tripId ───────────────────────────────────────────

  describe('DELETE /api/trips/:tripId', () => {
    it('deletes a trip and returns success', async () => {
      const trip = createMockTrip();
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip);
      mockDb.returns.updateExecute.mockResolvedValue([]); // unassign bookings & favorites
      mockDb.returns.deleteExecute.mockResolvedValueOnce([]);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.tripId).toBe(testTripId);
      expect(body.message).toBe('Trip deleted successfully');
    });

    it('unassigns bookings before deleting trip', async () => {
      const trip = createMockTrip();
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip);
      mockDb.returns.updateExecute.mockResolvedValue([]);
      mockDb.returns.deleteExecute.mockResolvedValueOnce([]);

      await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}`,
      });

      // Verify updateTable was called for bookings and favorites
      expect(mockDb.db.updateTable).toHaveBeenCalledWith('bookings');
      expect(mockDb.db.updateTable).toHaveBeenCalledWith('favorites');
    });

    it('returns 404 for non-existent trip', async () => {
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/trips/non-existent-id',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 403 when non-owner tries to delete', async () => {
      const trip = createMockTrip({ owner_id: otherUserId });
      mockDb.returns.selectTakeFirst.mockResolvedValueOnce(trip);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}`,
      });

      expect(response.statusCode).toBe(403);
    });
  });
});
