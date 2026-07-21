/**
 * Trip Members & Groups Routes
 *
 * CRUD for trip travellers and groups.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

export interface TripMembersOptions { db: Kysely<Database>; }

export async function registerTripMembersRoutes(app: FastifyInstance, options: TripMembersOptions): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/travellers ─────────────────────────────────
  app.get('/api/trips/:tripId/travellers', async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
    const { tripId } = request.params;

    const groups = await db.selectFrom('trip_groups').selectAll().where('trip_id', '=', tripId).orderBy('display_order', 'asc').execute();
    const travellers = await db.selectFrom('trip_travellers').selectAll().where('trip_id', '=', tripId).orderBy('display_name', 'asc').execute();

    // Build hierarchical structure
    const groupedData = groups.map(g => ({
      ...g,
      travellers: travellers.filter(t => t.group_id === g.id),
    }));
    const ungrouped = travellers.filter(t => !t.group_id);

    return reply.send({ statusCode: 200, data: { groups: groupedData, ungrouped, totalCount: travellers.length } });
  });

  // ─── POST /api/trips/:tripId/travellers ────────────────────────────────
  app.post('/api/trips/:tripId/travellers', async (
    request: FastifyRequest<{ Params: { tripId: string }; Body: { displayName: string; email?: string; phone?: string; travellerType?: string; dateOfBirth?: string; groupId?: string; role?: string } }>,
    reply: FastifyReply,
  ) => {
    const { tripId } = request.params;
    const userId = (request as any).userId as string;
    const { displayName, email, phone, travellerType, dateOfBirth, groupId, role } = request.body;

    if (!displayName) return reply.status(400).send({ statusCode: 400, error: 'displayName is required' });

    // Check if email matches existing user
    let linkedUserId: string | null = null;
    if (email) {
      const existingUser = await db.selectFrom('users').select(['id']).where('email', '=', email).executeTakeFirst();
      if (existingUser) linkedUserId = existingUser.id;
    }

    const traveller = await db.insertInto('trip_travellers').values({
      trip_id: tripId,
      user_id: linkedUserId,
      group_id: groupId ?? null,
      display_name: displayName,
      email: email ?? null,
      phone: phone ?? null,
      traveller_type: travellerType ?? 'adult',
      date_of_birth: dateOfBirth ?? null,
      role: role ?? 'editor',
      status: linkedUserId ? 'active' : 'active',
      invited_by: userId,
      joined_at: new Date(),
    }).returning(['id', 'display_name', 'email', 'traveller_type', 'role', 'status', 'group_id', 'user_id']).executeTakeFirstOrThrow();

    return reply.status(201).send({ statusCode: 201, data: traveller });
  });

  // ─── PUT /api/trips/:tripId/travellers/:id ─────────────────────────────
  app.put('/api/trips/:tripId/travellers/:id', async (
    request: FastifyRequest<{ Params: { tripId: string; id: string }; Body: { displayName?: string; email?: string; phone?: string; travellerType?: string; dateOfBirth?: string; groupId?: string; role?: string; nationality?: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = request.params;
    const body = request.body;
    const updates: Record<string, any> = { updated_at: sql`NOW()` };

    if (body.displayName !== undefined) updates['display_name'] = body.displayName;
    if (body.email !== undefined) updates['email'] = body.email;
    if (body.phone !== undefined) updates['phone'] = body.phone;
    if (body.travellerType !== undefined) updates['traveller_type'] = body.travellerType;
    if (body.dateOfBirth !== undefined) updates['date_of_birth'] = body.dateOfBirth;
    if (body.groupId !== undefined) updates['group_id'] = body.groupId || null;
    if (body.role !== undefined) updates['role'] = body.role;
    if (body.nationality !== undefined) updates['nationality'] = body.nationality;

    await db.updateTable('trip_travellers').set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Traveller updated' });
  });

  // ─── DELETE /api/trips/:tripId/travellers/:id ──────────────────────────
  app.delete('/api/trips/:tripId/travellers/:id', async (request: FastifyRequest<{ Params: { tripId: string; id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await db.deleteFrom('trip_travellers').where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Traveller removed' });
  });

  // ─── POST /api/trips/:tripId/travellers/:id/leave ──────────────────────
  app.post('/api/trips/:tripId/travellers/:id/leave', async (request: FastifyRequest<{ Params: { tripId: string; id: string } }>, reply: FastifyReply) => {
    const { id, tripId } = request.params;

    // Check for unsettled shared expenses
    const traveller = await db.selectFrom('trip_travellers').select(['user_id']).where('id', '=', id).executeTakeFirst();
    if (traveller?.user_id) {
      const sharedExpenses = await db
        .selectFrom('expenses')
        .select('id')
        .where('trip_id', '=', tripId)
        .where('user_id', '=', traveller.user_id)
        .where('is_shared', '=', true)
        .execute();

      if (sharedExpenses.length > 0) {
        // Check if there are unsettled splits
        const splitMembers = await db
          .selectFrom('expense_split_members')
          .select('id')
          .where('expense_id', 'in', sharedExpenses.map(e => e.id))
          .execute()
          .catch(() => []);

        if (splitMembers.length > 0) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'Cannot leave trip with unsettled shared expenses. Please settle all balances first.',
          });
        }
      }
    }

    await db.updateTable('trip_travellers').set({ status: 'left', left_at: new Date(), updated_at: sql`NOW()` }).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Left trip successfully' });
  });

  // ─── GET /api/trips/:tripId/traveller-names — booking name suggestions ──
  app.get('/api/trips/:tripId/traveller-names', async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
    const { tripId } = request.params;
    const travellers = await db
      .selectFrom('trip_travellers')
      .select(['display_name', 'passport_name', 'traveller_type'])
      .where('trip_id', '=', tripId)
      .where('status', '=', 'active')
      .orderBy('display_name', 'asc')
      .execute();

    const names = travellers.map(t => t.passport_name ?? t.display_name);
    return reply.send({ statusCode: 200, data: names });
  });

  // ─── Groups ────────────────────────────────────────────────────────────

  // GET /api/trips/:tripId/travel-groups
  app.get('/api/trips/:tripId/travel-groups', async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
    const { tripId } = request.params;
    const groups = await db.selectFrom('trip_groups').selectAll().where('trip_id', '=', tripId).orderBy('display_order', 'asc').execute();
    return reply.send({ statusCode: 200, data: groups });
  });

  // POST /api/trips/:tripId/travel-groups
  app.post('/api/trips/:tripId/travel-groups', async (
    request: FastifyRequest<{ Params: { tripId: string }; Body: { name: string; groupType?: string; expenseSplitMode?: string; color?: string } }>,
    reply: FastifyReply,
  ) => {
    const { tripId } = request.params;
    const { name, groupType, expenseSplitMode, color } = request.body;

    if (!name) return reply.status(400).send({ statusCode: 400, error: 'Group name is required' });

    const group = await db.insertInto('trip_groups').values({
      trip_id: tripId,
      name,
      group_type: groupType ?? 'family',
      expense_split_mode: expenseSplitMode ?? 'per_person',
      color: color ?? null,
    }).returning(['id', 'name', 'group_type', 'expense_split_mode', 'color']).executeTakeFirstOrThrow();

    return reply.status(201).send({ statusCode: 201, data: group });
  });

  // PUT /api/trips/:tripId/travel-groups/:id
  app.put('/api/trips/:tripId/travel-groups/:id', async (
    request: FastifyRequest<{ Params: { tripId: string; id: string }; Body: { name?: string; groupType?: string; expenseSplitMode?: string; color?: string } }>,
    reply: FastifyReply,
  ) => {
    const { id } = request.params;
    const { name, groupType, expenseSplitMode, color } = request.body;
    const updates: Record<string, any> = {};
    if (name !== undefined) updates['name'] = name;
    if (groupType !== undefined) updates['group_type'] = groupType;
    if (expenseSplitMode !== undefined) updates['expense_split_mode'] = expenseSplitMode;
    if (color !== undefined) updates['color'] = color;

    if (Object.keys(updates).length > 0) {
      await db.updateTable('trip_groups').set(updates).where('id', '=', id).execute();
    }
    return reply.send({ statusCode: 200, message: 'Group updated' });
  });

  // DELETE /api/trips/:tripId/travel-groups/:id
  app.delete('/api/trips/:tripId/travel-groups/:id', async (request: FastifyRequest<{ Params: { tripId: string; id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Ungroup members first
    await db.updateTable('trip_travellers').set({ group_id: null }).where('group_id', '=', id).execute();
    await db.deleteFrom('trip_groups').where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Group deleted, members ungrouped' });
  });
}


// ─── Invitations ─────────────────────────────────────────────────────────────

export async function registerTripInvitationRoutes(app: any, options: { db: any }): Promise<void> {
  const { db } = options;
  const crypto = await import('crypto');

  function generateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  // POST /api/trips/:tripId/invitations — send an invitation
  app.post('/api/trips/:tripId/invitations', async (request: any, reply: any) => {
    const { tripId } = request.params;
    const userId = request.userId as string;
    const { channel, recipient, role, groupId, message, expiresInDays } = request.body;

    if (!channel || !['email', 'phone', 'whatsapp', 'link'].includes(channel)) {
      return reply.status(400).send({ statusCode: 400, error: 'Invalid channel' });
    }
    if (channel !== 'link' && !recipient) {
      return reply.status(400).send({ statusCode: 400, error: 'Recipient required for non-link invitations' });
    }

    const token = generateToken();
    const expiresAt = expiresInDays ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000) : null;

    const invitation = await db.insertInto('trip_invitations').values({
      trip_id: tripId,
      invited_by: userId,
      channel,
      recipient: recipient ?? null,
      role: role ?? 'editor',
      group_id: groupId ?? null,
      message: message ?? null,
      expires_at: expiresAt,
      token,
      status: 'pending',
    }).returning(['id', 'token', 'channel', 'recipient', 'status', 'expires_at', 'created_at']).executeTakeFirstOrThrow();

    // Generate accept URL
    const acceptUrl = `${process.env.WEB_URL || 'http://localhost:3001'}/invite/${token}`;

    return reply.status(201).send({
      statusCode: 201,
      data: { ...invitation, acceptUrl },
    });
  });

  // GET /api/trips/:tripId/invitations — list pending invitations
  app.get('/api/trips/:tripId/invitations', async (request: any, reply: any) => {
    const { tripId } = request.params;
    const invitations = await db
      .selectFrom('trip_invitations')
      .selectAll()
      .where('trip_id', '=', tripId)
      .orderBy('created_at', 'desc')
      .execute();
    return reply.send({ statusCode: 200, data: invitations });
  });

  // POST /api/trips/:tripId/invitations/:id/resend — resend an invitation
  app.post('/api/trips/:tripId/invitations/:id/resend', async (request: any, reply: any) => {
    const { id } = request.params;
    // In production: re-send the email/SMS. For now just reset the status.
    await db.updateTable('trip_invitations').set({ status: 'pending' }).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Invitation resent' });
  });

  // DELETE /api/trips/:tripId/invitations/:id — cancel an invitation
  app.delete('/api/trips/:tripId/invitations/:id', async (request: any, reply: any) => {
    const { id } = request.params;
    await db.updateTable('trip_invitations').set({ status: 'cancelled' }).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Invitation cancelled' });
  });

  // POST /api/invitations/:token/accept — accept an invitation (public)
  app.post('/api/invitations/:token/accept', async (request: any, reply: any) => {
    const { token } = request.params;
    const userId = request.userId as string;

    const invitation = await db
      .selectFrom('trip_invitations')
      .selectAll()
      .where('token', '=', token)
      .where('status', '=', 'pending')
      .executeTakeFirst();

    if (!invitation) {
      return reply.status(404).send({ statusCode: 404, error: 'Invitation not found or already used' });
    }

    // Check expiry
    if (invitation.expires_at && new Date(invitation.expires_at) < new Date()) {
      await db.updateTable('trip_invitations').set({ status: 'expired' }).where('id', '=', invitation.id).execute();
      return reply.status(410).send({ statusCode: 410, error: 'Invitation has expired' });
    }

    // Get user info
    const user = await db.selectFrom('users').select(['id', 'display_name', 'email']).where('id', '=', userId).executeTakeFirst();
    if (!user) return reply.status(401).send({ statusCode: 401, error: 'Not authenticated' });

    // Add as trip traveller
    await db.insertInto('trip_travellers').values({
      trip_id: invitation.trip_id,
      user_id: userId,
      group_id: invitation.group_id,
      display_name: user.display_name,
      email: user.email,
      traveller_type: 'adult',
      role: invitation.role,
      status: 'active',
      invited_by: invitation.invited_by,
      joined_at: new Date(),
    }).execute();

    // Mark invitation as accepted
    await db.updateTable('trip_invitations').set({ status: 'accepted', accepted_at: new Date() }).where('id', '=', invitation.id).execute();

    return reply.send({ statusCode: 200, message: 'Invitation accepted', data: { tripId: invitation.trip_id } });
  });

  // POST /api/invitations/:token/decline — decline an invitation (public)
  app.post('/api/invitations/:token/decline', async (request: any, reply: any) => {
    const { token } = request.params;
    await db.updateTable('trip_invitations').set({ status: 'declined' }).where('token', '=', token).where('status', '=', 'pending').execute();
    return reply.send({ statusCode: 200, message: 'Invitation declined' });
  });
}


// ─── Admin Trip Membership Stats ─────────────────────────────────────────────

export async function registerAdminTripMembershipRoutes(app: any, options: { db: any }): Promise<void> {
  const { db } = options;

  app.get('/api/admin/trip-memberships', async (_request: any, reply: any) => {
    const totalTravellers = await db.selectFrom('trip_travellers').select(db.fn.count('id').as('count')).executeTakeFirst();
    const activeTravellers = await db.selectFrom('trip_travellers').select(db.fn.count('id').as('count')).where('status', '=', 'active').executeTakeFirst();
    const pendingInvitations = await db.selectFrom('trip_invitations').select(db.fn.count('id').as('count')).where('status', '=', 'pending').executeTakeFirst();

    const tripsWithMembers = await db.selectFrom('trip_travellers').select('trip_id').groupBy('trip_id').execute();
    const avgPerTrip = tripsWithMembers.length > 0 ? Math.round(Number(totalTravellers?.count ?? 0) / tripsWithMembers.length) : 0;

    // By type
    const byType = await db.selectFrom('trip_travellers').select(['traveller_type as type', db.fn.count('id').as('count')]).groupBy('traveller_type').execute();

    // By role
    const byRole = await db.selectFrom('trip_travellers').select(['role', db.fn.count('id').as('count')]).groupBy('role').execute();

    // Groups with member counts
    const groups = await db.selectFrom('trip_groups').selectAll().execute();
    const groupsWithCounts = await Promise.all(groups.map(async (g: any) => {
      const memberCount = await db.selectFrom('trip_travellers').select(db.fn.count('id').as('count')).where('group_id', '=', g.id).executeTakeFirst();
      return { ...g, member_count: Number(memberCount?.count ?? 0) };
    }));

    return reply.send({
      statusCode: 200,
      data: {
        totalTravellers: Number(totalTravellers?.count ?? 0),
        activeTravellers: Number(activeTravellers?.count ?? 0),
        pendingInvitations: Number(pendingInvitations?.count ?? 0),
        avgPerTrip,
        totalGroups: groups.length,
        byType: byType.map((t: any) => ({ type: t.type, count: Number(t.count) })),
        byRole: byRole.map((r: any) => ({ role: r.role, count: Number(r.count) })),
        groups: groupsWithCounts,
      },
    });
  });
}
