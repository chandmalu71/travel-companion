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
    // TODO: Check for unsettled expenses before allowing leave
    await db.updateTable('trip_travellers').set({ status: 'left', left_at: new Date(), updated_at: sql`NOW()` }).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Left trip successfully' });
  });

  // ─── Groups ────────────────────────────────────────────────────────────

  // GET /api/trips/:tripId/groups
  app.get('/api/trips/:tripId/groups', async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
    const { tripId } = request.params;
    const groups = await db.selectFrom('trip_groups').selectAll().where('trip_id', '=', tripId).orderBy('display_order', 'asc').execute();
    return reply.send({ statusCode: 200, data: groups });
  });

  // POST /api/trips/:tripId/groups
  app.post('/api/trips/:tripId/groups', async (
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

  // PUT /api/trips/:tripId/groups/:id
  app.put('/api/trips/:tripId/groups/:id', async (
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

  // DELETE /api/trips/:tripId/groups/:id
  app.delete('/api/trips/:tripId/groups/:id', async (request: FastifyRequest<{ Params: { tripId: string; id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    // Ungroup members first
    await db.updateTable('trip_travellers').set({ group_id: null }).where('group_id', '=', id).execute();
    await db.deleteFrom('trip_groups').where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Group deleted, members ungrouped' });
  });
}
