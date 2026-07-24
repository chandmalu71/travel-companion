/**
 * CRM Routes — Lead Capture & Admin Management
 *
 * Public:
 *  - POST /api/leads — capture lead from landing page
 *
 * Admin:
 *  - GET /api/admin/crm/leads — list all leads
 *  - GET /api/admin/crm/leads/:id — lead detail
 *  - PUT /api/admin/crm/leads/:id — update lead (tags, notes, status)
 *  - GET /api/admin/crm/stats — CRM dashboard stats
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

interface CrmOptions {
  db: Kysely<Database>;
}

// Simple email format validation
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// Disposable email domains to block
const DISPOSABLE_DOMAINS = ['tempmail.com', 'throwaway.email', 'guerrillamail.com', 'mailinator.com', 'yopmail.com', '10minutemail.com', 'trashmail.com'];

function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase();
  return DISPOSABLE_DOMAINS.includes(domain ?? '');
}

// Simple device detection from user-agent
function detectDevice(ua: string): 'desktop' | 'mobile' | 'tablet' {
  if (/tablet|ipad/i.test(ua)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua)) return 'mobile';
  return 'desktop';
}

export async function registerCrmRoutes(
  app: FastifyInstance,
  options: CrmOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/config/landing — Public landing page config (no auth) ─────────
  app.get('/api/config/landing', async (_request: FastifyRequest, reply: FastifyReply) => {
    let ctaMode = 'early_access'; // default
    let ctaContent: any = null;
    try {
      const { sql } = await import('kysely');
      const row = await sql`SELECT value FROM site_config WHERE key = 'landing_cta_mode'`.execute(db) as any;
      if (row?.rows?.[0]?.value) ctaMode = row.rows[0].value;
      const contentRow = await sql`SELECT value FROM site_config WHERE key = 'landing_cta_content'`.execute(db) as any;
      if (contentRow?.rows?.[0]?.value) ctaContent = JSON.parse(contentRow.rows[0].value);
    } catch { /* table may not exist — use default */ }

    return reply.send({ statusCode: 200, data: { ctaMode, content: ctaContent } });
  });

  // ─── POST /api/leads — Public lead capture ──────────────────────────────────
  app.post('/api/leads', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body as any;
    const { fullName, email, country, city, travelStyle, tripsPerYear, marketingConsent, termsConsent, recaptchaToken, source, utmSource, utmMedium, utmCampaign } = body ?? {};

    // Validation
    if (!fullName || !email) {
      return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Name and email are required' });
    }

    if (!isValidEmail(email)) {
      return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid email format' });
    }

    if (isDisposableEmail(email)) {
      return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Please use a permanent email address' });
    }

    if (!termsConsent) {
      return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'You must agree to the Terms of Service' });
    }

    // reCAPTCHA verification (if token provided and secret configured)
    if (recaptchaToken && process.env.RECAPTCHA_SECRET_KEY) {
      try {
        const verifyRes = await fetch('https://www.google.com/recaptcha/api/siteverify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `secret=${process.env.RECAPTCHA_SECRET_KEY}&response=${recaptchaToken}`,
        });
        const verifyData = await verifyRes.json() as any;
        if (!verifyData.success || (verifyData.score && verifyData.score < 0.5)) {
          return reply.status(403).send({ statusCode: 403, error: 'CAPTCHA_FAILED', message: 'Bot detection failed. Please try again.' });
        }
      } catch {
        // If verification fails, continue (don't block legitimate users)
      }
    }

    // Get IP and user-agent
    const ipAddress = request.ip;
    const userAgent = request.headers['user-agent'] ?? '';
    const deviceType = detectDevice(userAgent);

    // Auto-detect country from IP if not provided (using free ip-api.com)
    let detectedCountry = country;
    let detectedCity = city;
    if (!detectedCountry && ipAddress && ipAddress !== '127.0.0.1') {
      try {
        const geoRes = await fetch(`http://ip-api.com/json/${ipAddress}?fields=country,city`);
        const geoData = await geoRes.json() as any;
        if (geoData.country) detectedCountry = geoData.country;
        if (geoData.city) detectedCity = geoData.city;
      } catch {
        // GeoIP failed, continue without it
      }
    }

    // Insert lead
    try {
      const lead = await (db as any).insertInto('crm_leads').values({
        email: email.toLowerCase().trim(),
        full_name: fullName.trim(),
        country: detectedCountry ?? null,
        city: detectedCity ?? null,
        travel_style: travelStyle ?? null,
        trips_per_year: tripsPerYear ?? null,
        source_page: source ?? null,
        utm_source: utmSource ?? null,
        utm_medium: utmMedium ?? null,
        utm_campaign: utmCampaign ?? null,
        referrer: request.headers.referer ?? null,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_type: deviceType,
        marketing_consent: marketingConsent ?? false,
        terms_consent: termsConsent ?? false,
        consent_timestamp: new Date(),
        status: 'new',
      }).onConflict((oc: any) => oc.column('email').doUpdateSet({
        full_name: fullName.trim(),
        country: detectedCountry ?? null,
        city: detectedCity ?? null,
        travel_style: travelStyle ?? null,
        trips_per_year: tripsPerYear ?? null,
        updated_at: new Date(),
      })).returning('id').executeTakeFirst();

      // Store consent record
      if (lead?.id) {
        await (db as any).insertInto('consent_records').values({
          lead_id: lead.id,
          consent_type: 'terms',
          granted: true,
          policy_version: 'v1.0',
          ip_address: ipAddress,
          user_agent: userAgent,
        }).execute().catch(() => {});

        if (marketingConsent) {
          await (db as any).insertInto('consent_records').values({
            lead_id: lead.id,
            consent_type: 'marketing',
            granted: true,
            policy_version: 'v1.0',
            ip_address: ipAddress,
            user_agent: userAgent,
          }).execute().catch(() => {});
        }
      }

      // Trigger welcome automation
      try {
        await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/internal/trigger-automation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event: 'lead_signup', email: email.toLowerCase().trim(), name: fullName, leadId: lead?.id }),
        });
      } catch { /* non-blocking */ }

      return reply.status(201).send({
        statusCode: 201,
        message: 'Thanks for signing up! Check your inbox for a welcome email.',
        data: { id: lead?.id },
      });
    } catch (error: any) {
      if (error.code === '23505') {
        // Duplicate email — update instead
        return reply.send({ statusCode: 200, message: 'You\'re already on our list! We\'ll be in touch soon.' });
      }
      request.log.error(error, 'Lead capture failed');
      return reply.status(500).send({ statusCode: 500, error: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.' });
    }
  });

  // ─── GET /api/admin/crm/leads — List all leads ────────────────────────────
  app.get('/api/admin/crm/leads', async (request: FastifyRequest<{ Querystring: any }>, reply: FastifyReply) => {
    const { search, status, country, travelStyle, limit = '20', offset = '0' } = request.query as any;

    let query = (db as any).selectFrom('crm_leads').selectAll().orderBy('created_at', 'desc')
      .limit(parseInt(limit)).offset(parseInt(offset));

    if (search) {
      query = query.where((eb: any) => eb.or([
        eb('email', 'ilike', `%${search}%`),
        eb('full_name', 'ilike', `%${search}%`),
      ]));
    }
    if (status) query = query.where('status', '=', status);
    if (country) query = query.where('country', '=', country);
    if (travelStyle) query = query.where('travel_style', '=', travelStyle);

    const leads = await query.execute();

    // Get total count
    let countQuery = (db as any).selectFrom('crm_leads').select(sql`count(*)`.as('count'));
    if (search) countQuery = countQuery.where((eb: any) => eb.or([eb('email', 'ilike', `%${search}%`), eb('full_name', 'ilike', `%${search}%`)]));
    if (status) countQuery = countQuery.where('status', '=', status);
    const totalResult = await countQuery.executeTakeFirst();

    return reply.send({ statusCode: 200, data: leads, pagination: { total: Number(totalResult?.count ?? 0), limit: parseInt(limit), offset: parseInt(offset) } });
  });

  // ─── GET /api/admin/crm/stats — Dashboard stats ───────────────────────────
  app.get('/api/admin/crm/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const total = await (db as any).selectFrom('crm_leads').select(sql`count(*)`.as('c')).executeTakeFirst();
    const thisWeek = await (db as any).selectFrom('crm_leads').select(sql`count(*)`.as('c')).where('created_at', '>=', sql`NOW() - INTERVAL '7 days'`).executeTakeFirst();
    const converted = await (db as any).selectFrom('crm_leads').select(sql`count(*)`.as('c')).where('converted_to_user', '=', true).executeTakeFirst();
    const byCountry = await (db as any).selectFrom('crm_leads').select(['country', sql`count(*)`.as('count')]).groupBy('country').orderBy('count', 'desc').limit(10).execute();
    const byTravelStyle = await (db as any).selectFrom('crm_leads').select(['travel_style', sql`count(*)`.as('count')]).where('travel_style', 'is not', null).groupBy('travel_style').execute();

    return reply.send({
      statusCode: 200,
      data: {
        totalLeads: Number(total?.c ?? 0),
        thisWeek: Number(thisWeek?.c ?? 0),
        converted: Number(converted?.c ?? 0),
        conversionRate: total?.c > 0 ? Math.round((Number(converted?.c ?? 0) / Number(total?.c)) * 100) : 0,
        topCountries: byCountry,
        travelStyles: byTravelStyle,
      },
    });
  });

  // ─── PUT /api/admin/crm/leads/:id — Update lead ───────────────────────────
  app.put('/api/admin/crm/leads/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { status, tags, notes } = request.body as any;

    const updates: any = { updated_at: new Date() };
    if (status) updates.status = status;
    if (tags) updates.tags = tags;
    if (notes !== undefined) updates.notes = notes;

    await (db as any).updateTable('crm_leads').set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Lead updated' });
  });
}
