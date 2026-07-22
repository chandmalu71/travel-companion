/**
 * Reset remote database and run all migrations.
 * Usage: DATABASE_URL=<url> npx tsx src/scripts/reset-and-migrate.ts
 */
import pg from 'pg';
import { Kysely, PostgresDialect } from 'kysely';
import { migrateToLatest } from '../db/migrator.js';
import type { Database } from '../db/types.js';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not set');
    process.exit(1);
  }

  console.log('Connecting...');
  const pool = new pg.Pool({
    connectionString: url,
    ssl: { rejectUnauthorized: false },
  });

  // Reset schema
  console.log('Dropping all tables...');
  const client = await pool.connect();
  await client.query('DROP SCHEMA public CASCADE; CREATE SCHEMA public;');
  client.release();
  console.log('Schema reset.');

  // Run migrations
  const db = new Kysely<Database>({
    dialect: new PostgresDialect({ pool }),
  });

  console.log('Running migrations...');
  const result = await migrateToLatest(db);

  if (result.error) {
    console.error('Migration error:', result.error);
    await db.destroy();
    process.exit(1);
  }

  if (result.results && result.results.length > 0) {
    for (const r of result.results) {
      console.log(`  ${r.status === 'Success' ? '✓' : '✗'} ${r.migrationName}`);
    }
    console.log(`\n${result.results.length} migrations executed successfully.`);
  }

  await db.destroy();
  console.log('Done!');
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
