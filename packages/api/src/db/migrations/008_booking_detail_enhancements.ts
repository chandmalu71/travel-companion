import { type Kysely, sql } from 'kysely';

/**
 * Migration 008: Booking Detail Enhancements
 *
 * Adds confirmation numbers, traveller names, and additional
 * fields to flight_details, hotel_details, and car_rental_details
 * for richer timeline card display.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // --- Flight Details ---
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS confirmation_number VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS seat VARCHAR(10)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS terminal VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS gate VARCHAR(10)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS baggage_allowance VARCHAR(100)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS cabin_class VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS traveller_names TEXT`.execute(db); // JSON array
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS notes TEXT`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS price DECIMAL(10,2)`.execute(db);
  await sql`ALTER TABLE flight_details ADD COLUMN IF NOT EXISTS currency VARCHAR(3)`.execute(db);

  // --- Hotel Details ---
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS confirmation_number VARCHAR(30)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS room_type VARCHAR(50)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS number_of_guests INTEGER`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS contact_phone VARCHAR(30)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS traveller_names TEXT`.execute(db); // JSON array
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS notes TEXT`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS price_per_night DECIMAL(10,2)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS currency VARCHAR(3)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS latitude DECIMAL(9,6)`.execute(db);
  await sql`ALTER TABLE hotel_details ADD COLUMN IF NOT EXISTS longitude DECIMAL(9,6)`.execute(db);

  // --- Car Rental Details ---
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS confirmation_number VARCHAR(30)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS vehicle_class VARCHAR(50)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS pickup_location VARCHAR(200)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS return_location VARCHAR(200)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS driver_names TEXT`.execute(db); // JSON array
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS insurance VARCHAR(100)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS fuel_policy VARCHAR(50)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS extras TEXT`.execute(db); // JSON array (GPS, child seat, etc.)
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS notes TEXT`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS total_price DECIMAL(10,2)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS currency VARCHAR(3)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS pickup_latitude DECIMAL(9,6)`.execute(db);
  await sql`ALTER TABLE car_rental_details ADD COLUMN IF NOT EXISTS pickup_longitude DECIMAL(9,6)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // Flight
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS confirmation_number`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS seat`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS terminal`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS gate`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS baggage_allowance`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS cabin_class`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS traveller_names`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS notes`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS price`.execute(db);
  await sql`ALTER TABLE flight_details DROP COLUMN IF EXISTS currency`.execute(db);

  // Hotel
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS confirmation_number`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS room_type`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS number_of_guests`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS contact_phone`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS traveller_names`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS notes`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS price_per_night`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS total_price`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS currency`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS latitude`.execute(db);
  await sql`ALTER TABLE hotel_details DROP COLUMN IF EXISTS longitude`.execute(db);

  // Car
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS confirmation_number`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS vehicle_class`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS pickup_location`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS return_location`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS driver_names`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS insurance`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS fuel_policy`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS extras`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS notes`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS total_price`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS currency`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS pickup_latitude`.execute(db);
  await sql`ALTER TABLE car_rental_details DROP COLUMN IF EXISTS pickup_longitude`.execute(db);
}
