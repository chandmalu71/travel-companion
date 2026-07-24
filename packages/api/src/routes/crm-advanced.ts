/**
 * CRM Advanced Routes — A/B Testing, Lead Scoring, Referrals
 *
 * Admin:
 *  - POST /api/admin/campaigns/:id/ab-test    — create A/B test variants
 *  - GET  /api/admin/campaigns/:id/ab-results — get A/B test results
 *  - GET  /api/admin/lead-scores              — leaderboard of scored leads
 *  - POST /api/admin/lead-scores/recalculate  — recalculate all scores
 *  - GET  /api/admin/referrals                — list all referrals
 *
 * User:
 *  - GET  /api/user/referral-code            — get/generate user's referral code
 *  - POST /api/referral/:code                — register a referral (public)
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';
import { randomBytes } from 'node:crypto';

interface CrmAdvancedOptions {
  db: Kysely<Database>;
}

// Lead scoring rules
const SCORING_RULES = {
  email_opened: 5,
  email_clicked: 10,
  account_created: 20,
  trip_created: 15,
  booking_added: 10,
  expense_added: 5,
  message_sent: 3,
  referral_made: 25,
  trial_started: 30,
  upgraded_to_pro: 50,
  upgraded_to_premium: 75,
};

export async function registerCrmAdvancedRoutes(
  app: FastifyInstance,
  options: CrmAdvancedOptions,
): Promise<void> {
  const { db } = options;

  // ─── A/B Testing ───────────────────────────────────────────────────────────

  // POST /api/admin/campaigns/:id/ab-test — create variants
  app.post('/api/admin/campaigns/:id/ab-test', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { variants } = request.body as any;

    if (!variants || !Array.isArray(variants) || variants.length < 2) {
      return reply.status(400).send({ statusCode: 400, error: 'At least 2 variants required' });
    }

    // Clear existing variants
    await (db as any).deleteFrom('ab_test_variants').where('campaign_id', '=', id).execute();

    // Create new variants
    for (const v of variants) {
      await (db as any).insertInto('ab_test_variants').values({
        campaign_id: id,
        variant_name: v.name ?? 'A',
        subject: v.subject,
        preview_text: v.previewText ?? null,
        body_html: v.bodyHtml ?? null,
        percentage: v.percentage ?? Math.floor(100 / variants.length),
      }).execute();
    }

    return reply.status(201).send({ statusCode: 201, message: `${variants.length} A/B variants created` });
  });

  // GET /api/admin/campaigns/:id/ab-results — view results
  app.get('/api/admin/campaigns/:id/ab-results', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    const variants = await (db as any).selectFrom('ab_test_variants').selectAll().where('campaign_id', '=', id).execute();

    const results = variants.map((v: any) => ({
      ...v,
      openRate: v.total_sent > 0 ? Math.round((v.total_opened / v.total_sent) * 100) : 0,
      clickRate: v.total_sent > 0 ? Math.round((v.total_clicked / v.total_sent) * 100) : 0,
    }));

    return reply.send({ statusCode: 200, data: results });
  });

  // ─── Lead Scoring ──────────────────────────────────────────────────────────

  // GET /api/admin/lead-scores — leaderboard
  app.get('/api/admin/lead-scores', async (request: FastifyRequest<{ Querystring: { limit?: string } }>, reply: FastifyReply) => {
    const limit = parseInt(request.query.limit ?? '50');

    const scores = await (db as any).selectFrom('lead_scores')
      .leftJoin('crm_leads', 'crm_leads.id', 'lead_scores.lead_id')
      .leftJoin('users', 'users.id', 'lead_scores.user_id')
      .select([
        'lead_scores.score',
        'lead_scores.score_breakdown',
        'lead_scores.last_calculated_at',
        sql`COALESCE(crm_leads.full_name, users.display_name)`.as('name'),
        sql`COALESCE(crm_leads.email, users.email)`.as('email'),
        sql`CASE WHEN lead_scores.user_id IS NOT NULL THEN 'user' ELSE 'lead' END`.as('type'),
      ])
      .orderBy('lead_scores.score', 'desc')
      .limit(limit)
      .execute();

    return reply.send({ statusCode: 200, data: scores });
  });

  // POST /api/admin/lead-scores/recalculate — recalculate all scores
  app.post('/api/admin/lead-scores/recalculate', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Score all users
    const users = await db.selectFrom('users').select(['id', 'email']).execute();

    let updated = 0;
    for (const user of users) {
      const tripCount = await db.selectFrom('trips').select(sql`count(*)`.as('c')).where('owner_id', '=', user.id).executeTakeFirst();
      const bookingCount = await db.selectFrom('bookings').select(sql`count(*)`.as('c')).where('user_id', '=', user.id).executeTakeFirst();
      const expenseCount = await db.selectFrom('expenses').select(sql`count(*)`.as('c')).where('user_id', '=', user.id).executeTakeFirst();

      const breakdown = {
        account_created: SCORING_RULES.account_created,
        trips: Number(tripCount?.c ?? 0) * SCORING_RULES.trip_created,
        bookings: Number(bookingCount?.c ?? 0) * SCORING_RULES.booking_added,
        expenses: Number(expenseCount?.c ?? 0) * SCORING_RULES.expense_added,
      };
      const totalScore = Object.values(breakdown).reduce((a, b) => a + b, 0);

      await (db as any).insertInto('lead_scores').values({
        user_id: user.id,
        score: totalScore,
        score_breakdown: JSON.stringify(breakdown),
        last_calculated_at: new Date(),
      }).onConflict((oc: any) => oc.columns(['lead_id', 'user_id']).doUpdateSet({
        score: totalScore,
        score_breakdown: JSON.stringify(breakdown),
        last_calculated_at: new Date(),
      })).execute().catch(() => {});

      updated++;
    }

    return reply.send({ statusCode: 200, message: `Recalculated scores for ${updated} contacts` });
  });

  // ─── Referrals ─────────────────────────────────────────────────────────────

  // GET /api/user/referral-code — get or generate user's referral code
  app.get('/api/user/referral-code', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    // Check if user already has a code
    const user = await db.selectFrom('users').select(['id', 'referral_code' as any, 'referral_count' as any]).where('id', '=', userId).executeTakeFirst() as any;

    let code = user?.referral_code;
    if (!code) {
      // Generate unique code
      code = 'NEYYA-' + randomBytes(4).toString('hex').toUpperCase();
      await db.updateTable('users').set({ referral_code: code } as any).where('id', '=', userId).execute();
    }

    // Get referral stats
    const referrals = await (db as any).selectFrom('referrals').selectAll().where('referrer_user_id', '=', userId).execute();
    const converted = referrals.filter((r: any) => r.status === 'converted').length;

    return reply.send({
      statusCode: 200,
      data: {
        code,
        shareUrl: `https://neyya.ai/r/${code}`,
        totalReferrals: referrals.length,
        converted,
        rewards: referrals.filter((r: any) => r.reward_granted).length,
      },
    });
  });

  // POST /api/referral/:code — register referral (public, called when someone uses a referral link)
  app.post('/api/referral/:code', async (request: FastifyRequest<{ Params: { code: string }; Body: any }>, reply: FastifyReply) => {
    const { code } = request.params;
    const { email } = request.body as any;

    if (!email) return reply.status(400).send({ statusCode: 400, error: 'Email required' });

    // Find referrer
    const referrer = await db.selectFrom('users').select(['id']).where('referral_code' as any, '=', code).executeTakeFirst();
    if (!referrer) return reply.status(404).send({ statusCode: 404, error: 'Invalid referral code' });

    // Create referral record
    await (db as any).insertInto('referrals').values({
      referrer_user_id: referrer.id,
      referral_code: code,
      referred_email: email.toLowerCase(),
      status: 'pending',
      reward_type: '1_month_pro_free',
    }).execute().catch(() => {});

    return reply.send({ statusCode: 200, message: 'Referral registered! Your friend will get a reward when you sign up.' });
  });

  // GET /api/admin/referrals — admin view of all referrals
  app.get('/api/admin/referrals', async (_request: FastifyRequest, reply: FastifyReply) => {
    const referrals = await (db as any).selectFrom('referrals')
      .innerJoin('users', 'users.id', 'referrals.referrer_user_id')
      .select([
        'referrals.id', 'referrals.referral_code', 'referrals.referred_email',
        'referrals.status', 'referrals.reward_granted', 'referrals.created_at', 'referrals.converted_at',
        'users.display_name as referrer_name', 'users.email as referrer_email',
      ])
      .orderBy('referrals.created_at', 'desc')
      .limit(100)
      .execute();

    const stats = {
      total: referrals.length,
      pending: referrals.filter((r: any) => r.status === 'pending').length,
      converted: referrals.filter((r: any) => r.status === 'converted').length,
      rewardsGranted: referrals.filter((r: any) => r.reward_granted).length,
    };

    return reply.send({ statusCode: 200, data: referrals, stats });
  });
}
