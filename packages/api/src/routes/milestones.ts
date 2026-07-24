/**
 * User Milestones & Life Events Routes
 *
 * GET    /api/user/milestones       — list user's milestones
 * POST   /api/user/milestones       — create milestone
 * PUT    /api/user/milestones/:id   — update milestone
 * DELETE /api/user/milestones/:id   — delete milestone
 *
 * Milestone types:
 * - birthday (user or family member)
 * - anniversary
 * - move_city (moved to a new city)
 * - move_country (moved to a new country)
 * - years_in_city (celebrating N years in a city)
 * - years_in_country
 * - custom (user-defined)
 *
 * Implements Requirement 55.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import type { Database } from '../db/types.js';

interface MilestoneRoutesOptions {
  db: Kysely<Database>;
}

export async function registerMilestoneRoutes(
  app: FastifyInstance,
  options: MilestoneRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/user/milestones ──────────────────────────────────────────────

  app.get('/api/user/milestones', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const milestones = await (db as any)
      .selectFrom('user_milestones')
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('date', 'asc')
      .execute();

    return reply.send({ statusCode: 200, data: milestones });
  });

  // ─── POST /api/user/milestones ─────────────────────────────────────────────

  app.post('/api/user/milestones', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const { type, title, date, recurring, notes, related_person } = request.body as any;

    if (!type || !title || !date) {
      return reply.status(400).send({ statusCode: 400, error: 'type, title, and date are required' });
    }

    const validTypes = ['birthday', 'anniversary', 'move_city', 'move_country', 'years_in_city', 'years_in_country', 'custom'];
    if (!validTypes.includes(type)) {
      return reply.status(400).send({ statusCode: 400, error: `Invalid type. Must be one of: ${validTypes.join(', ')}` });
    }

    const milestone = await (db as any)
      .insertInto('user_milestones')
      .values({
        user_id: userId,
        type,
        title,
        date,
        recurring: recurring ?? (type === 'birthday' || type === 'anniversary'),
        notes: notes ?? null,
        related_person: related_person ?? null,
      })
      .returningAll()
      .executeTakeFirstOrThrow();

    return reply.status(201).send({ statusCode: 201, data: milestone });
  });

  // ─── PUT /api/user/milestones/:id ──────────────────────────────────────────

  app.put('/api/user/milestones/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const { id } = request.params;
    const { type, title, date, recurring, notes, related_person } = request.body as any;

    const updates: Record<string, any> = {};
    if (type !== undefined) updates.type = type;
    if (title !== undefined) updates.title = title;
    if (date !== undefined) updates.date = date;
    if (recurring !== undefined) updates.recurring = recurring;
    if (notes !== undefined) updates.notes = notes;
    if (related_person !== undefined) updates.related_person = related_person;

    if (Object.keys(updates).length === 0) {
      return reply.status(400).send({ statusCode: 400, error: 'No fields to update' });
    }

    const updated = await (db as any)
      .updateTable('user_milestones')
      .set(updates)
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .returningAll()
      .executeTakeFirst();

    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Milestone not found' });

    return reply.send({ statusCode: 200, data: updated });
  });

  // ─── DELETE /api/user/milestones/:id ───────────────────────────────────────

  app.delete('/api/user/milestones/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const { id } = request.params;

    await (db as any)
      .deleteFrom('user_milestones')
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .execute();

    return reply.send({ statusCode: 200, message: 'Milestone deleted' });
  });
}
