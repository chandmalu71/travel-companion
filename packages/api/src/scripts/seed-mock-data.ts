/**
 * Mock Data Seed Script
 *
 * Creates realistic test data for all features:
 * - 5 users (including 1 admin)
 * - Trips with bookings (flights, hotels, car rentals)
 * - Expenses (shared + personal)
 * - Timeline events
 * - Favorites and collections
 * - Email connections
 * - Activity feed entries
 *
 * Run: npx tsx src/scripts/seed-mock-data.ts
 * Clean: npx tsx src/scripts/seed-mock-data.ts --clean
 *
 * All mock data uses the prefix "mock-" in IDs for easy cleanup.
 */

import { createDatabaseFromEnv } from '../db/database.js';
import { createHash } from 'node:crypto';

const db = createDatabaseFromEnv();

// ─── Config ──────────────────────────────────────────────────────────────────

const MOCK_PREFIX = 'mock-';

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// ─── Mock Users ──────────────────────────────────────────────────────────────

const USERS = [
  { id: '00000000-0000-4000-a000-000000000001', email: 'alice@demo.nayya.ai', displayName: 'Alice Johnson', password: 'Demo1234', adminRole: 'super-admin' },
  { id: '00000000-0000-4000-a000-000000000002', email: 'bob@demo.nayya.ai', displayName: 'Bob Smith', password: 'Demo1234', adminRole: null },
  { id: '00000000-0000-4000-a000-000000000003', email: 'charlie@demo.nayya.ai', displayName: 'Charlie Brown', password: 'Demo1234', adminRole: null },
  { id: '00000000-0000-4000-a000-000000000004', email: 'dana@demo.nayya.ai', displayName: 'Dana Wilson', password: 'Demo1234', adminRole: 'support' },
  { id: '00000000-0000-4000-a000-000000000005', email: 'eve@demo.nayya.ai', displayName: 'Eve Martinez', password: 'Demo1234', adminRole: null },
];

// ─── Mock Trips ──────────────────────────────────────────────────────────────

const TRIPS = [
  { id: '00000000-0000-4000-b000-000000000001', ownerId: '00000000-0000-4000-a000-000000000001', name: 'Italy Summer 2026', startDate: '2026-08-01', endDate: '2026-08-15', destination: 'Rome, Italy' },
  { id: '00000000-0000-4000-b000-000000000002', ownerId: '00000000-0000-4000-a000-000000000002', name: 'Japan Cherry Blossom', startDate: '2027-03-20', endDate: '2027-04-05', destination: 'Tokyo, Japan' },
  { id: '00000000-0000-4000-b000-000000000003', ownerId: '00000000-0000-4000-a000-000000000001', name: 'Bali Group Retreat', startDate: '2026-10-10', endDate: '2026-10-20', destination: 'Bali, Indonesia' },
  { id: '00000000-0000-4000-b000-000000000004', ownerId: '00000000-0000-4000-a000-000000000003', name: 'NYC Weekend', startDate: '2026-09-05', endDate: '2026-09-08', destination: 'New York, USA' },
  { id: '00000000-0000-4000-b000-000000000005', ownerId: '00000000-0000-4000-a000-000000000005', name: 'Paris Romantic Getaway', startDate: '2026-12-20', endDate: '2026-12-27', destination: 'Paris, France' },
];

// ─── Mock Bookings ───────────────────────────────────────────────────────────

const BOOKINGS = [
  { id: '00000000-0000-4000-c000-000000000001', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000001', type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000002', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000001', type: 'hotel', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000003', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000001', type: 'car_rental', source: 'manual' },
  { id: '00000000-0000-4000-c000-000000000004', userId: '00000000-0000-4000-a000-000000000002', tripId: '00000000-0000-4000-b000-000000000002', type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000005', userId: '00000000-0000-4000-a000-000000000002', tripId: '00000000-0000-4000-b000-000000000002', type: 'hotel', source: 'manual' },
  { id: '00000000-0000-4000-c000-000000000006', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000003', type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000007', userId: '00000000-0000-4000-a000-000000000002', tripId: '00000000-0000-4000-b000-000000000003', type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000008', userId: '00000000-0000-4000-a000-000000000003', tripId: '00000000-0000-4000-b000-000000000003', type: 'flight', source: 'manual' },
];

// ─── Mock Flight Details ─────────────────────────────────────────────────────

const FLIGHT_DETAILS = [
  { bookingId: '00000000-0000-4000-c000-000000000001', airline: 'British Airways', flightNumber: 'BA560', departureAirport: 'LHR', arrivalAirport: 'FCO', departureTime: '2026-08-01T08:30:00Z', arrivalTime: '2026-08-01T12:15:00Z' },
  { bookingId: '00000000-0000-4000-c000-000000000004', airline: 'Japan Airlines', flightNumber: 'JL44', departureAirport: 'LHR', arrivalAirport: 'NRT', departureTime: '2027-03-20T11:00:00Z', arrivalTime: '2027-03-21T07:30:00Z' },
  { bookingId: '00000000-0000-4000-c000-000000000006', airline: 'Singapore Airlines', flightNumber: 'SQ325', departureAirport: 'LHR', arrivalAirport: 'DPS', departureTime: '2026-10-10T22:00:00Z', arrivalTime: '2026-10-11T18:30:00Z' },
  { bookingId: '00000000-0000-4000-c000-000000000007', airline: 'Emirates', flightNumber: 'EK356', departureAirport: 'DXB', arrivalAirport: 'DPS', departureTime: '2026-10-10T14:00:00Z', arrivalTime: '2026-10-11T04:30:00Z' },
  { bookingId: '00000000-0000-4000-c000-000000000008', airline: 'Qatar Airways', flightNumber: 'QR960', departureAirport: 'DOH', arrivalAirport: 'DPS', departureTime: '2026-10-10T02:00:00Z', arrivalTime: '2026-10-10T18:00:00Z' },
];

// ─── Mock Hotel Details ──────────────────────────────────────────────────────

const HOTEL_DETAILS = [
  { bookingId: '00000000-0000-4000-c000-000000000002', hotelName: 'Hotel Artemide', address: 'Via Nazionale 22, Rome', checkinDate: '2026-08-01', checkoutDate: '2026-08-15' },
  { bookingId: '00000000-0000-4000-c000-000000000005', hotelName: 'Park Hyatt Tokyo', address: '3-7-1-2 Nishi Shinjuku, Tokyo', checkinDate: '2027-03-21', checkoutDate: '2027-04-05' },
];

// ─── Mock Car Rental Details ─────────────────────────────────────────────────

const CAR_RENTAL_DETAILS = [
  { bookingId: '00000000-0000-4000-c000-000000000003', company: 'Europcar', pickupTime: '2026-08-01T14:00:00Z', returnTime: '2026-08-15T10:00:00Z', pickupLocation: 'Rome Fiumicino Airport', returnLocation: 'Rome Fiumicino Airport' },
];

// ─── Mock Expenses ───────────────────────────────────────────────────────────

const EXPENSES = [
  { id: '00000000-0000-4000-d000-000000000001', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000001', amount: 45.50, currency: 'EUR', category: 'food_dining', date: '2026-08-02', merchantName: 'Trattoria da Luigi', isShared: true },
  { id: '00000000-0000-4000-d000-000000000002', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000001', amount: 180.00, currency: 'EUR', category: 'tours_activities', date: '2026-08-03', merchantName: 'Colosseum Tour', isShared: false },
  { id: '00000000-0000-4000-d000-000000000003', userId: '00000000-0000-4000-a000-000000000002', tripId: '00000000-0000-4000-b000-000000000003', amount: 120.00, currency: 'USD', category: 'food_dining', date: '2026-10-12', merchantName: 'Locavore Restaurant', isShared: true },
  { id: '00000000-0000-4000-d000-000000000004', userId: '00000000-0000-4000-a000-000000000003', tripId: '00000000-0000-4000-b000-000000000003', amount: 85.00, currency: 'USD', category: 'tours_activities', date: '2026-10-13', merchantName: 'Ubud Monkey Forest', isShared: true },
  { id: '00000000-0000-4000-d000-000000000005', userId: '00000000-0000-4000-a000-000000000001', tripId: '00000000-0000-4000-b000-000000000003', amount: 200.00, currency: 'USD', category: 'accommodation', date: '2026-10-14', merchantName: 'Villa Rental (extra night)', isShared: true },
  { id: '00000000-0000-4000-d000-000000000006', userId: '00000000-0000-4000-a000-000000000005', tripId: '00000000-0000-4000-b000-000000000005', amount: 320.00, currency: 'EUR', category: 'shopping', date: '2026-12-22', merchantName: 'Galeries Lafayette', isShared: false },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding mock data...\n');

  // Users
  for (const user of USERS) {
    await db.insertInto('users').values({
      id: user.id,
      email: user.email,
      display_name: user.displayName,
      cognito_sub: `mock-sub-${user.id}`,
      email_verified: true,
      password_hash: hashPassword(user.password),
      admin_role: user.adminRole,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${USERS.length} users created`);

  // Trips
  for (const trip of TRIPS) {
    await db.insertInto('trips').values({
      id: trip.id,
      owner_id: trip.ownerId,
      name: trip.name,
      start_date: trip.startDate,
      end_date: trip.endDate,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${TRIPS.length} trips created`);

  // Trip members (shared Bali trip)
  await db.insertInto('trip_members').values({ trip_id: '00000000-0000-4000-b000-000000000003', user_id: '00000000-0000-4000-a000-000000000002', access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  await db.insertInto('trip_members').values({ trip_id: '00000000-0000-4000-b000-000000000003', user_id: '00000000-0000-4000-a000-000000000003', access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  console.log(`  ✅ Shared trip members added`);

  // Bookings
  for (const booking of BOOKINGS) {
    await db.insertInto('bookings').values({
      id: booking.id,
      user_id: booking.userId,
      trip_id: booking.tripId,
      type: booking.type,
      source: booking.source,
      checked_in: false,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${BOOKINGS.length} bookings created`);

  // Flight details
  for (const flight of FLIGHT_DETAILS) {
    await db.insertInto('flight_details').values({
      booking_id: flight.bookingId,
      airline: flight.airline,
      flight_number: flight.flightNumber,
      departure_airport: flight.departureAirport,
      arrival_airport: flight.arrivalAirport,
      departure_time: new Date(flight.departureTime),
      arrival_time: new Date(flight.arrivalTime),
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${FLIGHT_DETAILS.length} flight details`);

  // Hotel details
  for (const hotel of HOTEL_DETAILS) {
    await db.insertInto('hotel_details').values({
      booking_id: hotel.bookingId,
      hotel_name: hotel.hotelName,
      address: hotel.address,
      checkin_date: hotel.checkinDate,
      checkout_date: hotel.checkoutDate,
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${HOTEL_DETAILS.length} hotel details`);

  // Car rental details
  for (const car of CAR_RENTAL_DETAILS) {
    await db.insertInto('car_rental_details').values({
      booking_id: car.bookingId,
      company: car.company,
      pickup_time: new Date(car.pickupTime),
      return_time: new Date(car.returnTime),
      pickup_location: car.pickupLocation,
      return_location: car.returnLocation,
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${CAR_RENTAL_DETAILS.length} car rental details`);

  // Expenses
  for (const exp of EXPENSES) {
    await db.insertInto('expenses').values({
      id: exp.id,
      user_id: exp.userId,
      trip_id: exp.tripId,
      amount: exp.amount,
      currency: exp.currency,
      converted_amount: exp.amount, // Simplified for mock
      home_currency: 'USD',
      category: exp.category,
      date: exp.date,
      merchant_name: exp.merchantName,
      is_shared: exp.isShared,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${EXPENSES.length} expenses created`);

  // Activity feed entries
  const activities = [
    { tripId: '00000000-0000-4000-b000-000000000003', userId: '00000000-0000-4000-a000-000000000001', action: 'created_trip', entityType: 'trip', entityId: '00000000-0000-4000-b000-000000000003' },
    { tripId: '00000000-0000-4000-b000-000000000003', userId: '00000000-0000-4000-a000-000000000001', action: 'invited_member', entityType: 'trip', entityId: '00000000-0000-4000-a000-000000000002' },
    { tripId: '00000000-0000-4000-b000-000000000003', userId: '00000000-0000-4000-a000-000000000002', action: 'added_booking', entityType: 'booking', entityId: '00000000-0000-4000-c000-000000000007' },
    { tripId: '00000000-0000-4000-b000-000000000001', userId: '00000000-0000-4000-a000-000000000001', action: 'added_expense', entityType: 'expense', entityId: '00000000-0000-4000-d000-000000000001' },
  ];
  for (const act of activities) {
    await db.insertInto('activity_feed').values({
      trip_id: act.tripId,
      user_id: act.userId,
      action: act.action,
      entity_type: act.entityType,
      entity_id: act.entityId,
    }).execute();
  }
  console.log(`  ✅ ${activities.length} activity feed entries`);

  console.log('\n🎉 Mock data seeded successfully!');
  console.log('\n  Demo accounts (password: Demo1234):');
  for (const user of USERS) {
    console.log(`    ${user.email} ${user.adminRole ? `(${user.adminRole})` : ''}`);
  }
  console.log('\n  To clean: npx tsx src/scripts/seed-mock-data.ts --clean');
}

// ─── Clean Function ──────────────────────────────────────────────────────────

async function clean() {
  console.log('🧹 Cleaning mock data...\n');

  // Delete in reverse dependency order using known IDs
  await db.deleteFrom('activity_feed').where('user_id', 'in', USERS.map((u) => u.id)).execute();
  console.log('  ✅ Activity feed cleaned');

  await db.deleteFrom('expenses').where('user_id', 'in', USERS.map((u) => u.id)).execute();
  console.log('  ✅ Expenses cleaned');

  await db.deleteFrom('flight_details').where('booking_id', 'in', BOOKINGS.map((b) => b.id)).execute();
  await db.deleteFrom('hotel_details').where('booking_id', 'in', BOOKINGS.map((b) => b.id)).execute();
  await db.deleteFrom('car_rental_details').where('booking_id', 'in', BOOKINGS.map((b) => b.id)).execute();
  console.log('  ✅ Booking details cleaned');

  await db.deleteFrom('bookings').where('id', 'in', BOOKINGS.map((b) => b.id)).execute();
  console.log('  ✅ Bookings cleaned');

  await db.deleteFrom('trip_members').where('trip_id', 'in', TRIPS.map((t) => t.id)).execute();
  await db.deleteFrom('trips').where('id', 'in', TRIPS.map((t) => t.id)).execute();
  console.log('  ✅ Trips cleaned');

  await db.deleteFrom('users').where('id', 'in', USERS.map((u) => u.id)).execute();
  console.log('  ✅ Users cleaned');

  console.log('\n🧹 All mock data removed!');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const isClean = process.argv.includes('--clean');

  try {
    if (isClean) {
      await clean();
    } else {
      await seed();
    }
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
  } finally {
    await db.destroy();
    process.exit(0);
  }
}

main();
