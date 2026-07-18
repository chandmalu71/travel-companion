import { type Redis as RedisClient } from 'ioredis';

/**
 * Account lockout service.
 *
 * Tracks consecutive failed login attempts per email in Redis and locks
 * accounts after 3 consecutive failures. The lock lasts 15 minutes.
 *
 * Key patterns:
 *   - `lockout:attempts:{email}` — counter with 15-min TTL
 *   - `lockout:locked:{email}`  — lock flag with 15-min TTL
 */

/** Maximum consecutive failures before locking */
const MAX_ATTEMPTS = 3;
/** TTL for both the counter and the lock key, in seconds (15 minutes) */
const LOCKOUT_TTL_SECONDS = 15 * 60;

export interface LockoutStatus {
  /** Whether the account is currently locked */
  locked: boolean;
  /** Seconds remaining on the lock (0 if not locked) */
  remainingSeconds: number;
  /** Human-readable message (only present when locked) */
  message?: string;
}

function attemptsKey(email: string): string {
  return `lockout:attempts:${email.toLowerCase()}`;
}

function lockedKey(email: string): string {
  return `lockout:locked:${email.toLowerCase()}`;
}

/**
 * Check whether a given email account is currently locked.
 * Returns lock status and remaining lock duration.
 */
export async function checkLockout(
  redis: RedisClient,
  email: string,
): Promise<LockoutStatus> {
  const key = lockedKey(email);
  const lockValue = await redis.get(key);

  if (!lockValue) {
    return { locked: false, remainingSeconds: 0 };
  }

  // Get TTL to know how long remains
  const ttl = await redis.ttl(key);
  const remaining = ttl > 0 ? ttl : 0;

  return {
    locked: true,
    remainingSeconds: remaining,
    message: `Account is temporarily locked. Try again in ${Math.ceil(remaining / 60)} minute(s).`,
  };
}

/**
 * Record a failed login attempt for the given email.
 *
 * - Increments the failure counter (with 15-min TTL).
 * - If the counter reaches MAX_ATTEMPTS (3), sets the lock key.
 *
 * Returns the updated lockout status.
 */
export async function recordFailedAttempt(
  redis: RedisClient,
  email: string,
): Promise<LockoutStatus> {
  const aKey = attemptsKey(email);
  const lKey = lockedKey(email);

  // Increment the attempt counter
  const attempts = await redis.incr(aKey);

  // Set TTL on the counter (reset the window on each failure)
  await redis.expire(aKey, LOCKOUT_TTL_SECONDS);

  if (attempts >= MAX_ATTEMPTS) {
    // Lock the account
    await redis.set(lKey, '1', 'EX', LOCKOUT_TTL_SECONDS);

    return {
      locked: true,
      remainingSeconds: LOCKOUT_TTL_SECONDS,
      message: `Account is temporarily locked due to too many failed login attempts. Try again in 15 minutes.`,
    };
  }

  return { locked: false, remainingSeconds: 0 };
}

/**
 * Reset the lockout state for an email on successful login.
 * Deletes both the attempt counter and the lock key.
 */
export async function resetLockout(
  redis: RedisClient,
  email: string,
): Promise<void> {
  const aKey = attemptsKey(email);
  const lKey = lockedKey(email);
  await redis.del(aKey, lKey);
}
