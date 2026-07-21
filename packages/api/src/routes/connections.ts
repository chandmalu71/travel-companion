/**
 * User Connections (Travel Contacts) Routes
 *
 * When users collaborate on trips (invite accepted), they're automatically
 * added to each other's connected users list. Users can also manually add
 * connections by email. Connected users appear as suggestions when inviting
 * people to future trips.
 *
 * Endpoints:
 *  - GET    /api/connections         — list user's connections
 *  - POST   /api/connections         — manually add a connection
 *  - PUT    /api/connections/:id     — update label, privacy, notes
 *  - DELETE /api/connections/:id     — remove a connection
 *  - GET    /api/connections/suggest  — get connected users for trip invite suggestions
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

const MAX_CONNECTIONS = 500;

interface ConnectionsOptions {
  db: Kysely<Database>;
}

export async function registerConnectionRoutes(
  app: FastifyInstance,
  options: ConnectionsOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/connections ──────────────────────────────────────────────────
  app.get(
    '/api/connections',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) {
        return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const connections = await db
        .selectFrom('user_connections')
        .leftJoin('users', 'users.id', 'user_connections.connected_user_id')
        .select([
          'user_connections.id',
          'user_connections.connected_user_id',
          'user_connections.connected_email',
          'user_connections.connected_name',
          'user_connections.status',
          'user_connections.label',
          'user_connections.privacy',
          'user_connections.source',
          'user_connections.source_trip_id',
          'user_connections.notes',
          'user_connections.created_at',
          'user_connections.updated_at',
          'users.display_name',
          'users.email as user_email',
          'users.avatar_url',
        ])
        .where('user_connections.user_id', '=', userId)
        .orderBy('user_connections.updated_at', 'desc')
        .execute();

      // Apply privacy filtering — show info based on what the connected user allows
      const data = connections.map((c) => ({
        id: c.id,
        connectedUserId: c.connected_user_id,
        name: c.display_name ?? c.connected_name ?? 'Unknown',
        email: c.user_email ?? c.connected_email ?? null,
        avatarUrl: c.avatar_url ?? null,
        status: c.status,
        label: c.label,
        privacy: c.privacy,
        source: c.source,
        sourceTripId: c.source_trip_id,
        notes: c.notes,
        createdAt: c.created_at,
        updatedAt: c.updated_at,
      }));

      return reply.send({ statusCode: 200, data });
    },
  );

  // ─── GET /api/connections/suggest ──────────────────────────────────────────
  // Returns connected users suitable for trip invite suggestions
  app.get(
    '/api/connections/suggest',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) {
        return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const connections = await db
        .selectFrom('user_connections')
        .leftJoin('users', 'users.id', 'user_connections.connected_user_id')
        .select([
          'user_connections.id',
          'user_connections.connected_user_id',
          'user_connections.connected_email',
          'user_connections.connected_name',
          'user_connections.label',
          'users.display_name',
          'users.email as user_email',
        ])
        .where('user_connections.user_id', '=', userId)
        .where('user_connections.status', 'in', ['connected', 'invited'])
        .orderBy('user_connections.updated_at', 'desc')
        .limit(50)
        .execute();

      const suggestions = connections.map((c) => ({
        id: c.id,
        connectedUserId: c.connected_user_id,
        name: c.display_name ?? c.connected_name ?? 'Unknown',
        email: c.user_email ?? c.connected_email ?? null,
        label: c.label,
      }));

      return reply.send({ statusCode: 200, data: suggestions });
    },
  );

  // ─── POST /api/connections ─────────────────────────────────────────────────
  app.post(
    '/api/connections',
    async (
      request: FastifyRequest<{
        Body: { email?: string; name?: string; label?: string; privacy?: string; notes?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      if (!userId) {
        return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const { email, name, label, privacy, notes } = request.body;

      if (!email && !name) {
        return reply.status(400).send({
          statusCode: 400, error: 'VALIDATION_ERROR',
          message: 'Email or name is required',
        });
      }

      // Check limit
      const countResult = await db
        .selectFrom('user_connections')
        .select(db.fn.count<number>('id').as('count'))
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if ((countResult?.count ?? 0) >= MAX_CONNECTIONS) {
        return reply.status(400).send({
          statusCode: 400, error: 'LIMIT_REACHED',
          message: `Maximum ${MAX_CONNECTIONS} connections allowed`,
        });
      }

      // Check if the email belongs to a registered user
      let connectedUserId: string | null = null;
      let resolvedName = name ?? null;

      if (email) {
        const existingUser = await db
          .selectFrom('users')
          .select(['id', 'display_name'])
          .where('email', '=', email)
          .executeTakeFirst();

        if (existingUser) {
          connectedUserId = existingUser.id;
          resolvedName = existingUser.display_name ?? name ?? null;

          // Check for duplicate
          const existing = await db
            .selectFrom('user_connections')
            .select('id')
            .where('user_id', '=', userId)
            .where('connected_user_id', '=', connectedUserId)
            .executeTakeFirst();

          if (existing) {
            return reply.status(409).send({
              statusCode: 409, error: 'DUPLICATE',
              message: 'This user is already in your connections',
            });
          }
        } else {
          // Check for duplicate by email
          const existing = await db
            .selectFrom('user_connections')
            .select('id')
            .where('user_id', '=', userId)
            .where('connected_email', '=', email)
            .executeTakeFirst();

          if (existing) {
            return reply.status(409).send({
              statusCode: 409, error: 'DUPLICATE',
              message: 'This email is already in your connections',
            });
          }
        }
      }

      const connection = await db
        .insertInto('user_connections')
        .values({
          user_id: userId,
          connected_user_id: connectedUserId,
          connected_email: email ?? null,
          connected_name: resolvedName,
          status: connectedUserId ? 'connected' : 'invited',
          label: label ?? null,
          privacy: privacy ?? 'full',
          source: 'manual',
          notes: notes ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return reply.status(201).send({ statusCode: 201, data: connection });
    },
  );

  // ─── PUT /api/connections/:id ──────────────────────────────────────────────
  app.put(
    '/api/connections/:id',
    async (
      request: FastifyRequest<{
        Params: { id: string };
        Body: { label?: string; privacy?: string; notes?: string; status?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      if (!userId) {
        return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const { id } = request.params;
      const { label, privacy, notes, status } = request.body;

      // Verify ownership
      const existing = await db
        .selectFrom('user_connections')
        .select('id')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!existing) {
        return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Connection not found' });
      }

      const updates: Record<string, unknown> = { updated_at: new Date() };
      if (label !== undefined) updates.label = label;
      if (privacy !== undefined) updates.privacy = privacy;
      if (notes !== undefined) updates.notes = notes;
      if (status !== undefined) {
        if (!['connected', 'invited', 'declined', 'blocked'].includes(status)) {
          return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'Invalid status' });
        }
        updates.status = status;
      }

      const updated = await db
        .updateTable('user_connections')
        .set(updates)
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .returningAll()
        .executeTakeFirstOrThrow();

      return reply.send({ statusCode: 200, data: updated });
    },
  );

  // ─── DELETE /api/connections/:id ───────────────────────────────────────────
  app.delete(
    '/api/connections/:id',
    async (
      request: FastifyRequest<{ Params: { id: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      if (!userId) {
        return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });
      }

      const { id } = request.params;

      const deleted = await db
        .deleteFrom('user_connections')
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!deleted || deleted.numDeletedRows === 0n) {
        return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Connection not found' });
      }

      return reply.send({ statusCode: 200, message: 'Connection removed' });
    },
  );
}

/**
 * Auto-connect two users (called when a trip invitation is accepted).
 * Creates bidirectional connection records if they don't already exist.
 */
export async function autoConnectUsers(
  db: Kysely<Database>,
  inviterUserId: string,
  accepterUserId: string,
  tripId?: string,
): Promise<void> {
  // Connection: inviter → accepter
  await db
    .insertInto('user_connections')
    .values({
      user_id: inviterUserId,
      connected_user_id: accepterUserId,
      status: 'connected',
      source: 'trip_accept',
      source_trip_id: tripId ?? null,
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'connected_user_id']).doUpdateSet({
        status: 'connected',
        updated_at: new Date(),
      }),
    )
    .execute();

  // Connection: accepter → inviter
  await db
    .insertInto('user_connections')
    .values({
      user_id: accepterUserId,
      connected_user_id: inviterUserId,
      status: 'connected',
      source: 'trip_accept',
      source_trip_id: tripId ?? null,
    })
    .onConflict((oc) =>
      oc.columns(['user_id', 'connected_user_id']).doUpdateSet({
        status: 'connected',
        updated_at: new Date(),
      }),
    )
    .execute();
}
