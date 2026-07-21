import { type Kysely, sql } from 'kysely';

/**
 * Migration 015: User Connections (Travel Contacts)
 *
 * When users collaborate on trips (invite accepted), they're automatically
 * added to each other's connected users list. Users can also manually add
 * connections by email. Connected users appear as suggestions when inviting
 * people to future trips.
 *
 * Statuses:
 *  - connected: both parties accepted (mutual)
 *  - invited: invitation sent, not yet accepted
 *  - declined: invitation was declined
 *  - blocked: user has blocked this connection
 *
 * Privacy levels:
 *  - full: share name, email, avatar
 *  - limited: share name only
 *  - minimal: share display name only (no email)
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('user_connections')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('connected_user_id', 'uuid', (col) => col.references('users.id').onDelete('cascade'))
    .addColumn('connected_email', 'varchar(255)')
    .addColumn('connected_name', 'varchar(255)')
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('invited'))
    .addColumn('label', 'varchar(100)')
    .addColumn('privacy', 'varchar(20)', (col) => col.notNull().defaultTo('full'))
    .addColumn('source', 'varchar(50)', (col) => col.notNull().defaultTo('manual'))
    .addColumn('source_trip_id', 'uuid')
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Unique constraint: one connection record per user pair
  await db.schema
    .createIndex('idx_user_connections_pair')
    .on('user_connections')
    .columns(['user_id', 'connected_user_id'])
    .unique()
    .execute();

  // Index for quick lookups by user
  await db.schema
    .createIndex('idx_user_connections_user')
    .on('user_connections')
    .column('user_id')
    .execute();

  // Index for looking up by email (for non-registered users)
  await db.schema
    .createIndex('idx_user_connections_email')
    .on('user_connections')
    .column('connected_email')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('user_connections').execute();
}
