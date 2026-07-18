import { buildApp } from './app.js';
import { createDatabaseFromEnv } from './db/database.js';
import { migrateToLatest } from './db/migrator.js';
import { registerLocalAuthRoutes } from './routes/auth-local.js';

/**
 * Start the Fastify server.
 */
async function start(): Promise<void> {
  // Create database connection
  const db = createDatabaseFromEnv();

  // Run migrations
  try {
    const { results, error } = await migrateToLatest(db);
    if (error) {
      console.error('Migration error:', error);
    } else {
      const applied = results?.filter((r) => r.status === 'Success') ?? [];
      if (applied.length > 0) {
        console.log(`Applied ${applied.length} migration(s):`, applied.map((r) => r.migrationName));
      } else {
        console.log('Database is up to date');
      }
    }
  } catch (err) {
    console.error('Migration failed:', err);
  }

  // Ensure password_hash column exists for local auth
  try {
    await db.schema
      .alterTable('users')
      .addColumn('password_hash', 'text')
      .execute();
    console.log('Added password_hash column to users table');
  } catch {
    // Column already exists, ignore
  }

  // Use local auth when Cognito is not properly configured
  const useCognito = process.env['COGNITO_USER_POOL_ID'] &&
    process.env['COGNITO_USER_POOL_ID'] !== 'local-dev' &&
    process.env['COGNITO_USER_POOL_ID'] !== '';

  const app = await buildApp({
    db,
    skipAuth: true, // We'll register our own auth routes
    skipAuthMiddleware: !useCognito, // Skip JWT verification in local dev
  });

  // Register local auth routes when not using Cognito
  if (!useCognito) {
    await registerLocalAuthRoutes(app, { db });
    console.log('Using LOCAL auth (no Cognito) — development mode');

    // Add local auth middleware that extracts userId from local JWT
    app.addHook('preHandler', async (request: any) => {
      const auth = request.headers.authorization;
      if (!auth || !auth.startsWith('Bearer ')) return;

      const token = auth.slice(7);
      const { decodeLocalToken } = await import('./services/local-auth.js');
      const decoded = decodeLocalToken(token);
      if (decoded) {
        request.userId = decoded.sub;
        request.user = { userId: decoded.sub, email: decoded.email };
      }
    });
  }

  try {
    const address = await app.listen({
      port: app.config.PORT,
      host: app.config.HOST,
    });
    app.log.info(`Server listening at ${address}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

start();
