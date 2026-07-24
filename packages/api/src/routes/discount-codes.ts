/**
 * Discount Codes API
 *
 * Admin:
 *  - GET    /api/admin/discount-codes       — list all codes
 *  - POST   /api/admin/discount-codes       — create code (manual or auto-generated)
 *  - PUT    /api/admin/discount-codes/:id   — update (activate/deactivate)
 *  - DELETE /api/admin/discount-codes/:id   — delete code
 *
 * Public:
 *  - POST   /api/discount-codes/validate    — validate a code (used at checkout)
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import type { Database } from '../db/types.js';

export async function registerDiscountCodeRoutes(
  app: FastifyInstance,
  options: { db: Kysely<Database> },
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/discount-codes ─────────────────────────────────────────
  app.get('/api/admin/discount-codes', async (_req: FastifyRequest, reply: FastifyReply) => {
    const codes = await (db as any)
      .selectFrom('discount_codes')
      .selectAll()
      .orderBy('created_at', 'desc')
      .execute();
    return reply.send({ statusCode: 200, data: codes });
  });

  // ─── POST /api/admin/discount-codes ────────────────────────────────────────
  app.post('/api/admin/discount-codes', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { code, discount_percent, is_one_time, max_uses, valid_from, valid_until, auto_generate, count } = request.body as any;

    if (!discount_percent || discount_percent < 1 || discount_percent > 100) {
      return reply.status(400).send({ statusCode: 400, error: 'discount_percent must be 1-100' });
    }

    // Auto-generate codes
    if (auto_generate) {
      const numCodes = Math.min(count ?? 1, 100);
      const generated = [];
      for (let i = 0; i < numCodes; i++) {
        const genCode = `NEYYA-${randomCode(6)}`;
        const result = await (db as any).insertInto('discount_codes').values({
          code: genCode,
          discount_percent,
          is_one_time: is_one_time ?? true,
          max_uses: max_uses ?? 1,
          valid_from: valid_from ? new Date(valid_from) : new Date(),
          valid_until: valid_until ? new Date(valid_until) : null,
          is_active: true,
        }).returningAll().executeTakeFirstOrThrow();
        generated.push(result);
      }
      return reply.status(201).send({ statusCode: 201, data: generated, message: `${numCodes} code(s) generated` });
    }

    // Manual code creation
    if (!code) {
      return reply.status(400).send({ statusCode: 400, error: 'code is required (or set auto_generate: true)' });
    }

    const result = await (db as any).insertInto('discount_codes').values({
      code: code.toUpperCase().trim(),
      discount_percent,
      is_one_time: is_one_time ?? false,
      max_uses: max_uses ?? null,
      valid_from: valid_from ? new Date(valid_from) : new Date(),
      valid_until: valid_until ? new Date(valid_until) : null,
      is_active: true,
    }).returningAll().executeTakeFirstOrThrow();

    return reply.status(201).send({ statusCode: 201, data: result });
  });

  // ─── PUT /api/admin/discount-codes/:id ─────────────────────────────────────
  app.put('/api/admin/discount-codes/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const { is_active, valid_until, max_uses } = request.body as any;

    const updates: Record<string, any> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (valid_until !== undefined) updates.valid_until = valid_until ? new Date(valid_until) : null;
    if (max_uses !== undefined) updates.max_uses = max_uses;

    const updated = await (db as any).updateTable('discount_codes').set(updates).where('id', '=', id).returningAll().executeTakeFirst();
    if (!updated) return reply.status(404).send({ statusCode: 404, error: 'Code not found' });
    return reply.send({ statusCode: 200, data: updated });
  });

  // ─── DELETE /api/admin/discount-codes/:id ──────────────────────────────────
  app.delete('/api/admin/discount-codes/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    await (db as any).deleteFrom('discount_codes').where('id', '=', request.params.id).execute();
    return reply.send({ statusCode: 200, message: 'Code deleted' });
  });

  // ─── POST /api/discount-codes/validate — Public code validation ────────────
  app.post('/api/discount-codes/validate', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { code } = request.body as any;
    if (!code) return reply.status(400).send({ statusCode: 400, error: 'code is required' });

    const discount = await (db as any)
      .selectFrom('discount_codes')
      .selectAll()
      .where('code', '=', code.toUpperCase().trim())
      .where('is_active', '=', true)
      .executeTakeFirst();

    if (!discount) {
      return reply.status(404).send({ statusCode: 404, error: 'Invalid or expired code', valid: false });
    }

    // Check expiry
    if (discount.valid_until && new Date(discount.valid_until) < new Date()) {
      return reply.status(410).send({ statusCode: 410, error: 'Code expired', valid: false });
    }

    // Check max uses
    if (discount.max_uses && discount.current_uses >= discount.max_uses) {
      return reply.status(410).send({ statusCode: 410, error: 'Code fully redeemed', valid: false });
    }

    return reply.send({
      statusCode: 200,
      valid: true,
      data: {
        code: discount.code,
        discount_percent: discount.discount_percent,
        is_one_time: discount.is_one_time,
      },
    });
  });
}

function randomCode(length: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No I/O/0/1 to avoid confusion
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}
