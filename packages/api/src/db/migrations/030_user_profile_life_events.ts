import { type Kysely, sql } from 'kysely';

/**
 * Migration 030: User Profile Extension & Life Events
 *
 * Extends user profile with:
 * - Date of birth, anniversary, nationality
 * - Current city/country with move dates
 *
 * Adds:
 * - user_milestones: custom life events (birthdays, anniversaries, moves, etc.)
 * - login_sessions: tracks devices/IPs for security alerts
 *
 * Implements Requirement 55.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // ─── Extend users table with profile fields ────────────────────────────────
  await db.schema.alterTable('users').addColumn('date_of_birth', 'date').execute();
  await db.schema.alterTable('users').addColumn('anniversary_date', 'date').execute();
  await db.schema.alterTable('users').addColumn('nationality', 'varchar(100)').execute();
  await db.schema.alterTable('users').addColumn('current_city', 'varchar(100)').execute();
  await db.schema.alterTable('users').addColumn('current_country', 'varchar(100)').execute();
  await db.schema.alterTable('users').addColumn('moved_to_city_date', 'date').execute();
  await db.schema.alterTable('users').addColumn('moved_to_country_date', 'date').execute();
  await db.schema.alterTable('users').addColumn('phone', 'varchar(30)').execute();
  await db.schema.alterTable('users').addColumn('gender', 'varchar(20)').execute();

  // ─── User Milestones (life events for automations) ─────────────────────────
  await db.schema
    .createTable('user_milestones')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('type', 'varchar(50)', (col) => col.notNull())
    .addColumn('title', 'varchar(200)', (col) => col.notNull())
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('recurring', 'boolean', (col) => col.defaultTo(false))
    .addColumn('notes', 'text')
    .addColumn('related_person', 'varchar(100)')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await sql`CREATE INDEX idx_user_milestones_user ON user_milestones (user_id)`.execute(db);
  await sql`CREATE INDEX idx_user_milestones_date ON user_milestones (date)`.execute(db);

  // ─── Login Sessions (device tracking for security alerts) ──────────────────
  await db.schema
    .createTable('login_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('ip_address', 'varchar(45)')
    .addColumn('user_agent', 'text')
    .addColumn('device_fingerprint', 'varchar(64)')
    .addColumn('city', 'varchar(100)')
    .addColumn('country', 'varchar(100)')
    .addColumn('is_new_device', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await sql`CREATE INDEX idx_login_sessions_user ON login_sessions (user_id, created_at DESC)`.execute(db);
  await sql`CREATE INDEX idx_login_sessions_fingerprint ON login_sessions (user_id, device_fingerprint)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('login_sessions').ifExists().execute();
  await db.schema.dropTable('user_milestones').ifExists().execute();

  await db.schema.alterTable('users').dropColumn('date_of_birth').execute();
  await db.schema.alterTable('users').dropColumn('anniversary_date').execute();
  await db.schema.alterTable('users').dropColumn('nationality').execute();
  await db.schema.alterTable('users').dropColumn('current_city').execute();
  await db.schema.alterTable('users').dropColumn('current_country').execute();
  await db.schema.alterTable('users').dropColumn('moved_to_city_date').execute();
  await db.schema.alterTable('users').dropColumn('moved_to_country_date').execute();
  await db.schema.alterTable('users').dropColumn('phone').execute();
  await db.schema.alterTable('users').dropColumn('gender').execute();
}
