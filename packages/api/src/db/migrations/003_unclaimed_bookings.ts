import { type Kysely, sql } from 'kysely';

/**
 * Migration 003: Unclaimed Bookings table
 *
 * Stores bookings forwarded by unregistered users.
 * Data is held for 60 days, then auto-deleted.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('unclaimed_bookings')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('email', 'varchar(255)', (col) => col.notNull())
    .addColumn('booking_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('destination', 'varchar(255)')
    .addColumn('start_date', 'date')
    .addColumn('end_date', 'date')
    .addColumn('raw_data', 'text', (col) => col.notNull())
    .addColumn('claimed', 'boolean', (col) => col.notNull().defaultTo(false))
    .addColumn('claim_token', 'uuid')
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) =>
      col.notNull().defaultTo(sql`NOW()`),
    )
    .execute();

  // Indexes
  await db.schema
    .createIndex('idx_unclaimed_bookings_email')
    .on('unclaimed_bookings')
    .column('email')
    .execute();

  await db.schema
    .createIndex('idx_unclaimed_bookings_claim_token')
    .on('unclaimed_bookings')
    .column('claim_token')
    .execute();

  await db.schema
    .createIndex('idx_unclaimed_bookings_expires_at')
    .on('unclaimed_bookings')
    .column('expires_at')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('unclaimed_bookings').execute();
}
