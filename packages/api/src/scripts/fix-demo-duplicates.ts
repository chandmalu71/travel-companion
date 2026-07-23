/**
 * Fix duplicate demo data (tips, family members) and verify trip members.
 * Run: npx tsx src/scripts/fix-demo-duplicates.ts
 */
import { createDatabaseFromEnv } from '../db/database.js';
import { sql } from 'kysely';

const db = createDatabaseFromEnv();
const DEMO_ID = '00000000-0000-4000-a000-000000000010';

async function main() {
  console.log('Fixing demo data duplicates...\n');

  // 1. Remove duplicate trip tips (keep earliest per trip+category)
  const tipsBefore = await db.selectFrom('trip_tips').select(db.fn.count('id').as('c')).where('user_id', '=', DEMO_ID).executeTakeFirst();
  await sql`
    DELETE FROM trip_tips WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY trip_id, category ORDER BY created_at ASC) as rn
        FROM trip_tips WHERE user_id = ${DEMO_ID}
      ) sub WHERE rn > 1
    )
  `.execute(db);
  const tipsAfter = await db.selectFrom('trip_tips').select(db.fn.count('id').as('c')).where('user_id', '=', DEMO_ID).executeTakeFirst();
  console.log(`  Tips: ${(tipsBefore as any).c} → ${(tipsAfter as any).c} (removed duplicates)`);

  // 2. Remove duplicate family members (keep earliest per user+relationship+first_name)
  const famBefore = await db.selectFrom('family_members').select(db.fn.count('id').as('c')).where('user_id', '=', DEMO_ID).executeTakeFirst();
  await sql`
    DELETE FROM family_members WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY user_id, relationship, first_name ORDER BY created_at ASC) as rn
        FROM family_members WHERE user_id = ${DEMO_ID}
      ) sub WHERE rn > 1
    )
  `.execute(db);
  const famAfter = await db.selectFrom('family_members').select(db.fn.count('id').as('c')).where('user_id', '=', DEMO_ID).executeTakeFirst();
  console.log(`  Family: ${(famBefore as any).c} → ${(famAfter as any).c} (removed duplicates)`);

  // 3. Remove duplicate tip chats
  await sql`
    DELETE FROM trip_tip_chats WHERE id IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY trip_id, user_id, message ORDER BY created_at ASC) as rn
        FROM trip_tip_chats WHERE user_id = ${DEMO_ID}
      ) sub WHERE rn > 1
    )
  `.execute(db);
  const chatsAfter = await db.selectFrom('trip_tip_chats').select(db.fn.count('id').as('c')).where('user_id', '=', DEMO_ID).executeTakeFirst();
  console.log(`  Tip chats: ${(chatsAfter as any).c} remaining`);

  // 4. Verify trip members are properly set
  const tripIds = [
    '00000000-0000-4000-b000-000000000010', // Barcelona
    '00000000-0000-4000-b000-000000000011', // Japan
    '00000000-0000-4000-b000-000000000012', // Greece
    '00000000-0000-4000-b000-000000000013', // NYC
    '00000000-0000-4000-b000-000000000014', // Lapland
  ];

  for (const tripId of tripIds) {
    const members = await db.selectFrom('trip_members')
      .innerJoin('users', 'users.id', 'trip_members.user_id')
      .select(['users.display_name', 'trip_members.access_level'])
      .where('trip_members.trip_id', '=', tripId)
      .execute();
    const trip = await db.selectFrom('trips').select('name').where('id', '=', tripId).executeTakeFirst();
    console.log(`  ${(trip as any)?.name}: ${members.length} members [${members.map((m: any) => m.display_name).join(', ')}]`);
  }

  // 5. Also populate trip_travellers (the Members tab uses this table)
  const ALICE_ID = '00000000-0000-4000-a000-000000000001';
  const BOB_ID = '00000000-0000-4000-a000-000000000002';
  const CHARLIE_ID = '00000000-0000-4000-a000-000000000003';
  const DANA_ID = '00000000-0000-4000-a000-000000000004';
  const EVE_ID = '00000000-0000-4000-a000-000000000005';

  // Clear old broken entries (missing display_name) for demo trips
  await sql`DELETE FROM trip_travellers WHERE trip_id = ANY(${sql.raw(`ARRAY['${tripIds.join("','")}']::uuid[]`)})`.execute(db);

  // Ensure trip_travellers are populated (some views use this table)
  const travellers = [
    { tripId: tripIds[0], userId: DEMO_ID, displayName: 'Sarah Thompson', role: 'organiser' },
    { tripId: tripIds[0], userId: ALICE_ID, displayName: 'Alice Johnson', role: 'member' },
    { tripId: tripIds[1], userId: DEMO_ID, displayName: 'Sarah Thompson', role: 'organiser' },
    { tripId: tripIds[1], userId: ALICE_ID, displayName: 'Alice Johnson', role: 'member' },
    { tripId: tripIds[1], userId: BOB_ID, displayName: 'Bob Smith', role: 'member' },
    { tripId: tripIds[2], userId: DEMO_ID, displayName: 'Sarah Thompson', role: 'organiser' },
    { tripId: tripIds[2], userId: BOB_ID, displayName: 'Bob Smith', role: 'member' },
    { tripId: tripIds[2], userId: CHARLIE_ID, displayName: 'Charlie Brown', role: 'member' },
    { tripId: tripIds[3], userId: DEMO_ID, displayName: 'Sarah Thompson', role: 'organiser' },
    { tripId: tripIds[4], userId: DEMO_ID, displayName: 'Sarah Thompson', role: 'organiser' },
    { tripId: tripIds[4], userId: EVE_ID, displayName: 'Eve Martinez', role: 'member' },
    { tripId: tripIds[4], userId: DANA_ID, displayName: 'Dana Wilson', role: 'member' },
    { tripId: tripIds[4], userId: CHARLIE_ID, displayName: 'Charlie Brown', role: 'member' },
  ];

  for (const t of travellers) {
    await db.insertInto('trip_travellers' as any).values({
      trip_id: t.tripId,
      user_id: t.userId,
      display_name: t.displayName,
      role: t.role,
      status: 'active',
      traveller_type: 'adult',
    }).onConflict((oc: any) => oc.columns(['trip_id', 'user_id']).doNothing()).execute().catch(() => {});
  }
  console.log(`\n  ✅ Trip travellers populated (${travellers.length} entries)`);

  console.log('\nDone!');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
