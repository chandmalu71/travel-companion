import { type Kysely, sql } from 'kysely';

/**
 * Migration 006: Home Location
 *
 * Adds home_locations table for user's primary and native home addresses.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('home_locations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('type', 'varchar(20)', (col) => col.notNull()) // 'primary' or 'native'
    .addColumn('city', 'varchar(100)', (col) => col.notNull())
    .addColumn('country', 'varchar(100)', (col) => col.notNull())
    .addColumn('address', 'text') // optional full address
    .addColumn('latitude', 'decimal(9,6)')
    .addColumn('longitude', 'decimal(9,6)')
    .addColumn('timezone', 'varchar(50)') // e.g. 'Europe/London'
    .addColumn('nearest_airports', 'text') // JSON array of IATA codes
    .addColumn('transport_mode', 'varchar(30)') // drive, taxi, public_transport, train, drop_off
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex('idx_home_locations_user_id')
    .on('home_locations')
    .column('user_id')
    .execute();

  // Unique constraint: one primary + one native per user
  await db.schema
    .createIndex('idx_home_locations_user_type')
    .on('home_locations')
    .columns(['user_id', 'type'])
    .unique()
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('home_locations').execute();
}
