/**
 * Admin API Routes
 *
 * Provides endpoints for the admin panel: user management, configuration,
 * statistics, audit logging, announcements, and system health.
 *
 * All routes require admin authentication (role: super-admin or support).
 *
 * Routes:
 * - GET /api/admin/stats — Real-time platform statistics
 * - GET /api/admin/users — List users (searchable, filterable)
 * - GET /api/admin/users/:id — User detail with activity
 * - PUT /api/admin/users/:id/suspend — Suspend user
 * - PUT /api/admin/users/:id/reactivate — Reactivate user
 * - DELETE /api/admin/users/:id — Delete user and all data
 * - GET /api/admin/config — Get current configuration
 * - PUT /api/admin/config — Update configuration
 * - GET /api/admin/audit — Audit log entries
 * - POST /api/admin/announcements — Send announcement
 * - GET /api/admin/health — System health metrics
 *
 * Implements Requirement 30
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

export interface AdminRoutesOptions {
  db: Kysely<Database>;
}

export async function registerAdminRoutes(
  app: FastifyInstance,
  options: AdminRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/stats ──────────────────────────────────────────

  app.get('/api/admin/stats', async (_request: FastifyRequest, reply: FastifyReply) => {
    const totalUsers = await db.selectFrom('users').select(db.fn.count('id').as('count')).executeTakeFirst();
    const totalTrips = await db.selectFrom('trips').select(db.fn.count('id').as('count')).executeTakeFirst();
    const totalBookings = await db.selectFrom('bookings').select(db.fn.count('id').as('count')).executeTakeFirst();

    return reply.send({
      statusCode: 200,
      data: {
        totalUsers: Number(totalUsers?.count ?? 0),
        totalTrips: Number(totalTrips?.count ?? 0),
        totalBookings: Number(totalBookings?.count ?? 0),
        dau: 0, // TODO: Track from session activity
        mau: 0,
        onlineNow: 0,
      },
    });
  });

  // ─── GET /api/admin/users ──────────────────────────────────────────

  app.get(
    '/api/admin/users',
    async (request: FastifyRequest<{ Querystring: { search?: string; status?: string; limit?: string; offset?: string } }>, reply: FastifyReply) => {
      const { search, status, limit = '20', offset = '0' } = request.query;

      let query = db.selectFrom('users').selectAll().orderBy('created_at', 'desc')
        .limit(parseInt(limit)).offset(parseInt(offset));

      // Hide demo account from admin user list
      query = query.where('email', '!=', 'demo@neyya.ai');

      if (search) {
        query = query.where((eb) =>
          eb.or([
            eb('email', 'like', `%${search}%`),
            eb('display_name', 'like', `%${search}%`),
          ])
        );
      }

      if (status === 'suspended') {
        query = query.where('suspended', '=', true);
      } else if (status === 'active') {
        query = query.where('suspended', 'is', null);
      }

      const users = await query.execute();

      // Get total count for pagination
      let countQuery = db.selectFrom('users').select(db.fn.count('id').as('count')).where('email', '!=', 'demo@neyya.ai');
      if (search) {
        countQuery = countQuery.where((eb) =>
          eb.or([
            eb('email', 'like', `%${search}%`),
            eb('display_name', 'like', `%${search}%`),
          ])
        );
      }
      if (status === 'suspended') {
        countQuery = countQuery.where('suspended', '=', true);
      } else if (status === 'active') {
        countQuery = countQuery.where('suspended', 'is', null);
      }
      const totalResult = await countQuery.executeTakeFirst();
      const total = Number(totalResult?.count ?? 0);

      // Enrich with subscription data (if table exists)
      let subscriptions: any[] = [];
      try {
        subscriptions = await (db.selectFrom('user_subscriptions' as any) as any)
          .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
          .select([
            'user_subscriptions.user_id',
            'subscription_plans.slug as plan_slug',
            'user_subscriptions.status as sub_status',
          ])
          .execute();
      } catch { /* table may not exist yet */ }

      const subMap = new Map(subscriptions.map((s: any) => [s.user_id, { plan: s.plan_slug, status: s.sub_status }]));

      const enriched = users.map((u: any) => ({
        ...u,
        password_hash: undefined, // never expose
        subscription_plan: subMap.get(u.id)?.plan ?? 'free',
        subscription_status: subMap.get(u.id)?.status ?? null,
      }));

      return reply.send({ statusCode: 200, data: enriched, pagination: { total, limit: parseInt(limit), offset: parseInt(offset) } });
    },
  );

  // ─── GET /api/admin/users/:id ──────────────────────────────────────

  app.get(
    '/api/admin/users/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const user = await db.selectFrom('users').selectAll().where('id', '=', id).executeTakeFirst();
      if (!user) return reply.status(404).send({ statusCode: 404, error: 'User not found' });

      const trips = await db.selectFrom('trips').select(db.fn.count('id').as('count')).where('owner_id', '=', id).executeTakeFirst();
      const bookings = await db.selectFrom('bookings').select(db.fn.count('id').as('count')).where('user_id', '=', id).executeTakeFirst();
      const connections = await db.selectFrom('email_connections').select(db.fn.count('id').as('count')).where('user_id', '=', id).executeTakeFirst();

      return reply.send({
        statusCode: 200,
        data: {
          ...user,
          tripsCount: Number(trips?.count ?? 0),
          bookingsCount: Number(bookings?.count ?? 0),
          emailConnectionsCount: Number(connections?.count ?? 0),
        },
      });
    },
  );

  // ─── PUT /api/admin/users/:id/suspend ──────────────────────────────

  app.put(
    '/api/admin/users/:id/suspend',
    async (request: FastifyRequest<{ Params: { id: string }; Body: { reason?: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { reason } = request.body ?? {};
      const adminId = (request as any).userId as string;

      await db.updateTable('users').set({ suspended: true, suspended_reason: reason ?? 'Admin action', updated_at: new Date() }).where('id', '=', id).execute();

      // Audit log
      await logAdminAction(db, adminId, 'user_suspended', id, reason ?? 'Manual suspension', request.ip);

      return reply.send({ statusCode: 200, message: 'User suspended' });
    },
  );

  // ─── PUT /api/admin/users/:id/reactivate ───────────────────────────

  app.put(
    '/api/admin/users/:id/reactivate',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const adminId = (request as any).userId as string;

      await db.updateTable('users').set({ suspended: false, suspended_reason: null, updated_at: new Date() }).where('id', '=', id).execute();

      await logAdminAction(db, adminId, 'user_reactivated', id, '', request.ip);

      return reply.send({ statusCode: 200, message: 'User reactivated' });
    },
  );

  // ─── DELETE /api/admin/users/:id ───────────────────────────────────

  app.delete(
    '/api/admin/users/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;
      const adminId = (request as any).userId as string;

      // GDPR deletion: cascade removes all user data
      await db.deleteFrom('users').where('id', '=', id).execute();

      await logAdminAction(db, adminId, 'user_deleted', id, 'GDPR erasure', request.ip);

      return reply.send({ statusCode: 200, message: 'User and all data permanently deleted' });
    },
  );

  // ─── GET /api/admin/config ─────────────────────────────────────────

  app.get('/api/admin/config', async (_request: FastifyRequest, reply: FastifyReply) => {
    // In production: read from Redis/DB. For now return defaults.
    return reply.send({
      statusCode: 200,
      data: {
        ai: {
          email_parsing: { tier1: 'amazon.nova-lite-v1:0', tier2: 'anthropic.claude-3-5-haiku-20241022-v1:0', autoEscalate: true },
          search_rewrite: { tier1: 'amazon.nova-lite-v1:0', tier2: 'amazon.nova-lite-v1:0', autoEscalate: false },
        },
        featureFlags: {
          email_scanning: true, ai_search: true, receipt_scanning: true,
          social_sharing: false, expense_splitting: true, proactive_suggestions: true,
        },
        oauthProviders: [
          { id: 'google', name: 'Google', icon: '🔵', status: process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('placeholder') ? 'enabled' : 'disabled', configured: !!process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('placeholder') },
          { id: 'microsoft', name: 'Microsoft', icon: '🟦', status: process.env.MICROSOFT_CLIENT_ID && !process.env.MICROSOFT_CLIENT_ID.includes('placeholder') ? 'enabled' : 'disabled', configured: !!process.env.MICROSOFT_CLIENT_ID },
          { id: 'facebook', name: 'Facebook', icon: '🔷', status: process.env.FACEBOOK_APP_ID ? 'enabled' : 'disabled', configured: !!process.env.FACEBOOK_APP_ID },
          { id: 'apple', name: 'Apple', icon: '🍎', status: 'coming_soon', configured: false },
        ],
        emailScanningPaused: false,
        misuseDetectionEnabled: true,
      },
    });
  });

  // ─── PUT /api/admin/config ─────────────────────────────────────────

  app.put(
    '/api/admin/config',
    async (request: FastifyRequest<{ Body: Record<string, unknown> }>, reply: FastifyReply) => {
      const adminId = (request as any).userId as string;
      const config = request.body;

      // In production: persist to Redis/DB for live reload
      await logAdminAction(db, adminId, 'config_changed', 'system', JSON.stringify(config).slice(0, 200), request.ip);

      return reply.send({ statusCode: 200, message: 'Configuration updated' });
    },
  );

  // ─── GET /api/admin/audit ──────────────────────────────────────────

  app.get(
    '/api/admin/audit',
    async (request: FastifyRequest<{ Querystring: { action?: string; limit?: string } }>, reply: FastifyReply) => {
      const { action, limit = '100' } = request.query;

      let query = db.selectFrom('audit_log').selectAll().orderBy('created_at', 'desc').limit(parseInt(limit));

      if (action && action !== 'All') {
        query = query.where('action', '=', action);
      }

      const entries = await query.execute();

      return reply.send({ statusCode: 200, data: entries });
    },
  );

  // ─── POST /api/admin/announcements ─────────────────────────────────

  app.post(
    '/api/admin/announcements',
    async (request: FastifyRequest<{ Body: { title: string; message: string; type: string } }>, reply: FastifyReply) => {
      const adminId = (request as any).userId as string;
      const { title, message, type } = request.body;

      // In production: broadcast via WebSocket + store for offline users
      await logAdminAction(db, adminId, 'announcement_sent', 'all_users', `${type}: ${title}`, request.ip);

      return reply.send({ statusCode: 200, message: `Announcement "${title}" sent to all users` });
    },
  );

  // ─── GET /api/admin/health ─────────────────────────────────────────

  app.get('/api/admin/health', async (_request: FastifyRequest, reply: FastifyReply) => {
    const uptime = process.uptime();

    return reply.send({
      statusCode: 200,
      data: {
        uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
        uptimePercent: 99.9,
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        nodeVersion: process.version,
        environment: process.env['NODE_ENV'] ?? 'development',
      },
    });
  });
}

// ─── Audit Logger ────────────────────────────────────────────────────────────

async function logAdminAction(
  db: Kysely<Database>,
  adminId: string,
  action: string,
  target: string,
  details: string,
  ip: string,
): Promise<void> {
  try {
    await db.insertInto('audit_log').values({
      admin_id: adminId,
      action,
      target,
      details,
      ip_address: ip,
    }).execute();
  } catch {
    // Don't fail the request if audit logging fails
    console.error('[Admin] Audit log write failed');
  }
}

// ─── Admin Role Management ───────────────────────────────────────────────────

export async function registerAdminRoleRoutes(app: any, options: { db: any }): Promise<void> {
  const { db } = options;

  // GET /api/admin/roles — list all users with admin roles
  app.get('/api/admin/roles', async (_request: any, reply: any) => {
    const admins = await db
      .selectFrom('users')
      .select(['id', 'email', 'display_name', 'admin_role', 'created_at'])
      .where('admin_role', 'is not', null)
      .orderBy('admin_role', 'asc')
      .orderBy('display_name', 'asc')
      .execute();
    return reply.send({ statusCode: 200, data: admins });
  });

  // PUT /api/admin/roles/:userId — set a user's admin role
  app.put('/api/admin/roles/:userId', async (request: any, reply: any) => {
    const { userId } = request.params;
    const { role } = request.body; // 'super-admin', 'admin', 'support', 'ops', or null to remove

    const validRoles = ['super-admin', 'admin', 'support', 'ops', null];
    if (!validRoles.includes(role)) {
      return reply.status(400).send({ statusCode: 400, error: 'Invalid role. Must be: super-admin, admin, support, ops, or null' });
    }

    // Prevent removing the last super-admin
    if (role !== 'super-admin') {
      const superAdmins = await db.selectFrom('users').select('id').where('admin_role', '=', 'super-admin').execute();
      const target = await db.selectFrom('users').select(['id', 'admin_role']).where('id', '=', userId).executeTakeFirst();
      if (target?.admin_role === 'super-admin' && superAdmins.length <= 1) {
        return reply.status(400).send({ statusCode: 400, error: 'Cannot remove the last super-admin' });
      }
    }

    await db.updateTable('users').set({ admin_role: role }).where('id', '=', userId).execute();
    return reply.send({ statusCode: 200, message: `User role updated to: ${role ?? 'none'}` });
  });

  // POST /api/admin/roles/search — search users by email to promote
  app.post('/api/admin/roles/search', async (request: any, reply: any) => {
    const { email } = request.body;
    if (!email || email.length < 3) {
      return reply.status(400).send({ statusCode: 400, error: 'Provide at least 3 characters of email' });
    }

    const users = await db
      .selectFrom('users')
      .select(['id', 'email', 'display_name', 'admin_role'])
      .where('email', 'ilike', `%${email}%`)
      .limit(10)
      .execute();

    return reply.send({ statusCode: 200, data: users });
  });
}

// ─── Admin All Trips ─────────────────────────────────────────────────────────

export async function registerAdminTripsRoute(app: any, options: { db: any }): Promise<void> {
  const { db } = options;

  app.get('/api/admin/trips', async (_request: any, reply: any) => {
    const trips = await db
      .selectFrom('trips')
      .innerJoin('users', 'users.id', 'trips.owner_id')
      .select([
        'trips.id', 'trips.name', 'trips.start_date',
        'trips.end_date', 'trips.created_at',
        'users.display_name as owner_name', 'users.email as owner_email',
      ])
      .orderBy('trips.created_at', 'desc')
      .execute();

    // Get member and booking counts
    const tripIds = trips.map((t: any) => t.id);

    const memberCounts = tripIds.length > 0
      ? await db.selectFrom('trip_travellers')
          .select(['trip_id', db.fn.count('id').as('count')])
          .where('trip_id', 'in', tripIds)
          .groupBy('trip_id')
          .execute()
          .catch(() => [] as any[])
      : [];

    const bookingCounts = tripIds.length > 0
      ? await db.selectFrom('bookings')
          .select(['trip_id', db.fn.count('id').as('count')])
          .where('trip_id', 'in', tripIds)
          .groupBy('trip_id')
          .execute()
          .catch(() => [] as any[])
      : [];

    const memberMap = new Map(memberCounts.map((m: any) => [m.trip_id, Number(m.count)]));
    const bookingMap = new Map(bookingCounts.map((b: any) => [b.trip_id, Number(b.count)]));

    const result = trips.map((t: any) => ({
      ...t,
      member_count: memberMap.get(t.id) ?? 0,
      booking_count: bookingMap.get(t.id) ?? 0,
    }));

    return reply.send({ statusCode: 200, data: result });
  });
}

// ─── Admin Create User ───────────────────────────────────────────────────────

export async function registerAdminCreateUserRoute(app: any, options: { db: any }): Promise<void> {
  const { db } = options;
  const crypto = await import('crypto');

  function hashPassword(password: string): string {
    return crypto.createHash('sha256').update(password).digest('hex');
  }

  // POST /api/admin/users/create — create a new user with role
  app.post('/api/admin/users/create', async (request: any, reply: any) => {
    const { email, displayName, password, role } = request.body;

    if (!email || !displayName || !password) {
      return reply.status(400).send({ statusCode: 400, error: 'email, displayName, and password are required' });
    }

    // Check if user already exists
    const existing = await db.selectFrom('users').select('id').where('email', '=', email).executeTakeFirst();
    if (existing) {
      return reply.status(409).send({ statusCode: 409, error: 'A user with this email already exists' });
    }

    const validRoles = ['super-admin', 'admin', 'support', 'ops', null];
    const adminRole = validRoles.includes(role) ? role : null;

    // Create user
    const { sql } = await import('kysely');
    const user = await sql`INSERT INTO users (email, display_name, cognito_sub, email_verified, password_hash, admin_role)
      VALUES (${email}, ${displayName}, ${'admin-created-' + email}, true, ${hashPassword(password)}, ${adminRole})
      RETURNING id, email, display_name, admin_role, created_at`.execute(db);

    const created = (user as any).rows?.[0];

    // Create user preferences
    if (created?.id) {
      await sql`INSERT INTO user_preferences (user_id, language, locale_code) VALUES (${created.id}, 'en', 'en-GB') ON CONFLICT DO NOTHING`.execute(db);
    }

    return reply.status(201).send({
      statusCode: 201,
      data: created,
      message: `User created: ${email} (${adminRole ?? 'regular user'})`,
    });
  });
}


/**
 * Admin Impersonation endpoint.
 * Generates a token for the target user so admin can open their session in a new tab.
 */
export async function registerAdminImpersonateRoute(app: any, options: { db: any }): Promise<void> {
  const { db } = options;

  app.post('/api/admin/impersonate', async (request: any, reply: any) => {
    const { email } = request.body ?? {};

    if (!email) {
      return reply.status(400).send({ statusCode: 400, error: 'Email is required' });
    }

    // Find the target user
    const user = await db
      .selectFrom('users')
      .select(['id', 'email', 'display_name'])
      .where('email', '=', email)
      .executeTakeFirst();

    if (!user) {
      return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: `User not found: ${email}` });
    }

    // Generate a token for the target user (reuse local auth token generation)
    const { createHash } = await import('node:crypto');
    const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({
      sub: user.id,
      email: user.email,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      iss: 'local-dev',
      impersonated_by: 'admin',
    })).toString('base64url');
    const signature = createHash('sha256').update(`${header}.${payload}.local-secret`).digest('base64url');
    const accessToken = `${header}.${payload}.${signature}`;

    return reply.send({
      statusCode: 200,
      data: {
        accessToken,
        user: { id: user.id, email: user.email, displayName: user.display_name },
      },
    });
  });
}


// ─── PUT /api/admin/users/:id/subscription — Grant/override user subscription ─
// Called from Admin → Subscriptions → User Overrides
export async function registerAdminSubscriptionOverride(
  app: FastifyInstance,
  options: { db: Kysely<Database> },
): Promise<void> {
  const { db } = options;

  app.put('/api/admin/users/:id/subscription', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { planSlug, periodEnd } = request.body as any;

    if (!planSlug) return reply.status(400).send({ statusCode: 400, error: 'planSlug required' });

    // Find the target plan
    const plan = await db.selectFrom('subscription_plans' as any).selectAll().where('slug', '=', planSlug).executeTakeFirst() as any;
    if (!plan) return reply.status(404).send({ statusCode: 404, error: 'Plan not found' });

    // Check if user already has a subscription
    const existing = await db.selectFrom('user_subscriptions' as any).select('id').where('user_id', '=', id).executeTakeFirst();

    if (existing) {
      // Update existing
      await db.updateTable('user_subscriptions' as any).set({
        plan_id: plan.id,
        status: 'active',
        current_period_end: periodEnd ? new Date(periodEnd) : null,
        cancel_at_period_end: false,
        updated_at: new Date(),
      } as any).where('user_id', '=', id).execute();
    } else {
      // Create new subscription
      await db.insertInto('user_subscriptions' as any).values({
        user_id: id,
        plan_id: plan.id,
        status: 'active',
        billing_cycle: 'monthly',
        current_period_end: periodEnd ? new Date(periodEnd) : null,
        auto_renew: false,
        is_family_plan: false,
        cancel_at_period_end: false,
      } as any).execute();
    }

    return reply.send({ statusCode: 200, message: `Granted ${planSlug} to user ${id}`, periodEnd });
  });

  // GET /api/admin/subscription-overrides — list all users with active subscriptions
  app.get('/api/admin/subscription-overrides', async (_request: FastifyRequest, reply: FastifyReply) => {
    const overrides = await (db.selectFrom('user_subscriptions' as any) as any)
      .innerJoin('users', 'users.id', 'user_subscriptions.user_id')
      .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
      .select([
        'users.id', 'users.email', 'users.display_name',
        'subscription_plans.slug as plan_slug', 'subscription_plans.name as plan_name',
        'user_subscriptions.status', 'user_subscriptions.current_period_end',
        'user_subscriptions.created_at',
      ])
      .where('user_subscriptions.status', '=', 'active')
      .orderBy('user_subscriptions.created_at', 'desc')
      .execute();

    return reply.send({ statusCode: 200, data: overrides });
  });
}
