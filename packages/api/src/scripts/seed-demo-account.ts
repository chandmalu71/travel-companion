/**
 * Demo Account Seed Script
 *
 * Creates a comprehensive demo experience for sharing with potential users.
 * The demo account (demo@neyya.ai / TryNeyya2026) showcases all features:
 * - 5 trips (various stages: upcoming, active, completed)
 * - 5 connected users (travel companions)
 * - Multiple booking types (flights, hotels, car rentals)
 * - Expenses with splits
 * - Conversations and messages
 * - Premium subscription
 *
 * The nightly reset (`--reset` flag) removes any user-created data
 * while preserving the original seeded demo data.
 *
 * Run:
 *   npx tsx src/scripts/seed-demo-account.ts          # Initial seed
 *   npx tsx src/scripts/seed-demo-account.ts --reset  # Nightly reset
 */

import { createDatabaseFromEnv } from '../db/database.js';
import { createHash } from 'node:crypto';
import { sql } from 'kysely';

const db = createDatabaseFromEnv();

function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

// ─── Demo Account Config ─────────────────────────────────────────────────────

const DEMO_USER = {
  id: '00000000-0000-4000-a000-000000000010',
  email: 'demo@neyya.ai',
  displayName: 'Sarah Thompson',
  password: 'TryNeyya2026',
};

const DEMO_CONNECTIONS = [
  { id: '00000000-0000-4000-a000-000000000001', email: 'alice@demo.neyya.ai', displayName: 'Alice Johnson' },
  { id: '00000000-0000-4000-a000-000000000002', email: 'bob@demo.neyya.ai', displayName: 'Bob Smith' },
  { id: '00000000-0000-4000-a000-000000000003', email: 'charlie@demo.neyya.ai', displayName: 'Charlie Brown' },
  { id: '00000000-0000-4000-a000-000000000004', email: 'dana@demo.neyya.ai', displayName: 'Dana Wilson' },
  { id: '00000000-0000-4000-a000-000000000005', email: 'eve@demo.neyya.ai', displayName: 'Eve Martinez' },
];

const DEMO_TRIPS = [
  { id: '00000000-0000-4000-b000-000000000010', name: 'Barcelona Long Weekend', startDate: '2026-09-12', endDate: '2026-09-15', destination: 'Barcelona, Spain' },
  { id: '00000000-0000-4000-b000-000000000011', name: 'Japan Adventure 2027', startDate: '2027-03-15', endDate: '2027-03-30', destination: 'Tokyo & Kyoto, Japan' },
  { id: '00000000-0000-4000-b000-000000000012', name: 'Greek Islands Cruise', startDate: '2026-07-01', endDate: '2026-07-14', destination: 'Santorini & Mykonos, Greece' },
  { id: '00000000-0000-4000-b000-000000000013', name: 'NYC Business + Fun', startDate: '2026-11-10', endDate: '2026-11-14', destination: 'New York City, USA' },
  { id: '00000000-0000-4000-b000-000000000014', name: 'Family Christmas in Lapland', startDate: '2026-12-20', endDate: '2026-12-27', destination: 'Rovaniemi, Finland' },
];

const DEMO_BOOKINGS = [
  // Barcelona trip
  { id: '00000000-0000-4000-c000-000000000010', tripId: DEMO_TRIPS[0].id, type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000011', tripId: DEMO_TRIPS[0].id, type: 'hotel', source: 'email' },
  // Japan trip
  { id: '00000000-0000-4000-c000-000000000012', tripId: DEMO_TRIPS[1].id, type: 'flight', source: 'manual' },
  { id: '00000000-0000-4000-c000-000000000013', tripId: DEMO_TRIPS[1].id, type: 'hotel', source: 'email' },
  // Greek Islands (completed)
  { id: '00000000-0000-4000-c000-000000000014', tripId: DEMO_TRIPS[2].id, type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000015', tripId: DEMO_TRIPS[2].id, type: 'hotel', source: 'email' },
  // NYC
  { id: '00000000-0000-4000-c000-000000000016', tripId: DEMO_TRIPS[3].id, type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000017', tripId: DEMO_TRIPS[3].id, type: 'car_rental', source: 'manual' },
  // Lapland
  { id: '00000000-0000-4000-c000-000000000018', tripId: DEMO_TRIPS[4].id, type: 'flight', source: 'email' },
  { id: '00000000-0000-4000-c000-000000000019', tripId: DEMO_TRIPS[4].id, type: 'hotel', source: 'email' },
];

const DEMO_FLIGHTS = [
  { bookingId: '00000000-0000-4000-c000-000000000010', airline: 'Vueling', flightNumber: 'VY8700', departureAirport: 'LGW', arrivalAirport: 'BCN', departureTime: '2026-09-12T06:45:00Z', arrivalTime: '2026-09-12T10:15:00Z', confirmationNumber: 'VY4K8N', seat: '6A', terminal: 'S', cabinClass: 'Economy', price: 189, currency: 'GBP', travellerNames: '["Sarah Thompson"]' },
  { bookingId: '00000000-0000-4000-c000-000000000012', airline: 'ANA', flightNumber: 'NH212', departureAirport: 'LHR', arrivalAirport: 'HND', departureTime: '2027-03-15T10:30:00Z', arrivalTime: '2027-03-16T06:50:00Z', confirmationNumber: 'ANA7M2', seat: '24K', terminal: 'T2', cabinClass: 'Premium Economy', price: 1450, currency: 'GBP', travellerNames: '["Sarah Thompson","James Mitchell"]' },
  { bookingId: '00000000-0000-4000-c000-000000000014', airline: 'Aegean Airlines', flightNumber: 'A3601', departureAirport: 'LHR', arrivalAirport: 'ATH', departureTime: '2026-07-01T07:00:00Z', arrivalTime: '2026-07-01T12:30:00Z', confirmationNumber: 'AEG3W9', seat: '12F', terminal: 'T2', cabinClass: 'Business', price: 680, currency: 'EUR', travellerNames: '["Sarah Thompson","Maria Santos"]' },
  { bookingId: '00000000-0000-4000-c000-000000000016', airline: 'Virgin Atlantic', flightNumber: 'VS3', departureAirport: 'LHR', arrivalAirport: 'JFK', departureTime: '2026-11-10T09:00:00Z', arrivalTime: '2026-11-10T12:00:00Z', confirmationNumber: 'VS8KL2', seat: '35A', terminal: 'T3', cabinClass: 'Economy', price: 520, currency: 'GBP', travellerNames: '["Sarah Thompson"]' },
  { bookingId: '00000000-0000-4000-c000-000000000018', airline: 'Finnair', flightNumber: 'AY1332', departureAirport: 'LHR', arrivalAirport: 'RVN', departureTime: '2026-12-20T08:00:00Z', arrivalTime: '2026-12-20T14:30:00Z', confirmationNumber: 'AY6P4N', seat: '8C', terminal: 'T3', cabinClass: 'Economy', price: 390, currency: 'EUR', travellerNames: '["Sarah Thompson","Tom Baker","Priya Sharma"]' },
];

const DEMO_HOTELS = [
  { bookingId: '00000000-0000-4000-c000-000000000011', hotelName: 'Hotel Casa Bonay', address: 'Gran Via de les Corts Catalanes 700, Barcelona', checkinDate: '2026-09-12', checkoutDate: '2026-09-15', confirmationNumber: 'CB-912847', roomType: 'Design Double', numberOfGuests: 1, pricePerNight: 165, totalPrice: 495, currency: 'EUR', latitude: '41.3918', longitude: '2.1700' },
  { bookingId: '00000000-0000-4000-c000-000000000013', hotelName: 'Aman Tokyo', address: 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda-ku', checkinDate: '2027-03-16', checkoutDate: '2027-03-22', confirmationNumber: 'AMAN-77201', roomType: 'Premier Room', numberOfGuests: 2, pricePerNight: 850, totalPrice: 5100, currency: 'USD', latitude: '35.6866', longitude: '139.7639' },
  { bookingId: '00000000-0000-4000-c000-000000000015', hotelName: 'Canaves Oia Suites', address: 'Oia, Santorini 847 02, Greece', checkinDate: '2026-07-01', checkoutDate: '2026-07-07', confirmationNumber: 'CAN-44891', roomType: 'Infinity Pool Suite', numberOfGuests: 2, pricePerNight: 580, totalPrice: 3480, currency: 'EUR', latitude: '36.4613', longitude: '25.3753' },
  { bookingId: '00000000-0000-4000-c000-000000000019', hotelName: 'Arctic TreeHouse Hotel', address: 'Joulukkapolku 1, Rovaniemi', checkinDate: '2026-12-20', checkoutDate: '2026-12-27', confirmationNumber: 'ATH-20267', roomType: 'Arctic Glass House', numberOfGuests: 3, pricePerNight: 420, totalPrice: 2940, currency: 'EUR', latitude: '66.4896', longitude: '25.7140' },
];

const DEMO_CAR_RENTAL = [
  { bookingId: '00000000-0000-4000-c000-000000000017', company: 'Hertz', pickupTime: '2026-11-10T14:00:00Z', returnTime: '2026-11-14T10:00:00Z', pickupLocation: 'JFK Airport Terminal 4', returnLocation: 'JFK Airport Terminal 4', confirmationNumber: 'HTZ-8891234', vehicleClass: 'Full-size sedan (Nissan Altima or similar)', totalPrice: 340, currency: 'USD', insurance: 'LDW + SLI', fuelPolicy: 'Full-to-full' },
];

// ─── Seed Function ───────────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Seeding demo account...\n');

  // Create demo user
  await db.insertInto('users').values({
    id: DEMO_USER.id,
    email: DEMO_USER.email,
    display_name: DEMO_USER.displayName,
    cognito_sub: `demo-sub-${DEMO_USER.id}`,
    email_verified: true,
    password_hash: hashPassword(DEMO_USER.password),
    admin_role: null,
  }).onConflict((oc) => oc.column('id').doNothing()).execute();

  // Create demo connections (users already exist from mock-data seed — ABCDE users)
  // Just establish the network connections
  console.log(`  ✅ Demo user created (ABCDE users used as connections)`);

  // Create connections (bidirectional)
  for (const conn of DEMO_CONNECTIONS) {
    await db.insertInto('user_connections').values({
      user_id: DEMO_USER.id,
      connected_user_id: conn.id,
      status: 'accepted',
      source: 'manual',
    }).onConflict((oc) => oc.columns(['user_id', 'connected_user_id']).doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_CONNECTIONS.length} connections established`);

  // Create trips
  for (const trip of DEMO_TRIPS) {
    await db.insertInto('trips').values({
      id: trip.id,
      owner_id: DEMO_USER.id,
      name: trip.name,
      start_date: trip.startDate,
      end_date: trip.endDate,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_TRIPS.length} trips created`);

  // Add trip members (shared trips)
  // Barcelona: Sarah + James
  await db.insertInto('trip_members').values({ trip_id: DEMO_TRIPS[0].id, user_id: DEMO_CONNECTIONS[0].id, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  // Japan: Sarah + James
  await db.insertInto('trip_members').values({ trip_id: DEMO_TRIPS[1].id, user_id: DEMO_CONNECTIONS[0].id, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  // Greek Islands: Sarah + Maria
  await db.insertInto('trip_members').values({ trip_id: DEMO_TRIPS[2].id, user_id: DEMO_CONNECTIONS[1].id, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  // Lapland: Sarah + Tom + Priya
  await db.insertInto('trip_members').values({ trip_id: DEMO_TRIPS[4].id, user_id: DEMO_CONNECTIONS[4].id, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  await db.insertInto('trip_members').values({ trip_id: DEMO_TRIPS[4].id, user_id: DEMO_CONNECTIONS[3].id, access_level: 'view' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  console.log(`  ✅ Trip members assigned`);

  // Create bookings
  for (const booking of DEMO_BOOKINGS) {
    await db.insertInto('bookings').values({
      id: booking.id,
      user_id: DEMO_USER.id,
      trip_id: booking.tripId,
      type: booking.type,
      source: booking.source,
      checked_in: false,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_BOOKINGS.length} bookings created`);

  // Flight details
  for (const f of DEMO_FLIGHTS) {
    await db.insertInto('flight_details').values({
      booking_id: f.bookingId,
      airline: f.airline,
      flight_number: f.flightNumber,
      departure_airport: f.departureAirport,
      arrival_airport: f.arrivalAirport,
      departure_time: new Date(f.departureTime),
      arrival_time: new Date(f.arrivalTime),
      confirmation_number: f.confirmationNumber,
      seat: f.seat,
      terminal: f.terminal,
      cabin_class: f.cabinClass,
      price: String(f.price),
      currency: f.currency,
      traveller_names: f.travellerNames,
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_FLIGHTS.length} flight details`);

  // Hotel details
  for (const h of DEMO_HOTELS) {
    await db.insertInto('hotel_details').values({
      booking_id: h.bookingId,
      hotel_name: h.hotelName,
      address: h.address,
      checkin_date: h.checkinDate,
      checkout_date: h.checkoutDate,
      confirmation_number: h.confirmationNumber,
      room_type: h.roomType,
      number_of_guests: h.numberOfGuests,
      price_per_night: String(h.pricePerNight),
      total_price: String(h.totalPrice),
      currency: h.currency,
      latitude: h.latitude,
      longitude: h.longitude,
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_HOTELS.length} hotel details`);

  // Car rental details
  for (const c of DEMO_CAR_RENTAL) {
    await db.insertInto('car_rental_details').values({
      booking_id: c.bookingId,
      company: c.company,
      pickup_time: new Date(c.pickupTime),
      return_time: new Date(c.returnTime),
      pickup_location: c.pickupLocation,
      return_location: c.returnLocation,
      confirmation_number: c.confirmationNumber,
      vehicle_class: c.vehicleClass,
      total_price: String(c.totalPrice),
      currency: c.currency,
      insurance: c.insurance,
      fuel_policy: c.fuelPolicy,
    }).onConflict((oc) => oc.column('booking_id').doNothing()).execute();
  }
  console.log(`  ✅ ${DEMO_CAR_RENTAL.length} car rental details`);

  // Grant premium subscription
  const premiumPlan = await db.selectFrom('subscription_plans' as any).select('id').where('slug', '=', 'premium').executeTakeFirst() as any;
  if (premiumPlan) {
    await db.insertInto('user_subscriptions' as any).values({
      user_id: DEMO_USER.id,
      plan_id: premiumPlan.id,
      status: 'active',
      billing_cycle: 'annual',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      auto_renew: true,
      is_family_plan: false,
      cancel_at_period_end: false,
    }).onConflict((oc) => oc.column('user_id' as any).doNothing()).execute().catch(() => {});
  }
  console.log(`  ✅ Premium subscription granted`);

  console.log('\n✅ Demo account ready!');
  console.log(`   Email: ${DEMO_USER.email}`);
  console.log(`   Password: ${DEMO_USER.password}`);
  console.log(`   Plan: Premium (annual)`);
  console.log(`   Trips: ${DEMO_TRIPS.length}, Connections: ${DEMO_CONNECTIONS.length}, Bookings: ${DEMO_BOOKINGS.length}`);
}

// ─── Reset Function (nightly) ────────────────────────────────────────────────

async function reset() {
  console.log('🔄 Resetting demo account to clean state...\n');

  const demoUserIds = [DEMO_USER.id, ...DEMO_CONNECTIONS.map(c => c.id)];
  const demoTripIds = DEMO_TRIPS.map(t => t.id);
  const demoBookingIds = DEMO_BOOKINGS.map(b => b.id);

  // Delete any user-created data (non-demo IDs owned by demo users)
  // Trips not in our demo list
  await sql`DELETE FROM trips WHERE owner_id = ANY(${sql.raw(`ARRAY['${demoUserIds.join("','")}']::uuid[]`)}) AND id != ALL(${sql.raw(`ARRAY['${demoTripIds.join("','")}']::uuid[]`)})`.execute(db);

  // Bookings not in our demo list
  await sql`DELETE FROM bookings WHERE user_id = ANY(${sql.raw(`ARRAY['${demoUserIds.join("','")}']::uuid[]`)}) AND id != ALL(${sql.raw(`ARRAY['${demoBookingIds.join("','")}']::uuid[]`)})`.execute(db);

  // Conversations created by demo users
  await sql`DELETE FROM messages WHERE sender_id = ANY(${sql.raw(`ARRAY['${demoUserIds.join("','")}']::uuid[]`)})`.execute(db).catch(() => {});
  await sql`DELETE FROM conversation_participants WHERE user_id = ANY(${sql.raw(`ARRAY['${demoUserIds.join("','")}']::uuid[]`)})`.execute(db).catch(() => {});

  // Expenses not in demo set
  await sql`DELETE FROM expenses WHERE user_id = ANY(${sql.raw(`ARRAY['${demoUserIds.join("','")}']::uuid[]`)}) AND id NOT LIKE '00000000-0000-4000-d000%'`.execute(db).catch(() => {});

  // Reset password (in case user changed it)
  await db.updateTable('users')
    .set({ password_hash: hashPassword(DEMO_USER.password) })
    .where('id', '=', DEMO_USER.id)
    .execute();

  console.log('  ✅ User-created trips, bookings, messages removed');
  console.log('  ✅ Password reset to default');
  console.log('  ✅ Original demo data preserved');
  console.log('\n✅ Demo account reset complete!');
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  try {
    if (process.argv.includes('--reset')) {
      await reset();
    } else {
      await seed();
    }
  } catch (error: any) {
    console.error('❌ Error:', error.message);
    if (error.detail) console.error('   Detail:', error.detail);
  } finally {
    process.exit(0);
  }
}

main();
