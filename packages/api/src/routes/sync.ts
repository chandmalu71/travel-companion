/**
 * Sync protocol routes: POST /api/sync
 * Handles offline sync by accepting local changes, returning server changes
 * since the client's last sync, and resolving conflicts using last-write-wins.
 *
 * Requirements: 13.4, 13.5, 17.3, 17.5, 17.6, 17.7
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Sync Protocol Types ─────────────────────────────────────────────────────

export interface ChangeEntry {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  localTimestamp: string; // ISO 8601
}

export interface SyncPayload {
  lastSyncTimestamp: string; // ISO 8601
  localChanges: ChangeEntry[];
}

export interface ConflictEntry {
  entityType: string;
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  resolvedVersion: Record<string, unknown>; // most recent wins
}

export interface SyncResponse {
  serverChanges: ChangeEntry[];
  conflicts: ConflictEntry[];
  newSyncTimestamp: string;
}

// ─── Supported Entity Types ──────────────────────────────────────────────────

const SUPPORTED_ENTITY_TYPES = [
  'trips',
  'bookings',
  'favorites',
  'timeline_events',
  'votes',
  'expenses',
  'documents',
] as const;

type SupportedEntityType = (typeof SUPPORTED_ENTITY_TYPES)[number];

function isSupportedEntityType(type: string): type is SupportedEntityType {
  return SUPPORTED_ENTITY_TYPES.includes(type as SupportedEntityType);
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface SyncRoutesOptions {
  db: Kysely<Database>;
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validateSyncPayload(body: unknown): { valid: true; payload: SyncPayload } | { valid: false; error: string } {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be an object' };
  }

  const payload = body as Record<string, unknown>;

  if (!payload.lastSyncTimestamp || typeof payload.lastSyncTimestamp !== 'string') {
    return { valid: false, error: 'lastSyncTimestamp is required and must be an ISO 8601 string' };
  }

  // Validate it's a parseable ISO date
  const parsedDate = new Date(payload.lastSyncTimestamp);
  if (isNaN(parsedDate.getTime())) {
    return { valid: false, error: 'lastSyncTimestamp must be a valid ISO 8601 date' };
  }

  if (!Array.isArray(payload.localChanges)) {
    return { valid: false, error: 'localChanges must be an array' };
  }

  for (let i = 0; i < payload.localChanges.length; i++) {
    const change = payload.localChanges[i] as Record<string, unknown>;

    if (!change.entityType || typeof change.entityType !== 'string') {
      return { valid: false, error: `localChanges[${i}].entityType is required` };
    }

    if (!isSupportedEntityType(change.entityType)) {
      return {
        valid: false,
        error: `localChanges[${i}].entityType "${change.entityType}" is not supported. Supported: ${SUPPORTED_ENTITY_TYPES.join(', ')}`,
      };
    }

    if (!change.entityId || typeof change.entityId !== 'string') {
      return { valid: false, error: `localChanges[${i}].entityId is required` };
    }

    if (!change.operation || !['create', 'update', 'delete'].includes(change.operation as string)) {
      return { valid: false, error: `localChanges[${i}].operation must be "create", "update", or "delete"` };
    }

    if (change.data !== undefined && (typeof change.data !== 'object' || change.data === null || Array.isArray(change.data))) {
      return { valid: false, error: `localChanges[${i}].data must be an object` };
    }

    if (!change.localTimestamp || typeof change.localTimestamp !== 'string') {
      return { valid: false, error: `localChanges[${i}].localTimestamp is required` };
    }

    const localDate = new Date(change.localTimestamp);
    if (isNaN(localDate.getTime())) {
      return { valid: false, error: `localChanges[${i}].localTimestamp must be a valid ISO 8601 date` };
    }
  }

  return { valid: true, payload: payload as unknown as SyncPayload };
}

// ─── Server Change Detection ─────────────────────────────────────────────────

/**
 * Fetches entities that changed on the server since the given timestamp for the user.
 * Returns ChangeEntry[] representing server-side modifications.
 */
export async function getServerChangesSince(
  db: Kysely<Database>,
  userId: string,
  since: Date,
): Promise<ChangeEntry[]> {
  const changes: ChangeEntry[] = [];

  // Fetch trips updated since lastSync that the user owns or is a member of
  const trips = await db
    .selectFrom('trips')
    .selectAll()
    .where('updated_at', '>', since)
    .where('owner_id', '=', userId)
    .execute();

  for (const trip of trips) {
    changes.push({
      entityType: 'trips',
      entityId: trip.id,
      operation: 'update',
      data: {
        name: trip.name,
        start_date: trip.start_date,
        end_date: trip.end_date,
        budget: trip.budget,
        budget_currency: trip.budget_currency,
      },
      localTimestamp: trip.updated_at.toISOString(),
    });
  }

  // Fetch bookings updated since lastSync for the user
  const bookings = await db
    .selectFrom('bookings')
    .selectAll()
    .where('updated_at', '>', since)
    .where('user_id', '=', userId)
    .execute();

  for (const booking of bookings) {
    changes.push({
      entityType: 'bookings',
      entityId: booking.id,
      operation: 'update',
      data: {
        trip_id: booking.trip_id,
        type: booking.type,
        source: booking.source,
        checked_in: booking.checked_in,
      },
      localTimestamp: booking.updated_at.toISOString(),
    });
  }

  // Fetch favorites created/updated since lastSync for the user
  const favorites = await db
    .selectFrom('favorites')
    .selectAll()
    .where('created_at', '>', since)
    .where('user_id', '=', userId)
    .execute();

  for (const fav of favorites) {
    changes.push({
      entityType: 'favorites',
      entityId: fav.id,
      operation: 'update',
      data: {
        name: fav.name,
        category: fav.category,
        trip_id: fav.trip_id,
        place_id: fav.place_id,
        notes: fav.notes,
      },
      localTimestamp: fav.created_at.toISOString(),
    });
  }

  // Fetch timeline events updated since lastSync for trips the user owns
  const userTripIds = await db
    .selectFrom('trips')
    .select('id')
    .where('owner_id', '=', userId)
    .execute();

  if (userTripIds.length > 0) {
    const tripIds = userTripIds.map((t) => t.id);

    const timelineEvents = await db
      .selectFrom('timeline_events')
      .selectAll()
      .where('updated_at', '>', since)
      .where('trip_id', 'in', tripIds)
      .execute();

    for (const event of timelineEvents) {
      changes.push({
        entityType: 'timeline_events',
        entityId: event.id,
        operation: 'update',
        data: {
          trip_id: event.trip_id,
          title: event.title,
          event_time: event.event_time?.toISOString() ?? null,
          all_day: event.all_day,
          location: event.location,
          notes: event.notes,
          event_type: event.event_type,
          reference_id: event.reference_id,
        },
        localTimestamp: event.updated_at.toISOString(),
      });
    }
  }

  return changes;
}

// ─── Conflict Resolution ─────────────────────────────────────────────────────

/**
 * Resolves conflicts using last-write-wins strategy based on timestamps.
 * If the local change is more recent, the local version wins.
 * If the server version is more recent, the server version wins.
 * Both versions are included in the ConflictEntry for user notification.
 */
export function resolveConflict(
  localChange: ChangeEntry,
  serverChange: ChangeEntry,
): ConflictEntry {
  const localTime = new Date(localChange.localTimestamp).getTime();
  const serverTime = new Date(serverChange.localTimestamp).getTime();

  // Last-write-wins: most recent timestamp is the resolved version
  const resolvedVersion = serverTime >= localTime ? serverChange.data : localChange.data;

  return {
    entityType: localChange.entityType,
    entityId: localChange.entityId,
    localVersion: localChange.data,
    serverVersion: serverChange.data,
    resolvedVersion,
  };
}

// ─── Apply Local Changes ─────────────────────────────────────────────────────

/**
 * Applies a local change to the server database.
 * Returns true if applied successfully, false if a conflict was detected.
 */
async function applyLocalChange(
  db: Kysely<Database>,
  userId: string,
  change: ChangeEntry,
  serverChanges: ChangeEntry[],
): Promise<{ applied: boolean; conflict?: ConflictEntry }> {
  // Check if there's a server change for the same entity
  const conflictingServerChange = serverChanges.find(
    (sc) => sc.entityType === change.entityType && sc.entityId === change.entityId,
  );

  if (conflictingServerChange) {
    // Conflict detected - resolve using last-write-wins
    const conflict = resolveConflict(change, conflictingServerChange);

    // Apply the resolved version (winner) to the database
    if (conflict.resolvedVersion === change.data) {
      // Local wins - apply local change
      await applyChangeToDb(db, userId, change);
    }
    // If server wins, no need to apply anything (server already has latest)

    return { applied: true, conflict };
  }

  // No conflict - apply the local change directly
  await applyChangeToDb(db, userId, change);
  return { applied: true };
}

/**
 * Applies a single change entry to the appropriate database table.
 */
async function applyChangeToDb(
  db: Kysely<Database>,
  userId: string,
  change: ChangeEntry,
): Promise<void> {
  const { entityType, entityId, operation, data } = change;

  switch (entityType) {
    case 'trips':
      await applyTripChange(db, userId, entityId, operation, data);
      break;
    case 'bookings':
      await applyBookingChange(db, userId, entityId, operation, data);
      break;
    case 'favorites':
      await applyFavoriteChange(db, userId, entityId, operation, data);
      break;
    case 'timeline_events':
      await applyTimelineEventChange(db, userId, entityId, operation, data);
      break;
    case 'votes':
      await applyVoteChange(db, userId, entityId, operation, data);
      break;
    case 'expenses':
      await applyExpenseChange(db, userId, entityId, operation, data);
      break;
    case 'documents':
      await applyDocumentChange(db, userId, entityId, operation, data);
      break;
  }
}

async function applyTripChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (operation) {
    case 'create':
      await db
        .insertInto('trips')
        .values({
          id: entityId,
          owner_id: userId,
          name: (data.name as string) || 'Untitled Trip',
          start_date: (data.start_date as string) || null,
          end_date: (data.end_date as string) || null,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    case 'update':
      await db
        .updateTable('trips')
        .set({
          ...(data.name !== undefined && { name: data.name as string }),
          ...(data.start_date !== undefined && { start_date: data.start_date as string | null }),
          ...(data.end_date !== undefined && { end_date: data.end_date as string | null }),
          updated_at: new Date(),
        })
        .where('id', '=', entityId)
        .where('owner_id', '=', userId)
        .execute();
      break;
    case 'delete':
      await db
        .deleteFrom('trips')
        .where('id', '=', entityId)
        .where('owner_id', '=', userId)
        .execute();
      break;
  }
}

async function applyBookingChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (operation) {
    case 'create':
      await db
        .insertInto('bookings')
        .values({
          id: entityId,
          user_id: userId,
          trip_id: (data.trip_id as string) || null,
          type: (data.type as 'flight' | 'hotel' | 'car_rental') || 'flight',
          source: 'manual',
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    case 'update':
      await db
        .updateTable('bookings')
        .set({
          ...(data.trip_id !== undefined && { trip_id: data.trip_id as string | null }),
          ...(data.checked_in !== undefined && { checked_in: data.checked_in as boolean }),
          updated_at: new Date(),
        })
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
    case 'delete':
      await db
        .deleteFrom('bookings')
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
  }
}

async function applyFavoriteChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (operation) {
    case 'create':
      await db
        .insertInto('favorites')
        .values({
          id: entityId,
          user_id: userId,
          name: (data.name as string) || 'Unnamed',
          trip_id: (data.trip_id as string) || null,
          category: (data.category as string) || null,
          place_id: (data.place_id as string) || null,
          notes: (data.notes as string) || null,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    case 'update':
      await db
        .updateTable('favorites')
        .set({
          ...(data.name !== undefined && { name: data.name as string }),
          ...(data.category !== undefined && { category: data.category as string | null }),
          ...(data.trip_id !== undefined && { trip_id: data.trip_id as string | null }),
          ...(data.notes !== undefined && { notes: data.notes as string | null }),
        })
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
    case 'delete':
      await db
        .deleteFrom('favorites')
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
  }
}

async function applyTimelineEventChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  // For timeline events, verify user owns the trip
  switch (operation) {
    case 'create': {
      const tripId = data.trip_id as string;
      if (!tripId) return;

      // Verify user owns the trip
      const trip = await db
        .selectFrom('trips')
        .select('id')
        .where('id', '=', tripId)
        .where('owner_id', '=', userId)
        .executeTakeFirst();

      if (!trip) return;

      await db
        .insertInto('timeline_events')
        .values({
          id: entityId,
          trip_id: tripId,
          title: (data.title as string) || 'Untitled',
          event_time: data.event_time ? new Date(data.event_time as string) : null,
          all_day: (data.all_day as boolean) ?? false,
          location: (data.location as string) || null,
          notes: (data.notes as string) || null,
          event_type: (data.event_type as 'booking' | 'favorite' | 'custom') || 'custom',
          reference_id: (data.reference_id as string) || null,
          added_by: userId,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    }
    case 'update': {
      // Verify user owns the trip associated with this event
      const event = await db
        .selectFrom('timeline_events')
        .innerJoin('trips', 'trips.id', 'timeline_events.trip_id')
        .select('timeline_events.id')
        .where('timeline_events.id', '=', entityId)
        .where('trips.owner_id', '=', userId)
        .executeTakeFirst();

      if (!event) return;

      await db
        .updateTable('timeline_events')
        .set({
          ...(data.title !== undefined && { title: data.title as string }),
          ...(data.event_time !== undefined && {
            event_time: data.event_time ? new Date(data.event_time as string) : null,
          }),
          ...(data.location !== undefined && { location: data.location as string | null }),
          ...(data.notes !== undefined && { notes: data.notes as string | null }),
          updated_at: new Date(),
        })
        .where('id', '=', entityId)
        .execute();
      break;
    }
    case 'delete': {
      // Verify user owns the trip
      const eventToDelete = await db
        .selectFrom('timeline_events')
        .innerJoin('trips', 'trips.id', 'timeline_events.trip_id')
        .select('timeline_events.id')
        .where('timeline_events.id', '=', entityId)
        .where('trips.owner_id', '=', userId)
        .executeTakeFirst();

      if (!eventToDelete) return;

      await db
        .deleteFrom('timeline_events')
        .where('id', '=', entityId)
        .execute();
      break;
    }
  }
}

async function applyVoteChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (operation) {
    case 'create':
      await db
        .insertInto('votes')
        .values({
          id: entityId,
          trip_id: (data.trip_id as string) || '',
          user_id: userId,
          entity_type: (data.entity_type as 'favorite' | 'timeline_event') || 'favorite',
          entity_id: (data.entity_id as string) || '',
          vote_value: (data.vote_value as number) || 1,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    case 'update':
      await db
        .updateTable('votes')
        .set({
          ...(data.vote_value !== undefined && { vote_value: data.vote_value as number }),
        })
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
    case 'delete':
      await db
        .deleteFrom('votes')
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
  }
}

async function applyExpenseChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  data: Record<string, unknown>,
): Promise<void> {
  switch (operation) {
    case 'create':
      await db
        .insertInto('expenses')
        .values({
          id: entityId,
          user_id: userId,
          trip_id: (data.trip_id as string) || null,
          amount: (data.amount as string) || '0',
          currency: (data.currency as string) || 'USD',
          date: (data.date as string) || new Date().toISOString().split('T')[0]!,
          category: (data.category as 'accommodation' | 'transportation' | 'food_dining' | 'shopping' | 'tours_activities' | 'entertainment' | 'other') || 'other',
          merchant_name: (data.merchant_name as string) || null,
          notes: (data.notes as string) || null,
        })
        .onConflict((oc) => oc.column('id').doNothing())
        .execute();
      break;
    case 'update':
      await db
        .updateTable('expenses')
        .set({
          ...(data.amount !== undefined && { amount: data.amount as string }),
          ...(data.currency !== undefined && { currency: data.currency as string }),
          ...(data.category !== undefined && { category: data.category as 'accommodation' | 'transportation' | 'food_dining' | 'shopping' | 'tours_activities' | 'entertainment' | 'other' }),
          ...(data.merchant_name !== undefined && { merchant_name: data.merchant_name as string | null }),
          ...(data.notes !== undefined && { notes: data.notes as string | null }),
          updated_at: new Date(),
        })
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
    case 'delete':
      await db
        .deleteFrom('expenses')
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
  }
}

async function applyDocumentChange(
  db: Kysely<Database>,
  userId: string,
  entityId: string,
  operation: string,
  _data: Record<string, unknown>,
): Promise<void> {
  // Documents only support delete via sync (create requires file upload)
  switch (operation) {
    case 'delete':
      await db
        .deleteFrom('documents')
        .where('id', '=', entityId)
        .where('user_id', '=', userId)
        .execute();
      break;
  }
}

// ─── Route Registration ──────────────────────────────────────────────────────

/**
 * Register sync protocol routes on the Fastify instance.
 */
export async function registerSyncRoutes(
  app: FastifyInstance,
  options: SyncRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/sync ────────────────────────────────────────────────────────

  app.post(
    '/api/sync',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Body: SyncPayload }>, reply: FastifyReply) => {
      const userId = request.user?.userId;
      if (!userId) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Validate payload
      const validation = validateSyncPayload(request.body);
      if (!validation.valid) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: validation.error,
        });
      }

      const { lastSyncTimestamp, localChanges } = validation.payload;
      const since = new Date(lastSyncTimestamp);
      const newSyncTimestamp = new Date().toISOString();

      try {
        // 1. Get server changes since last sync
        const serverChanges = await getServerChangesSince(db, userId, since);

        // 2. Process local changes and detect conflicts
        const conflicts: ConflictEntry[] = [];

        for (const localChange of localChanges) {
          const result = await applyLocalChange(db, userId, localChange, serverChanges);
          if (result.conflict) {
            conflicts.push(result.conflict);
          }
        }

        // 3. Filter out server changes that were part of conflicts (already resolved)
        const conflictEntityKeys = new Set(
          conflicts.map((c) => `${c.entityType}:${c.entityId}`),
        );
        const nonConflictServerChanges = serverChanges.filter(
          (sc) => !conflictEntityKeys.has(`${sc.entityType}:${sc.entityId}`),
        );

        const response: SyncResponse = {
          serverChanges: nonConflictServerChanges,
          conflicts,
          newSyncTimestamp,
        };

        return reply.status(200).send(response);
      } catch (error) {
        request.log.error(error, 'Sync operation failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'SYNC_ERROR',
          message: 'Failed to synchronize changes. Please retry.',
        });
      }
    },
  );
}
