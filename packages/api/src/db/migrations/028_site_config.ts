import { type Kysely, sql } from 'kysely';

/**
 * Migration 028: Site Config (key-value store)
 *
 * Simple key-value table for admin-configurable settings
 * like landing page CTA mode, feature flags, etc.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('site_config')
    .addColumn('key', 'varchar(100)', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // Seed default landing CTA mode
  await sql`INSERT INTO site_config (key, value) VALUES ('landing_cta_mode', 'early_access')`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('site_config').ifExists().execute();
}
