/**
 * Analytics Routes
 *
 * In-house event tracking for user engagement.
 * Tracks page views, clicks, feature usage, time on page.
 *
 * Endpoints:
 *  - POST /api/analytics/event     — track an event (from client)
 *  - POST /api/analytics/batch     — track multiple events at once
 *  - GET  /api/admin/analytics     — admin dashboard summary
 *  - GET  /api/admin/analytics/top-pages — most visited pages
 *  - GET  /api/admin/analytics/top-features — most used features
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

interface AnalyticsOptions {
  db: Kysely<Database>;
}

export async function registerAnalyticsRoutes(
  app: FastifyInstance,
  options: AnalyticsOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/analytics/event ─────────────────────────────────────────────
  app.post('/api/analytics/event', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string ?? null;
    const { eventType, page, element, metadata, sessionId } = request.body as any;

    if (!eventType) return reply.status(400).send({ statusCode: 400, error: 'eventType required' });

    await db.insertInto('analytics_events' as any).values({
      user_id: userId,
      session_id: sessionId ?? null,
      event_type: eventType,
      page: page ?? null,
      element: element ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    } as any).execute();

    return reply.send({ statusCode: 200, tracked: true });
  });

  // ─── POST /api/analytics/batch ─────────────────────────────────────────────
  app.post('/api/analytics/batch', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string ?? null;
    const { events } = request.body as any;

    if (!Array.isArray(events) || events.length === 0) return reply.status(400).send({ statusCode: 400, error: 'events array required' });

    for (const evt of events.slice(0, 50)) { // max 50 per batch
      await db.insertInto('analytics_events' as any).values({
        user_id: userId,
        session_id: evt.sessionId ?? null,
        event_type: evt.eventType ?? 'unknown',
        page: evt.page ?? null,
        element: evt.element ?? null,
        metadata: evt.metadata ? JSON.stringify(evt.metadata) : null,
      } as any).execute();
    }

    return reply.send({ statusCode: 200, tracked: events.length });
  });

  // ─── GET /api/admin/analytics ──────────────────────────────────────────────
  app.get('/api/admin/analytics', async (_request: FastifyRequest, reply: FastifyReply) => {
    // Summary stats for the admin dashboard
    const totalEvents = await db.selectFrom('analytics_events' as any).select(sql<number>`count(*)`.as('count')).executeTakeFirst();
    const today = await db.selectFrom('analytics_events' as any).select(sql<number>`count(*)`.as('count')).where('created_at', '>=', sql`now() - interval '24 hours'`).executeTakeFirst();
    const uniqueUsers = await db.selectFrom('analytics_events' as any).select(sql<number>`count(distinct user_id)`.as('count')).where('created_at', '>=', sql`now() - interval '7 days'`).executeTakeFirst();
    const topPages = await db.selectFrom('analytics_events' as any)
      .select(['page', sql<number>`count(*)`.as('views')])
      .where('event_type', '=', 'page_view')
      .where('page', 'is not', null)
      .groupBy('page')
      .orderBy(sql`count(*)`, 'desc')
      .limit(10)
      .execute();
    const topFeatures = await db.selectFrom('analytics_events' as any)
      .select(['element', sql<number>`count(*)`.as('uses')])
      .where('event_type', '=', 'feature_use')
      .where('element', 'is not', null)
      .groupBy('element')
      .orderBy(sql`count(*)`, 'desc')
      .limit(10)
      .execute();
    const eventsByDay = await db.selectFrom('analytics_events' as any)
      .select([sql`date(created_at)`.as('day'), sql<number>`count(*)`.as('count')])
      .where('created_at', '>=', sql`now() - interval '30 days'`)
      .groupBy(sql`date(created_at)`)
      .orderBy(sql`date(created_at)`, 'desc')
      .limit(30)
      .execute();

    return reply.send({
      statusCode: 200,
      data: {
        totalEvents: (totalEvents as any)?.count ?? 0,
        eventsToday: (today as any)?.count ?? 0,
        uniqueUsersWeek: (uniqueUsers as any)?.count ?? 0,
        topPages,
        topFeatures,
        eventsByDay,
      },
    });
  });
}
