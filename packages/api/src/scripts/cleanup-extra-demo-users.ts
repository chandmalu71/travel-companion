/**
 * Cleanup: Remove extra demo users (Sarah, James, Maria, Liam, Priya, Tom)
 * and rewire the demo account to use ABCDE users (Alice, Bob, Charlie, Dana, Eve) as connections.
 * 
 * Run: npx tsx src/scripts/cleanup-extra-demo-users.ts
 */
import { createDatabaseFromEnv } from '../db/database.js';
import { sql } from 'kysely';

const db = createDatabaseFromEnv();

async function main() {
  console.log('Cleaning up extra demo users...');

  const extraIds = [
    '00000000-0000-4000-a000-000000000011',
    '00000000-0000-4000-a000-000000000012',
    '00000000-0000-4000-a000-000000000013',
    '00000000-0000-4000-a000-000000000014',
    '00000000-0000-4000-a000-000000000015',
  ];
  const demoId = '00000000-0000-4000-a000-000000000010';
  const abcdeIds = [
    '00000000-0000-4000-a000-000000000001', // Alice
    '00000000-0000-4000-a000-000000000002', // Bob
    '00000000-0000-4000-a000-000000000003', // Charlie
    '00000000-0000-4000-a000-000000000004', // Dana
    '00000000-0000-4000-a000-000000000005', // Eve
  ];

  // Remove connections from demo user
  await sql`DELETE FROM user_connections WHERE user_id = ${demoId}`.execute(db);
  console.log('  Removed old demo connections');

  // Remove trip members for extra users
  await sql`DELETE FROM trip_members WHERE user_id = ANY(${sql.raw(`ARRAY['${extraIds.join("','")}']::uuid[]`)})`.execute(db);

  // Remove bookings/trips owned by demo
  await sql`DELETE FROM flight_details WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ${demoId})`.execute(db);
  await sql`DELETE FROM hotel_details WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ${demoId})`.execute(db);
  await sql`DELETE FROM car_rental_details WHERE booking_id IN (SELECT id FROM bookings WHERE user_id = ${demoId})`.execute(db);
  await sql`DELETE FROM bookings WHERE user_id = ${demoId}`.execute(db);
  await sql`DELETE FROM trips WHERE owner_id = ${demoId}`.execute(db);
  console.log('  Removed demo trips and bookings');

  // Remove subscription for demo
  await sql`DELETE FROM user_subscriptions WHERE user_id = ${demoId}`.execute(db).catch(() => {});

  // Delete extra users
  const del = await sql`DELETE FROM users WHERE id = ANY(${sql.raw(`ARRAY['${extraIds.join("','")}']::uuid[]`)})`.execute(db);
  console.log(`  Deleted ${(del as any).numAffectedRows ?? 'some'} extra users`);

  // Now add ABCDE as connections for demo account
  for (const connId of abcdeIds) {
    await db.insertInto('user_connections').values({
      user_id: demoId,
      connected_user_id: connId,
      status: 'accepted',
      source: 'manual',
    }).onConflict((oc) => oc.columns(['user_id', 'connected_user_id']).doNothing()).execute();
  }
  console.log(`  Connected ABCDE users to demo account`);

  // Grant premium subscription to demo
  const premiumPlan = await db.selectFrom('subscription_plans' as any).select('id').where('slug', '=', 'premium').executeTakeFirst() as any;
  if (premiumPlan) {
    await db.insertInto('user_subscriptions' as any).values({
      user_id: demoId,
      plan_id: premiumPlan.id,
      status: 'active',
      billing_cycle: 'annual',
      current_period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
      auto_renew: true,
      is_family_plan: false,
      cancel_at_period_end: false,
    }).onConflict((oc) => oc.column('user_id' as any).doNothing()).execute().catch(() => {});
  }
  console.log('  Premium subscription granted to demo');

  console.log('\nDone! Demo account (demo@neyya.ai) now uses ABCDE as connections.');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
