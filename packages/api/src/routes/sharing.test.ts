import { describe, it, expect, vi } from 'vitest';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerSharingRoutes } from './sharing.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const testUserId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const testOtherUserId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const testTripId = 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f';
const testMemberId = 'd4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f8a';

function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: testTripId,
    owner_id: testUserId,
    ...overrides,
  };
}

function createMockMember(overrides: Record<string, unknown> = {}) {
  return {
    id: testMemberId,
    trip_id: testTripId,
    user_id: testOtherUserId,
    email: 'member@example.com',
    access_level: 'view',
    invited_at: new Date('2025-01-15'),
    accepted_at: null,
    ...overrides,
  };
}

// ─── Mock DB Factory ─────────────────────────────────────────────────────────

function createMockDb() {
  const selectTakeFirst = vi.fn();
  const selectExecute = vi.fn(() => []);
  const insertReturningAll = vi.fn();
  const insertExecute = vi.fn();
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
    chain.returningAll = vi.fn(() => chain);
    chain.executeTakeFirstOrThrow = insertReturningAll;
    chain.execute = insertExecute;
    return chain;
  };

  const createChainableDelete = () => {
    const chain: any = {};
    chain.where = vi.fn(() => chain);
    chain.execute = deleteExecute;
    return chain;
  };

  const db = {
    selectFrom: vi.fn(() => createChainableSelect()),
    insertInto: vi.fn(() => createChainableInsert()),
    deleteFrom: vi.fn(() => createChainableDelete()),
  } as unknown as Kysely<Database>;

  return {
    db,
    mocks: {
      selectTakeFirst,
      selectExecute,
      insertReturningAll,
      insertExecute,
      deleteExecute,
    },
  };
}

// ─── App Setup ───────────────────────────────────────────────────────────────

function buildTestApp(db: Kysely<Database>, userId = testUserId) {
  const app = Fastify({ logger: false });

  // Mock auth middleware
  app.decorate('requireAuth', async (request: any) => {
    request.user = { userId };
  });

  registerSharingRoutes(app, { db });
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Sharing Routes', () => {
  // ─── POST /api/trips/:tripId/share ─────────────────────────────────────────

  describe('POST /api/trips/:tripId/share', () => {
    it('shares a trip with valid emails', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      // Trip lookup - owner
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip exists, user is owner
        .mockResolvedValueOnce(undefined) // not already a member by email
        .mockResolvedValueOnce(undefined); // no registered user with that email

      mocks.selectExecute.mockResolvedValueOnce([]); // no existing members

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['friend@example.com'],
          accessLevel: 'view',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Trip shared successfully');
      expect(body.accessLevel).toBe('view');
      expect(body.results).toHaveLength(1);
      expect(body.results[0].email).toBe('friend@example.com');
      expect(body.results[0].status).toBe('invited');

      await app.close();
    });

    it('shares with multiple emails and edit access', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce(undefined) // email1 not a member
        .mockResolvedValueOnce(undefined) // email1 not a user
        .mockResolvedValueOnce(undefined) // email2 not a member
        .mockResolvedValueOnce(undefined); // email2 not a user

      mocks.selectExecute.mockResolvedValueOnce([]); // no existing members

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['a@example.com', 'b@example.com'],
          accessLevel: 'edit',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accessLevel).toBe('edit');
      expect(body.results).toHaveLength(2);

      await app.close();
    });

    it('defaults accessLevel to view when not specified', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(undefined) // not already member
        .mockResolvedValueOnce(undefined); // no user

      mocks.selectExecute.mockResolvedValueOnce([]);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['test@example.com'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accessLevel).toBe('view');

      await app.close();
    });

    it('returns 400 for invalid email addresses', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['not-an-email', 'also bad'],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
      expect(body.message).toContain('invalid');

      await app.close();
    });

    it('returns 400 when emails field is missing', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');

      await app.close();
    });

    it('returns 400 when emails is empty', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: [],
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('At least one');

      await app.close();
    });

    it('returns 400 when exceeding 20 recipients', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const emails = Array.from({ length: 21 }, (_, i) => `user${i}@example.com`);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: { emails },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('20');

      await app.close();
    });

    it('returns 400 for invalid accessLevel', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['test@example.com'],
          accessLevel: 'admin',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.message).toContain('accessLevel');

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(undefined); // trip not found

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['friend@example.com'],
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');

      await app.close();
    });

    it('returns 403 when user is not the trip owner', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(createMockTrip({ owner_id: 'other-user' }));

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['friend@example.com'],
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');

      await app.close();
    });

    it('reports already_member for duplicate invitations', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce({ id: 'existing-member-id' }); // already a member by email

      mocks.selectExecute.mockResolvedValueOnce([]); // existing member count

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/share`,
        payload: {
          emails: ['existing@example.com'],
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.results[0].status).toBe('already_member');

      await app.close();
    });
  });

  // ─── GET /api/trips/:tripId/share/link ─────────────────────────────────────

  describe('GET /api/trips/:tripId/share/link', () => {
    it('generates a new share link', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 30);

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce(undefined); // no existing link

      mocks.insertReturningAll.mockResolvedValueOnce({
        id: 'link-id',
        trip_id: testTripId,
        token: 'abc123token',
        expires_at: futureDate,
        created_by: testUserId,
        created_at: new Date(),
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/share/link`,
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.url).toContain('/shared/trip/');
      expect(body.token).toBeDefined();
      expect(body.expiresAt).toBeDefined();

      await app.close();
    });

    it('returns existing non-expired share link', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 15);

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce({
          id: 'existing-link',
          trip_id: testTripId,
          token: 'existing-token-123',
          expires_at: futureDate,
          created_by: testUserId,
          created_at: new Date('2025-01-01'),
        }); // existing valid link

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/share/link`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.token).toBe('existing-token-123');
      expect(body.url).toContain('existing-token-123');

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/share/link`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 403 when user is not the trip owner', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(createMockTrip({ owner_id: 'other-user' }));

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/share/link`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');

      await app.close();
    });
  });

  // ─── DELETE /api/trips/:tripId/share/:memberId ─────────────────────────────

  describe('DELETE /api/trips/:tripId/share/:memberId', () => {
    it('revokes member access successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce(createMockMember()); // member found

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/share/${testMemberId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Access revoked successfully');
      expect(body.memberId).toBe(testMemberId);

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/share/${testMemberId}`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 403 when user is not the trip owner', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValueOnce(createMockTrip({ owner_id: 'other-user' }));

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/share/${testMemberId}`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');

      await app.close();
    });

    it('returns 404 when member does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip
        .mockResolvedValueOnce(undefined); // member not found

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/share/${testMemberId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');
      expect(body.message).toContain('Member not found');

      await app.close();
    });
  });
});
