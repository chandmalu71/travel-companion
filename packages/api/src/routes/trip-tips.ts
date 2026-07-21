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

  if (lower.includes('weather') || lower.includes('temperature') || lower.includes('rain')) {
    return `For ${destination}, I'd recommend checking the weather forecast closer to your travel dates. Generally:\n\n- **Summer**: Warm to hot, pack light clothing and sun protection\n- **Winter**: Can be cool, bring layers and a warm jacket\n- **Spring/Autumn**: Variable weather, pack layers and a rain jacket\n\nI'd suggest downloading a weather app and checking 7 days before departure for the most accurate forecast.`;
  }

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('eat')) {
    return `Great question about dining in ${destination}! Here are my suggestions:\n\n1. **For local cuisine**: Ask your hotel concierge or check Google Maps reviews sorted by "newest"\n2. **Budget-friendly**: Look for lunch specials (menú del día in Spain, set lunch in Asia)\n3. **Reservations**: Popular restaurants should be booked 1-2 weeks in advance\n4. **Street food**: Generally safe where you see locals eating and high turnover\n\nWant me to suggest specific types of cuisine to try?`;
  }

  if (lower.includes('safety') || lower.includes('safe') || lower.includes('danger')) {
    return `Safety in ${destination}:\n\n**General tips:**\n- Most tourist areas are safe during daytime\n- Use well-lit, populated streets at night\n- Keep valuables in your hotel safe\n- Use official taxis or ride-hailing apps\n\n**Emergency:**\n- Save the local emergency number in your phone\n- Know your hotel address in the local language (for taxi drivers)\n- Register with your embassy for longer stays\n\nIs there a specific safety concern you'd like me to address?`;
  }

  if (lower.includes('wifi') || lower.includes('internet') || lower.includes('sim') || lower.includes('data')) {
    return `Staying connected in ${destination}:\n\n**Options:**\n1. **Local SIM card**: Buy at the airport — usually cheapest for data\n2. **eSIM**: Airalo or Holafly work in most countries\n3. **WiFi**: Hotels, cafes, and restaurants usually have free WiFi\n4. **Portable hotspot**: Rent one if traveling in a group\n\n**Tips:**\n- Download offline maps before you go (Google Maps or Maps.me)\n- Pre-download entertainment and translation packages\n- Use WiFi calling to stay in touch with home`;
  }

  return `That's a great question about ${destination}! Here's what I know:\n\nBased on your trip details, I'd recommend:\n\n1. **Research thoroughly** before your trip — travel blogs and recent YouTube videos are great sources\n2. **Ask locals** once you arrive — hotel staff, shopkeepers, and tour guides often have the best tips\n3. **Stay flexible** — some of the best travel experiences are unplanned\n\nWould you like me to help with something more specific? I can provide advice on:\n- Specific attractions or activities\n- Transportation between locations\n- Cultural customs and etiquette\n- Packing recommendations\n- Budget planning`;
}
