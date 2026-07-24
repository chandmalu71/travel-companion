import { type Kysely, sql } from 'kysely';

/**
 * Migration 029: Landing Page A/B Tests
 *
 * Enables admin to create multiple CTA variants and split-test them.
 * - landing_ab_tests: test container (name, status, winner)
 * - landing_ab_variants: individual variants with content, traffic %, and metrics
 */
export async function up(db: Kysely<any>): Promise<void> {
  // ─── A/B Tests ─────────────────────────────────────────────────────────────
  await db.schema
    .createTable('landing_ab_tests')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('draft'))
    .addColumn('winner_variant_id', 'uuid')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('started_at', 'timestamptz')
    .addColumn('ended_at', 'timestamptz')
    .execute();

  await sql`CREATE INDEX idx_landing_ab_tests_status ON landing_ab_tests (status)`.execute(db);

  // ─── A/B Variants ──────────────────────────────────────────────────────────
  await db.schema
    .createTable('landing_ab_variants')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('test_id', 'uuid', (col) =>
      col.notNull().references('landing_ab_tests.id').onDelete('cascade'))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('mode', 'varchar(20)', (col) => col.notNull())
    .addColumn('content', 'jsonb', (col) => col.notNull())
    .addColumn('traffic_percent', 'integer', (col) => col.notNull())
    .addColumn('views', 'integer', (col) => col.defaultTo(0))
    .addColumn('conversions', 'integer', (col) => col.defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await sql`CREATE INDEX idx_landing_ab_variants_test ON landing_ab_variants (test_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('landing_ab_variants').ifExists().execute();
  await db.schema.dropTable('landing_ab_tests').ifExists().execute();
}
