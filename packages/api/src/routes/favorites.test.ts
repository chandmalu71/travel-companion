import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import Fastify from 'fastify';
import { registerFavoriteRoutes } from './favorites.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Integration Tests for Favorites & Collections Routes ────────────────────

describe('Favorites & Collections Routes', () => {
  let app: FastifyInstance;

  // State tracking for mock DB
  const state = {
    favorites: [] as Record<string, unknown>[],
    collections: [] as Record<string, unknown>[],
    favoriteCollections: [] as Record<string, unknown>[],
    favoriteCount: 0,
  };

  function createMockDb() {
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

    const db = {
      selectFrom: vi.fn((table: string) => {
        if (table === 'favorites') {
          return {
            select: vi.fn((arg: unknown) => {
              // For count queries (db.fn.countAll().as('count'))
              // The arg will be the result of db.fn.countAll().as('count')
              return {
                where: vi.fn(() => ({
                  where: vi.fn(() => ({
                    executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
                    executeTakeFirstOrThrow: vi.fn(() => ({ count: state.favoriteCount })),
                  })),
                  executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
                  executeTakeFirstOrThrow: vi.fn(() => ({ count: state.favoriteCount })),
                })),
              };
            }),
            selectAll: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  orderBy: vi.fn(() => ({
                    execute: vi.fn(() => state.favorites),
                  })),
                  execute: vi.fn(() => state.favorites),
                  executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
                  executeTakeFirstOrThrow: vi.fn(() => {
                    if (state.favorites.length === 0) throw new Error('No result');
                    return state.favorites[0];
                  }),
                })),
                orderBy: vi.fn(() => ({
                  execute: vi.fn(() => state.favorites),
                })),
                execute: vi.fn(() => state.favorites),
                executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
                executeTakeFirstOrThrow: vi.fn(() => {
                  if (state.favorites.length === 0) throw new Error('No result');
                  return state.favorites[0];
                }),
              })),
            })),
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
              })),
              executeTakeFirst: vi.fn(() => state.favorites[0] ?? undefined),
            })),
          };
        }
        if (table === 'collections') {
          return {
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  executeTakeFirst: vi.fn(() => state.collections[0] ?? undefined),
                })),
                executeTakeFirst: vi.fn(() => state.collections[0] ?? undefined),
              })),
            })),
            selectAll: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  execute: vi.fn(() => state.collections),
                  executeTakeFirst: vi.fn(() => state.collections[0] ?? undefined),
                })),
                orderBy: vi.fn(() => ({
                  execute: vi.fn(() => state.collections),
                })),
                execute: vi.fn(() => state.collections),
                executeTakeFirst: vi.fn(() => state.collections[0] ?? undefined),
              })),
            })),
          };
        }
        if (table === 'favorite_collections') {
          return {
            select: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  executeTakeFirst: vi.fn(() => state.favoriteCollections[0] ?? undefined),
                })),
                execute: vi.fn(() => state.favoriteCollections),
                executeTakeFirst: vi.fn(() => state.favoriteCollections[0] ?? undefined),
              })),
            })),
          };
        }
        return createChain();
      }),
      insertInto: vi.fn((table: string) => {
        if (table === 'favorites') {
          return {
            values: vi.fn((values: Record<string, unknown>) => ({
              returningAll: vi.fn(() => ({
                executeTakeFirstOrThrow: vi.fn(() => ({
                  id: 'fav-uuid-1',
                  user_id: values.user_id,
                  trip_id: values.trip_id ?? null,
                  name: values.name,
                  category: values.category ?? null,
                  place_id: values.place_id ?? null,
                  location_lat: values.location_lat ?? null,
                  location_lng: values.location_lng ?? null,
                  rating: values.rating ?? null,
                  notes: values.notes ?? null,
                  added_by: values.added_by ?? null,
                  created_at: new Date('2024-01-01'),
                })),
              })),
            })),
          };
        }
        if (table === 'collections') {
          return {
            values: vi.fn((values: Record<string, unknown>) => ({
              returningAll: vi.fn(() => ({
                executeTakeFirstOrThrow: vi.fn(() => ({
                  id: 'col-uuid-1',
                  user_id: values.user_id,
                  name: values.name,
                  created_at: new Date('2024-01-01'),
                })),
              })),
            })),
          };
        }
        if (table === 'favorite_collections') {
          return {
            values: vi.fn(() => ({
              execute: vi.fn(() => []),
            })),
          };
        }
        return createChain();
      }),
      updateTable: vi.fn((table: string) => {
        if (table === 'favorites') {
          return {
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  returningAll: vi.fn(() => ({
                    executeTakeFirstOrThrow: vi.fn(() => ({
                      ...state.favorites[0],
                      notes: 'Updated notes',
                    })),
                  })),
                })),
                returningAll: vi.fn(() => ({
                  executeTakeFirstOrThrow: vi.fn(() => ({
                    ...state.favorites[0],
                    notes: 'Updated notes',
                  })),
                })),
              })),
            })),
          };
        }
        if (table === 'collections') {
          return {
            set: vi.fn(() => ({
              where: vi.fn(() => ({
                where: vi.fn(() => ({
                  returningAll: vi.fn(() => ({
                    executeTakeFirstOrThrow: vi.fn(() => ({
                      ...state.collections[0],
                      name: 'Renamed',
                    })),
                  })),
                })),
                returningAll: vi.fn(() => ({
                  executeTakeFirstOrThrow: vi.fn(() => ({
                    ...state.collections[0],
                    name: 'Renamed',
                  })),
                })),
              })),
            })),
          };
        }
        return createChain();
      }),
      deleteFrom: vi.fn((table: string) => {
        if (table === 'favorites') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => ({
                  numDeletedRows: state.favorites.length > 0 ? 1n : 0n,
                })),
              })),
              executeTakeFirst: vi.fn(() => ({
                numDeletedRows: state.favorites.length > 0 ? 1n : 0n,
              })),
            })),
          };
        }
        if (table === 'collections') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => ({
                  numDeletedRows: state.collections.length > 0 ? 1n : 0n,
                })),
              })),
              executeTakeFirst: vi.fn(() => ({
                numDeletedRows: state.collections.length > 0 ? 1n : 0n,
              })),
            })),
          };
        }
        if (table === 'favorite_collections') {
          return {
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                executeTakeFirst: vi.fn(() => ({
                  numDeletedRows: state.favoriteCollections.length > 0 ? 1n : 0n,
                })),
              })),
              executeTakeFirst: vi.fn(() => ({
                numDeletedRows: state.favoriteCollections.length > 0 ? 1n : 0n,
              })),
            })),
          };
        }
        return createChain();
      }),
      fn: {
        countAll: vi.fn(() => ({ as: vi.fn(() => 'count') })),
      },
    } as unknown as Kysely<Database>;

    return db;
  }

  let mockDb: Kysely<Database>;

  beforeAll(async () => {
    mockDb = createMockDb();

    // Build a minimal Fastify app with stub auth and favorites routes
    app = Fastify({ logger: false });

    // Stub auth middleware that always sets the user
    app.decorateRequest('user', undefined);
    app.decorate('requireAuth', async (request: FastifyRequest, _reply: FastifyReply) => {
      request.user = { userId: 'test-user-id', email: 'test@example.com' };
    });

    await registerFavoriteRoutes(app, { db: mockDb });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    state.favorites = [];
    state.collections = [];
    state.favoriteCollections = [];
    state.favoriteCount = 0;
    vi.clearAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORITES
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/favorites', () => {
    it('creates a favorite with trip_id and returns 201', async () => {
      state.favoriteCount = 0;

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Eiffel Tower',
          trip_id: 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
          category: 'landmarks',
          notes: 'Must visit!',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('fav-uuid-1');
      expect(body.name).toBe('Eiffel Tower');
      expect(body.trip_id).toBe('a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d');
    });

    it('creates a favorite with null trip_id (unassigned) and returns 201', async () => {
      state.favoriteCount = 0;

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Random Restaurant',
          trip_id: null,
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.trip_id).toBeNull();
    });

    it('returns 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          trip_id: null,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when notes exceed 1000 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Some Place',
          trip_id: null,
          notes: 'x'.repeat(1001),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when favorites limit (500) is reached', async () => {
      state.favoriteCount = 500;

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'One more place',
          trip_id: null,
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('LIMIT_REACHED');
      expect(body.message).toContain('500');
    });

    it('returns 400 when trip_id is not provided (undefined)', async () => {
      state.favoriteCount = 0;

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Some place',
          // trip_id omitted entirely
        },
      });

      // Schema allows trip_id to be null but we require it to be explicitly provided
      // The Zod schema has trip_id as z.string().uuid().nullable() which means it must be present
      expect(response.statusCode).toBe(400);
    });
  });

  describe('GET /api/favorites', () => {
    it('returns empty favorites list', async () => {
      state.favorites = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.favorites).toEqual([]);
    });

    it('returns favorites list', async () => {
      state.favorites = [
        {
          id: 'fav-1',
          user_id: 'test-user-id',
          trip_id: null,
          name: 'Paris Cafe',
          category: 'restaurants',
          place_id: null,
          location_lat: null,
          location_lng: null,
          rating: '4.5',
          notes: null,
          added_by: 'test-user-id',
          created_at: new Date('2024-01-01'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/favorites',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.favorites).toHaveLength(1);
      expect(body.favorites[0].name).toBe('Paris Cafe');
    });
  });

  describe('GET /api/favorites/:id', () => {
    it('returns 404 when favorite does not exist', async () => {
      state.favorites = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/favorites/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns a favorite when found', async () => {
      state.favorites = [
        {
          id: 'fav-1',
          user_id: 'test-user-id',
          trip_id: null,
          name: 'My Spot',
          category: 'parks',
          notes: 'Lovely view',
          created_at: new Date('2024-01-01'),
        },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/favorites/fav-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('My Spot');
    });
  });

  describe('DELETE /api/favorites/:id', () => {
    it('returns 204 on successful deletion', async () => {
      state.favorites = [{ id: 'fav-1', user_id: 'test-user-id' }];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/favorites/fav-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 when favorite does not exist', async () => {
      state.favorites = [];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/favorites/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // COLLECTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/collections', () => {
    it('creates a collection and returns 201', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'Best restaurants',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.id).toBe('col-uuid-1');
      expect(body.name).toBe('Best restaurants');
    });

    it('returns 400 when name is missing', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when name exceeds 50 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'x'.repeat(51),
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('accepts collection name of exactly 50 characters', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'x'.repeat(50),
        },
      });

      expect(response.statusCode).toBe(201);
    });
  });

  describe('GET /api/collections', () => {
    it('returns empty collections list', async () => {
      state.collections = [];

      const response = await app.inject({
        method: 'GET',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.collections).toEqual([]);
    });

    it('returns collections list', async () => {
      state.collections = [
        { id: 'col-1', user_id: 'test-user-id', name: 'Beaches', created_at: new Date('2024-01-01') },
      ];

      const response = await app.inject({
        method: 'GET',
        url: '/api/collections',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.collections).toHaveLength(1);
      expect(body.collections[0].name).toBe('Beaches');
    });
  });

  describe('PUT /api/collections/:id', () => {
    it('renames a collection and returns 200', async () => {
      state.collections = [
        { id: 'col-1', user_id: 'test-user-id', name: 'Old Name', created_at: new Date('2024-01-01') },
      ];

      const response = await app.inject({
        method: 'PUT',
        url: '/api/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
        payload: {
          name: 'New Name',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.name).toBe('Renamed');
    });

    it('returns 404 when collection does not exist', async () => {
      state.collections = [];

      const response = await app.inject({
        method: 'PUT',
        url: '/api/collections/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'Something' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 400 when name exceeds 50 chars', async () => {
      state.collections = [
        { id: 'col-1', user_id: 'test-user-id', name: 'Old', created_at: new Date() },
      ];

      const response = await app.inject({
        method: 'PUT',
        url: '/api/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
        payload: { name: 'a'.repeat(51) },
      });

      expect(response.statusCode).toBe(400);
    });
  });

  describe('DELETE /api/collections/:id', () => {
    it('returns 204 on successful deletion', async () => {
      state.collections = [{ id: 'col-1', user_id: 'test-user-id' }];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 when collection does not exist', async () => {
      state.collections = [];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/collections/nonexistent-id',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // FAVORITE-COLLECTION ASSOCIATIONS
  // ═══════════════════════════════════════════════════════════════════════════

  describe('POST /api/favorites/:id/collections/:collectionId', () => {
    it('adds favorite to collection and returns 201', async () => {
      state.favorites = [{ id: 'fav-1', user_id: 'test-user-id' }];
      state.collections = [{ id: 'col-1', user_id: 'test-user-id' }];
      state.favoriteCollections = [];

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites/fav-1/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.favorite_id).toBe('fav-1');
      expect(body.collection_id).toBe('col-1');
    });

    it('returns 404 when favorite does not exist', async () => {
      state.favorites = [];
      state.collections = [{ id: 'col-1', user_id: 'test-user-id' }];

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites/nonexistent/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 200 when favorite is already in collection', async () => {
      state.favorites = [{ id: 'fav-1', user_id: 'test-user-id' }];
      state.collections = [{ id: 'col-1', user_id: 'test-user-id' }];
      state.favoriteCollections = [{ favorite_id: 'fav-1', collection_id: 'col-1' }];

      const response = await app.inject({
        method: 'POST',
        url: '/api/favorites/fav-1/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toContain('already');
    });
  });

  describe('DELETE /api/favorites/:id/collections/:collectionId', () => {
    it('removes favorite from collection and returns 204', async () => {
      state.favorites = [{ id: 'fav-1', user_id: 'test-user-id' }];
      state.favoriteCollections = [{ favorite_id: 'fav-1', collection_id: 'col-1' }];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/favorites/fav-1/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(204);
    });

    it('returns 404 when favorite does not exist', async () => {
      state.favorites = [];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/favorites/nonexistent/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });

    it('returns 404 when favorite is not in collection', async () => {
      state.favorites = [{ id: 'fav-1', user_id: 'test-user-id' }];
      state.favoriteCollections = [];

      const response = await app.inject({
        method: 'DELETE',
        url: '/api/favorites/fav-1/collections/col-1',
        headers: { authorization: 'Bearer test-token' },
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
