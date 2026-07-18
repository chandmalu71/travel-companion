import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerTimelineRoutes } from './timeline.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const testUserId = 'user-123-uuid';
const testTripId = 'trip-456-uuid';
const testEventId = 'event-789-uuid';

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

function createMockTimelineEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: testEventId,
    trip_id: testTripId,
    title: 'Visit Museum',
    event_time: new Date('2025-07-05T10:00:00.000Z'),
    all_day: false,
    location: 'Downtown Museum',
    notes: 'Remember to book tickets',
    event_type: 'custom',
    reference_id: null,
    added_by: testUserId,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Mock DB Factory ─────────────────────────────────────────────────────────

function createMockDb() {
  const selectTakeFirst = vi.fn();
  const selectExecute = vi.fn(() => []);
  const insertReturningAll = vi.fn();
  const updateReturningAll = vi.fn();
  const deleteExecute = vi.fn();

  const createChainableSelect = () => {
    const chain: any = {};
    chain.selectAll = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.execute = selectExecute;
    chain.executeTakeFirst = selectTakeFirst;
    chain.executeTakeFirstOrThrow = vi.fn(async () => {
      const result = await selectTakeFirst();
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
    chain.executeTakeFirstOrThrow = insertReturningAll;
    chain.execute = insertReturningAll;
    return chain;
  };

  const createChainableUpdate = () => {
    const chain: any = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.returningAll = vi.fn(() => chain);
    chain.executeTakeFirstOrThrow = updateReturningAll;
    chain.execute = vi.fn();
    return chain;
  };

  const createChainableDelete = () => {
    const chain: any = {};
    chain.where = vi.fn(() => chain);
    chain.execute = deleteExecute;
    chain.executeTakeFirst = vi.fn(() => ({ numDeletedRows: 1n }));
    return chain;
  };

  const db = {
    selectFrom: vi.fn(() => createChainableSelect()),
    insertInto: vi.fn(() => createChainableInsert()),
    updateTable: vi.fn(() => createChainableUpdate()),
    deleteFrom: vi.fn(() => createChainableDelete()),
  } as unknown as Kysely<Database>;

  return {
    db,
    mocks: {
      selectTakeFirst,
      selectExecute,
      insertReturningAll,
      updateReturningAll,
      deleteExecute,
    },
  };
}

// ─── App Setup ───────────────────────────────────────────────────────────────

function buildTestApp(db: Kysely<Database>) {
  const app = Fastify({ logger: false });

  // Mock auth middleware
  app.decorate('requireAuth', async (request: any) => {
    request.user = { userId: testUserId };
  });

  registerTimelineRoutes(app, { db });
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Timeline Routes', () => {
  // ─── GET /api/trips/:tripId/timeline ─────────────────────────────────────

  describe('GET /api/trips/:tripId/timeline', () => {
    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline`,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');

      await app.close();
    });

    it('returns 403 when user does not have access', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip({ owner_id: 'other-user' }))
        .mockResolvedValueOnce(undefined); // no membership

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline`,
      });

      expect(response.statusCode).toBe(403);

      await app.close();
    });

    it('returns detailed timeline view with events grouped by day', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());

      const customEvent = createMockTimelineEvent();
      mocks.selectExecute
        .mockResolvedValueOnce([customEvent]) // timeline_events
        .mockResolvedValueOnce([]) // bookings (empty -> no detail queries)
        .mockResolvedValueOnce([]); // favorites

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.view).toBe('detailed');
      expect(body.days).toBeDefined();
      expect(Array.isArray(body.days)).toBe(true);
      expect(body.days.length).toBeGreaterThan(0);
      expect(body.days[0].date).toBe('2025-07-05');
      expect(body.days[0].events[0].title).toBe('Visit Museum');

      await app.close();
    });

    it('returns overview timeline view with counts and time ranges', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());

      const event1 = createMockTimelineEvent({ event_time: new Date('2025-07-05T10:00:00.000Z') });
      const event2 = createMockTimelineEvent({
        id: 'event-2',
        title: 'Lunch',
        event_time: new Date('2025-07-05T12:30:00.000Z'),
      });

      mocks.selectExecute
        .mockResolvedValueOnce([event1, event2]) // timeline_events
        .mockResolvedValueOnce([]) // bookings (empty)
        .mockResolvedValueOnce([]); // favorites

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline?view=overview`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.view).toBe('overview');
      expect(body.days[0].count).toBe(2);
      expect(body.days[0].titles).toContain('Visit Museum');
      expect(body.days[0].titles).toContain('Lunch');
      expect(body.days[0].time_range.earliest).toBeDefined();
      expect(body.days[0].time_range.latest).toBeDefined();

      await app.close();
    });

    it('includes generated booking events on the timeline', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());

      const bookingId = 'booking-1';
      const booking = {
        id: bookingId,
        user_id: testUserId,
        trip_id: testTripId,
        type: 'flight',
        source: 'manual',
        source_email_id: null,
        checked_in: false,
        created_at: new Date('2025-01-01'),
        updated_at: new Date('2025-01-01'),
      };

      const flightDetail = {
        booking_id: bookingId,
        airline: 'Delta',
        flight_number: 'DL123',
        departure_airport: 'JFK',
        arrival_airport: 'LAX',
        departure_time: new Date('2025-07-01T08:00:00.000Z'),
        arrival_time: new Date('2025-07-01T11:00:00.000Z'),
        departure_lat: null,
        departure_lng: null,
        arrival_lat: null,
        arrival_lng: null,
        checkin_window_opens: null,
        checkin_window_closes: null,
      };

      mocks.selectExecute
        .mockResolvedValueOnce([]) // timeline_events
        .mockResolvedValueOnce([booking]) // bookings
        .mockResolvedValueOnce([flightDetail]) // flight_details
        .mockResolvedValueOnce([]) // hotel_details
        .mockResolvedValueOnce([]) // car_rental_details
        .mockResolvedValueOnce([]); // favorites

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.days.length).toBeGreaterThan(0);

      const allEvents = body.days.flatMap((d: any) => d.events);
      const departureEvent = allEvents.find((e: any) => e.title.includes('departure'));
      const arrivalEvent = allEvents.find((e: any) => e.title.includes('arrival'));
      expect(departureEvent).toBeDefined();
      expect(departureEvent.event_type).toBe('booking');
      expect(arrivalEvent).toBeDefined();
      expect(arrivalEvent.event_type).toBe('booking');

      await app.close();
    });

    it('includes favorites as all-day events', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());

      const favorite = {
        id: 'fav-1',
        user_id: testUserId,
        trip_id: testTripId,
        name: 'Eiffel Tower',
        category: 'landmarks',
        place_id: null,
        location_lat: '48.8584',
        location_lng: '2.2945',
        rating: '4.5',
        notes: 'Must visit!',
        added_by: testUserId,
        created_at: new Date('2025-01-01'),
      };

      mocks.selectExecute
        .mockResolvedValueOnce([]) // timeline_events
        .mockResolvedValueOnce([]) // bookings (empty)
        .mockResolvedValueOnce([favorite]); // favorites

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/timeline`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      const allEvents = body.days.flatMap((d: any) => d.events);
      const favEvent = allEvents.find((e: any) => e.event_type === 'favorite');
      expect(favEvent).toBeDefined();
      expect(favEvent.title).toBe('Eiffel Tower');
      expect(favEvent.all_day).toBe(true);

      await app.close();
    });
  });

  // ─── POST /api/trips/:tripId/events ──────────────────────────────────────

  describe('POST /api/trips/:tripId/events', () => {
    it('creates a custom event successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());
      mocks.insertReturningAll.mockResolvedValue(createMockTimelineEvent());

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'Visit Museum',
          event_time: '2025-07-05T10:00:00.000Z',
          location: 'Downtown Museum',
          notes: 'Remember to book tickets',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.title).toBe('Visit Museum');
      expect(body.event_type).toBe('custom');

      await app.close();
    });

    it('rejects event with missing title', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          event_time: '2025-07-05T10:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('rejects event with title exceeding 100 chars', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'A'.repeat(101),
          event_time: '2025-07-05T10:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('rejects non-all-day event without event_time', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'No time event',
          all_day: false,
        },
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('allows all-day event without event_time', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());
      mocks.insertReturningAll.mockResolvedValue(
        createMockTimelineEvent({ all_day: true, event_time: null }),
      );

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'Free Day',
          all_day: true,
        },
      });

      expect(response.statusCode).toBe(201);

      await app.close();
    });

    it('rejects event with notes exceeding 500 chars', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'Test Event',
          event_time: '2025-07-05T10:00:00.000Z',
          notes: 'X'.repeat(501),
        },
      });

      expect(response.statusCode).toBe(400);

      await app.close();
    });

    it('rejects event outside trip date range', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(createMockTrip());

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'Too Late Event',
          event_time: '2025-08-01T10:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('trip date range');

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/events`,
        payload: {
          title: 'Test Event',
          event_time: '2025-07-05T10:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });
  });

  // ─── PUT /api/trips/:tripId/events/:eventId ──────────────────────────────

  describe('PUT /api/trips/:tripId/events/:eventId', () => {
    it('updates a custom event successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const event = createMockTimelineEvent();
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip lookup
        .mockResolvedValueOnce(event); // event lookup

      const updatedEvent = { ...event, title: 'Updated Museum Visit' };
      mocks.updateReturningAll.mockResolvedValue(updatedEvent);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
        payload: {
          title: 'Updated Museum Visit',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.title).toBe('Updated Museum Visit');

      await app.close();
    });

    it('rejects editing a non-custom event', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const bookingEvent = createMockTimelineEvent({ event_type: 'booking' });
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(bookingEvent);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
        payload: {
          title: 'Cannot edit this',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.message).toContain('Only custom events');

      await app.close();
    });

    it('returns 404 for non-existent event', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(undefined); // event not found

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
        payload: {
          title: 'Updated',
        },
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('rejects update with event_time outside trip date range', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const event = createMockTimelineEvent();
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(event);

      const response = await app.inject({
        method: 'PUT',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
        payload: {
          event_time: '2025-12-01T10:00:00.000Z',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('trip date range');

      await app.close();
    });
  });

  // ─── DELETE /api/trips/:tripId/events/:eventId ───────────────────────────

  describe('DELETE /api/trips/:tripId/events/:eventId', () => {
    it('deletes a custom event successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const event = createMockTimelineEvent();
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip lookup
        .mockResolvedValueOnce(event); // event lookup

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
      });

      expect(response.statusCode).toBe(204);

      await app.close();
    });

    it('rejects deleting a non-custom event', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const bookingEvent = createMockTimelineEvent({ event_type: 'booking' });
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(bookingEvent);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.message).toContain('Only custom events');

      await app.close();
    });

    it('returns 404 for non-existent event', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/events/${testEventId}`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });
  });
});
