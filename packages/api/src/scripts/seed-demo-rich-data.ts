/**
 * Seed Rich Demo Data
 * 
 * Adds expenses, messages, family members, trip tips, and activity feed
 * to the demo account. Run AFTER seed-demo-account.ts.
 *
 * Run: npx tsx src/scripts/seed-demo-rich-data.ts
 */
import { createDatabaseFromEnv } from '../db/database.js';
import { sql } from 'kysely';
import { randomUUID } from 'node:crypto';

const db = createDatabaseFromEnv();

const DEMO_ID = '00000000-0000-4000-a000-000000000010';
const ALICE_ID = '00000000-0000-4000-a000-000000000001';
const BOB_ID = '00000000-0000-4000-a000-000000000002';
const CHARLIE_ID = '00000000-0000-4000-a000-000000000003';
const DANA_ID = '00000000-0000-4000-a000-000000000004';
const EVE_ID = '00000000-0000-4000-a000-000000000005';

const TRIP_BARCELONA = '00000000-0000-4000-b000-000000000010';
const TRIP_JAPAN = '00000000-0000-4000-b000-000000000011';
const TRIP_GREECE = '00000000-0000-4000-b000-000000000012';
const TRIP_NYC = '00000000-0000-4000-b000-000000000013';
const TRIP_LAPLAND = '00000000-0000-4000-b000-000000000014';

async function main() {
  console.log('🌱 Seeding rich demo data...\n');

  // ─── EXPENSES (personal + shared) ─────────────────────────────────────────
  const expenses = [
    // Barcelona - shared with Alice
    { id: '00000000-0000-4000-d000-000000000010', userId: DEMO_ID, tripId: TRIP_BARCELONA, amount: '62.50', currency: 'EUR', category: 'food_dining', date: '2026-09-12', merchantName: 'La Boqueria Market', isShared: true },
    { id: '00000000-0000-4000-d000-000000000011', userId: DEMO_ID, tripId: TRIP_BARCELONA, amount: '28.00', currency: 'EUR', category: 'transportation', date: '2026-09-12', merchantName: 'Airport Bus (Aerobus)', isShared: true },
    { id: '00000000-0000-4000-d000-000000000012', userId: DEMO_ID, tripId: TRIP_BARCELONA, amount: '45.00', currency: 'EUR', category: 'tours_activities', date: '2026-09-13', merchantName: 'Sagrada Familia Tickets', isShared: false },
    { id: '00000000-0000-4000-d000-000000000013', userId: ALICE_ID, tripId: TRIP_BARCELONA, amount: '38.00', currency: 'EUR', category: 'food_dining', date: '2026-09-13', merchantName: 'Tapas Bar El Nacional', isShared: true },
    // Greece - shared with Bob
    { id: '00000000-0000-4000-d000-000000000014', userId: DEMO_ID, tripId: TRIP_GREECE, amount: '120.00', currency: 'EUR', category: 'tours_activities', date: '2026-07-03', merchantName: 'Catamaran Sunset Cruise', isShared: true },
    { id: '00000000-0000-4000-d000-000000000015', userId: BOB_ID, tripId: TRIP_GREECE, amount: '85.00', currency: 'EUR', category: 'food_dining', date: '2026-07-04', merchantName: 'Ammoudi Fish Taverna', isShared: true },
    { id: '00000000-0000-4000-d000-000000000016', userId: DEMO_ID, tripId: TRIP_GREECE, amount: '220.00', currency: 'EUR', category: 'shopping', date: '2026-07-05', merchantName: 'Oia Art Gallery', isShared: false },
    // NYC - personal
    { id: '00000000-0000-4000-d000-000000000017', userId: DEMO_ID, tripId: TRIP_NYC, amount: '89.00', currency: 'USD', category: 'food_dining', date: '2026-11-11', merchantName: 'Peter Luger Steakhouse', isShared: false },
    { id: '00000000-0000-4000-d000-000000000018', userId: DEMO_ID, tripId: TRIP_NYC, amount: '35.00', currency: 'USD', category: 'entertainment', date: '2026-11-12', merchantName: 'MoMA Admission', isShared: false },
    { id: '00000000-0000-4000-d000-000000000019', userId: DEMO_ID, tripId: TRIP_NYC, amount: '156.00', currency: 'USD', category: 'shopping', date: '2026-11-13', merchantName: 'SoHo Boutique', isShared: false },
    // Lapland - shared with Eve + Dana
    { id: '00000000-0000-4000-d000-000000000020', userId: DEMO_ID, tripId: TRIP_LAPLAND, amount: '280.00', currency: 'EUR', category: 'tours_activities', date: '2026-12-21', merchantName: 'Husky Safari (3 people)', isShared: true },
    { id: '00000000-0000-4000-d000-000000000021', userId: EVE_ID, tripId: TRIP_LAPLAND, amount: '95.00', currency: 'EUR', category: 'food_dining', date: '2026-12-22', merchantName: 'Arctic Restaurant', isShared: true },
  ];

  for (const exp of expenses) {
    await db.insertInto('expenses').values({
      id: exp.id,
      user_id: exp.userId,
      trip_id: exp.tripId,
      amount: exp.amount,
      currency: exp.currency,
      converted_amount: exp.amount,
      converted_currency: exp.currency,
      category: exp.category as any,
      date: exp.date,
      merchant_name: exp.merchantName,
      is_shared: exp.isShared,
    }).onConflict((oc) => oc.column('id').doNothing()).execute();
  }
  console.log(`  ✅ ${expenses.length} expenses created (personal + shared)`);

  // ─── FAMILY MEMBERS ────────────────────────────────────────────────────────
  await db.insertInto('family_members').values({
    user_id: DEMO_ID,
    mode: 'connected',
    linked_user_id: ALICE_ID,
    relationship: 'spouse',
    first_name: 'Alice',
    last_name: 'Johnson',
    date_of_birth: '1992-03-15',
    gender: 'female',
    dietary_preferences: ['vegetarian'] as any,
    allergies: ['nuts'] as any,
    seat_preference: 'window',
    meal_preference: 'vegetarian',
    sharing_scope: 'all_trips',
    share_dietary: true,
    share_allergies: true,
  }).onConflict((oc) => oc.columns(['user_id', 'linked_user_id'] as any).doNothing()).execute().catch(() => {});

  await db.insertInto('family_members').values({
    user_id: DEMO_ID,
    mode: 'managed',
    relationship: 'child',
    first_name: 'Oliver',
    last_name: 'Thompson',
    date_of_birth: '2019-06-22',
    gender: 'male',
    dietary_preferences: [] as any,
    allergies: ['dairy'] as any,
    seat_preference: 'window',
    meal_preference: 'child_meal',
    sharing_scope: 'all_trips',
    share_dietary: true,
    share_allergies: true,
    notes: 'Needs booster seat for car rentals',
  }).execute().catch(() => {});
  console.log('  ✅ 2 family members (spouse + child)');

  // ─── CONVERSATIONS & MESSAGES ──────────────────────────────────────────────
  // Barcelona trip group chat
  const convBarcelonaId = randomUUID();
  await db.insertInto('conversations').values({
    id: convBarcelonaId,
    type: 'trip',
    name: 'Barcelona Trip',
    trip_id: TRIP_BARCELONA,
    created_by: DEMO_ID,
    last_message_at: new Date('2026-09-11T18:00:00Z'),
    last_message_preview: 'See you at the gate! ✈️',
  }).execute().catch(() => {});

  // Add participants
  for (const uid of [DEMO_ID, ALICE_ID]) {
    await db.insertInto('conversation_participants').values({
      conversation_id: convBarcelonaId,
      user_id: uid,
      role: uid === DEMO_ID ? 'owner' : 'member',
    }).execute().catch(() => {});
  }

  // Messages
  const barcelonaMessages = [
    { sender: DEMO_ID, content: 'Hey! I just booked the hotel in Barcelona. Check the bookings tab!', time: '2026-09-01T10:00:00Z' },
    { sender: ALICE_ID, content: 'Looks amazing! The rooftop pool 😍 Should we book Sagrada Familia tickets in advance?', time: '2026-09-01T10:15:00Z' },
    { sender: DEMO_ID, content: 'Definitely, they sell out. I added it to the timeline. Also added a few restaurant suggestions from the AI tips.', time: '2026-09-01T10:20:00Z' },
    { sender: ALICE_ID, content: 'Perfect. I found a great tapas place near the hotel — El Nacional. Adding it as a favorite.', time: '2026-09-02T14:30:00Z' },
    { sender: DEMO_ID, content: 'Love it! The weather forecast shows 28°C all weekend ☀️', time: '2026-09-10T09:00:00Z' },
    { sender: ALICE_ID, content: 'Can\'t wait! I\'ve packed light — just carry-on. See you at the gate! ✈️', time: '2026-09-11T18:00:00Z' },
  ];

  for (const msg of barcelonaMessages) {
    await db.insertInto('messages').values({
      conversation_id: convBarcelonaId,
      sender_id: msg.sender,
      content: msg.content,
      content_type: 'text',
      created_at: new Date(msg.time),
    }).execute().catch(() => {});
  }

  // Lapland family group chat
  const convLaplandId = randomUUID();
  await db.insertInto('conversations').values({
    id: convLaplandId,
    type: 'trip',
    name: 'Lapland Christmas 🎄',
    trip_id: TRIP_LAPLAND,
    created_by: DEMO_ID,
    last_message_at: new Date('2026-12-18T20:00:00Z'),
    last_message_preview: 'Packed the kids\' snow suits!',
  }).execute().catch(() => {});

  for (const uid of [DEMO_ID, EVE_ID, DANA_ID]) {
    await db.insertInto('conversation_participants').values({
      conversation_id: convLaplandId,
      user_id: uid,
      role: uid === DEMO_ID ? 'owner' : 'member',
    }).execute().catch(() => {});
  }

  const laplandMessages = [
    { sender: DEMO_ID, content: 'Booked the Arctic TreeHouse Hotel! Glass roof to see the Northern Lights 🌌', time: '2026-11-15T12:00:00Z' },
    { sender: EVE_ID, content: 'OMG that looks incredible! Is it heated? My kids will love it', time: '2026-11-15T12:30:00Z' },
    { sender: DANA_ID, content: 'I just checked the weather — it\'ll be -15°C! Need to pack properly', time: '2026-11-20T09:00:00Z' },
    { sender: DEMO_ID, content: 'Check the AI packing tips — it suggests thermals, hand warmers, and face masks for the husky safari', time: '2026-11-20T09:15:00Z' },
    { sender: EVE_ID, content: 'Added the husky safari to expenses — €280 split between us three 🐺', time: '2026-12-01T16:00:00Z' },
    { sender: DANA_ID, content: 'Packed the kids\' snow suits!', time: '2026-12-18T20:00:00Z' },
  ];

  for (const msg of laplandMessages) {
    await db.insertInto('messages').values({
      conversation_id: convLaplandId,
      sender_id: msg.sender,
      content: msg.content,
      content_type: 'text',
      created_at: new Date(msg.time),
    }).execute().catch(() => {});
  }

  // DM between Demo and Bob
  const convDmBobId = randomUUID();
  await db.insertInto('conversations').values({
    id: convDmBobId,
    type: 'dm',
    created_by: DEMO_ID,
    last_message_at: new Date('2026-07-20T11:00:00Z'),
    last_message_preview: 'The sunset cruise was the best part!',
  }).execute().catch(() => {});

  for (const uid of [DEMO_ID, BOB_ID]) {
    await db.insertInto('conversation_participants').values({
      conversation_id: convDmBobId,
      user_id: uid,
      role: 'member',
    }).execute().catch(() => {});
  }

  const dmMessages = [
    { sender: BOB_ID, content: 'How was Santorini?? Saw your photos!', time: '2026-07-15T10:00:00Z' },
    { sender: DEMO_ID, content: 'Absolutely magical. The sunset cruise was the best part!', time: '2026-07-20T11:00:00Z' },
  ];

  for (const msg of dmMessages) {
    await db.insertInto('messages').values({
      conversation_id: convDmBobId,
      sender_id: msg.sender,
      content: msg.content,
      content_type: 'text',
      created_at: new Date(msg.time),
    }).execute().catch(() => {});
  }
  console.log('  ✅ 3 conversations with 14 messages');

  // ─── TRIP TIPS (AI-generated) ──────────────────────────────────────────────
  const tips = [
    // Barcelona
    { tripId: TRIP_BARCELONA, category: 'activities', title: 'Top Activities in Barcelona', content: '**Must-do experiences:**\n\n1. Visit Sagrada Familia (book tickets 2 weeks ahead)\n2. Walk Las Ramblas to La Boqueria market\n3. Park Güell at sunset\n4. Gothic Quarter walking tour\n5. Beach day at Barceloneta\n\n**Local tip:** Visit Sagrada Familia at 4pm for the best light through the stained glass windows.', checklist: '[{"id":"1","text":"Book Sagrada Familia tickets","checked":true},{"id":"2","text":"Download offline map of Gothic Quarter","checked":false},{"id":"3","text":"Reserve rooftop bar for sunset","checked":false}]' },
    { tripId: TRIP_BARCELONA, category: 'food', title: 'Barcelona Food Guide', content: '**Vegetarian-friendly options** (based on your preferences):\n\n- **La Boqueria Market** — fresh fruit juices, veggie tapas\n- **Flax & Kale** — plant-based fine dining\n- **El Nacional** — multiple food halls under one roof\n\n**Note:** Most tapas bars have *patatas bravas* and *pan con tomate* as veggie staples.\n\n⚠️ **Nut allergy alert:** Many Catalan dishes use *romesco* sauce (almond-based). Always ask!', checklist: '[{"id":"1","text":"Ask about romesco sauce (nut allergy)","checked":false},{"id":"2","text":"Try churros at Xurreria Trebol","checked":false}]' },
    { tripId: TRIP_BARCELONA, category: 'packing', title: 'Packing for Barcelona (September)', content: '**Weather:** 25-30°C, sunny, low rain chance\n\n**Essentials:**\n- Light cotton clothing\n- Comfortable walking shoes (cobblestones!)\n- Sunscreen SPF 50\n- Reusable water bottle\n- Light jacket for evenings\n\n**Skip:** Umbrella, heavy jackets, formal wear', checklist: '[{"id":"1","text":"Sunscreen SPF 50","checked":true},{"id":"2","text":"Comfortable walking shoes","checked":true},{"id":"3","text":"Light evening jacket","checked":false},{"id":"4","text":"Reusable water bottle","checked":true}]' },
    // Lapland
    { tripId: TRIP_LAPLAND, category: 'packing', title: 'Arctic Packing Essentials', content: '**Temperature:** -10°C to -25°C in December\n\n**Layer system:**\n1. Base layer: Merino wool thermals\n2. Mid layer: Fleece or down jacket\n3. Outer layer: Windproof/waterproof shell\n\n**Don\'t forget:**\n- Hand warmers (essential for husky safari)\n- Balaclava or face mask\n- Insulated boots rated to -30°C\n- Kids: full snow suits + mittens on strings', checklist: '[{"id":"1","text":"Merino wool base layers","checked":false},{"id":"2","text":"Hand warmers (pack of 20)","checked":false},{"id":"3","text":"Insulated boots -30°C rated","checked":false},{"id":"4","text":"Oliver snow suit","checked":false},{"id":"5","text":"Balaclava/face mask","checked":false}]' },
    { tripId: TRIP_LAPLAND, category: 'activities', title: 'Lapland Winter Activities', content: '**Family-friendly experiences:**\n\n1. 🐺 Husky Safari (2 hours, kid-friendly)\n2. 🎅 Santa Claus Village — official Arctic Circle crossing certificate\n3. 🦌 Reindeer farm visit + sleigh ride\n4. 🌌 Northern Lights tour (best after 9pm)\n5. ⛷️ Cross-country skiing (equipment rental available)\n\n**With kids:** Book the daytime Northern Lights photography tour instead of late-night one.', checklist: '[{"id":"1","text":"Book husky safari (morning slot)","checked":true},{"id":"2","text":"Santa Village - arrive before 10am","checked":false},{"id":"3","text":"Northern Lights tour (check aurora forecast)","checked":false}]' },
    // Japan
    { tripId: TRIP_JAPAN, category: 'culture', title: 'Japanese Culture & Etiquette', content: '**Essential tips:**\n\n- 🙇 **Bowing:** Slight bow (15°) for greetings\n- 🚇 **Trains:** No phone calls, keep quiet, queue orderly\n- 🏠 **Shoes:** Always remove before entering homes/temples\n- 💴 **Cash:** Many places don\'t accept cards — carry ¥10,000+\n- 🍜 **Slurping:** Encouraged for noodles (shows appreciation!)\n\n**Useful phrases:**\n- *Sumimasen* — Excuse me / Sorry\n- *Arigatou gozaimasu* — Thank you very much\n- *Oishii* — Delicious!', checklist: '[{"id":"1","text":"Get IC card (Suica/Pasmo) at airport","checked":false},{"id":"2","text":"Download Google Translate offline Japanese","checked":false},{"id":"3","text":"Withdraw cash at 7-Eleven ATM","checked":false}]' },
  ];

  for (const tip of tips) {
    await db.insertInto('trip_tips').values({
      trip_id: tip.tripId,
      user_id: DEMO_ID,
      category: tip.category,
      title: tip.title,
      content: tip.content,
      checklist: tip.checklist as any,
      source: 'ai',
      ai_model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    }).execute().catch(() => {});
  }
  console.log(`  ✅ ${tips.length} AI trip tips with checklists`);

  // ─── TRIP TIP CHAT (AI Q&A) ───────────────────────────────────────────────
  const tipChats = [
    // Barcelona AI chat
    { tripId: TRIP_BARCELONA, role: 'user', message: 'What time should I arrive at Sagrada Familia to avoid crowds?' },
    { tripId: TRIP_BARCELONA, role: 'assistant', message: 'I recommend arriving right at opening (9:00 AM) or going for a late afternoon slot around 4-5 PM. The afternoon light through the stained glass on the west side is spectacular. Midday (11 AM - 2 PM) is the busiest. Book your tickets for a specific time slot online — they sell out 1-2 weeks in advance for popular times.' },
    { tripId: TRIP_BARCELONA, role: 'user', message: 'Any good vegetarian restaurants near the Gothic Quarter?' },
    { tripId: TRIP_BARCELONA, role: 'assistant', message: 'Great options near the Gothic Quarter:\n\n1. **Flax & Kale** (Carrer dels Tallers) — Creative plant-based dishes, beautiful interior\n2. **Teresa Carles** (Carrer de Jovellanos) — Legendary vegetarian spot, excellent value lunch menu\n3. **The Green Spot** (Carrer de la Reina Cristina) — Upscale veggie with harbour views\n\n⚠️ For your nut allergy: Teresa Carles marks all allergens on their menu. At Flax & Kale, ask about the romesco-based sauces.' },
    // Lapland AI chat
    { tripId: TRIP_LAPLAND, role: 'user', message: 'Is it safe to do the husky safari with a 7-year-old?' },
    { tripId: TRIP_LAPLAND, role: 'assistant', message: 'Absolutely! The husky safaris in Rovaniemi are very family-friendly. For a 7-year-old:\n\n- **Sit in the sled**: Oliver can ride as a passenger while you drive\n- **Dress warmly**: Full snow suit + balaclava (the wind chill during the ride is significant)\n- **Duration**: Choose the 1-hour "family safari" rather than the 2-hour wilderness tour\n- **Book morning**: Kids are more alert and it\'s slightly warmer (if -12°C counts as warm!)\n\nThe dogs are gentle and the guides are experienced with children. Many companies even let kids pet and feed the huskies afterwards.' },
  ];

  for (const chat of tipChats) {
    await db.insertInto('trip_tip_chats').values({
      trip_id: chat.tripId,
      user_id: DEMO_ID,
      role: chat.role,
      message: chat.message,
      ai_model: chat.role === 'assistant' ? 'anthropic.claude-3-5-haiku-20241022-v1:0' : null,
    }).execute().catch(() => {});
  }
  console.log(`  ✅ ${tipChats.length} AI chat messages (Q&A)`);

  // ─── MORE TRIP MEMBERS (groups) ────────────────────────────────────────────
  // Add Charlie and Dana to the Greece trip
  await db.insertInto('trip_members').values({ trip_id: TRIP_GREECE, user_id: CHARLIE_ID, access_level: 'view' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  // Add Bob to the Japan trip
  await db.insertInto('trip_members').values({ trip_id: TRIP_JAPAN, user_id: BOB_ID, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  // Add Charlie to the Lapland trip
  await db.insertInto('trip_members').values({ trip_id: TRIP_LAPLAND, user_id: CHARLIE_ID, access_level: 'edit' }).onConflict((oc) => oc.columns(['trip_id', 'user_id']).doNothing()).execute();
  console.log('  ✅ Additional trip members added');

  // ─── ACTIVITY FEED ─────────────────────────────────────────────────────────
  const activities = [
    { tripId: TRIP_BARCELONA, userId: DEMO_ID, action: 'created_trip', entityType: 'trip', entityId: TRIP_BARCELONA },
    { tripId: TRIP_BARCELONA, userId: DEMO_ID, action: 'added_booking', entityType: 'booking', entityId: '00000000-0000-4000-c000-000000000010' },
    { tripId: TRIP_BARCELONA, userId: DEMO_ID, action: 'invited_member', entityType: 'user', entityId: ALICE_ID },
    { tripId: TRIP_BARCELONA, userId: ALICE_ID, action: 'added_expense', entityType: 'expense', entityId: '00000000-0000-4000-d000-000000000013' },
    { tripId: TRIP_LAPLAND, userId: DEMO_ID, action: 'created_trip', entityType: 'trip', entityId: TRIP_LAPLAND },
    { tripId: TRIP_LAPLAND, userId: DEMO_ID, action: 'added_booking', entityType: 'booking', entityId: '00000000-0000-4000-c000-000000000018' },
    { tripId: TRIP_LAPLAND, userId: EVE_ID, action: 'added_expense', entityType: 'expense', entityId: '00000000-0000-4000-d000-000000000021' },
    { tripId: TRIP_GREECE, userId: DEMO_ID, action: 'created_trip', entityType: 'trip', entityId: TRIP_GREECE },
  ];

  for (const act of activities) {
    await db.insertInto('activity_feed').values({
      trip_id: act.tripId,
      user_id: act.userId,
      action: act.action,
      entity_type: act.entityType,
      entity_id: act.entityId,
    }).execute().catch(() => {});
  }
  console.log(`  ✅ ${activities.length} activity feed entries`);

  // ─── USER PREFERENCES (demo user) ─────────────────────────────────────────
  await db.insertInto('user_preferences').values({
    user_id: DEMO_ID,
    interests: ['culture', 'food', 'nature', 'photography'] as any,
    dietary_preferences: ['vegetarian'] as any,
    allergies: ['nuts'] as any,
    language: 'en',
    display_currencies: ['EUR', 'GBP', 'USD'] as any,
    locale_code: 'en-GB',
  }).onConflict((oc) => oc.column('user_id').doNothing()).execute().catch(() => {});
  console.log('  ✅ User preferences (vegetarian, nut allergy, multi-currency)');

  // ─── TRIP BUDGETS ──────────────────────────────────────────────────────────
  await sql`UPDATE trips SET budget = '800', budget_currency = 'EUR' WHERE id = ${TRIP_BARCELONA}`.execute(db);
  await sql`UPDATE trips SET budget = '5000', budget_currency = 'EUR' WHERE id = ${TRIP_GREECE}`.execute(db);
  await sql`UPDATE trips SET budget = '2000', budget_currency = 'USD' WHERE id = ${TRIP_NYC}`.execute(db);
  await sql`UPDATE trips SET budget = '4000', budget_currency = 'EUR' WHERE id = ${TRIP_LAPLAND}`.execute(db);
  console.log('  ✅ Trip budgets set');

  console.log('\n✅ Rich demo data seeded!');
  console.log('   Expenses: 12 (shared + personal, multiple currencies)');
  console.log('   Family: Spouse (Alice) + Child (Oliver, age 7)');
  console.log('   Conversations: 3 (2 trip chats + 1 DM)');
  console.log('   Messages: 14 realistic messages');
  console.log('   Trip Tips: 6 AI-generated with checklists');
  console.log('   Activity Feed: 8 entries');
  console.log('   Preferences: Vegetarian, nut allergy, multi-currency');
  process.exit(0);
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
