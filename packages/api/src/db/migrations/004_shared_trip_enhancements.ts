import { type Kysely, sql } from 'kysely';

/**
 * Migration 004: Shared Trip Enhancements
 *
 * Adds fields for:
 * - Co-owner role support on trip_members
 * - Member departure tracking
 * - Expense shared/personal flag
 * - Scan frequency on email_connections
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add departure tracking to trip_members
  await db.schema
    .alterTable('trip_members')
    .addColumn('departed', 'boolean', (col) => col.defaultTo(false))
    .execute();

  await db.schema
    .alterTable('trip_members')
    .addColumn('departed_at', 'timestamptz')
    .execute();

  // Update access_level check constraint to include co-owner
  // (PostgreSQL: drop and recreate constraint)
  await sql`ALTER TABLE trip_members DROP CONSTRAINT IF EXISTS trip_members_access_level_check`.execute(db);
  await sql`ALTER TABLE trip_members ADD CONSTRAINT trip_members_access_level_check CHECK (access_level IN ('owner', 'co-owner', 'editor', 'view', 'edit'))`.execute(db);

  // is_shared column already created in migration 002 — skip here

  // Add scan settings to email_connections
  await db.schema
    .alterTable('email_connections')
    .addColumn('scan_frequency', 'varchar(10)', (col) => col.defaultTo('5min'))
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('last_scan_status', 'varchar(20)', (col) => col.defaultTo('never'))
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('last_scan_error', 'text')
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('imap_host', 'varchar(255)')
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('imap_port', 'integer')
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('imap_username', 'varchar(255)')
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('imap_password_encrypted', 'text')
    .execute();

  await db.schema
    .alterTable('email_connections')
    .addColumn('imap_use_tls', 'boolean', (col) => col.defaultTo(true))
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('trip_members').dropColumn('departed').execute();
  await db.schema.alterTable('trip_members').dropColumn('departed_at').execute();
  await db.schema.alterTable('expenses').dropColumn('is_shared').execute();
  await db.schema.alterTable('email_connections').dropColumn('scan_frequency').execute();
  await db.schema.alterTable('email_connections').dropColumn('is_active').execute();
  await db.schema.alterTable('email_connections').dropColumn('last_scan_status').execute();
  await db.schema.alterTable('email_connections').dropColumn('last_scan_error').execute();
  await db.schema.alterTable('email_connections').dropColumn('imap_host').execute();
  await db.schema.alterTable('email_connections').dropColumn('imap_port').execute();
  await db.schema.alterTable('email_connections').dropColumn('imap_username').execute();
  await db.schema.alterTable('email_connections').dropColumn('imap_password_encrypted').execute();
  await db.schema.alterTable('email_connections').dropColumn('imap_use_tls').execute();
}
