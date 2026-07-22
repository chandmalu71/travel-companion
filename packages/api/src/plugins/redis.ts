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

  // Skip Redis entirely in serverless (Vercel) if no valid URL or if it's localhost
  const isServerless = !!process.env.VERCEL || !!process.env.AWS_LAMBDA_FUNCTION_NAME;
  const isLocalhost = url.includes('localhost') || url.includes('127.0.0.1');

  if (isServerless && isLocalhost) {
    app.log.info('Serverless environment with localhost Redis — skipping Redis');
    app.decorate('redis', null as any);
    return;
  }

  if (options.client) {
    app.decorate('redis', options.client);
    return;
  }

  const client = new Redis(url, {
    maxRetriesPerRequest: null,
    retryStrategy(times: number) {
      if (times > 5) return null;
      return Math.min(times * 300, 3000);
    },
    lazyConnect: true,
    enableReadyCheck: false,
    connectTimeout: 3000,
    tls: url.startsWith('rediss://') ? { rejectUnauthorized: false } : undefined,
  });

  try {
    await client.connect();
    await client.ping();
    app.log.info('Redis connection established');
    app.decorate('redis', client);

    app.addHook('onClose', async () => {
      await client.quit();
    });
  } catch (err) {
    app.log.warn('Redis connection failed — operating without Redis');
    try { client.disconnect(); } catch {}
    app.decorate('redis', null as any);
  }
}

export const registerRedis = fp(redisPlugin, {
  name: 'redis',
  fastify: '>=4.0.0',
});
