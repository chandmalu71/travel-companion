import { describe, it, expect, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { type Redis as RedisClient } from 'ioredis';
import { checkLockout, recordFailedAttempt, resetLockout } from '../../lockout.js';

/**
 * Feature: travel-companion, Property 2: Account Lockout State Machine
 *
 * For any sequence of login attempts (success or failure) for a given account,
 * the account SHALL be locked if and only if the most recent 3 consecutive
 * attempts were all failures without an intervening success. A successful
 * login at any point resets the failure counter.
 *
 * **Validates: Requirements 1.4**
 */

/**
 * Create an in-memory mock Redis client that simulates the operations
 * used by the lockout service: get, set, del, incr, expire, ttl.
 */
function createMockRedis(): RedisClient & { _store: Map<string, { value: string; ttl: number }> } {
  const store = new Map<string, { value: string; ttl: number }>();

  const mock = {
    get: async (key: string) => {
      const entry = store.get(key);
      return entry ? entry.value : null;
    },
    set: async (key: string, value: string, _mode?: string, ttl?: number) => {
      store.set(key, { value, ttl: ttl ?? 0 });
      return 'OK';
    },
    del: async (...keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        if (store.has(key)) count++;
        store.delete(key);
      }
      return count;
    },
    incr: async (key: string) => {
      const entry = store.get(key);
      const newVal = entry ? parseInt(entry.value, 10) + 1 : 1;
      store.set(key, { value: String(newVal), ttl: entry?.ttl ?? 0 });
      return newVal;
    },
    expire: async (key: string, ttl: number) => {
      const entry = store.get(key);
      if (entry) {
        entry.ttl = ttl;
        return 1;
      }
      return 0;
    },
    ttl: async (key: string) => {
      const entry = store.get(key);
      if (!entry) return -2;
      return entry.ttl > 0 ? entry.ttl : -1;
    },
    _store: store,
  };

  return mock as unknown as RedisClient & { _store: typeof store };
}

/**
 * Determine the expected lockout state from a sequence of events.
 *
 * The account should be locked iff the last 3 or more consecutive events
 * are all 'failure' without any intervening 'success'.
 */
function expectedLocked(events: Array<'success' | 'failure'>): boolean {
  let consecutiveFailures = 0;
  for (const event of events) {
    if (event === 'failure') {
      consecutiveFailures++;
    } else {
      consecutiveFailures = 0;
    }
  }
  return consecutiveFailures >= 3;
}

describe('Property 2: Account Lockout State Machine', () => {
  let redis: ReturnType<typeof createMockRedis>;
  const testEmail = 'test@example.com';

  beforeEach(() => {
    redis = createMockRedis();
  });

  it('account is locked iff there are 3+ consecutive failures without intervening success', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(fc.constant('success' as const), fc.constant('failure' as const)), {
          minLength: 0,
          maxLength: 20,
        }),
        async (events) => {
          // Fresh Redis for each test case
          redis = createMockRedis();

          // Replay the event sequence against the lockout service
          for (const event of events) {
            if (event === 'failure') {
              await recordFailedAttempt(redis, testEmail);
            } else {
              await resetLockout(redis, testEmail);
            }
          }

          // Check the final lockout state
          const status = await checkLockout(redis, testEmail);
          const expected = expectedLocked(events);

          expect(status.locked).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('after a reset (success), the failure counter starts fresh', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a prefix of events followed by a success, then more events
        fc.array(fc.oneof(fc.constant('success' as const), fc.constant('failure' as const)), {
          minLength: 1,
          maxLength: 10,
        }),
        fc.array(fc.oneof(fc.constant('success' as const), fc.constant('failure' as const)), {
          minLength: 0,
          maxLength: 10,
        }),
        async (prefix, suffix) => {
          redis = createMockRedis();

          // Play the prefix
          for (const event of prefix) {
            if (event === 'failure') {
              await recordFailedAttempt(redis, testEmail);
            } else {
              await resetLockout(redis, testEmail);
            }
          }

          // Force a reset (simulating successful login)
          await resetLockout(redis, testEmail);

          // Play the suffix
          for (const event of suffix) {
            if (event === 'failure') {
              await recordFailedAttempt(redis, testEmail);
            } else {
              await resetLockout(redis, testEmail);
            }
          }

          // The final state should only depend on the suffix
          // (since the reset clears the counter)
          const status = await checkLockout(redis, testEmail);
          const expected = expectedLocked(suffix);

          expect(status.locked).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('lockout state is correct at any point in the sequence', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.oneof(fc.constant('success' as const), fc.constant('failure' as const)), {
          minLength: 1,
          maxLength: 15,
        }),
        async (events) => {
          redis = createMockRedis();

          // Replay events one by one, checking state after each
          const replayed: Array<'success' | 'failure'> = [];

          for (const event of events) {
            replayed.push(event);

            if (event === 'failure') {
              await recordFailedAttempt(redis, testEmail);
            } else {
              await resetLockout(redis, testEmail);
            }

            const status = await checkLockout(redis, testEmail);
            const expected = expectedLocked(replayed);

            expect(status.locked).toBe(expected);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});
