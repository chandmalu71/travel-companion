import { Kysely, PostgresDialect } from 'kysely';
import pg from 'pg';
import type { Database } from './types.js';

const { Pool } = pg;

export interface DatabaseConfig {
  connectionString: string;
  maxConnections?: number;
  idleTimeoutMs?: number;
  connectionTimeoutMs?: number;
}

/**
 * Create a Kysely database instance with a PostgreSQL connection pool.
 */
export function createDatabase(config: DatabaseConfig): Kysely<Database> {
  const pool = new Pool({
    connectionString: config.connectionString,
    max: config.maxConnections ?? 20,
    idleTimeoutMillis: config.idleTimeoutMs ?? 30000,
    connectionTimeoutMillis: config.connectionTimeoutMs ?? 5000,
  });

  const dialect = new PostgresDialect({ pool });

  return new Kysely<Database>({ dialect });
}

/**
 * Create a database instance from environment variables.
 */
export function createDatabaseFromEnv(): Kysely<Database> {
  const connectionString =
    process.env['DATABASE_URL'] ?? 'postgresql://localhost:5432/travel_companion';

  return createDatabase({ connectionString });
}
