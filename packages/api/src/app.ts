import Fastify, { type FastifyInstance } from 'fastify';
import { registerConfig, type AppConfig } from './config.js';
import {
  registerCors,
  registerHelmet,
  registerRateLimit,
  registerRedis,
  registerSession,
  registerAuthMiddleware,
} from './plugins/index.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerAuthRoutes, type AuthRoutesOptions } from './routes/auth.js';
import { registerTripRoutes } from './routes/trips.js';
import { registerBookingRoutes } from './routes/bookings.js';
import { registerFavoriteRoutes } from './routes/favorites.js';
import { registerPOIRoutes } from './routes/pois.js';
import { registerTimelineRoutes } from './routes/timeline.js';
import { registerMapRoutes } from './routes/map.js';
import { registerVoteRoutes } from './routes/votes.js';
import { registerEmailRoutes } from './routes/email.js';
import { registerEmailWebhookRoutes } from './routes/email-webhooks.js';
import { registerSearchRoutes } from './routes/search.js';
import { registerSharingRoutes } from './routes/sharing.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerActivityFeedRoutes } from './routes/activity-feed.js';
import { CognitoService } from './services/cognito.js';
import { type Kysely } from 'kysely';
import { type Database } from './db/types.js';
import { type Redis as RedisClient } from 'ioredis';

declare module 'fastify' {
  interface FastifyInstance {
    config: AppConfig;
  }
}

export interface BuildAppOptions {
  logger?: boolean | object;
  /** Skip Redis connection (useful for testing without Redis) */
  skipRedis?: boolean;
  /** Provide a pre-configured Redis client (useful for testing) */
  redisClient?: RedisClient;
  /** Skip auth routes (useful for testing without Cognito/DB) */
  skipAuth?: boolean;
  /** Skip auth middleware registration (useful for testing) */
  skipAuthMiddleware?: boolean;
  /** Provide auth route dependencies directly (for testing) */
  authOptions?: AuthRoutesOptions;
  /** Provide a database instance */
  db?: Kysely<Database>;
}

/**
 * Build and configure the Fastify application with all plugins and routes.
 */
export async function buildApp(
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const app = Fastify({
    logger: options.logger ?? {
      level: process.env['LOG_LEVEL'] || 'info',
      transport:
        process.env['NODE_ENV'] === 'development'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
    },
  });

  // Register environment configuration first
  await registerConfig(app);

  // Register security and middleware plugins
  await registerHelmet(app);
  await registerCors(app);

  // Register Redis connection (before rate limiting so it can use Redis store)
  if (!options.skipRedis) {
    await app.register(registerRedis, {
      client: options.redisClient,
    });

    // Register session management (requires Redis)
    await app.register(registerSession, {});
  }

  // Register rate limiting (will use Redis if available)
  await registerRateLimit(app);

  // Register auth middleware (JWT verification via Cognito JWKS)
  if (!options.skipAuthMiddleware) {
    await app.register(registerAuthMiddleware, {
      userPoolId: app.config.COGNITO_USER_POOL_ID || undefined,
      region: app.config.COGNITO_REGION || undefined,
      jwksUrl: app.config.COGNITO_JWKS_URL || undefined,
    });
  }

  // Register routes
  await registerHealthRoutes(app);

  // Register auth routes (requires Cognito and DB)
  if (!options.skipAuth) {
    if (options.authOptions) {
      await registerAuthRoutes(app, options.authOptions);
    } else if (app.config.COGNITO_USER_POOL_ID && app.config.COGNITO_CLIENT_ID && options.db) {
      const cognitoService = new CognitoService({
        userPoolId: app.config.COGNITO_USER_POOL_ID,
        clientId: app.config.COGNITO_CLIENT_ID,
        region: app.config.COGNITO_REGION,
      });
      await registerAuthRoutes(app, { cognitoService, db: options.db });
    }
  }

  // Register trip routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerTripRoutes(app, { db: options.db });
  }

  // Register booking routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerBookingRoutes(app, { db: options.db });
  }

  // Register favorites and collections routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerFavoriteRoutes(app, { db: options.db });
  }

  // Register POI routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerPOIRoutes(app, {
      db: options.db,
      redis: options.redisClient ?? (app as unknown as { redis?: RedisClient }).redis,
    });
  }

  // Register timeline event routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerTimelineRoutes(app, { db: options.db });
  }

  // Register map routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerMapRoutes(app, { db: options.db });
  }

  // Register vote routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerVoteRoutes(app, { db: options.db });
  }

  // Register email connection routes (requires DB, auth middleware, and email config)
  if (options.db && !options.skipAuthMiddleware) {
    await registerEmailRoutes(app, {
      db: options.db,
      config: {
        gmailClientId: app.config.GMAIL_CLIENT_ID,
        gmailClientSecret: app.config.GMAIL_CLIENT_SECRET,
        outlookClientId: app.config.OUTLOOK_CLIENT_ID,
        outlookClientSecret: app.config.OUTLOOK_CLIENT_SECRET,
        encryptionKey: app.config.EMAIL_ENCRYPTION_KEY,
      },
    });
  }

  // Register email webhook routes (public — no auth required, rate-limited)
  if (options.db) {
    await registerEmailWebhookRoutes(app, {
      db: options.db,
      sqsQueueUrl: app.config.SQS_EMAIL_QUEUE_URL || undefined,
    });
  }

  // Register AI search routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerSearchRoutes(app, {
      db: options.db,
      redis: options.redisClient ?? (app as unknown as { redis?: RedisClient }).redis,
    });
  }

  // Register sharing routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerSharingRoutes(app, { db: options.db });
  }

  // Register sync routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerSyncRoutes(app, { db: options.db });
  }

  // Register activity feed routes (requires DB and auth middleware)
  if (options.db && !options.skipAuthMiddleware) {
    await registerActivityFeedRoutes(app, { db: options.db });
  }

  return app;
}
