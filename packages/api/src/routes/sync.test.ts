import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  registerSyncRoutes,
  resolveConflict,
  getServerChangesSince,
  type ChangeEntry,
  type SyncPayload,
} from './sync.js';

// ─── Test Constants ──────────────────────────────────────────────────────────

const testUserId = 'user-sync-123';
const testTripId = 'trip-sync-456';
const testBookingId = 'booking-sync-789';
const testFavoriteId = 'fav-sync-101';

// ─── Mock Database ───────────────────────────────────────────────────────────

function createMockDb() {
  const returns = {
    selectExecute: vi.fn().mockResolvedValue([]),
    selectTakeFirst: vi.fn().mockResolvedValue(null),
    insertExecute: vi.fn().mockResolvedValue(undefined),
    updateExecute: vi.fn().mockResolvedValue(undefined),
    deleteExecute: vi.fn().mockResolvedValue(undefined),
  };

  const createChainableSelect = () => {
    const chain: any = {};
    chain.selectAll = vi.fn(() => chain);
    chain.select = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
    chain.innerJoin = vi.fn(() => chain);
    chain.orderBy = vi.fn(() => chain);
    chain.execute = returns.selectExecute;
    chain.executeTakeFirst = returns.selectTakeFirst;
    return chain;
  };

  const createChainableInsert = () => {
    const chain: any = {};
    chain.values = vi.fn(() => chain);
    // onConflict accepts a callback; we provide a mock oc builder
    const ocBuilder: any = {};
    ocBuilder.column = vi.fn(() => ocBuilder);
    ocBuilder.columns = vi.fn(() => ocBuilder);
    ocBuilder.doNothing = vi.fn(() => chain);
    ocBuilder.doUpdateSet = vi.fn(() => chain);
    chain.onConflict = vi.fn((cb: any) => {
      cb(ocBuilder);
      return chain;
    });
    chain.returning = vi.fn(() => chain);
    chain.returningAll = vi.fn(() => chain);
    chain.execute = returns.insertExecute;
    chain.executeTakeFirst = returns.insertExecute;
    chain.executeTakeFirstOrThrow = returns.insertExecute;
    return chain;
  };

  const createChainableUpdate = () => {
    const chain: any = {};
    chain.set = vi.fn(() => chain);
    chain.where = vi.fn(() => chain);
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

// ─── Unit Tests: resolveConflict ─────────────────────────────────────────────

describe('resolveConflict', () => {
  it('resolves to server version when server timestamp is more recent', () => {
    const localChange: ChangeEntry = {
      entityType: 'trips',
      entityId: testTripId,
      operation: 'update',
      data: { name: 'Local Trip Name' },
      localTimestamp: '2025-01-10T10:00:00.000Z',
    };
    const serverChange: ChangeEntry = {
      entityType: 'trips',
      entityId: testTripId,
      operation: 'update',
      data: { name: 'Server Trip Name' },
      localTimestamp: '2025-01-10T12:00:00.000Z',
    };

    const result = resolveConflict(localChange, serverChange);

    expect(result.entityType).toBe('trips');
    expect(result.entityId).toBe(testTripId);
    expect(result.localVersion).toEqual({ name: 'Local Trip Name' });
    expect(result.serverVersion).toEqual({ name: 'Server Trip Name' });
    expect(result.resolvedVersion).toEqual({ name: 'Server Trip Name' });
  });

  it('resolves to local version when local timestamp is more recent', () => {
    const localChange: ChangeEntry = {
      entityType: 'favorites',
      entityId: testFavoriteId,
      operation: 'update',
      data: { name: 'Updated by user' },
      localTimestamp: '2025-01-10T14:00:00.000Z',
    };
    const serverChange: ChangeEntry = {
      entityType: 'favorites',
      entityId: testFavoriteId,
      operation: 'update',
      data: { name: 'Updated by another device' },
      localTimestamp: '2025-01-10T12:00:00.000Z',
    };

    const result = resolveConflict(localChange, serverChange);

    expect(result.resolvedVersion).toEqual({ name: 'Updated by user' });
  });

  it('resolves to server version when timestamps are equal', () => {
    const timestamp = '2025-01-10T12:00:00.000Z';
    const localChange: ChangeEntry = {
      entityType: 'bookings',
      entityId: testBookingId,
      operation: 'update',
      data: { checked_in: true },
      localTimestamp: timestamp,
    };
    const serverChange: ChangeEntry = {
      entityType: 'bookings',
      entityId: testBookingId,
      operation: 'update',
      data: { checked_in: false },
      localTimestamp: timestamp,
    };

    const result = resolveConflict(localChange, serverChange);

    // On tie, server wins (serverTime >= localTime)
    expect(result.resolvedVersion).toEqual({ checked_in: false });
  });

  it('preserves both local and server versions in the conflict entry', () => {
    const localChange: ChangeEntry = {
      entityType: 'trips',
      entityId: testTripId,
      operation: 'update',
      data: { name: 'My Trip', start_date: '2025-07-01' },
      localTimestamp: '2025-01-10T10:00:00.000Z',
    };
    const serverChange: ChangeEntry = {
      entityType: 'trips',
      entityId: testTripId,
      operation: 'update',
      data: { name: 'Our Trip', start_date: '2025-07-05' },
      localTimestamp: '2025-01-10T11:00:00.000Z',
    };

    const result = resolveConflict(localChange, serverChange);

    expect(result.localVersion).toEqual({ name: 'My Trip', start_date: '2025-07-01' });
    expect(result.serverVersion).toEqual({ name: 'Our Trip', start_date: '2025-07-05' });
  });
});

// ─── Integration Tests: POST /api/sync ───────────────────────────────────────

describe('POST /api/sync', () => {
  let app: FastifyInstance;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeAll(async () => {
    mockDb = createMockDb();

    app = Fastify({ logger: false });

    // Decorate with auth
    app.decorateRequest('user', undefined);
    app.decorate('requireAuth', async (request: any) => {
      request.user = { userId: testUserId, email: 'test@example.com' };
    });

    await registerSyncRoutes(app, { db: mockDb.db });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: no server changes found
    mockDb.returns.selectExecute.mockResolvedValue([]);
  });

  it('returns 400 if lastSyncTimestamp is missing', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        localChanges: [],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('lastSyncTimestamp');
  });

  it('returns 400 if lastSyncTimestamp is not a valid date', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: 'not-a-date',
        localChanges: [],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('valid ISO 8601');
  });

  it('returns 400 if localChanges is not an array', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: 'not an array',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('localChanges must be an array');
  });

  it('returns 400 if a change entry has unsupported entityType', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'unknown_entity',
            entityId: 'id-1',
            operation: 'create',
            data: {},
            localTimestamp: '2025-01-02T00:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('not supported');
  });

  it('returns 400 if a change entry has invalid operation', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'trips',
            entityId: 'id-1',
            operation: 'archive',
            data: {},
            localTimestamp: '2025-01-02T00:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.message).toContain('operation');
  });

  it('returns 200 with empty arrays when no changes exist', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.serverChanges).toEqual([]);
    expect(body.conflicts).toEqual([]);
    expect(body.newSyncTimestamp).toBeDefined();
    // newSyncTimestamp should be a valid ISO date
    expect(new Date(body.newSyncTimestamp).toISOString()).toBe(body.newSyncTimestamp);
  });

  it('returns server changes when they exist since lastSyncTimestamp', async () => {
    // Mock trips updated on server
    mockDb.returns.selectExecute
      .mockResolvedValueOnce([
        {
          id: testTripId,
          owner_id: testUserId,
          name: 'Server Updated Trip',
          start_date: '2025-07-01',
          end_date: '2025-07-15',
          budget: null,
          budget_currency: null,
          created_at: new Date('2025-01-01'),
          updated_at: new Date('2025-01-05T12:00:00Z'),
        },
      ])
      // bookings - none
      .mockResolvedValueOnce([])
      // favorites - none
      .mockResolvedValueOnce([])
      // user trip ids for timeline
      .mockResolvedValueOnce([{ id: testTripId }])
      // timeline events - none
      .mockResolvedValueOnce([]);

    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.serverChanges).toHaveLength(1);
    expect(body.serverChanges[0].entityType).toBe('trips');
    expect(body.serverChanges[0].entityId).toBe(testTripId);
    expect(body.serverChanges[0].data.name).toBe('Server Updated Trip');
  });

  it('processes local create changes successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'trips',
            entityId: 'new-trip-id',
            operation: 'create',
            data: { name: 'New Offline Trip', start_date: '2025-08-01' },
            localTimestamp: '2025-01-02T10:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conflicts).toEqual([]);
    expect(body.newSyncTimestamp).toBeDefined();
  });

  it('processes local update changes successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'favorites',
            entityId: testFavoriteId,
            operation: 'update',
            data: { name: 'Updated Favorite', notes: 'Must visit!' },
            localTimestamp: '2025-01-02T10:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conflicts).toEqual([]);
  });

  it('processes local delete changes successfully', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'bookings',
            entityId: testBookingId,
            operation: 'delete',
            data: {},
            localTimestamp: '2025-01-02T10:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conflicts).toEqual([]);
  });

  it('detects and reports conflicts with last-write-wins resolution', async () => {
    // Server has a trip change
    mockDb.returns.selectExecute
      .mockResolvedValueOnce([
        {
          id: testTripId,
          owner_id: testUserId,
          name: 'Server Name',
          start_date: '2025-07-01',
          end_date: '2025-07-15',
          budget: null,
          budget_currency: null,
          created_at: new Date('2025-01-01'),
          updated_at: new Date('2025-01-05T14:00:00Z'),
        },
      ])
      // bookings - none
      .mockResolvedValueOnce([])
      // favorites - none
      .mockResolvedValueOnce([])
      // user trip ids
      .mockResolvedValueOnce([{ id: testTripId }])
      // timeline events - none
      .mockResolvedValueOnce([]);

    // Local change to the same trip with an earlier timestamp
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'trips',
            entityId: testTripId,
            operation: 'update',
            data: { name: 'Local Name' },
            localTimestamp: '2025-01-05T10:00:00.000Z', // earlier than server
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Should have 1 conflict
    expect(body.conflicts).toHaveLength(1);
    expect(body.conflicts[0].entityType).toBe('trips');
    expect(body.conflicts[0].entityId).toBe(testTripId);
    expect(body.conflicts[0].localVersion).toEqual({ name: 'Local Name' });
    expect(body.conflicts[0].serverVersion).toEqual({
      name: 'Server Name',
      start_date: '2025-07-01',
      end_date: '2025-07-15',
      budget: null,
      budget_currency: null,
    });
    // Server wins because it has a more recent timestamp
    expect(body.conflicts[0].resolvedVersion).toEqual(body.conflicts[0].serverVersion);

    // Conflicted entity should NOT appear in serverChanges (it's in conflicts instead)
    expect(body.serverChanges).toEqual([]);
  });

  it('handles multiple local changes in a single sync', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: '2025-01-01T00:00:00.000Z',
        localChanges: [
          {
            entityType: 'trips',
            entityId: 'trip-1',
            operation: 'create',
            data: { name: 'Trip One' },
            localTimestamp: '2025-01-02T08:00:00.000Z',
          },
          {
            entityType: 'favorites',
            entityId: 'fav-1',
            operation: 'create',
            data: { name: 'Coffee Shop', category: 'food' },
            localTimestamp: '2025-01-02T09:00:00.000Z',
          },
          {
            entityType: 'expenses',
            entityId: 'exp-1',
            operation: 'create',
            data: { amount: '25.50', currency: 'EUR', category: 'food_dining' },
            localTimestamp: '2025-01-02T10:00:00.000Z',
          },
        ],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.conflicts).toEqual([]);
    expect(body.newSyncTimestamp).toBeDefined();
  });

  it('returns newSyncTimestamp that is after lastSyncTimestamp', async () => {
    const lastSync = '2025-01-01T00:00:00.000Z';

    const response = await app.inject({
      method: 'POST',
      url: '/api/sync',
      payload: {
        lastSyncTimestamp: lastSync,
        localChanges: [],
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    const newSync = new Date(body.newSyncTimestamp).getTime();
    const oldSync = new Date(lastSync).getTime();
    expect(newSync).toBeGreaterThan(oldSync);
  });
});
