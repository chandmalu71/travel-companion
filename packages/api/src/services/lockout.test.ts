import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type Redis as RedisClient } from 'ioredis';
import { checkLockout, recordFailedAttempt, resetLockout } from './lockout.js';

/**
 * Create a mock Redis client that simulates key/value store with TTL tracking.
 */
function createMockRedis() {
  const store = new Map<string, { value: string; ttl: number }>();

  const mock = {
    get: vi.fn(async (key: string) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    }),
    set: vi.fn(async (key: string, value: string, mode?: string, ttl?: number) => {
      store.set(key, { value, ttl: ttl ?? 0 });
      return 'OK';
    }),
    del: vi.fn(async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.has(key)) count++;
        store.delete(key);
      }
      return count;
    }),
    incr: vi.fn(async (key: string) => {
      const entry = store.get(key);
      const newVal = entry ? parseInt(entry.value, 10) + 1 : 1;
      store.set(key, { value: String(newVal), ttl: entry?.ttl ?? 0 });
      return newVal;
    }),
    expire: vi.fn(async (key: string, ttl: number) => {
      const entry = store.get(key);
      if (entry) {
        entry.ttl = ttl;
        return 1;
      }
      return 0;
    }),
    ttl: vi.fn(async (key: string) => {
      const entry = store.get(key);
      if (!entry) return -2; // Key does not exist
      return entry.ttl > 0 ? entry.ttl : -1;
    }),
    // Expose store for assertions
    _store: store,
  };

  return mock as unknown as RedisClient & { _store: typeof store };
}

describe('Lockout Service', () => {
  let redis: ReturnType<typeof createMockRedis>;

  beforeEach(() => {
    redis = createMockRedis();
  });

  describe('checkLockout', () => {
    it('returns not locked when no lock key exists', async () => {
      const status = await checkLockout(redis, 'user@example.com');
      expect(status.locked).toBe(false);
      expect(status.remainingSeconds).toBe(0);
      expect(status.message).toBeUndefined();
    });

    it('returns locked with remaining time when lock key exists', async () => {
      // Simulate a lock key in Redis
      redis._store.set('lockout:locked:user@example.com', { value: '1', ttl: 600 });

      const status = await checkLockout(redis, 'user@example.com');
      expect(status.locked).toBe(true);
      expect(status.remainingSeconds).toBe(600);
      expect(status.message).toContain('10 minute(s)');
    });

    it('normalizes email to lowercase', async () => {
      redis._store.set('lockout:locked:user@example.com', { value: '1', ttl: 900 });

      const status = await checkLockout(redis, 'User@Example.COM');
      expect(status.locked).toBe(true);
    });
  });

  describe('recordFailedAttempt', () => {
    it('increments counter on first failure without locking', async () => {
      const status = await recordFailedAttempt(redis, 'user@example.com');
      expect(status.locked).toBe(false);
      expect(redis._store.get('lockout:attempts:user@example.com')?.value).toBe('1');
    });

    it('does not lock on second failure', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      const status = await recordFailedAttempt(redis, 'user@example.com');
      expect(status.locked).toBe(false);
      expect(redis._store.get('lockout:attempts:user@example.com')?.value).toBe('2');
    });

    it('locks account on third consecutive failure', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');
      const status = await recordFailedAttempt(redis, 'user@example.com');

      expect(status.locked).toBe(true);
      expect(status.remainingSeconds).toBe(900); // 15 minutes
      expect(status.message).toContain('too many failed login attempts');
      expect(redis._store.has('lockout:locked:user@example.com')).toBe(true);
    });

    it('sets TTL on the attempts counter', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      expect(redis.expire).toHaveBeenCalledWith('lockout:attempts:user@example.com', 900);
    });

    it('sets lock key with 15-min TTL', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');

      expect(redis.set).toHaveBeenCalledWith(
        'lockout:locked:user@example.com',
        '1',
        'EX',
        900,
      );
    });

    it('normalizes email to lowercase for key generation', async () => {
      await recordFailedAttempt(redis, 'User@EXAMPLE.com');
      expect(redis._store.has('lockout:attempts:user@example.com')).toBe(true);
    });
  });

  describe('resetLockout', () => {
    it('deletes both attempts and locked keys', async () => {
      // Set up some state
      redis._store.set('lockout:attempts:user@example.com', { value: '2', ttl: 900 });
      redis._store.set('lockout:locked:user@example.com', { value: '1', ttl: 900 });

      await resetLockout(redis, 'user@example.com');

      expect(redis._store.has('lockout:attempts:user@example.com')).toBe(false);
      expect(redis._store.has('lockout:locked:user@example.com')).toBe(false);
    });

    it('does not error when keys do not exist', async () => {
      await expect(resetLockout(redis, 'noone@example.com')).resolves.toBeUndefined();
    });

    it('normalizes email to lowercase', async () => {
      redis._store.set('lockout:attempts:user@example.com', { value: '1', ttl: 900 });

      await resetLockout(redis, 'User@Example.COM');
      expect(redis._store.has('lockout:attempts:user@example.com')).toBe(false);
    });
  });

  describe('full lockout flow', () => {
    it('locks after 3 failures, then check confirms locked', async () => {
      await recordFailedAttempt(redis, 'locked@example.com');
      await recordFailedAttempt(redis, 'locked@example.com');
      await recordFailedAttempt(redis, 'locked@example.com');

      const status = await checkLockout(redis, 'locked@example.com');
      expect(status.locked).toBe(true);
      expect(status.remainingSeconds).toBe(900);
    });

    it('reset clears lockout so check returns not locked', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');

      // Simulate successful login
      await resetLockout(redis, 'user@example.com');

      const status = await checkLockout(redis, 'user@example.com');
      expect(status.locked).toBe(false);
    });

    it('reset after partial failures allows fresh attempt sequence', async () => {
      await recordFailedAttempt(redis, 'user@example.com');
      await recordFailedAttempt(redis, 'user@example.com');

      // Successful login
      await resetLockout(redis, 'user@example.com');

      // Start fresh — should not lock until 3 more failures
      const s1 = await recordFailedAttempt(redis, 'user@example.com');
      expect(s1.locked).toBe(false);
      const s2 = await recordFailedAttempt(redis, 'user@example.com');
      expect(s2.locked).toBe(false);
      const s3 = await recordFailedAttempt(redis, 'user@example.com');
      expect(s3.locked).toBe(true);
    });
  });
});
