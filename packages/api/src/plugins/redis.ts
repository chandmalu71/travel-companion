import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import Redis, { type Redis as RedisClient } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    redis: RedisClient;
  }
}

export interface RedisPluginOptions {
  url?: string;
  /** Provide a pre-configured Redis instance (useful for testing) */
  client?: RedisClient;
}

/**
 * Redis connection plugin for Fastify.
 *
 * Connects to Redis (ElastiCache compatible) and decorates the Fastify
 * instance with `app.redis` for use throughout the application.
 *
 * Redis is used for:
 * - Session management
 * - Rate limiting
 * - Exchange rate caching
 * - Weather data caching
 * - POI data caching
 * - Account lockout tracking
 */
async function redisPlugin(
  app: FastifyInstance,
  options: RedisPluginOptions,
): Promise<void> {
  const config = (app as unknown as { config?: { REDIS_URL?: string } }).config;
  const url = options.url ?? config?.REDIS_URL ?? 'redis://localhost:6379';

  const client =
    options.client ??
    new Redis(url, {
      maxRetriesPerRequest: null,
      retryStrategy(times: number) {
        if (times > 10) return null; // stop retrying after 10 attempts
        const delay = Math.min(times * 200, 3000);
        return delay;
      },
      lazyConnect: true,
      enableReadyCheck: false,
      tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
    });

  // Only connect if we created the client ourselves (not injected)
  if (!options.client) {
    try {
      await client.connect();
      app.log.info('Redis connection established');
    } catch (err) {
      app.log.warn({ err }, 'Redis connection failed, will retry on demand');
    }
  }

  app.decorate('redis', client);

  app.addHook('onClose', async () => {
    if (!options.client) {
      await client.quit();
      app.log.info('Redis connection closed');
    }
  });
}

export const registerRedis = fp(redisPlugin, {
  name: 'redis',
  fastify: '>=4.0.0',
});
