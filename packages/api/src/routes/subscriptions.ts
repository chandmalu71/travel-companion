/**
 * Subscription & Pricing Routes
 *
 * Manages freemium subscription model with Stripe integration.
 * 30-day trial → grace period → downgrade to Free.
 *
 * Endpoints:
 *  - GET  /api/plans                        — list available plans (public)
 *  - GET  /api/subscription                 — get user's current subscription
 *  - POST /api/subscription/start-trial     — start 30-day trial (auto on signup)
 *  - POST /api/subscription/upgrade         — upgrade to plan (creates Stripe checkout)
 *  - POST /api/subscription/cancel          — cancel at period end
 *  - POST /api/subscription/reactivate      — undo cancellation
 *  - POST /api/subscription/apply-campaign  — apply discount code
 *  - GET  /api/subscription/limits          — get current plan limits + usage
 *  - POST /api/webhooks/stripe              — Stripe webhook handler
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

interface SubscriptionOptions {
  db: Kysely<Database>;
}

export async function registerSubscriptionRoutes(
  app: FastifyInstance,
  options: SubscriptionOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/plans ────────────────────────────────────────────────────────
  app.get('/api/plans', async (_request: FastifyRequest, reply: FastifyReply) => {
    const plans = await db
      .selectFrom('subscription_plans' as any)
      .selectAll()
      .where('is_active', '=', true)
      .orderBy('tier', 'asc')
      .execute();

    // Fetch active promotions (valid now)
    const promotions = await db
      .selectFrom('subscription_promotions' as any)
      .selectAll()
      .where('is_active', '=', true)
      .where('starts_at', '<=', new Date())
      .where('ends_at', '>=', new Date())
      .execute();

    return reply.send({ statusCode: 200, data: plans, promotions });
  });

  // ─── GET /api/subscription ─────────────────────────────────────────────────
  app.get('/api/subscription', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const sub = await db
      .selectFrom('user_subscriptions' as any)
      .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
      .select([
        'user_subscriptions.id', 'user_subscriptions.status',
        'user_subscriptions.billing_cycle', 'user_subscriptions.is_family_plan',
        'user_subscriptions.trial_ends_at', 'user_subscriptions.current_period_end',
        'user_subscriptions.cancel_at_period_end', 'user_subscriptions.auto_renew',
        'user_subscriptions.created_at',
        'subscription_plans.name as plan_name', 'subscription_plans.slug as plan_slug',
        'subscription_plans.tier', 'subscription_plans.features',
        'subscription_plans.price_monthly_eur', 'subscription_plans.price_annual_eur',
      ])
      .where('user_subscriptions.user_id', '=', userId)
      .executeTakeFirst();

    if (!sub) {
      // No subscription — user is on implicit Free plan
      const freePlan = await db.selectFrom('subscription_plans' as any).selectAll().where('slug', '=', 'free').executeTakeFirst();
      return reply.send({ statusCode: 200, data: { planName: 'Free', planSlug: 'free', status: 'active', tier: 0, plan: freePlan } });
    }

    return reply.send({ statusCode: 200, data: sub });
  });

  // ─── POST /api/subscription/start-trial ────────────────────────────────────
  app.post('/api/subscription/start-trial', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    // Check if already has subscription
    const existing = await db.selectFrom('user_subscriptions' as any).select('id').where('user_id', '=', userId).executeTakeFirst();
    if (existing) return reply.status(409).send({ statusCode: 409, error: 'Already has subscription' });

    // Get Premium plan (trial gives full access)
    const premiumPlan = await db.selectFrom('subscription_plans' as any).select('id').where('slug', '=', 'premium').executeTakeFirst();
    if (!premiumPlan) return reply.status(500).send({ statusCode: 500, error: 'Premium plan not configured' });

    const trialEnds = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await db.insertInto('user_subscriptions' as any).values({
      user_id: userId,
      plan_id: (premiumPlan as any).id,
      status: 'trialing',
      billing_cycle: 'monthly',
      trial_ends_at: trialEnds,
      current_period_start: new Date(),
      current_period_end: trialEnds,
    } as any).execute();

    return reply.status(201).send({ statusCode: 201, message: 'Trial started! Full access for 30 days.', data: { trialEndsAt: trialEnds } });
  });

  // ─── POST /api/subscription/upgrade ────────────────────────────────────────
  app.post('/api/subscription/upgrade', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const { planSlug, billingCycle, isFamily, campaignCode } = request.body as any;

    const plan = await db.selectFrom('subscription_plans' as any).selectAll().where('slug', '=', planSlug).executeTakeFirst();
    if (!plan) return reply.status(404).send({ statusCode: 404, error: 'Plan not found' });

    // If Stripe is configured, create a real Checkout Session
    if (process.env.STRIPE_SECRET_KEY && !process.env.STRIPE_SECRET_KEY.includes('placeholder')) {
      const { createCheckoutSession } = await import('../services/stripe.js');
      const user = await db.selectFrom('users').select(['email']).where('id', '=', userId).executeTakeFirst();
      const appUrl = process.env.APP_URL ?? 'http://localhost:3001';

      const { url, sessionId } = await createCheckoutSession(db, {
        userId,
        email: user?.email ?? '',
        planSlug: planSlug as 'pro' | 'premium',
        billingCycle: billingCycle ?? 'monthly',
        isFamily: isFamily ?? false,
        successUrl: `${appUrl}/settings?upgrade=success`,
        cancelUrl: `${appUrl}/settings?upgrade=cancelled`,
      });

      return reply.send({ statusCode: 200, checkoutUrl: url, sessionId });
    }

    // Dev fallback: directly activate (no payment)
    const periodEnd = billingCycle === 'annual'
      ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const existing = await db.selectFrom('user_subscriptions' as any).select('id').where('user_id', '=', userId).executeTakeFirst();

    if (existing) {
      await db.updateTable('user_subscriptions' as any).set({
        plan_id: (plan as any).id,
        status: 'active',
        billing_cycle: billingCycle ?? 'monthly',
        is_family_plan: isFamily ?? false,
        current_period_start: new Date(),
        current_period_end: periodEnd,
        cancel_at_period_end: false,
        updated_at: new Date(),
      } as any).where('user_id', '=', userId).execute();
    } else {
      await db.insertInto('user_subscriptions' as any).values({
        user_id: userId,
        plan_id: (plan as any).id,
        status: 'active',
        billing_cycle: billingCycle ?? 'monthly',
        is_family_plan: isFamily ?? false,
        current_period_start: new Date(),
        current_period_end: periodEnd,
      } as any).execute();
    }

    if (campaignCode) {
      await db.updateTable('subscription_campaigns' as any)
        .set({ current_uses: db.fn<number>('coalesce', ['current_uses', db.val(0)]) } as any)
        .where('code', '=', campaignCode)
        .execute();
    }

    return reply.send({
      statusCode: 200,
      message: `Upgraded to ${(plan as any).name}!`,
      data: { plan: (plan as any).name, billingCycle, periodEnd },
    });
  });

  // ─── POST /api/subscription/cancel ─────────────────────────────────────────
  app.post('/api/subscription/cancel', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    await db.updateTable('user_subscriptions' as any)
      .set({ cancel_at_period_end: true, updated_at: new Date() } as any)
      .where('user_id', '=', userId)
      .execute();

    return reply.send({ statusCode: 200, message: 'Subscription will cancel at end of billing period' });
  });

  // ─── POST /api/subscription/reactivate ─────────────────────────────────────
  app.post('/api/subscription/reactivate', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    await db.updateTable('user_subscriptions' as any)
      .set({ cancel_at_period_end: false, updated_at: new Date() } as any)
      .where('user_id', '=', userId)
      .execute();

    return reply.send({ statusCode: 200, message: 'Subscription reactivated' });
  });

  // ─── POST /api/subscription/apply-campaign ─────────────────────────────────
  app.post('/api/subscription/apply-campaign', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { code } = request.body as any;
    if (!code) return reply.status(400).send({ statusCode: 400, error: 'Campaign code required' });

    const campaign = await db.selectFrom('subscription_campaigns' as any).selectAll()
      .where('code', '=', code.toUpperCase())
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!campaign) return reply.status(404).send({ statusCode: 404, error: 'Invalid campaign code' });

    const c = campaign as any;
    if (c.valid_until && new Date(c.valid_until) < new Date()) {
      return reply.status(410).send({ statusCode: 410, error: 'Campaign has expired' });
    }
    if (c.max_uses && c.current_uses >= c.max_uses) {
      return reply.status(410).send({ statusCode: 410, error: 'Campaign usage limit reached' });
    }

    return reply.send({
      statusCode: 200,
      data: { code: c.code, name: c.name, discountPercent: c.discount_percent, discountMonths: c.discount_months, applicablePlans: c.applicable_plans },
    });
  });

  // ─── GET /api/subscription/limits ──────────────────────────────────────────
  app.get('/api/subscription/limits', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    // Get user's plan
    const sub = await db.selectFrom('user_subscriptions' as any)
      .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
      .selectAll('subscription_plans' as any)
      .select(['user_subscriptions.status', 'user_subscriptions.trial_ends_at'])
      .where('user_subscriptions.user_id', '=', userId)
      .executeTakeFirst();

    let plan: any;
    if (!sub || (sub as any).status === 'cancelled') {
      plan = await db.selectFrom('subscription_plans' as any).selectAll().where('slug', '=', 'free').executeTakeFirst();
    } else {
      plan = sub;
    }

    const p = plan as any;

    // Get current usage (counts)
    const tripCount = await db.selectFrom('trips').select(db.fn.count<number>('id').as('c')).where('owner_id', '=', userId).executeTakeFirst();
    const expenseCount = await db.selectFrom('expenses').select(db.fn.count<number>('id').as('c')).where('user_id', '=', userId).executeTakeFirst();
    const connectionCount = await db.selectFrom('user_connections').select(db.fn.count<number>('id').as('c')).where('user_id', '=', userId).executeTakeFirst();

    return reply.send({
      statusCode: 200,
      data: {
        plan: { name: p.name, slug: p.slug, tier: p.tier },
        limits: {
          maxActiveTrips: p.max_active_trips,
          maxBookings: p.max_bookings,
          maxExpensesPerMonth: p.max_expenses_per_month,
          maxAiTipsPerTrip: p.max_ai_tips_per_trip,
          maxAiChatPerDay: p.max_ai_chat_per_day,
          maxEmailConnections: p.max_email_connections,
          maxNetworkConnections: p.max_network_connections,
          maxFamilyMembers: p.max_family_members,
          maxStorageMb: p.max_storage_mb,
          maxMessagesPerDay: p.max_messages_per_day,
          maxEmailAliases: p.max_email_aliases,
          weatherDays: p.weather_days,
        },
        usage: {
          trips: (tripCount as any)?.c ?? 0,
          expenses: (expenseCount as any)?.c ?? 0,
          connections: (connectionCount as any)?.c ?? 0,
        },
        features: p.features ?? [],
      },
    });
  });

  // ─── POST /api/webhooks/stripe ─────────────────────────────────────────────
  app.post('/api/webhooks/stripe', {
    config: { rawBody: true },
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    const sig = request.headers['stripe-signature'] as string;

    // If webhook secret is configured, verify signature
    if (process.env.STRIPE_WEBHOOK_SECRET && sig) {
      try {
        const { verifyWebhookSignature, handleWebhookEvent } = await import('../services/stripe.js');
        const rawBody = (request as any).rawBody ?? JSON.stringify(request.body);
        const event = verifyWebhookSignature(rawBody, sig);
        await handleWebhookEvent(db, event);
        console.log(`[Stripe Webhook] Processed: ${event.type}`);
        return reply.send({ statusCode: 200, received: true });
      } catch (err: any) {
        console.error('[Stripe Webhook] Signature verification failed:', err.message);
        return reply.status(400).send({ statusCode: 400, error: 'Webhook signature verification failed' });
      }
    }

    // Dev fallback: log and accept without verification
    const event = request.body as any;
    console.log('[Stripe Webhook] Received (unverified):', event?.type ?? 'unknown');
    return reply.send({ statusCode: 200, received: true });
  });

  // ─── POST /api/subscription/portal ─────────────────────────────────────────
  app.post('/api/subscription/portal', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    if (!process.env.STRIPE_SECRET_KEY) {
      return reply.status(503).send({ statusCode: 503, error: 'Stripe not configured' });
    }

    const { createPortalSession } = await import('../services/stripe.js');
    const appUrl = process.env.APP_URL ?? 'http://localhost:3001';

    try {
      const { url } = await createPortalSession(db, userId, `${appUrl}/settings`);
      return reply.send({ statusCode: 200, portalUrl: url });
    } catch (err: any) {
      return reply.status(400).send({ statusCode: 400, error: err.message });
    }
  });
}


// ─── Admin Plan Management ───────────────────────────────────────────────────

export async function registerAdminPlanRoutes(
  app: FastifyInstance,
  options: SubscriptionOptions,
): Promise<void> {
  const { db } = options;

  // PUT /api/admin/plans/:slug — update plan pricing and limits
  app.put('/api/admin/plans/:slug', async (request: FastifyRequest<{ Params: { slug: string }; Body: any }>, reply: FastifyReply) => {
    const { slug } = request.params;
    const body = request.body as any;

    const existing = await db.selectFrom('subscription_plans' as any).select('id').where('slug', '=', slug).executeTakeFirst();
    if (!existing) return reply.status(404).send({ statusCode: 404, error: 'Plan not found' });

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.priceMonthlyEur !== undefined) updates.price_monthly_eur = body.priceMonthlyEur;
    if (body.priceAnnualEur !== undefined) updates.price_annual_eur = body.priceAnnualEur;
    if (body.priceMonthlyFamilyEur !== undefined) updates.price_monthly_family_eur = body.priceMonthlyFamilyEur;
    if (body.priceAnnualFamilyEur !== undefined) updates.price_annual_family_eur = body.priceAnnualFamilyEur;
    if (body.maxActiveTrips !== undefined) updates.max_active_trips = body.maxActiveTrips || null;
    if (body.maxBookings !== undefined) updates.max_bookings = body.maxBookings || null;
    if (body.maxExpensesPerMonth !== undefined) updates.max_expenses_per_month = body.maxExpensesPerMonth || null;
    if (body.maxAiTipsPerTrip !== undefined) updates.max_ai_tips_per_trip = body.maxAiTipsPerTrip || null;
    if (body.maxAiChatPerDay !== undefined) updates.max_ai_chat_per_day = body.maxAiChatPerDay || null;
    if (body.maxEmailConnections !== undefined) updates.max_email_connections = body.maxEmailConnections || null;
    if (body.maxNetworkConnections !== undefined) updates.max_network_connections = body.maxNetworkConnections || null;
    if (body.maxFamilyMembers !== undefined) updates.max_family_members = body.maxFamilyMembers || null;
    if (body.maxStorageMb !== undefined) updates.max_storage_mb = body.maxStorageMb || null;
    if (body.maxMessagesPerDay !== undefined) updates.max_messages_per_day = body.maxMessagesPerDay || null;
    if (body.maxEmailAliases !== undefined) updates.max_email_aliases = body.maxEmailAliases || null;
    if (body.weatherDays !== undefined) updates.weather_days = body.weatherDays;

    await db.updateTable('subscription_plans' as any).set(updates as any).where('slug', '=', slug).execute();

    return reply.send({ statusCode: 200, message: `Plan "${slug}" updated` });
  });
}


// ─── Admin Promotions Management ─────────────────────────────────────────────

export async function registerAdminPromotionRoutes(
  app: FastifyInstance,
  options: SubscriptionOptions,
): Promise<void> {
  const { db } = options;

  // GET /api/admin/promotions — list all promotions
  app.get('/api/admin/promotions', async (_request: FastifyRequest, reply: FastifyReply) => {
    const promos = await db.selectFrom('subscription_promotions' as any).selectAll().orderBy('created_at', 'desc').execute();
    return reply.send({ statusCode: 200, data: promos });
  });

  // POST /api/admin/promotions — create promotion
  app.post('/api/admin/promotions', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.name || !body.discountPercent || !body.startsAt || !body.endsAt) {
      return reply.status(400).send({ statusCode: 400, error: 'name, discountPercent, startsAt, endsAt required' });
    }

    const promo = await db.insertInto('subscription_promotions' as any).values({
      name: body.name,
      discount_percent: body.discountPercent,
      applies_to: body.appliesTo ?? ['pro', 'premium'],
      billing_cycles: body.billingCycles ?? ['monthly', 'annual'],
      starts_at: new Date(body.startsAt),
      ends_at: new Date(body.endsAt),
      badge_text: body.badgeText ?? 'Limited Time!',
      is_active: body.isActive ?? true,
      event_type: body.eventType ?? 'general',
      theme_color: body.themeColor ?? '#ef4444',
      banner_text: body.bannerText ?? null,
      banner_emoji: body.bannerEmoji ?? null,
      description: body.description ?? null,
    } as any).returningAll().executeTakeFirst();

    return reply.send({ statusCode: 201, data: promo });
  });

  // PUT /api/admin/promotions/:id — update promotion
  app.put('/api/admin/promotions/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as any;

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.discountPercent !== undefined) updates.discount_percent = body.discountPercent;
    if (body.appliesTo !== undefined) updates.applies_to = body.appliesTo;
    if (body.billingCycles !== undefined) updates.billing_cycles = body.billingCycles;
    if (body.startsAt !== undefined) updates.starts_at = new Date(body.startsAt);
    if (body.endsAt !== undefined) updates.ends_at = new Date(body.endsAt);
    if (body.badgeText !== undefined) updates.badge_text = body.badgeText;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.eventType !== undefined) updates.event_type = body.eventType;
    if (body.themeColor !== undefined) updates.theme_color = body.themeColor;
    if (body.bannerText !== undefined) updates.banner_text = body.bannerText;
    if (body.bannerEmoji !== undefined) updates.banner_emoji = body.bannerEmoji;
    if (body.description !== undefined) updates.description = body.description;

    await db.updateTable('subscription_promotions' as any).set(updates as any).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Promotion updated' });
  });

  // DELETE /api/admin/promotions/:id — delete promotion
  app.delete('/api/admin/promotions/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await db.deleteFrom('subscription_promotions' as any).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Promotion deleted' });
  });
}


// ─── Admin Campaigns Management ──────────────────────────────────────────────

export async function registerAdminCampaignRoutes(
  app: FastifyInstance,
  options: SubscriptionOptions,
): Promise<void> {
  const { db } = options;

  // GET /api/admin/campaigns — list all campaigns
  app.get('/api/admin/campaigns', async (_request: FastifyRequest, reply: FastifyReply) => {
    const campaigns = await db.selectFrom('subscription_campaigns' as any).selectAll().orderBy('created_at', 'desc').execute();
    return reply.send({ statusCode: 200, data: campaigns });
  });

  // POST /api/admin/campaigns — create campaign
  app.post('/api/admin/campaigns', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.code || !body.name || !body.discountPercent) {
      return reply.status(400).send({ statusCode: 400, error: 'code, name, discountPercent required' });
    }
    const campaign = await db.insertInto('subscription_campaigns' as any).values({
      code: body.code.toUpperCase(),
      name: body.name,
      discount_percent: body.discountPercent,
      discount_months: body.discountMonths ?? 3,
      applicable_plans: body.applicablePlans ?? ['pro', 'premium'],
      max_uses: body.maxUses ?? 1000,
      valid_until: body.validUntil ? new Date(body.validUntil) : new Date(Date.now() + 365 * 86400000),
      is_active: body.isActive ?? true,
    } as any).returningAll().executeTakeFirst();
    return reply.status(201).send({ statusCode: 201, data: campaign });
  });

  // PUT /api/admin/campaigns/:id — update campaign
  app.put('/api/admin/campaigns/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as any;
    const updates: Record<string, unknown> = {};
    if (body.code !== undefined) updates.code = body.code.toUpperCase();
    if (body.name !== undefined) updates.name = body.name;
    if (body.discountPercent !== undefined) updates.discount_percent = body.discountPercent;
    if (body.discountMonths !== undefined) updates.discount_months = body.discountMonths;
    if (body.applicablePlans !== undefined) updates.applicable_plans = body.applicablePlans;
    if (body.maxUses !== undefined) updates.max_uses = body.maxUses;
    if (body.validUntil !== undefined) updates.valid_until = new Date(body.validUntil);
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    await db.updateTable('subscription_campaigns' as any).set(updates as any).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Campaign updated' });
  });

  // DELETE /api/admin/campaigns/:id — delete campaign
  app.delete('/api/admin/campaigns/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await db.deleteFrom('subscription_campaigns' as any).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Campaign deleted' });
  });
}
