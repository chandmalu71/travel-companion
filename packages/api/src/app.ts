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
import { registerBookingForwardRoutes } from './routes/booking-forward.js';
import { registerEmailConnectionRoutes } from './routes/email-connections.js';
import { registerAdminRoutes, registerAdminRoleRoutes, registerAdminTripsRoute, registerAdminCreateUserRoute, registerAdminImpersonateRoute } from './routes/admin.js';
import { registerAdminAuth } from './plugins/admin-auth.js';
import { registerExpenseRoutes } from './routes/expenses.js';
import { registerExpenseGroupRoutes } from './routes/expense-groups.js';
import { registerExpenseSplittingRoutes } from './routes/expense-splitting.js';
import { registerI18nRoutes, registerPreferenceOptionsRoutes } from './routes/i18n.js';
import { registerTripMembersRoutes, registerTripInvitationRoutes, registerAdminTripMembershipRoutes } from './routes/trip-members.js';
import { registerDocumentRoutes } from './routes/documents.js';
import { registerHighlightRoutes } from './routes/highlights.js';
import { registerPreferencesRoutes, registerDashboardConfigRoutes } from './routes/preferences.js';
import { registerConnectionRoutes } from './routes/connections.js';
import { registerFamilyMemberRoutes } from './routes/family-members.js';
import { registerTripTipsRoutes } from './routes/trip-tips.js';
import { registerWeatherRoutes } from './routes/weather.js';
import { registerMessagingRoutes } from './routes/messaging.js';
import { registerEmailAliasRoutes } from './routes/email-aliases.js';
import { registerSubscriptionRoutes, registerAdminPlanRoutes, registerAdminPromotionRoutes, registerAdminCampaignRoutes } from './routes/subscriptions.js';
import { registerReceiptScanRoute } from './routes/receipt-scan.js';
import { registerAnalyticsRoutes } from './routes/analytics.js';
import { registerTripTimelineRoute } from './routes/trip-timeline.js';
import { registerHomeLocationRoutes } from './routes/home-location.js';
import { registerSharingRoutes } from './routes/sharing.js';
import { registerSyncRoutes } from './routes/sync.js';
import { registerActivityFeedRoutes } from './routes/activity-feed.js';
import { registerSourceAttachmentsRoute } from './routes/source-attachments.js';
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
  } else {
    // In local dev mode, register a pass-through requireAuth decorator
    app.decorate('requireAuth', async (request: any) => {
      request.userId = request.userId ?? 'dev-user';
      request.user = request.user ?? { userId: 'dev-user', email: 'dev@local' };
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

  // Register trip routes (requires DB)
  if (options.db) {
    await registerTripRoutes(app, { db: options.db });
  }

  // Register booking routes (requires DB)
  if (options.db) {
    await registerBookingRoutes(app, { db: options.db });
  }

  // Register expense routes (requires DB + currency service)
  if (options.db) {
    const { CurrencyService } = await import('./services/currency.js');
    const redis = (app as any).redis ?? { get: async () => null, set: async () => {}, setex: async () => {} };
    const currencyService = new CurrencyService(redis);
    await registerExpenseRoutes(app, { db: options.db, currencyService });
  }

  // Register expense group (splitting) routes
  if (options.db) {
    await registerExpenseGroupRoutes(app, { db: options.db });
    await registerExpenseSplittingRoutes(app, { db: options.db });
    await registerI18nRoutes(app, { db: options.db });
    await registerPreferenceOptionsRoutes(app, { db: options.db });
    await registerTripMembersRoutes(app, { db: options.db });
    await registerTripInvitationRoutes(app, { db: options.db });
    await registerAdminTripMembershipRoutes(app, { db: options.db });
  }

  // Register document routes
  if (options.db) {
    await registerDocumentRoutes(app, {
      db: options.db,
      s3Bucket: process.env['S3_DOCS_BUCKET'] ?? 'neyya-docs-qa',
      s3Region: process.env['AWS_REGION'] ?? 'eu-west-1',
      cloudfrontDomain: process.env['CLOUDFRONT_DOCS_DOMAIN'],
    });
  }

  // Register highlights (social sharing) routes
  if (options.db) {
    await registerHighlightRoutes(app, { db: options.db });
  }

  // Register user preferences routes
  if (options.db) {
    await registerPreferencesRoutes(app, { db: options.db });
    await registerDashboardConfigRoutes(app, { db: options.db });
  }

  // Register user connections routes
  if (options.db) {
    await registerConnectionRoutes(app, { db: options.db });
  }

  // Register family members routes
  if (options.db) {
    await registerFamilyMemberRoutes(app, { db: options.db });
  }

  // Register AI trip tips routes
  if (options.db) {
    await registerTripTipsRoutes(app, { db: options.db });
  }

  // Register weather routes
  if (options.db) {
    await registerWeatherRoutes(app, { db: options.db });
  }

  // Register messaging routes
  if (options.db) {
    await registerMessagingRoutes(app, { db: options.db });
  }

  // Register email alias routes
  if (options.db) {
    await registerEmailAliasRoutes(app, { db: options.db });
  }

  // Register subscription routes
  if (options.db) {
    await registerSubscriptionRoutes(app, { db: options.db });
    await registerAdminPlanRoutes(app, { db: options.db });
    await registerAdminPromotionRoutes(app, { db: options.db });
    await registerAdminCampaignRoutes(app, { db: options.db });
  }

  // Register receipt scanning route
  await registerReceiptScanRoute(app);

  // Register analytics routes
  if (options.db) {
    await registerAnalyticsRoutes(app, { db: options.db });
  }

  // Register enriched trip timeline route
  if (options.db) {
    await registerTripTimelineRoute(app, { db: options.db });
  }

  // Register source attachments routes
  if (options.db) {
    await registerSourceAttachmentsRoute(app, { db: options.db });
  }

  // Register home location routes
  if (options.db) {
    await registerHomeLocationRoutes(app, { db: options.db });
  }

  // Register favorites and collections routes (requires DB)
  if (options.db) {
    await registerFavoriteRoutes(app, { db: options.db });
  }

  // Register POI routes (requires DB)
  if (options.db) {
    await registerPOIRoutes(app, {
      db: options.db,
      redis: options.redisClient ?? (app as unknown as { redis?: RedisClient }).redis,
    });
  }

  // Register timeline event routes (requires DB)
  if (options.db) {
    await registerTimelineRoutes(app, { db: options.db });
  }

  // Register map routes (requires DB)
  if (options.db) {
    await registerMapRoutes(app, { db: options.db });
  }

  // Register vote routes (requires DB)
  if (options.db) {
    await registerVoteRoutes(app, { db: options.db });
  }

  // Register email connection routes (requires DB) — new enhanced version
  if (options.db) {
    await registerEmailConnectionRoutes(app, { db: options.db });
  }

  // Register email webhook routes (public — no auth required, rate-limited)
  if (options.db) {
    await registerEmailWebhookRoutes(app, {
      db: options.db,
      sqsQueueUrl: app.config.SQS_EMAIL_QUEUE_URL || undefined,
    });
  }

  // Register AI search routes (requires DB)
  if (options.db) {
    await registerSearchRoutes(app, {
      db: options.db,
      redis: options.redisClient ?? (app as unknown as { redis?: RedisClient }).redis,
    });
  }

  // Register booking forward ingestion routes (public + authenticated)
  if (options.db) {
    await registerBookingForwardRoutes(app, { db: options.db });
  }

  // Register email connection management routes (authenticated)
  // (already registered above)

  // Register sharing routes (requires DB)
  if (options.db) {
    await registerSharingRoutes(app, { db: options.db });
  }

  // Register sync routes (requires DB)
  if (options.db) {
    await registerSyncRoutes(app, { db: options.db });
  }

  // Register activity feed routes (requires DB)
  if (options.db) {
    await registerActivityFeedRoutes(app, { db: options.db });
  }

  // Register admin routes (requires DB + admin auth)
  if (options.db) {
    await app.register(registerAdminAuth, { db: options.db });
    await registerAdminRoutes(app, { db: options.db });
    await registerAdminRoleRoutes(app, { db: options.db });
    await registerAdminTripsRoute(app, { db: options.db });
    await registerAdminCreateUserRoute(app, { db: options.db });
    await registerAdminImpersonateRoute(app, { db: options.db });
  }

  return app;
}
