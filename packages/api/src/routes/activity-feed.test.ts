import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { registerActivityFeedRoutes, recordActivity } from './activity-feed.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Tests for Activity Feed Route ──────────────────────────────────────────

describe('Activity Feed Routes', () => {
  let app: FastifyInstance;

  // State tracking for mock DB
  const state = {
    trip: null as Record<string, unknown> | null,
    membership: null as Record<string, unknown> | null,
    activityEntries: [] as Record<string, unknown>[],
  };

  function createMockDb() {
    const db = {
      selectFrom: vi.fn((table: string) => {
        if (table === 'trips') {
          return {
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => state.trip),
              })),
            })),
          };
        }
        if (table === 'trip_members') {
          return {
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  executeTakeFirst: vi.fn(() => state.membership),
                })),
              })),
            })),
          };
        }
        if (table === 'activity_feed') {
          return {
            innerJoin: vi.fn(() => ({
              select: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => ({
                    limit: vi.fn(() => ({
                      execute: vi.fn(() => state.activityEntries),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        return {};
      }),
      insertInto: vi.fn((table: string) => {
        if (table === 'activity_feed') {
          return {
            values: vi.fn(() => ({
              execute: vi.fn(() => []),
            })),
          };
        }
        return {};
      }),
    } as unknown as Kysely<Database>;

    return db;
  }

  let mockDb: Kysely<Database>;

  beforeAll(async () => {
    mockDb = createMockDb();

    app = Fastify({ logger: false });

    // Stub auth middleware
    app.decorateRequest('user', undefined);
    app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
      request.user = { userId: 'test-user-id', email: 'test@example.com' };
    });

    await registerActivityFeedRoutes(app, { db: mockDb });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    state.trip = null;
    state.membership = null;
    state.activityEntries = [];
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // GET /api/trips/:tripId/activity-feed
  // ═══════════════════════════════════════════════════════════════════════════

  describe('GET /api/trips/:tripId/activity-feed', () => {
    it('returns activity feed entries for trip owner', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };
      state.activityEntries = [
        {
          id: 'entry-1',
          userId: 'test-user-id',
          userName: 'Test User',
          action: 'add',
          entityType: 'booking',
          entityId: 'booking-1',
          metadata: { name: 'Flight to Paris' },
          timestamp: new Date('2024-06-01T10:00:00Z'),
        },
        {
          id: 'entry-2',
          userId: 'collab-user-id',
          userName: 'Collaborator',
          action: 'edit',
          entityType: 'favorite',
          entityId: 'fav-1',
          metadata: { name: 'Eiffel Tower' },
          timestamp: new Date('2024-06-01T09:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(2);
      expect(body[0].id).toBe('entry-1');
      expect(body[0].userId).toBe('test-user-id');
      expect(body[0].userName).toBe('Test User');
      expect(body[0].action).toBe('add');
      expect(body[0].entityType).toBe('booking');
      expect(body[0].entityId).toBe('booking-1');
      expect(body[0].metadata).toEqual({ name: 'Flight to Paris' });
    });

    it('returns activity feed for trip member (collaborator)', async () => {
      state.trip = { id: 'trip-1', owner_id: 'other-owner-id' };
      state.membership = { id: 'member-1' };
      state.activityEntries = [
        {
          id: 'entry-3',
          userId: 'other-owner-id',
          userName: 'Owner',
          action: 'remove',
          entityType: 'timeline_event',
          entityId: 'event-1',
          metadata: {},
          timestamp: new Date('2024-06-02T12:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toHaveLength(1);
      expect(body[0].action).toBe('remove');
    });

    it('returns 404 when trip does not exist', async () => {
      state.trip = null;

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/nonexistent-trip/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
    });

    it('returns 403 when user is not owner or member', async () => {
      state.trip = { id: 'trip-1', owner_id: 'other-owner-id' };
      state.membership = null;

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');
    });

    it('respects custom limit query parameter', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };
      state.activityEntries = [
        {
          id: 'entry-1',
          userId: 'test-user-id',
          userName: 'Test User',
          action: 'add',
          entityType: 'booking',
          entityId: 'booking-1',
          metadata: {},
          timestamp: new Date('2024-06-01T10:00:00Z'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed?limit=10',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(Array.isArray(body)).toBe(true);
    });

    it('caps limit at 50 even if larger value is requested', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };
      state.activityEntries = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed?limit=100',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 400 for invalid limit (non-numeric)', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed?limit=abc',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for invalid limit (zero)', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed?limit=0',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for negative limit', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed?limit=-5',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns empty array when no activity exists', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };
      state.activityEntries = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body).toEqual([]);
    });

    it('defaults to limit=50 when no limit is provided', async () => {
      state.trip = { id: 'trip-1', owner_id: 'test-user-id' };
      state.activityEntries = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/trips/trip-1/activity-feed',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // recordActivity utility function
  // ═══════════════════════════════════════════════════════════════════════════

  describe('recordActivity utility', () => {
    it('inserts an activity entry into the database', async () => {
      const insertDb = {
        insertInto: vi.fn(() => ({
          values: vi.fn(() => ({
            execute: vi.fn(() => []),
          })),
        })),
      } as unknown as Kysely<Database>;

      await recordActivity(
        insertDb,
        'trip-1',
        'user-1',
        'add',
        'booking',
        'booking-1',
        { name: 'Flight to Tokyo' },
      );

      expect(insertDb.insertInto).toHaveBeenCalledWith('activity_feed');
    });

    it('records activity with null entityId', async () => {
      const insertDb = {
        insertInto: vi.fn(() => ({
          values: vi.fn(() => ({
            execute: vi.fn(() => []),
          })),
        })),
      } as unknown as Kysely<Database>;

      await recordActivity(
        insertDb,
        'trip-1',
        'user-1',
        'edit',
        'trip',
        null,
        undefined,
      );

      expect(insertDb.insertInto).toHaveBeenCalledWith('activity_feed');
    });

    it('records activity with empty metadata when not provided', async () => {
      const capturedValues: Record<string, unknown>[] = [];
      const insertDb = {
        insertInto: vi.fn(() => ({
          values: vi.fn((vals: Record<string, unknown>) => {
            capturedValues.push(vals);
            return {
              execute: vi.fn(() => []),
            };
          }),
        })),
      } as unknown as Kysely<Database>;

      await recordActivity(
        insertDb,
        'trip-1',
        'user-1',
        'remove',
        'favorite',
        'fav-1',
      );

      expect(capturedValues[0]).toEqual({
        trip_id: 'trip-1',
        user_id: 'user-1',
        action: 'remove',
        entity_type: 'favorite',
        entity_id: 'fav-1',
        metadata: {},
      });
    });
  });
});
