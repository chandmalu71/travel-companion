/**
 * Landing Page A/B Testing Routes
 *
 * Admin:
 *  - GET    /api/admin/ab-tests           — list all tests
 *  - POST   /api/admin/ab-tests           — create test with variants
 *  - PUT    /api/admin/ab-tests/:id       — update test (start, stop, declare winner)
 *  - GET    /api/admin/ab-tests/:id/results — get variant results
 *  - DELETE /api/admin/ab-tests/:id       — delete test
 *
 * Public:
 *  - GET    /api/config/landing           — returns assigned variant (cookie-pinned)
 *  - POST   /api/config/landing/convert   — track conversion for assigned variant
 *
 * Implements Requirement 53.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

interface AbTestRoutesOptions {
  db: Kysely<Database>;
}

export async function registerAbTestRoutes(
  app: FastifyInstance,
  options: AbTestRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/ab-tests — List all tests ──────────────────────────────

  app.get('/api/admin/ab-tests', async (_request: FastifyRequest, reply: FastifyReply) => {
    const tests = await (db as any)
      .selectFrom('landing_ab_tests')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();

    // Enrich with variant data
    const enriched = await Promise.all(tests.map(async (test: any) => {
      const variants = await (db as any)
        .selectFrom('landing_ab_variants')
        .selectAll()
        .where('test_id', '=', test.id)
        .orderBy('created_at', 'asc')
        .execute();
      return { ...test, variants };
    }));

    return reply.send({ statusCode: 200, data: enriched });
  });

  // ─── POST /api/admin/ab-tests — Create test with variants ──────────────────

  app.post('/api/admin/ab-tests', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { name, variants } = request.body as any;

    if (!name || !variants || !Array.isArray(variants) || variants.length < 2) {
      return reply.status(400).send({ statusCode: 400, error: 'Name and at least 2 variants required' });
    }

    if (variants.length > 5) {
      return reply.status(400).send({ statusCode: 400, error: 'Maximum 5 variants per test' });
    }

    // Validate traffic percentages sum to 100
    const totalTraffic = variants.reduce((sum: number, v: any) => sum + (v.traffic_percent ?? 0), 0);
    if (totalTraffic !== 100) {
      return reply.status(400).send({ statusCode: 400, error: `Traffic percentages must sum to 100 (currently ${totalTraffic})` });
    }

    // Create test
    const test = await (db as any)
      .insertInto('landing_ab_tests')
      .values({ name, status: 'draft' })
      .returningAll()
      .executeTakeFirstOrThrow();

    // Create variants
    const createdVariants = [];
    for (const v of variants) {
      const variant = await (db as any)
        .insertInto('landing_ab_variants')
        .values({
          test_id: test.id,
          name: v.name,
          mode: v.mode ?? 'early_access',
          content: JSON.stringify(v.content ?? {}),
          traffic_percent: v.traffic_percent,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      createdVariants.push(variant);
    }

    return reply.status(201).send({
      statusCode: 201,
      data: { ...test, variants: createdVariants },
    });
  });

  // ─── PUT /api/admin/ab-tests/:id — Update test status ──────────────────────

  app.put('/api/admin/ab-tests/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { action, winner_variant_id, name } = request.body as any;

    const updates: Record<string, any> = {};

    if (action === 'start') {
      updates.status = 'active';
      updates.started_at = new Date();
    } else if (action === 'stop') {
      updates.status = 'completed';
      updates.ended_at = new Date();
    } else if (action === 'declare_winner') {
      if (!winner_variant_id) {
        return reply.status(400).send({ statusCode: 400, error: 'winner_variant_id required' });
      }
      updates.status = 'completed';
      updates.ended_at = new Date();
      updates.winner_variant_id = winner_variant_id;

      // Apply winner content as the default site config
      const winner = await (db as any)
        .selectFrom('landing_ab_variants')
        .selectAll()
        .where('id', '=', winner_variant_id)
        .executeTakeFirst();

      if (winner) {
        const content = typeof winner.content === 'string' ? JSON.parse(winner.content) : winner.content;
        await sql`INSERT INTO site_config (key, value, updated_at) VALUES ('landing_cta_mode', ${winner.mode}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = ${winner.mode}, updated_at = NOW()`.execute(db);
        await sql`INSERT INTO site_config (key, value, updated_at) VALUES ('landing_cta_content', ${JSON.stringify({ [winner.mode]: content })}, NOW())
          ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify({ [winner.mode]: content })}, updated_at = NOW()`.execute(db);
      }
    } else if (name) {
      updates.name = name;
    }

    if (Object.keys(updates).length > 0) {
      await (db as any)
        .updateTable('landing_ab_tests')
        .set(updates)
        .where('id', '=', id)
        .execute();
    }

    const updated = await (db as any)
      .selectFrom('landing_ab_tests')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirstOrThrow();

    return reply.send({ statusCode: 200, data: updated });
  });

  // ─── GET /api/admin/ab-tests/:id/results — Variant results ─────────────────

  app.get('/api/admin/ab-tests/:id/results', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;

    const test = await (db as any)
      .selectFrom('landing_ab_tests')
      .selectAll()
      .where('id', '=', id)
      .executeTakeFirst();

    if (!test) return reply.status(404).send({ statusCode: 404, error: 'Test not found' });

    const variants = await (db as any)
      .selectFrom('landing_ab_variants')
      .selectAll()
      .where('test_id', '=', id)
      .orderBy('created_at', 'asc')
      .execute();

    const results = variants.map((v: any) => ({
      ...v,
      content: typeof v.content === 'string' ? JSON.parse(v.content) : v.content,
      conversion_rate: v.views > 0 ? Math.round((v.conversions / v.views) * 1000) / 10 : 0,
    }));

    return reply.send({ statusCode: 200, data: { test, variants: results } });
  });

  // ─── DELETE /api/admin/ab-tests/:id — Delete test ──────────────────────────

  app.delete('/api/admin/ab-tests/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await (db as any).deleteFrom('landing_ab_tests').where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Test deleted' });
  });

  // ─── POST /api/config/landing/convert — Track conversion ───────────────────

  app.post('/api/config/landing/convert', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { variant_id } = request.body as any;

    if (!variant_id) {
      return reply.status(400).send({ statusCode: 400, error: 'variant_id required' });
    }

    // Increment conversions counter
    await (db as any)
      .updateTable('landing_ab_variants')
      .set({ conversions: sql`conversions + 1` })
      .where('id', '=', variant_id)
      .execute();

    return reply.send({ statusCode: 200, message: 'Conversion tracked' });
  });
}
