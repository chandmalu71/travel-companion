/**
 * AI Trip Tips Routes
 *
 * Generates personalized travel advice using LLM (with trip context):
 * - Activities, packing, precautions, culture, food, transport, budget, documents
 * - Checklist items within each category
 * - Favorites, dismiss, regenerate
 * - Chat follow-ups for asking destination questions
 *
 * In dev: uses mock AI responses (no Bedrock calls)
 * In production: calls AWS Bedrock (Nova Lite → Haiku escalation)
 *
 * Endpoints:
 *  - GET    /api/trips/:tripId/tips          — list tips for a trip
 *  - POST   /api/trips/:tripId/tips/generate — generate/regenerate AI tips
 *  - PUT    /api/trips/:tripId/tips/:id      — update (favorite, dismiss, check items)
 *  - POST   /api/trips/:tripId/tips/chat     — ask follow-up question
 *  - GET    /api/trips/:tripId/tips/chat     — get chat history
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { randomUUID } from 'node:crypto';

const CATEGORIES = ['activities', 'packing', 'precautions', 'culture', 'food', 'transport', 'budget', 'documents'] as const;

const CATEGORY_META: Record<string, { icon: string; title: string }> = {
  activities: { icon: '🎯', title: 'Things to Do' },
  packing: { icon: '🧳', title: 'Packing Guide' },
  precautions: { icon: '⚠️', title: 'Safety & Precautions' },
  culture: { icon: '🎭', title: 'Culture & Etiquette' },
  food: { icon: '🍽️', title: 'Food & Dining' },
  transport: { icon: '🚌', title: 'Getting Around' },
  budget: { icon: '💰', title: 'Budget & Costs' },
  documents: { icon: '📋', title: 'Documents & Visas' },
};

interface TripTipsOptions {
  db: Kysely<Database>;
}

export async function registerTripTipsRoutes(
  app: FastifyInstance,
  options: TripTipsOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/tips ───────────────────────────────────────────
  app.get(
    '/api/trips/:tripId/tips',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;

      const tips = await db
        .selectFrom('trip_tips')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .where('is_dismissed', '=', false)
        .orderBy('category', 'asc')
        .execute();

      const data = tips.map((t) => ({
        id: t.id,
        category: t.category,
        icon: CATEGORY_META[t.category]?.icon ?? '💡',
        title: t.title,
        content: t.content,
        checklist: t.checklist ?? [],
        isFavorited: t.is_favorited,
        isDismissed: t.is_dismissed,
        source: t.source,
        aiModel: t.ai_model,
        generatedAt: t.generated_at,
        expiresAt: t.expires_at,
      }));

      return reply.send({ statusCode: 200, data });
    },
  );

  // ─── POST /api/trips/:tripId/tips/generate ─────────────────────────────────
  app.post(
    '/api/trips/:tripId/tips/generate',
    async (request: FastifyRequest<{ Params: { tripId: string }; Body: { categories?: string[] } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;
      const requestedCategories = (request.body as any)?.categories ?? CATEGORIES;

      // Fetch trip context
      const trip = await db.selectFrom('trips').selectAll().where('id', '=', tripId).executeTakeFirst();
      if (!trip) return reply.status(404).send({ statusCode: 404, error: 'Trip not found' });

      // Fetch user preferences for personalization
      const prefs = await db.selectFrom('user_preferences').selectAll().where('user_id', '=', userId).executeTakeFirst();

      // Fetch family members (for group-specific tips)
      const family = await db.selectFrom('family_members').selectAll().where('user_id', '=', userId).execute();

      // Delete existing tips for these categories (regenerate)
      await db.deleteFrom('trip_tips')
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .where('category', 'in', requestedCategories)
        .execute();

      // Build context for AI prompt
      const tripContext = {
        destination: trip.name, // Trip name often includes destination
        startDate: trip.start_date,
        endDate: trip.end_date,
        budget: trip.budget ? `${trip.budget} ${trip.budget_currency}` : null,
        travellers: family.map(f => ({ name: f.first_name, relationship: f.relationship, allergies: f.allergies })),
        userAllergies: prefs?.allergies ?? [],
        userDietary: prefs?.dietary_preferences ?? [],
      };

      // Generate tips per category
      // In production: call Bedrock with tripContext
      // In dev: use rich mock responses
      const generatedTips = generateMockTips(tripContext, requestedCategories as string[]);

      // Insert into DB
      const inserted = [];
      for (const tip of generatedTips) {
        const result = await db.insertInto('trip_tips').values({
          trip_id: tripId,
          user_id: userId,
          category: tip.category,
          title: tip.title,
          content: tip.content,
          checklist: JSON.stringify(tip.checklist),
          source: 'ai',
          ai_model: 'mock-dev (production: amazon.nova-lite)',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 day cache
        }).returningAll().executeTakeFirstOrThrow();
        inserted.push(result);
      }

      const data = inserted.map((t) => ({
        id: t.id,
        category: t.category,
        icon: CATEGORY_META[t.category]?.icon ?? '💡',
        title: t.title,
        content: t.content,
        checklist: t.checklist ?? [],
        isFavorited: t.is_favorited,
        source: t.source,
        generatedAt: t.generated_at,
      }));

      return reply.status(201).send({ statusCode: 201, data, message: `Generated ${data.length} tips` });
    },
  );

  // ─── PUT /api/trips/:tripId/tips/:id ───────────────────────────────────────
  app.put(
    '/api/trips/:tripId/tips/:id',
    async (request: FastifyRequest<{ Params: { tripId: string; id: string }; Body: any }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { id } = request.params;
      const body = request.body as any;

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (body.isFavorited !== undefined) updates.is_favorited = body.isFavorited;
      if (body.isDismissed !== undefined) updates.is_dismissed = body.isDismissed;
      if (body.checklist !== undefined) updates.checklist = JSON.stringify(body.checklist);

      await db.updateTable('trip_tips')
        .set(updates)
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .execute();

      return reply.send({ statusCode: 200, message: 'Tip updated' });
    },
  );

  // ─── POST /api/trips/:tripId/tips/chat ─────────────────────────────────────
  app.post(
    '/api/trips/:tripId/tips/chat',
    async (request: FastifyRequest<{ Params: { tripId: string }; Body: { message: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;
      const { message } = request.body as any;

      if (!message || message.length > 1000) {
        return reply.status(400).send({ statusCode: 400, error: 'Message required (max 1000 chars)' });
      }

      // Save user message
      await db.insertInto('trip_tip_chats').values({
        trip_id: tripId, user_id: userId, role: 'user', message,
      }).execute();

      // Get trip context for AI response
      const trip = await db.selectFrom('trips').selectAll().where('id', '=', tripId).executeTakeFirst();

      // In production: call Bedrock with conversation history + trip context
      // In dev: generate mock response
      const aiResponse = generateMockChatResponse(message, trip?.name ?? 'your destination');

      // Save assistant response
      await db.insertInto('trip_tip_chats').values({
        trip_id: tripId, user_id: userId, role: 'assistant', message: aiResponse, ai_model: 'mock-dev',
      }).execute();

      return reply.send({ statusCode: 200, data: { role: 'assistant', message: aiResponse } });
    },
  );

  // ─── GET /api/trips/:tripId/tips/chat ──────────────────────────────────────
  app.get(
    '/api/trips/:tripId/tips/chat',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;

      const messages = await db
        .selectFrom('trip_tip_chats')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .orderBy('created_at', 'asc')
        .limit(50)
        .execute();

      return reply.send({ statusCode: 200, data: messages.map(m => ({ role: m.role, message: m.message, createdAt: m.created_at })) });
    },
  );

  // ─── POST /api/trips/:tripId/tips/save-favorite ────────────────────────────
  // Save a place from AI chat response to the trip's favorites
  app.post(
    '/api/trips/:tripId/tips/save-favorite',
    async (request: FastifyRequest<{ Params: { tripId: string }; Body: any }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { tripId } = request.params;
      const { name, category, rating, notes } = request.body as any;

      if (!name) return reply.status(400).send({ statusCode: 400, error: 'Name is required' });

      const favorite = await db.insertInto('favorites').values({
        user_id: userId,
        trip_id: tripId,
        name,
        category: category ?? 'attraction',
        rating: rating ?? null,
        notes: notes ?? 'Added from AI Tips',
        added_by: userId,
      }).returningAll().executeTakeFirstOrThrow();

      return reply.status(201).send({ statusCode: 201, data: favorite, message: `"${name}" added to trip favorites` });
    },
  );
}

// ─── Mock AI Generation (dev mode) ──────────────────────────────────────────

function generateMockTips(context: any, categories: string[]) {
  const destination = context.destination ?? 'your destination';
  const tips: Array<{ category: string; title: string; content: string; checklist: Array<{ id: string; text: string; checked: boolean }> }> = [];

  if (categories.includes('activities')) {
    tips.push({
      category: 'activities',
      title: `Things to Do in ${destination}`,
      content: `Here are the top recommended activities for your trip to ${destination}:\n\n**Must-see attractions:**\n- Visit the most popular landmarks and historical sites\n- Explore local markets and artisan shops\n- Take a guided walking tour of the old town\n\n**Hidden gems:**\n- Ask locals for their favorite off-the-beaten-path spots\n- Check out neighborhood cafes away from tourist areas\n- Visit during golden hour for the best photography`,
      checklist: [
        { id: randomUUID(), text: 'Research top-rated attractions', checked: false },
        { id: randomUUID(), text: 'Book guided tour in advance', checked: false },
        { id: randomUUID(), text: 'Download offline maps', checked: false },
        { id: randomUUID(), text: 'Check opening hours for museums', checked: false },
      ],
    });
  }

  if (categories.includes('packing')) {
    const hasKids = context.travellers?.some((t: any) => t.relationship === 'child');
    tips.push({
      category: 'packing',
      title: `Packing Guide for ${destination}`,
      content: `**Essential clothing:**\n- Light layers for variable temperatures\n- Comfortable walking shoes (you'll walk a lot!)\n- Rain jacket or compact umbrella\n- Swimwear if near water\n\n**Accessories:**\n- Universal power adapter\n- Portable charger\n- Sunscreen SPF 50+\n- Reusable water bottle\n\n**Documents:**\n- Passport (check 6-month validity)\n- Travel insurance documents\n- Copies of all bookings${hasKids ? '\n\n**For kids:**\n- Entertainment for travel (tablets, books)\n- Snacks for between meals\n- First-aid kit with children\'s medicine' : ''}`,
      checklist: [
        { id: randomUUID(), text: 'Check passport validity (6+ months)', checked: false },
        { id: randomUUID(), text: 'Pack universal adapter', checked: false },
        { id: randomUUID(), text: 'Comfortable walking shoes', checked: false },
        { id: randomUUID(), text: 'Rain gear', checked: false },
        { id: randomUUID(), text: 'Sunscreen & sunglasses', checked: false },
        { id: randomUUID(), text: 'Travel insurance printed', checked: false },
        ...(hasKids ? [{ id: randomUUID(), text: 'Kids entertainment & snacks', checked: false }] : []),
      ],
    });
  }

  if (categories.includes('precautions')) {
    tips.push({
      category: 'precautions',
      title: `Safety Tips for ${destination}`,
      content: `**General safety:**\n- Keep valuables in hotel safe\n- Use registered taxis or ride-hailing apps\n- Avoid displaying expensive jewelry/electronics\n- Stay aware of your surroundings in crowded areas\n\n**Health:**\n- Drink bottled water if unsure of tap water quality\n- Carry basic first-aid supplies\n- Know the local emergency number\n- Check if any vaccinations are recommended\n\n**Scam awareness:**\n- Be wary of unsolicited help at tourist spots\n- Agree on taxi fares before getting in\n- Verify restaurant bills carefully`,
      checklist: [
        { id: randomUUID(), text: 'Note local emergency numbers', checked: false },
        { id: randomUUID(), text: 'Register with embassy (for long trips)', checked: false },
        { id: randomUUID(), text: 'Get travel insurance', checked: false },
        { id: randomUUID(), text: 'Check vaccination requirements', checked: false },
        { id: randomUUID(), text: 'Share itinerary with someone at home', checked: false },
      ],
    });
  }

  if (categories.includes('culture')) {
    tips.push({
      category: 'culture',
      title: `Culture & Etiquette`,
      content: `**Local customs:**\n- Learn a few basic phrases in the local language (hello, thank you, please)\n- Respect dress codes at religious sites (cover shoulders/knees)\n- Tipping customs vary — research before you go\n\n**Etiquette:**\n- Ask permission before photographing locals\n- Remove shoes when entering homes or temples\n- Be punctual for reservations but expect local pace\n\n**Communication:**\n- Download Google Translate offline for the local language\n- Hand gestures may have different meanings — be cautious`,
      checklist: [
        { id: randomUUID(), text: 'Learn 5 basic phrases', checked: false },
        { id: randomUUID(), text: 'Research tipping customs', checked: false },
        { id: randomUUID(), text: 'Download offline translation', checked: false },
        { id: randomUUID(), text: 'Check dress codes for planned sites', checked: false },
      ],
    });
  }

  if (categories.includes('food')) {
    const dietary = context.userDietary?.length > 0 ? `\n\n**Your dietary needs (${context.userDietary.join(', ')}):**\nLook for restaurants that cater to your preferences. Use apps like HappyCow or TripAdvisor filters.` : '';
    const allergies = context.userAllergies?.length > 0 ? `\n\n**⚠️ Allergy alert (${context.userAllergies.join(', ')}):**\nCarry an allergy card in the local language. Inform restaurant staff before ordering.` : '';
    tips.push({
      category: 'food',
      title: `Food & Dining Guide`,
      content: `**Must-try local dishes:**\n- Ask your hotel/host for their favorite local restaurants\n- Try the street food — it's often the most authentic\n- Visit local markets for fresh produce and snacks\n\n**Dining tips:**\n- Peak dining hours may differ from home\n- Reservations recommended for popular spots\n- Water safety: check if tap water is drinkable${dietary}${allergies}`,
      checklist: [
        { id: randomUUID(), text: 'Research local must-try dishes', checked: false },
        { id: randomUUID(), text: 'Check water safety', checked: false },
        { id: randomUUID(), text: 'Book key restaurant reservations', checked: false },
        ...(context.userAllergies?.length > 0 ? [{ id: randomUUID(), text: 'Prepare allergy card in local language', checked: false }] : []),
      ],
    });
  }

  if (categories.includes('transport')) {
    tips.push({
      category: 'transport',
      title: `Getting Around`,
      content: `**From the airport:**\n- Research airport transfer options in advance\n- Pre-book transfers or know the taxi/bus situation\n\n**In the city:**\n- Public transport is often cheapest and fastest\n- Download local transit apps\n- Ride-hailing apps (Uber, Bolt, Grab) work in many destinations\n\n**Day trips:**\n- Consider renting a car for countryside exploration\n- Check if an international driving permit is needed\n- Train travel is often scenic and efficient`,
      checklist: [
        { id: randomUUID(), text: 'Research airport transfer options', checked: false },
        { id: randomUUID(), text: 'Download local transit/ride app', checked: false },
        { id: randomUUID(), text: 'Check if driving permit needed', checked: false },
        { id: randomUUID(), text: 'Get transport pass if available', checked: false },
      ],
    });
  }

  if (categories.includes('budget')) {
    tips.push({
      category: 'budget',
      title: `Budget & Costs`,
      content: `**Typical daily costs:**\n- Budget: Research the average daily spend for your destination\n- Mid-range: Expect comfortable hotels + restaurant meals\n- Use XE or your app's currency converter for quick checks\n\n**Money tips:**\n- Notify your bank of travel dates\n- Carry some local cash for small vendors\n- ATMs at airports often have higher fees\n- Credit cards widely accepted in cities, less so in rural areas\n\n**Savings:**\n- Book attractions online in advance (often cheaper)\n- Free walking tours (tip-based)\n- Lunch menus are usually cheaper than dinner`,
      checklist: [
        { id: randomUUID(), text: 'Notify bank of travel dates', checked: false },
        { id: randomUUID(), text: 'Get some local currency', checked: false },
        { id: randomUUID(), text: 'Set daily spending budget', checked: false },
        { id: randomUUID(), text: 'Check which cards have no foreign fees', checked: false },
      ],
    });
  }

  if (categories.includes('documents')) {
    tips.push({
      category: 'documents',
      title: `Documents & Visas`,
      content: `**Essential documents:**\n- Passport (valid for 6+ months after return date)\n- Visa — check requirements well in advance\n- Travel insurance (medical + cancellation)\n- Flight and hotel confirmations\n- International driving permit (if renting a car)\n\n**Digital copies:**\n- Photograph all documents and store in cloud\n- Have offline copies on your phone\n- Share copies with emergency contact at home\n\n**Health:**\n- Check if vaccination certificate is required\n- Carry prescription medications in original packaging\n- Health insurance card (EHIC for Europe, or travel policy)`,
      checklist: [
        { id: randomUUID(), text: 'Check visa requirements', checked: false },
        { id: randomUUID(), text: 'Verify passport validity', checked: false },
        { id: randomUUID(), text: 'Purchase travel insurance', checked: false },
        { id: randomUUID(), text: 'Digital copies of all documents', checked: false },
        { id: randomUUID(), text: 'Check vaccination requirements', checked: false },
        { id: randomUUID(), text: 'Print emergency contacts list', checked: false },
      ],
    });
  }

  return tips;
}

function generateMockChatResponse(userMessage: string, destination: string): string {
  const lower = userMessage.toLowerCase();

  // Destination-specific knowledge base (in production: LLM + web search)
  const DESTINATION_DATA: Record<string, { attractions: string[]; restaurants: string[]; activities: string[] }> = {
    'italy': {
      attractions: [
        '📍 Colosseum — Rome | ⭐ 4.8 | Ancient amphitheater, UNESCO World Heritage Site',
        '📍 Venice Grand Canal — Venice | ⭐ 4.9 | Iconic waterway with gondola rides',
        '📍 Uffizi Gallery — Florence | ⭐ 4.7 | Renaissance art museum (Botticelli, Da Vinci)',
        '📍 Pompeii Archaeological Park — Naples | ⭐ 4.6 | Ancient Roman city preserved by volcano',
        '📍 Amalfi Coast Drive — Salerno | ⭐ 4.9 | Stunning coastal road with cliffside villages',
        '📍 St. Mark\'s Basilica — Venice | ⭐ 4.8 | Byzantine cathedral with golden mosaics',
        '📍 Cinque Terre — Liguria | ⭐ 4.8 | Five colorful fishing villages on the coast',
        '📍 Vatican Museums — Rome | ⭐ 4.7 | Sistine Chapel, Raphael Rooms, ancient sculptures',
      ],
      restaurants: [
        '🍽️ Da Enzo al 29 — Rome, Trastevere | ⭐ 4.7 | Traditional Roman cuisine, cacio e pepe',
        '🍽️ Trattoria Mario — Florence | ⭐ 4.5 | Family-run since 1953, bistecca fiorentina',
        '🍽️ Pizzeria Da Michele — Naples | ⭐ 4.6 | Historic pizza since 1870, margherita & marinara only',
        '🍽️ Osteria Alle Testiere — Venice | ⭐ 4.8 | Intimate seafood, 9 tables, book weeks ahead',
        '🍽️ Trattoria Sostanza — Florence | ⭐ 4.6 | Butter chicken, artichoke omelette, cash only',
      ],
      activities: [
        '🎯 Cooking class in Tuscany — Learn pasta making from local nonnas | €80-120',
        '🎯 Gondola ride at sunset — Venice | 30 min | €80 (up to 6 people)',
        '🎯 Wine tasting in Chianti — Half-day tour from Florence | €65-95',
        '🎯 Vespa tour of Rome — 3 hours through historic streets | €85',
        '🎯 Truffle hunting in Umbria — Forest walk + lunch | €120',
      ],
    },
    'default': {
      attractions: [
        '📍 Top Historical Landmark — City Center | ⭐ 4.8 | The most visited historical site',
        '📍 National Museum — Downtown | ⭐ 4.7 | Art and history collection',
        '📍 Old Town Quarter — Historic District | ⭐ 4.6 | Charming streets and architecture',
        '📍 Botanical Gardens — South Side | ⭐ 4.5 | 500+ plant species, peaceful walks',
        '📍 Panoramic Viewpoint — Hilltop | ⭐ 4.9 | Best sunset views of the city',
      ],
      restaurants: [
        '🍽️ The Local Kitchen — City Center | ⭐ 4.7 | Best traditional cuisine in town',
        '🍽️ Market Food Hall — Old Town | ⭐ 4.5 | Multiple vendors, street food style',
        '🍽️ Riverside Terrace — Waterfront | ⭐ 4.6 | Scenic dining with local seafood',
        '🍽️ Hidden Courtyard — Back Street | ⭐ 4.8 | Reservations required, tasting menu',
      ],
      activities: [
        '🎯 Walking tour of Old Town — 2-3 hours | Free (tip-based)',
        '🎯 Local cooking class — Learn signature dishes | €60-100',
        '🎯 Day trip to countryside — Nature + villages | €40-80',
        '🎯 Sunset boat trip — Harbor cruise | €30-50',
      ],
    },
  };

  // Match destination to knowledge base
  const destKey = Object.keys(DESTINATION_DATA).find(k => destination.toLowerCase().includes(k)) ?? 'default';
  const data = DESTINATION_DATA[destKey];

  // Detect intent and return structured results
  if (lower.includes('attraction') || lower.includes('see') || lower.includes('visit') || lower.includes('top') || lower.includes('must') || lower.includes('landmark') || lower.includes('sightseeing')) {
    return `Here are the **top-rated attractions** near ${destination}:\n\n${data.attractions.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n💡 **Tip:** Book tickets online in advance for popular sites to skip the queue.\n\n_Mark any item as ⭐ favorite to add it to your trip._`;
  }

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('eat') || lower.includes('dine') || lower.includes('dinner') || lower.includes('lunch')) {
    return `Here are **highly-rated restaurants** in ${destination}:\n\n${data.restaurants.map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n💡 **Tip:** Book popular restaurants 1-2 weeks in advance. Lunch menus are usually cheaper.\n\n_Mark any item as ⭐ favorite to add it to your trip._`;
  }

  if (lower.includes('activit') || lower.includes('do') || lower.includes('experience') || lower.includes('tour') || lower.includes('fun')) {
    return `Here are **recommended activities** in ${destination}:\n\n${data.activities.map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n💡 **Tip:** Book activities with free cancellation in case your plans change.\n\n_Mark any item as ⭐ favorite to add it to your trip._`;
  }

  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain') || lower.includes('climate')) {
    return `**Weather for ${destination}:**\n\n☀️ **Summer (Jun-Aug):** 25-35°C, sunny, occasional thunderstorms\n🍂 **Autumn (Sep-Nov):** 15-25°C, mild, light rain possible\n❄️ **Winter (Dec-Feb):** 5-12°C, cool, rain more frequent\n🌸 **Spring (Mar-May):** 15-22°C, pleasant, perfect for sightseeing\n\n**Pack:** Layers, comfortable shoes, sunscreen, and a light rain jacket.\n\n_Check the forecast 7 days before departure for the latest._`;
  }

  if (lower.includes('safety') || lower.includes('safe') || lower.includes('scam') || lower.includes('danger') || lower.includes('avoid')) {
    return `**Safety tips for ${destination}:**\n\n⚠️ **Be aware of:**\n- Pickpockets in crowded tourist areas and public transport\n- Fake "friendship bracelet" scammers near landmarks\n- Unlicensed taxi drivers overcharging at airports\n- Counterfeit goods sellers on the street\n\n✅ **Stay safe:**\n- Use registered taxis or apps (Uber, Bolt)\n- Keep wallet in front pocket, bag zipped\n- Don't flash expensive items\n- Stick to well-lit streets at night\n\n📞 **Emergency:** Save the local emergency number in your phone before arriving.`;
  }

  if (lower.includes('budget') || lower.includes('cost') || lower.includes('cheap') || lower.includes('expensive') || lower.includes('money') || lower.includes('price')) {
    return `**Budget guide for ${destination}:**\n\n💰 **Daily costs (per person):**\n- Budget: €50-80/day (hostel, street food, public transport)\n- Mid-range: €120-200/day (3-star hotel, restaurants, some activities)\n- Luxury: €300+/day (4-5 star, fine dining, private tours)\n\n**Money-saving tips:**\n1. City tourist pass (often includes transport + museums)\n2. Free walking tours (tip-based)\n3. Lunch menus instead of dinner (same food, 40% cheaper)\n4. Cook 1 meal/day if you have a kitchen\n5. Pre-book attractions online (usually 10-20% cheaper)\n\n**Payment:** Credit cards widely accepted. Carry €50 cash for small vendors.`;
  }

  // Default: show a mix of top picks
  return `Here are my **top picks** for ${destination}:\n\n**🏛️ Must-See:**\n${data.attractions.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n**🍽️ Where to Eat:**\n${data.restaurants.slice(0, 3).map((r, i) => `${i + 1}. ${r}`).join('\n')}\n\n**🎯 Things to Do:**\n${data.activities.slice(0, 3).map((a, i) => `${i + 1}. ${a}`).join('\n')}\n\n_Ask me about specific topics: attractions, restaurants, activities, weather, safety, or budget._\n\n_Mark any item as ⭐ favorite to add it to your trip._`;
}
