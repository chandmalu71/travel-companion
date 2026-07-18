import { type FastifyInstance } from 'fastify';
import rateLimit from '@fastify/rate-limit';

/**
 * Register rate limiting plugin.
 *
 * When Redis is available (app.redis is decorated) and supports the
 * defineCommand method required by @fastify/rate-limit, uses Redis as
 * the store for distributed rate limiting across multiple instances.
 * Falls back to in-memory store when Redis is not available.
 */
export async function registerRateLimit(app: FastifyInstance): Promise<void> {
  const config = (
    app as unknown as {
      config: { RATE_LIMIT_MAX: number; RATE_LIMIT_TIME_WINDOW: number };
    }
  ).config;

  const redis = (
    app as unknown as { redis?: { defineCommand?: unknown } }
  ).redis;

  const rateLimitOptions: Parameters<typeof rateLimit>[1] = {
    max: config.RATE_LIMIT_MAX,
    timeWindow: config.RATE_LIMIT_TIME_WINDOW,
  };

  // Use Redis store when available and it supports defineCommand
  // (required by @fastify/rate-limit's RedisStore)
  if (redis && typeof redis.defineCommand === 'function') {
    rateLimitOptions.redis = redis;
    app.log.info('Rate limiting configured with Redis store');
  } else {
    app.log.info('Rate limiting configured with in-memory store');
  }

  await app.register(rateLimit, rateLimitOptions);
}
