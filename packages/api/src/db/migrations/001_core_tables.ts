import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // --- Users ---
  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('email', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('cognito_sub', 'varchar(255)', (col) => col.unique().notNull())
    .addColumn('display_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('avatar_url', 'text')
    .addColumn('email_verified', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- User Preferences ---
  await db.schema
    .createTable('user_preferences')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('interests', sql`TEXT[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('dietary_preferences', sql`TEXT[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('allergies', sql`TEXT[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('language', 'varchar(10)', (col) => col.defaultTo('en'))
    .addColumn('display_currencies', sql`TEXT[]`, (col) => col.defaultTo(sql`'{USD}'`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Trips ---
  await db.schema
    .createTable('trips')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('owner_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('start_date', 'date')
    .addColumn('end_date', 'date')
    .addColumn('budget', 'decimal(12, 2)')
    .addColumn('budget_currency', 'varchar(3)')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_date_range',
      sql`end_date IS NULL OR start_date IS NULL OR end_date >= start_date`,
    )
    .execute();

  // --- Trip Members ---
  await db.schema
    .createTable('trip_members')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('email', 'varchar(255)')
    .addColumn('access_level', 'varchar(10)', (col) => col.notNull())
    .addColumn('invited_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('accepted_at', 'timestamptz')
    .addCheckConstraint('valid_access_level', sql`access_level IN ('view', 'edit')`)
    .addUniqueConstraint('trip_members_trip_user_unique', ['trip_id', 'user_id'])
    .addUniqueConstraint('trip_members_trip_email_unique', ['trip_id', 'email'])
    .execute();

  // --- Bookings ---
  await db.schema
    .createTable('bookings')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('trip_id', 'uuid', (col) => col.references('trips.id').onDelete('set null'))
    .addColumn('type', 'varchar(20)', (col) => col.notNull())
    .addColumn('source', 'varchar(20)', (col) => col.notNull().defaultTo('manual'))
    .addColumn('source_email_id', 'text')
    .addColumn('checked_in', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint('valid_booking_type', sql`type IN ('flight', 'hotel', 'car_rental')`)
    .addCheckConstraint('valid_booking_source', sql`source IN ('email', 'manual')`)
    .execute();

  // --- Flight Details ---
  await db.schema
    .createTable('flight_details')
    .addColumn('booking_id', 'uuid', (col) =>
      col.primaryKey().references('bookings.id').onDelete('cascade'),
    )
    .addColumn('airline', 'varchar(100)')
    .addColumn('flight_number', 'varchar(20)')
    .addColumn('departure_airport', 'varchar(10)')
    .addColumn('arrival_airport', 'varchar(10)')
    .addColumn('departure_time', 'timestamptz')
    .addColumn('arrival_time', 'timestamptz')
    .addColumn('departure_lat', 'decimal(9, 6)')
    .addColumn('departure_lng', 'decimal(9, 6)')
    .addColumn('arrival_lat', 'decimal(9, 6)')
    .addColumn('arrival_lng', 'decimal(9, 6)')
    .addColumn('checkin_window_opens', 'timestamptz')
    .addColumn('checkin_window_closes', 'timestamptz')
    .execute();

  // --- Hotel Details ---
  await db.schema
    .createTable('hotel_details')
    .addColumn('booking_id', 'uuid', (col) =>
      col.primaryKey().references('bookings.id').onDelete('cascade'),
    )
    .addColumn('hotel_name', 'varchar(200)')
    .addColumn('address', 'text')
    .addColumn('checkin_date', 'date')
    .addColumn('checkout_date', 'date')
    .addColumn('latitude', 'decimal(9, 6)')
    .addColumn('longitude', 'decimal(9, 6)')
    .addColumn('confirmation_number', 'varchar(100)')
    .execute();

  // --- Car Rental Details ---
  await db.schema
    .createTable('car_rental_details')
    .addColumn('booking_id', 'uuid', (col) =>
      col.primaryKey().references('bookings.id').onDelete('cascade'),
    )
    .addColumn('company', 'varchar(100)')
    .addColumn('vehicle_type', 'varchar(100)')
    .addColumn('pickup_location', 'text')
    .addColumn('return_location', 'text')
    .addColumn('pickup_time', 'timestamptz')
    .addColumn('return_time', 'timestamptz')
    .addColumn('pickup_lat', 'decimal(9, 6)')
    .addColumn('pickup_lng', 'decimal(9, 6)')
    .addColumn('return_lat', 'decimal(9, 6)')
    .addColumn('return_lng', 'decimal(9, 6)')
    .addColumn('confirmation_number', 'varchar(100)')
    .execute();

  // --- Indexes ---

  // Trips indexes
  await db.schema
    .createIndex('idx_trips_owner_id')
    .on('trips')
    .column('owner_id')
    .execute();

  await db.schema
    .createIndex('idx_trips_start_date')
    .on('trips')
    .column('start_date')
    .execute();

  // Bookings indexes
  await db.schema
    .createIndex('idx_bookings_user_id')
    .on('bookings')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_bookings_trip_id')
    .on('bookings')
    .column('trip_id')
    .execute();

  await db.schema
    .createIndex('idx_bookings_type')
    .on('bookings')
    .column('type')
    .execute();

  // Flight details deduplication index
  await db.schema
    .createIndex('idx_flight_details_dedup')
    .on('flight_details')
    .columns(['flight_number', 'departure_time'])
    .execute();

  // Hotel details deduplication index
  await db.schema
    .createIndex('idx_hotel_details_dedup')
    .on('hotel_details')
    .columns(['hotel_name', 'checkin_date'])
    .execute();

  // Car rental details deduplication index
  await db.schema
    .createIndex('idx_car_rental_details_dedup')
    .on('car_rental_details')
    .columns(['company', 'pickup_time'])
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex('idx_car_rental_details_dedup').execute();
  await db.schema.dropIndex('idx_hotel_details_dedup').execute();
  await db.schema.dropIndex('idx_flight_details_dedup').execute();
  await db.schema.dropIndex('idx_bookings_type').execute();
  await db.schema.dropIndex('idx_bookings_trip_id').execute();
  await db.schema.dropIndex('idx_bookings_user_id').execute();
  await db.schema.dropIndex('idx_trips_start_date').execute();
  await db.schema.dropIndex('idx_trips_owner_id').execute();

  // Drop tables in reverse dependency order
  await db.schema.dropTable('car_rental_details').execute();
  await db.schema.dropTable('hotel_details').execute();
  await db.schema.dropTable('flight_details').execute();
  await db.schema.dropTable('bookings').execute();
  await db.schema.dropTable('trip_members').execute();
  await db.schema.dropTable('trips').execute();
  await db.schema.dropTable('user_preferences').execute();
  await db.schema.dropTable('users').execute();
}
