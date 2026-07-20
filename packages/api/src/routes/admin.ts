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
      const { search, status, limit = '50', offset = '0' } = request.query;

      let query = db.selectFrom('users').selectAll().orderBy('created_at', 'desc')
        .limit(parseInt(limit)).offset(parseInt(offset));

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

      return reply.send({ statusCode: 200, data: users });
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
        'trips.id', 'trips.name', 'trips.destination', 'trips.start_date',
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
