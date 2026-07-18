import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { calculateBookingStatus, type BookingStatus } from './bookings.js';

// ─── Unit Tests for calculateBookingStatus ──────────────────────────────────

describe('calculateBookingStatus', () => {
  it('returns "upcoming" when current time is before flight departure', () => {
    const now = new Date('2024-06-01T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'flight',
        flight_details: {
          departure_time: '2024-06-10T14:00:00Z',
          arrival_time: '2024-06-10T18:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('upcoming');
  });

  it('returns "in-progress" when current time is between flight departure and arrival', () => {
    const now = new Date('2024-06-10T16:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'flight',
        flight_details: {
          departure_time: '2024-06-10T14:00:00Z',
          arrival_time: '2024-06-10T18:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('in-progress');
  });

  it('returns "completed" when current time is after flight arrival', () => {
    const now = new Date('2024-06-11T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'flight',
        flight_details: {
          departure_time: '2024-06-10T14:00:00Z',
          arrival_time: '2024-06-10T18:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('completed');
  });

  it('returns "upcoming" when current time is before hotel checkin_date', () => {
    const now = new Date('2024-06-01T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'hotel',
        hotel_details: {
          checkin_date: '2024-06-10',
          checkout_date: '2024-06-15',
        },
      },
      now,
    );
    expect(status).toBe('upcoming');
  });

  it('returns "in-progress" when current time is within hotel stay', () => {
    const now = new Date('2024-06-12T14:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'hotel',
        hotel_details: {
          checkin_date: '2024-06-10',
          checkout_date: '2024-06-15',
        },
      },
      now,
    );
    expect(status).toBe('in-progress');
  });

  it('returns "completed" when current time is after hotel checkout', () => {
    const now = new Date('2024-06-16T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'hotel',
        hotel_details: {
          checkin_date: '2024-06-10',
          checkout_date: '2024-06-15',
        },
      },
      now,
    );
    expect(status).toBe('completed');
  });

  it('returns "upcoming" when current time is before car rental pickup', () => {
    const now = new Date('2024-06-01T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'car_rental',
        car_rental_details: {
          pickup_time: '2024-06-10T09:00:00Z',
          return_time: '2024-06-12T09:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('upcoming');
  });

  it('returns "in-progress" when current time is within car rental period', () => {
    const now = new Date('2024-06-11T12:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'car_rental',
        car_rental_details: {
          pickup_time: '2024-06-10T09:00:00Z',
          return_time: '2024-06-12T09:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('in-progress');
  });

  it('returns "completed" when current time is after car rental return', () => {
    const now = new Date('2024-06-13T10:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'car_rental',
        car_rental_details: {
          pickup_time: '2024-06-10T09:00:00Z',
          return_time: '2024-06-12T09:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('completed');
  });

  it('returns "upcoming" when booking has no dates', () => {
    const status = calculateBookingStatus({
      type: 'flight',
      flight_details: { departure_time: null, arrival_time: null },
    });
    expect(status).toBe('upcoming');
  });

  it('returns "in-progress" at exact start time boundary', () => {
    const now = new Date('2024-06-10T14:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'flight',
        flight_details: {
          departure_time: '2024-06-10T14:00:00Z',
          arrival_time: '2024-06-10T18:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('in-progress');
  });

  it('returns "in-progress" at exact end time boundary', () => {
    const now = new Date('2024-06-10T18:00:00Z');
    const status = calculateBookingStatus(
      {
        type: 'flight',
        flight_details: {
          departure_time: '2024-06-10T14:00:00Z',
          arrival_time: '2024-06-10T18:00:00Z',
        },
      },
      now,
    );
    expect(status).toBe('in-progress');
  });
});

// ─── Integration Tests for Booking Routes ────────────────────────────────────

describe('Booking Routes', () => {
  let app: FastifyInstance;

  // A chainable mock DB builder that works for the booking route queries
  function createBookingMockDb() {
    // Track state for test manipulation
    const state = {
      bookings: [] as Record<string, unknown>[],
      flightDetails: [] as Record<string, unknown>[],
      hotelDetails: [] as Record<string, unknown>[],
      carRentalDetails: [] as Record<string, unknown>[],
    };

    // Build a mock that supports Kysely's fluent chain pattern
    const createChain = (terminalValue: unknown = undefined) => {
      const chain: Record<string, unknown> = {};
      const methods = [
        'selectAll', 'select', 'where', 'orderBy', 'returning', 'returningAll',
        'values', 'set', 'execute', 'executeTakeFirst', 'executeTakeFirstOrThrow',
      ];

      for (const method of methods) {
        if (method === 'execute') {
          chain[method] = vi.fn(() => terminalValue ?? []);
        } else if (method === 'executeTakeFirst') {
          chain[method] = vi.fn(() => terminalValue ?? undefined);
        } else if (method === 'executeTakeFirstOrThrow') {
          chain[method] = vi.fn(() => {
            if (terminalValue === undefined) throw new Error('No result');
            return terminalValue;
          });
        } else {
          chain[method] = vi.fn(() => chain);
        }
      }
      return chain;
    };

    const mockTransaction = vi.fn(async (callback: (trx: unknown) => Promise<unknown>) => {
      // The trx mock supports insertInto and returning chains
      // Track which type is being inserted via the booking values
      let bookingType = 'flight';

      const trx = {
        insertInto: vi.fn((table: string) => {
          if (table === 'bookings') {
            return {
              values: vi.fn((values: Record<string, unknown>) => {
                bookingType = values.type as string;
                return {
                  returning: vi.fn(() => ({
                    executeTakeFirstOrThrow: vi.fn(() => ({
                      id: 'booking-uuid-1',
                      user_id: 'test-user-id',
                      trip_id: values.trip_id ?? null,
                      type: values.type,
                      source: values.source ?? 'manual',
                      source_email_id: values.source_email_id ?? null,
                      checked_in: false,
                      created_at: new Date('2024-01-01'),
                      updated_at: new Date('2024-01-01'),
                    })),
                  })),
                };
              }),
            };
          } else if (table === 'flight_details') {
            return {
              values: vi.fn((values: Record<string, unknown>) => ({
                returning: vi.fn(() => ({
                  executeTakeFirstOrThrow: vi.fn(() => ({
                    booking_id: 'booking-uuid-1',
                    airline: values.airline ?? null,
                    flight_number: values.flight_number ?? null,
                    departure_airport: values.departure_airport ?? null,
                    arrival_airport: values.arrival_airport ?? null,
                    departure_time: values.departure_time ?? null,
                    arrival_time: values.arrival_time ?? null,
                  })),
                })),
              })),
            };
          } else if (table === 'hotel_details') {
            return {
              values: vi.fn((values: Record<string, unknown>) => ({
                returning: vi.fn(() => ({
                  executeTakeFirstOrThrow: vi.fn(() => ({
                    booking_id: 'booking-uuid-1',
                    hotel_name: values.hotel_name ?? null,
                    address: values.address ?? null,
                    checkin_date: values.checkin_date ?? null,
                    checkout_date: values.checkout_date ?? null,
                    confirmation_number: values.confirmation_number ?? null,
                  })),
                })),
              })),
            };
          } else if (table === 'car_rental_details') {
            return {
              values: vi.fn((values: Record<string, unknown>) => ({
                returning: vi.fn(() => ({
                  executeTakeFirstOrThrow: vi.fn(() => ({
                    booking_id: 'booking-uuid-1',
                    company: values.company ?? null,
                    vehicle_type: values.vehicle_type ?? null,
                    pickup_location: values.pickup_location ?? null,
                    return_location: values.return_location ?? null,
                    pickup_time: values.pickup_time ?? null,
                    return_time: values.return_time ?? null,
                    confirmation_number: values.confirmation_number ?? null,
                  })),
                })),
              })),
            };
          }
          return createChain();
        }),
      };

      return callback(trx);
    });

    // Build the main mock db object
    const db = {
      transaction: vi.fn(() => ({
        execute: mockTransaction,
      })),
      selectFrom: vi.fn((table: string) => {
        const chain = createChain();
        // Override where to return different results based on table
        chain.where = vi.fn(() => {
          const subChain = createChain();
          subChain.where = vi.fn(() => subChain);
          subChain.execute = vi.fn(() => state.bookings);
          subChain.executeTakeFirst = vi.fn(() => state.bookings[0] ?? undefined);
          subChain.executeTakeFirstOrThrow = vi.fn(() => {
            if (state.bookings.length === 0) throw new Error('No result');
            return state.bookings[0];
          });
          subChain.selectAll = vi.fn(() => subChain);
          subChain.select = vi.fn(() => subChain);
          return subChain;
        });
        chain.selectAll = vi.fn(() => chain);

        if (table === 'flight_details') {
          chain.where = vi.fn(() => {
            const sub = createChain();
            sub.execute = vi.fn(() => state.flightDetails);
            sub.executeTakeFirst = vi.fn(() => state.flightDetails[0] ?? undefined);
            return sub;
          });
        } else if (table === 'hotel_details') {
          chain.where = vi.fn(() => {
            const sub = createChain();
            sub.execute = vi.fn(() => state.hotelDetails);
            sub.executeTakeFirst = vi.fn(() => state.hotelDetails[0] ?? undefined);
            return sub;
          });
        } else if (table === 'car_rental_details') {
          chain.where = vi.fn(() => {
            const sub = createChain();
            sub.execute = vi.fn(() => state.carRentalDetails);
            sub.executeTakeFirst = vi.fn(() => state.carRentalDetails[0] ?? undefined);
            return sub;
          });
        } else if (table === 'bookings') {
          chain.where = vi.fn(() => {
            const sub = createChain();
            sub.where = vi.fn(() => sub);
            sub.selectAll = vi.fn(() => sub);
            sub.select = vi.fn(() => sub);
            sub.execute = vi.fn(() => state.bookings);
            sub.executeTakeFirst = vi.fn(() => state.bookings[0] ?? undefined);
            sub.executeTakeFirstOrThrow = vi.fn(() => {
              if (state.bookings.length === 0) throw new Error('No result');
              return state.bookings[0];
            });
            return sub;
          });
        }

        return chain;
      }),
      updateTable: vi.fn(() => {
        const chain = createChain();
        chain.set = vi.fn(() => chain);
        chain.where = vi.fn(() => chain);
        chain.execute = vi.fn(() => ({}));
        chain.returningAll = vi.fn(() => chain);
        chain.executeTakeFirstOrThrow = vi.fn(() => state.bookings[0]);
        return chain;
      }),
      deleteFrom: vi.fn(() => {
        const chain = createChain();
        chain.where = vi.fn(() => chain);
        chain.executeTakeFirst = vi.fn(() => ({ numDeletedRows: state.bookings.length > 0 ? 1n : 0n }));
        return chain;
      }),
      insertInto: vi.fn(() => createChain()),
    } as unknown as Kysely<Database>;

    return { db, state, mockTransaction };
  }

  let mockDb: ReturnType<typeof createBookingMockDb>;

  beforeAll(async () => {
    mockDb = createBookingMockDb();

    app = await buildApp({
      logger: false,
      skipRedis: true,
      skipAuth: true,
      skipAuthMiddleware: true,
      db: mockDb.db,
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    mockDb.state.bookings = [];
    mockDb.state.flightDetails = [];
    mockDb.state.hotelDetails = [];
    mockDb.state.carRentalDetails = [];
    vi.clearAllMocks();
  });

  // ─── POST /api/bookings ──────────────────────────────────────────────────

  describe('POST /api/bookings', () => {
    it('creates a flight booking and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          type: 'flight',
          flight_details: {
            airline: 'Delta',
            flight_number: 'DL100',
            departure_airport: 'JFK',
            arrival_airport: 'LAX',
            departure_time: '2024-07-01T14:00:00Z',
            arrival_time: '2024-07-01T20:00:00Z',
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('booking-uuid-1');
      expect(body.type).toBe('flight');
      expect(body.status).toBeDefined();
      expect(body.flight_details).toBeDefined();
    });

    it('creates a hotel booking and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          type: 'hotel',
          hotel_details: {
            hotel_name: 'Grand Hotel',
            address: '123 Main St',
            checkin_date: '2024-07-01',
            checkout_date: '2024-07-05',
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('booking-uuid-1');
      expect(body.type).toBe('hotel');
      expect(body.hotel_details).toBeDefined();
    });

    it('creates a car rental booking and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          type: 'car_rental',
          car_rental_details: {
            company: 'Hertz',
            vehicle_type: 'SUV',
            pickup_location: 'LAX Airport',
            return_location: 'LAX Airport',
            pickup_time: '2024-07-01T10:00:00Z',
            return_time: '2024-07-03T10:00:00Z',
          },
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('booking-uuid-1');
      expect(body.type).toBe('car_rental');
      expect(body.car_rental_details).toBeDefined();
    });

    it('returns 400 for invalid booking type', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          type: 'invalid_type',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when type is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });
  });

  // ─── GET /api/bookings ───────────────────────────────────────────────────

  describe('GET /api/bookings', () => {
    it('returns empty bookings list', async () => {
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bookings).toEqual([]);
    });

    it('returns bookings with computed status', async () => {
      mockDb.state.bookings = [
        {
          id: 'booking-1',
          user_id: 'test-user-id',
          trip_id: null,
          type: 'flight',
          source: 'manual',
          source_email_id: null,
          checked_in: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'booking-1',
          airline: 'Delta',
          flight_number: 'DL100',
          departure_airport: 'JFK',
          arrival_airport: 'LAX',
          departure_time: new Date('2099-07-01T14:00:00Z'),
          arrival_time: new Date('2099-07-01T20:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bookings).toHaveLength(1);
      expect(body.bookings[0].status).toBe('upcoming');
    });

    it('filters bookings by status query param', async () => {
      mockDb.state.bookings = [
        {
          id: 'booking-1',
          user_id: 'test-user-id',
          trip_id: null,
          type: 'flight',
          source: 'manual',
          source_email_id: null,
          checked_in: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'booking-1',
          departure_time: new Date('2020-01-01T14:00:00Z'),
          arrival_time: new Date('2020-01-01T20:00:00Z'),
        },
      ];

      // This booking is completed (in the past), so filtering by upcoming should return empty
      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings?status=upcoming',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.bookings).toHaveLength(0);
    });
  });

  // ─── GET /api/bookings/:bookingId ────────────────────────────────────────

  describe('GET /api/bookings/:bookingId', () => {
    it('returns 404 when booking does not exist', async () => {
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns a booking with details when found', async () => {
      mockDb.state.bookings = [
        {
          id: 'booking-1',
          user_id: 'test-user-id',
          trip_id: null,
          type: 'flight',
          source: 'manual',
          source_email_id: null,
          checked_in: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];
      mockDb.state.flightDetails = [
        {
          booking_id: 'booking-1',
          airline: 'Delta',
          flight_number: 'DL100',
          departure_airport: 'JFK',
          arrival_airport: 'LAX',
          departure_time: new Date('2099-07-01T14:00:00Z'),
          arrival_time: new Date('2099-07-01T20:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/bookings/booking-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.id).toBe('booking-1');
      expect(body.type).toBe('flight');
      expect(body.status).toBe('upcoming');
      expect(body.flight_details).toBeDefined();
    });
  });

  // ─── DELETE /api/bookings/:bookingId ─────────────────────────────────────

  describe('DELETE /api/bookings/:bookingId', () => {
    it('returns 204 on successful deletion', async () => {
      mockDb.state.bookings = [
        {
          id: 'booking-1',
          user_id: 'test-user-id',
          trip_id: null,
          type: 'flight',
          source: 'manual',
          source_email_id: null,
          checked_in: false,
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01'),
        },
      ];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/bookings/booking-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 when booking does not exist', async () => {
      mockDb.state.bookings = [];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/bookings/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
