import { describe, it, expect, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerVoteRoutes } from './votes.js';

// ─── Constants ───────────────────────────────────────────────────────────────

const testUserId = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const testOtherUserId = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';
const testTripId = 'c3d4e5f6-a7b8-4c9d-ae1f-2a3b4c5d6e7f';
const testVoteId = 'd4e5f6a7-b8c9-4d0e-9f2a-3b4c5d6e7f8a';
const testFavoriteId = 'e5f6a7b8-c9d0-4e1f-aa3b-4c5d6e7f8a9b';
const testEventId = 'f6a7b8c9-d0e1-4f2a-bb4c-5d6e7f8a9b0c';

function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: testTripId,
    owner_id: testUserId,
    ...overrides,
  };
}

function createMockVote(overrides: Record<string, unknown> = {}) {
  return {
    id: testVoteId,
    trip_id: testTripId,
    user_id: testUserId,
    entity_type: 'favorite',
    entity_id: testFavoriteId,
    vote_value: 1,
    created_at: new Date('2025-01-15'),
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

function buildTestApp(db: Kysely<Database>, userId = testUserId) {
  const app = Fastify({ logger: false });

  // Mock auth middleware
  app.decorate('requireAuth', async (request: any) => {
    request.user = { userId };
  });

  registerVoteRoutes(app, { db });
  return app;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Vote Routes', () => {
  // ─── POST /api/trips/:tripId/votes ───────────────────────────────────────

  describe('POST /api/trips/:tripId/votes', () => {
    it('creates a new upvote successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const newVote = createMockVote();

      // verifyTripMembership: trip lookup
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip exists, user is owner
        .mockResolvedValueOnce(undefined) // no existing vote
        .mockResolvedValueOnce({ net_count: '1' }); // net count after insert

      mocks.insertReturningAll.mockResolvedValue(newVote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.vote).toBeDefined();
      expect(body.vote.entity_type).toBe('favorite');
      expect(body.vote.entity_id).toBe(testFavoriteId);
      expect(body.vote.vote_value).toBe(1);
      expect(body.net_vote_count).toBeDefined();

      await app.close();
    });

    it('creates a downvote successfully', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const newVote = createMockVote({ vote_value: -1 });

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(undefined) // no existing vote
        .mockResolvedValueOnce({ net_count: '-1' });

      mocks.insertReturningAll.mockResolvedValue(newVote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'timeline_event',
          entity_id: testEventId,
          vote_value: -1,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.vote.vote_value).toBe(-1);

      await app.close();
    });

    it('updates an existing vote (upsert)', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const existingVote = createMockVote({ vote_value: 1 });
      const updatedVote = createMockVote({ vote_value: -1 });

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(existingVote) // existing vote found
        .mockResolvedValueOnce({ net_count: '-1' });

      mocks.updateReturningAll.mockResolvedValue(updatedVote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: -1,
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.vote.vote_value).toBe(-1);

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');

      await app.close();
    });

    it('returns 403 when user is not a trip member', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      // Trip exists but user is not owner
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip({ owner_id: 'other-owner' }))
        .mockResolvedValueOnce(undefined); // no membership

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('FORBIDDEN');

      await app.close();
    });

    it('rejects invalid entity_type', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'invalid_type',
          entity_id: testFavoriteId,
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');

      await app.close();
    });

    it('rejects invalid vote_value (must be -1 or 1)', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: 2,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');

      await app.close();
    });

    it('rejects invalid entity_id (must be UUID)', async () => {
      const { db } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: 'not-a-valid-uuid',
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');

      await app.close();
    });

    it('allows a trip collaborator to vote', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db, testOtherUserId);
      await app.ready();

      const newVote = createMockVote({ user_id: testOtherUserId });

      // Trip owner is different, but user is a member
      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip({ owner_id: testUserId })) // trip
        .mockResolvedValueOnce({ id: 'member-id' }) // membership found
        .mockResolvedValueOnce(undefined) // no existing vote
        .mockResolvedValueOnce({ net_count: '1' });

      mocks.insertReturningAll.mockResolvedValue(newVote);

      const response = await app.inject({
        method: 'POST',
        url: `/api/trips/${testTripId}/votes`,
        payload: {
          entity_type: 'favorite',
          entity_id: testFavoriteId,
          vote_value: 1,
        },
      });

      expect(response.statusCode).toBe(201);

      await app.close();
    });
  });

  // ─── GET /api/trips/:tripId/votes ────────────────────────────────────────

  describe('GET /api/trips/:tripId/votes', () => {
    it('returns all votes for a trip', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const votes = [
        createMockVote({ id: 'vote-1', entity_id: testFavoriteId, vote_value: 1 }),
        createMockVote({ id: 'vote-2', user_id: testOtherUserId, entity_id: testFavoriteId, vote_value: -1 }),
      ];

      mocks.selectTakeFirst.mockResolvedValueOnce(createMockTrip());
      mocks.selectExecute.mockResolvedValue(votes);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/votes`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.votes).toHaveLength(2);
      expect(body.net_counts).toBeDefined();
      // Net count: 1 + (-1) = 0
      expect(body.net_counts[`favorite:${testFavoriteId}`]).toBe(0);

      await app.close();
    });

    it('returns filtered votes by entity_type', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const votes = [createMockVote({ entity_type: 'timeline_event', entity_id: testEventId })];

      mocks.selectTakeFirst.mockResolvedValueOnce(createMockTrip());
      mocks.selectExecute.mockResolvedValue(votes);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/votes?entity_type=timeline_event`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.votes).toHaveLength(1);
      expect(body.votes[0].entity_type).toBe('timeline_event');

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/votes`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 403 when user is not a trip member', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip({ owner_id: 'other-owner' }))
        .mockResolvedValueOnce(undefined); // no membership

      const response = await app.inject({
        method: 'GET',
        url: `/api/trips/${testTripId}/votes`,
      });

      expect(response.statusCode).toBe(403);

      await app.close();
    });
  });

  // ─── DELETE /api/trips/:tripId/votes/:voteId ─────────────────────────────

  describe('DELETE /api/trips/:tripId/votes/:voteId', () => {
    it('deletes own vote successfully and returns updated net count', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const vote = createMockVote();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip()) // trip lookup
        .mockResolvedValueOnce(vote) // vote lookup
        .mockResolvedValueOnce({ net_count: '0' }); // net count after delete

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/votes/${testVoteId}`,
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toBe('Vote removed successfully');
      expect(body.net_vote_count).toBeDefined();

      await app.close();
    });

    it('returns 404 when vote does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(undefined); // vote not found

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/votes/${testVoteId}`,
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('NOT_FOUND');

      await app.close();
    });

    it('returns 403 when trying to delete another user vote', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      const otherUserVote = createMockVote({ user_id: testOtherUserId });

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip())
        .mockResolvedValueOnce(otherUserVote);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/votes/${testVoteId}`,
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.message).toContain('vote owner');

      await app.close();
    });

    it('returns 404 when trip does not exist', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/votes/${testVoteId}`,
      });

      expect(response.statusCode).toBe(404);

      await app.close();
    });

    it('returns 403 when user is not a trip member', async () => {
      const { db, mocks } = createMockDb();
      const app = buildTestApp(db);
      await app.ready();

      mocks.selectTakeFirst
        .mockResolvedValueOnce(createMockTrip({ owner_id: 'other-owner' }))
        .mockResolvedValueOnce(undefined); // no membership

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/trips/${testTripId}/votes/${testVoteId}`,
      });

      expect(response.statusCode).toBe(403);

      await app.close();
    });
  });
});
