import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import Redis from 'ioredis';

function createMockRedisClient() {
  const store = new Map<string, { value: string; ttl: number }>();

  return {
    status: 'ready',
    connect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue('OK'),
    get: vi.fn().mockImplementation(async (key: string) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    }),
    set: vi.fn().mockImplementation(
      async (key: string, value: string, _mode?: string, _ttl?: number) => {
        store.set(key, { value, ttl: _ttl ?? 0 });
        return 'OK';
      },
    ),
    del: vi.fn().mockImplementation(async (key: string) => {
      const existed = store.has(key);
      store.delete(key);
      return existed ? 1 : 0;
    }),
    expire: vi.fn().mockImplementation(async (key: string, _ttl: number) => {
      return store.has(key) ? 1 : 0;
    }),
    incr: vi.fn().mockImplementation(async (key: string) => {
      const entry = store.get(key);
      const newVal = entry ? parseInt(entry.value, 10) + 1 : 1;
      store.set(key, { value: String(newVal), ttl: 0 });
      return newVal;
    }),
    ping: vi.fn().mockResolvedValue('PONG'),
    defineCommand: vi.fn(),
    call: vi.fn().mockResolvedValue(null),
  };
}

describe('Redis Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const mockClient = createMockRedisClient() as unknown as Redis;
    app = await buildApp({ logger: false, redisClient: mockClient });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('decorates the app with a redis instance', () => {
    expect(app.redis).toBeDefined();
  });

  it('redis client has expected methods', () => {
    expect(app.redis.get).toBeInstanceOf(Function);
    expect(app.redis.set).toBeInstanceOf(Function);
    expect(app.redis.del).toBeInstanceOf(Function);
  });

  it('can set and get values', async () => {
    await app.redis.set('test-key', 'test-value');
    const value = await app.redis.get('test-key');
    expect(value).toBe('test-value');
  });

  it('returns null for non-existent keys', async () => {
    const value = await app.redis.get('nonexistent-key');
    expect(value).toBeNull();
  });

  it('can delete keys', async () => {
    await app.redis.set('delete-me', 'some-value');
    const deleted = await app.redis.del('delete-me');
    expect(deleted).toBe(1);

    const value = await app.redis.get('delete-me');
    expect(value).toBeNull();
  });
});

describe('Session Store Plugin', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const mockClient = createMockRedisClient() as unknown as Redis;
    app = await buildApp({ logger: false, redisClient: mockClient });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('decorates the app with a sessionStore', () => {
    expect(app.sessionStore).toBeDefined();
  });

  it('sessionStore has expected methods', () => {
    expect(app.sessionStore.create).toBeInstanceOf(Function);
    expect(app.sessionStore.get).toBeInstanceOf(Function);
    expect(app.sessionStore.update).toBeInstanceOf(Function);
    expect(app.sessionStore.destroy).toBeInstanceOf(Function);
    expect(app.sessionStore.touch).toBeInstanceOf(Function);
  });

  it('can create and retrieve a session', async () => {
    const sessionId = await app.sessionStore.create({
      userId: 'user-123',
      email: 'test@example.com',
    });

    expect(sessionId).toBeDefined();
    expect(typeof sessionId).toBe('string');
    expect(sessionId.length).toBe(32);

    const session = await app.sessionStore.get(sessionId);
    expect(session).not.toBeNull();
    expect(session!.userId).toBe('user-123');
    expect(session!.email).toBe('test@example.com');
    expect(session!.createdAt).toBeGreaterThan(0);
    expect(session!.expiresAt).toBeGreaterThan(session!.createdAt);
  });

  it('returns null for non-existent session', async () => {
    const session = await app.sessionStore.get('nonexistent-session-id');
    expect(session).toBeNull();
  });

  it('can update a session', async () => {
    const sessionId = await app.sessionStore.create({
      userId: 'user-456',
      email: 'update@example.com',
    });

    const updated = await app.sessionStore.update(sessionId, {
      email: 'new-email@example.com',
    });
    expect(updated).toBe(true);

    const session = await app.sessionStore.get(sessionId);
    expect(session!.email).toBe('new-email@example.com');
    expect(session!.userId).toBe('user-456');
  });

  it('returns false when updating non-existent session', async () => {
    const updated = await app.sessionStore.update('fake-id', {
      email: 'x@y.com',
    });
    expect(updated).toBe(false);
  });

  it('can destroy a session', async () => {
    const sessionId = await app.sessionStore.create({
      userId: 'user-789',
      email: 'destroy@example.com',
    });

    const destroyed = await app.sessionStore.destroy(sessionId);
    expect(destroyed).toBe(true);

    const session = await app.sessionStore.get(sessionId);
    expect(session).toBeNull();
  });

  it('returns false when destroying non-existent session', async () => {
    const destroyed = await app.sessionStore.destroy('fake-session-id');
    expect(destroyed).toBe(false);
  });

  it('can touch a session to extend TTL', async () => {
    const sessionId = await app.sessionStore.create({
      userId: 'user-touch',
      email: 'touch@example.com',
    });

    const touched = await app.sessionStore.touch(sessionId);
    expect(touched).toBe(true);
  });

  it('returns false when touching non-existent session', async () => {
    const touched = await app.sessionStore.touch('nonexistent-touch-id');
    expect(touched).toBe(false);
  });
});

describe('App without Redis (skipRedis)', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildApp({ logger: false, skipRedis: true });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('builds successfully without Redis', () => {
    expect(app).toBeDefined();
  });

  it('does not have redis decorator when skipped', () => {
    expect((app as unknown as { redis?: unknown }).redis).toBeUndefined();
  });

  it('does not have sessionStore decorator when Redis is skipped', () => {
    expect(
      (app as unknown as { sessionStore?: unknown }).sessionStore,
    ).toBeUndefined();
  });

  it('health check still works without Redis', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/health',
    });
    expect(response.statusCode).toBe(200);
  });
});

describe('Rate limit uses Redis when available', () => {
  let app: FastifyInstance;
  let mockClient: ReturnType<typeof createMockRedisClient>;

  beforeAll(async () => {
    mockClient = createMockRedisClient();
    app = await buildApp({
      logger: false,
      redisClient: mockClient as unknown as Redis,
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('rate limiter is registered with Redis store (defineCommand was called)', () => {
    // @fastify/rate-limit calls defineCommand on the redis instance when using Redis store
    expect(mockClient.defineCommand).toHaveBeenCalled();
  });
});
