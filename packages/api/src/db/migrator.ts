import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promises as fs } from 'node:fs';
import { FileMigrationProvider, Migrator, type Kysely, type MigrationResultSet } from 'kysely';
import type { Database } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Create a Kysely Migrator instance configured to use file-based migrations.
 */
export function createMigrator(db: Kysely<Database>): Migrator {
  const migrationFolder = path.join(__dirname, 'migrations');

  return new Migrator({
    db,
    provider: new FileMigrationProvider({
      fs,
      path,
      migrationFolder,
    }),
  });
}

/**
 * Run all pending migrations up to the latest.
 */
export async function migrateToLatest(db: Kysely<Database>): Promise<MigrationResultSet> {
  const migrator = createMigrator(db);
  return migrator.migrateToLatest();
}

/**
 * Roll back the last migration.
 */
export async function migrateDown(db: Kysely<Database>): Promise<MigrationResultSet> {
  const migrator = createMigrator(db);
  return migrator.migrateDown();
}
