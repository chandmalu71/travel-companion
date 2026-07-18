import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerTripRoutes } from './trips.js';
import { registerBookingRoutes } from './bookings.js';

// ─── Test Constants ──────────────────────────────────────────────────────────

const testUserId = 'user-123-uuid';
const otherUserId = 'other-789-uuid';
const testTripId = 'trip-456-uuid';
const testBookingId = 'booking-111-uuid';

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

function createMockBooking(overrides: Record<string, unknown> = {}) {
  return {
    id: testBookingId,
    user_id: testUserId,
    trip_id: testTripId,
    type: 'flight',
    source: 'manual',
    source_email_id: null,
    checked_in: false,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Mock DB Helper ──────────────────────────────────────────────────────────

function createDashboardMockDb() {
  const state = {
    trip: null as Record<string, unknown> | null,
    membership: null as Record<string, unknown> | null,
    bookings: [] as Record<string, unknown>[],
    flightDetails: [] as Record<string, unknown>[],
    hotelDetails: [] as Record<string, unknown>[],
    carRentalDetails: [] as Record<string, unknown>[],
    gapAlerts: [] as Record<string, unknown>[],
    trips: [] as Record<string, unknown>[],
  };

  const createChain = () => {
    const chain: any = {};
    const self = () => chain;
    chain.selectAll = vi.fn(self);
    chain.select = vi.fn(self);
    chain.where = vi.fn(self);
    chain.orderBy = vi.fn(self);
    chain.values = vi.fn(self);
    chain.set = vi.fn(self);
    chain.returning = vi.fn(self);
    chain.returningAll = vi.fn(self);
    chain.execute = vi.fn(() => []);
    chain.executeTakeFirst = vi.fn(() => undefined);
    chain.executeTakeFirstOrThrow = vi.fn(() => {
      throw new Error('No result');
    });
    return chain;
  };

  // Track select calls per table to return appropriate data
  let selectTable = '';
  let whereConditions: Array<{ column: string; value: unknown }> = [];

  const db = {
    selectFrom: vi.fn((table: string) => {
      selectTable = table;
      whereConditions = [];

      const chain: any = {};
      const self = () => chain;
      chain.selectAll = vi.fn(self);
      chain.select = vi.fn(self);
      chain.where = vi.fn((column: string, _op: string, value: unknown) => {
        whereConditions.push({ column, value });
        return chain;
      });
      chain.orderBy = vi.fn(self);
      chain.execute = vi.fn(() => {
        if (selectTable === 'bookings') return state.bookings;
        if (selectTable === 'flight_details') return state.flightDetails;
        if (selectTable === 'hotel_details') return state.hotelDetails;
        if (selectTable === 'car_rental_details') return state.carRentalDetails;
        if (selectTable === 'gap_alerts') return state.gapAlerts;
        if (selectTable === 'trips') return state.trips;
        if (selectTable === 'trip_members') return [];
        return [];
      });
      chain.executeTakeFirst = vi.fn(() => {
        if (selectTable === 'trips') return state.trip;
        if (selectTable === 'trip_members') return state.membership;
        if (selectTable === 'bookings') {
          // For the booking lookup by ID
          const bookingIdCondition = whereConditions.find(c => c.column === 'id');
          if (bookingIdCondition) {
            return state.bookings.find(b => b.id === bookingIdCondition.value) ?? null;
          }
          return state.bookings[0] ?? null;
        }
        if (selectTable === 'flight_details') return state.flightDetails[0] ?? null;
        if (selectTable === 'hotel_details') return state.hotelDetails[0] ?? null;
        if (selectTable === 'car_rental_details') return state.carRentalDetails[0] ?? null;
        return null;
      });
      chain.executeTakeFirstOrThrow = vi.fn(() => {
        const result = chain.executeTakeFirst();
        if (!result) throw new Error('No result');
        return result;
      });
      return chain;
    }),
    updateTable: vi.fn(() => {
      const chain: any = {};
      const self = () => chain;
      chain.set = vi.fn(self);
      chain.where = vi.fn(self);
      chain.returningAll = vi.fn(self);
      chain.execute = vi.fn(() => []);
      chain.executeTakeFirstOrThrow = vi.fn(() => {
        // Return the updated booking
        return { ...state.bookings[0], trip_id: testTripId, updated_at: new Date() };
      });
      return chain;
    }),
    insertInto: vi.fn(() => createChain()),
    deleteFrom: vi.fn(() => {
      const chain: any = {};
      const self = () => chain;
      chain.where = vi.fn(self);
      chain.execute = vi.fn(() => []);
      return chain;
    }),
    transaction: vi.fn(() => ({
      execute: vi.fn(async (cb: (trx: unknown) => Promise<unknown>) => cb(db)),
    })),
  } as unknown as Kysely<Database>;

  return { db, state };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Trip Dashboard & Booking Assignment Routes', () => {
  let app: FastifyInstance;
  let mockDb: ReturnType<typeof createDashboardMockDb>;

  beforeAll(async () => {
    mockDb = createDashboardMockDb();

    app = Fastify({ logger: false });

    // Decorate with user property and mock auth
    app.decorateRequest('user', undefined);
    app.decorate('requireAuth', async (request: any) => {
      request.user = { userId: testUserId, email: 'test@example.com' };
    });

    await registerTripRoutes(app, { db: mockDb.db });
    await registerBookingRoutes(app, { db: mockDb.db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb.state.trip = null;
    mockDb.state.membership = null;
    mockDb.state.bookings = [];
    mockDb.state.flightDetails = [];
    mockDb.state.hotelDetails = [];
    mockDb.state.carRentalDetails = [];
    mockDb.state.gapAlerts = [];
    mockDb.state.trips = [];
  });

  // ─── GET /api/trips/:tripId/dashboard ──────────────────────────────────────

  describe('GET /api/trips/:tripId/dashboard', () => {
    it('returns trip dashboard with all components', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.bookings = [
        createMockBooking({ id: 'b1', type: 'flight' }),
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'b1',
          airline: 'Delta',
          flight_number: 'DL100',
          departure_airport: 'JFK',
          arrival_airport: 'LAX',
          departure_time: new Date('2025-07-02T14:00:00Z'),
          arrival_time: new Date('2025-07-02T20:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.trip).toBeDefined();
      expect(body.trip.id).toBe(testTripId);
      expect(body.bookings).toBeDefined();
      expect(body.bookings).toHaveLength(1);
      expect(body.gapAlerts).toBeDefined();
      expect(body.weatherSummary).toBeDefined();
      expect(body.weatherSummary.available).toBe(false);
      expect(body.expenseSummary).toBeDefined();
    });

    it('returns bookings sorted by earliest date ascending', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.bookings = [
        createMockBooking({ id: 'b1', type: 'flight' }),
        createMockBooking({ id: 'b2', type: 'hotel' }),
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'b1',
          departure_time: new Date('2025-07-05T14:00:00Z'),
          arrival_time: new Date('2025-07-05T20:00:00Z'),
        },
      ];
      mockDb.state.hotelDetails = [
        {
          booking_id: 'b2',
          hotel_name: 'Hotel California',
          checkin_date: '2025-07-02',
          checkout_date: '2025-07-06',
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bookings).toHaveLength(2);
      // Hotel check-in (July 2) should come before flight departure (July 5)
      expect(body.bookings[0].type).toBe('hotel');
      expect(body.bookings[1].type).toBe('flight');
    });

    it('returns non-dismissed gap alerts', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.gapAlerts = [
        {
          id: 'gap-1',
          trip_id: testTripId,
          type: 'missing_accommodation',
          date: '2025-07-03',
          description: 'No hotel booked for July 3',
          suggested_action: 'Book a hotel',
          dismissed: false,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.gapAlerts).toHaveLength(1);
      expect(body.gapAlerts[0].type).toBe('missing_accommodation');
    });

    it('returns empty dashboard when trip has no bookings', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bookings).toEqual([]);
      expect(body.gapAlerts).toEqual([]);
    });

    it('returns 404 for non-existent trip', async () => {
      mockDb.state.trip = null;

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/non-existent-id/dashboard',
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 403 when user has no access to trip', async () => {
      mockDb.state.trip = createMockTrip({ owner_id: otherUserId });
      mockDb.state.membership = null;

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('allows access for trip members', async () => {
      mockDb.state.trip = createMockTrip({ owner_id: otherUserId });
      mockDb.state.membership = { id: 'membership-1' };

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
    });

    it('includes weather and expense summary placeholders', async () => {
      mockDb.state.trip = createMockTrip({
        budget: '5000.00',
        budget_currency: 'USD',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/dashboard`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.weatherSummary.available).toBe(false);
      expect(body.expenseSummary.budget).toEqual({ amount: 5000, currency: 'USD' });
    });
  });

  // ─── POST /api/trips/:tripId/bookings ──────────────────────────────────────

  describe('POST /api/trips/:tripId/bookings', () => {
    it('assigns a booking to a trip', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.bookings = [
        createMockBooking({ id: testBookingId, trip_id: null }),
      ];

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/bookings`,
        payload: { bookingId: testBookingId },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Booking assigned to trip successfully');
      expect(body.booking).toBeDefined();
    });

    it('returns 400 when bookingId is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/bookings`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when trip does not exist', async () => {
      mockDb.state.trip = null;

      const response = await app.inject({
        method: 'POST',
        url: '/api/trips/non-existent-trip/bookings',
        payload: { bookingId: testBookingId },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Trip not found');
    });

    it('returns 403 when user has view-only access', async () => {
      mockDb.state.trip = createMockTrip({ owner_id: otherUserId });
      mockDb.state.membership = { id: 'membership-1', access_level: 'view' };

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/bookings`,
        payload: { bookingId: testBookingId },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('returns 404 when booking does not exist', async () => {
      mockDb.state.trip = createMockTrip();
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/bookings`,
        payload: { bookingId: 'non-existent-booking' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toBe('Booking not found or does not belong to you');
    });

    it('allows edit collaborators to assign bookings', async () => {
      mockDb.state.trip = createMockTrip({ owner_id: otherUserId });
      mockDb.state.membership = { id: 'membership-1', access_level: 'edit' };
      mockDb.state.bookings = [
        createMockBooking({ id: testBookingId, trip_id: null }),
      ];

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/bookings`,
        payload: { bookingId: testBookingId },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ─── GET /api/bookings/suggestions ─────────────────────────────────────────

  describe('GET /api/bookings/suggestions', () => {
    it('returns trip suggestions for a booking with overlapping dates', async () => {
      mockDb.state.bookings = [
        createMockBooking({ id: 'b1', type: 'flight', trip_id: null }),
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'b1',
          departure_time: new Date('2025-07-03T14:00:00Z'),
          arrival_time: new Date('2025-07-03T20:00:00Z'),
          arrival_airport: 'LAX',
        },
      ];
      mockDb.state.trips = [
        createMockTrip({ id: 'trip-1', name: 'LA Trip', start_date: '2025-07-01', end_date: '2025-07-15' }),
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/suggestions?bookingId=b1',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.suggestions).toBeDefined();
      expect(body.suggestions.length).toBeGreaterThan(0);
      expect(body.suggestions[0].tripId).toBe('trip-1');
      expect(body.suggestions[0].matchReason).toContain('overlapping_dates');
    });

    it('returns 400 when bookingId is not provided', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/suggestions',
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 404 when booking does not exist', async () => {
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/suggestions?bookingId=non-existent',
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns empty suggestions when no trips match', async () => {
      mockDb.state.bookings = [
        createMockBooking({ id: 'b1', type: 'flight', trip_id: null }),
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'b1',
          departure_time: new Date('2025-12-01T14:00:00Z'),
          arrival_time: new Date('2025-12-01T20:00:00Z'),
          arrival_airport: 'TYO',
        },
      ];
      mockDb.state.trips = [
        createMockTrip({ id: 'trip-1', name: 'LA Trip', start_date: '2025-07-01', end_date: '2025-07-15' }),
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/suggestions?bookingId=b1',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.suggestions).toEqual([]);
    });

    it('suggests trips with matching destination name', async () => {
      mockDb.state.bookings = [
        createMockBooking({ id: 'b1', type: 'hotel', trip_id: null }),
      ];
      mockDb.state.hotelDetails = [
        {
          booking_id: 'b1',
          hotel_name: 'Hotel Paris',
          checkin_date: '2025-09-01',
          checkout_date: '2025-09-05',
          address: 'Paris',
        },
      ];
      mockDb.state.trips = [
        createMockTrip({ id: 'trip-1', name: 'Paris', start_date: '2025-08-01', end_date: '2025-08-10' }),
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/suggestions?bookingId=b1',
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.suggestions.length).toBeGreaterThan(0);
      expect(body.suggestions[0].matchReason).toContain('matching_destination');
    });
  });
});
