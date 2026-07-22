/**
 * Admin Email Management Routes
 *
 * - GET/PUT /api/admin/email/templates — list and edit templates
 * - POST /api/admin/email/templates/:slug/test — send test email
 * - GET/POST/PUT/DELETE /api/admin/email/senders — manage sender addresses
 * - GET /api/admin/email/log — send history
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { EmailService } from '../services/email.js';

interface EmailAdminOptions {
  db: Kysely<Database>;
}

export async function registerEmailAdminRoutes(
  app: FastifyInstance,
  options: EmailAdminOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/admin/email/templates ────────────────────────────────────────
  app.get('/api/admin/email/templates', async (_request: FastifyRequest, reply: FastifyReply) => {
    const templates = await (db.selectFrom('email_templates' as any) as any).selectAll().orderBy('created_at', 'asc').execute();
    return reply.send({ statusCode: 200, data: templates });
  });

  // ─── PUT /api/admin/email/templates/:slug ──────────────────────────────────
  app.put('/api/admin/email/templates/:slug', async (request: FastifyRequest<{ Params: { slug: string }; Body: any }>, reply: FastifyReply) => {
    const { slug } = request.params;
    const body = request.body as any;

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (body.name !== undefined) updates.name = body.name;
    if (body.subject !== undefined) updates.subject = body.subject;
    if (body.htmlBody !== undefined) updates.html_body = body.htmlBody;
    if (body.textBody !== undefined) updates.text_body = body.textBody;
    if (body.replyTo !== undefined) updates.reply_to = body.replyTo;
    if (body.senderAddressId !== undefined) updates.sender_address_id = body.senderAddressId;
    if (body.isActive !== undefined) updates.is_active = body.isActive;
    if (body.variables !== undefined) updates.variables = body.variables;

    await (db.updateTable('email_templates' as any) as any).set(updates).where('slug', '=', slug).execute();
    return reply.send({ statusCode: 200, message: `Template "${slug}" updated` });
  });

  // ─── POST /api/admin/email/templates/:slug/test ────────────────────────────
  app.post('/api/admin/email/templates/:slug/test', async (request: FastifyRequest<{ Params: { slug: string }; Body: any }>, reply: FastifyReply) => {
    const { slug } = request.params;
    const { to } = request.body as any;
    if (!to) return reply.status(400).send({ statusCode: 400, error: 'to email required' });

    const emailService = new EmailService(db);

    // Create test variables
    const testVars: Record<string, string> = {
      name: 'Test User',
      verificationUrl: 'https://neyya.ai/verify?token=test123',
      resetUrl: 'https://neyya.ai/reset?token=test123',
      inviterName: 'Alice Demo',
      tripName: 'Summer in Paris',
      acceptUrl: 'https://neyya.ai/accept?token=test',
      declineUrl: 'https://neyya.ai/decline?token=test',
      aliasEmail: 'test@example.com',
      verifyUrl: 'https://neyya.ai/verify-alias?token=test',
      planName: 'Pro',
      billingCycle: 'Monthly',
      nextPayment: '2026-08-22',
      dashboardUrl: 'https://neyya.ai/dashboard',
      message: 'Join us for an amazing trip!',
    };

    const result = await emailService.sendTemplate({ to, templateSlug: slug, variables: testVars });
    return reply.send({ statusCode: 200, ...result });
  });

  // ─── GET /api/admin/email/senders ──────────────────────────────────────────
  app.get('/api/admin/email/senders', async (_request: FastifyRequest, reply: FastifyReply) => {
    const senders = await (db.selectFrom('email_sender_addresses' as any) as any).selectAll().orderBy('created_at', 'asc').execute();
    return reply.send({ statusCode: 200, data: senders });
  });

  // ─── POST /api/admin/email/senders ─────────────────────────────────────────
  app.post('/api/admin/email/senders', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const body = request.body as any;
    if (!body.email || !body.name || !body.purpose) {
      return reply.status(400).send({ statusCode: 400, error: 'email, name, purpose required' });
    }
    const sender = await (db.insertInto('email_sender_addresses' as any) as any).values({
      email: body.email,
      name: body.name,
      purpose: body.purpose,
      is_verified: false,
      is_default: body.isDefault ?? false,
    }).returningAll().executeTakeFirst();
    return reply.status(201).send({ statusCode: 201, data: sender });
  });

  // ─── PUT /api/admin/email/senders/:id ──────────────────────────────────────
  app.put('/api/admin/email/senders/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const { id } = request.params;
    const body = request.body as any;
    const updates: Record<string, unknown> = {};
    if (body.email !== undefined) updates.email = body.email;
    if (body.name !== undefined) updates.name = body.name;
    if (body.purpose !== undefined) updates.purpose = body.purpose;
    if (body.isDefault !== undefined) updates.is_default = body.isDefault;
    if (body.isVerified !== undefined) updates.is_verified = body.isVerified;
    await (db.updateTable('email_sender_addresses' as any) as any).set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Sender updated' });
  });

  // ─── DELETE /api/admin/email/senders/:id ───────────────────────────────────
  app.delete('/api/admin/email/senders/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const { id } = request.params;
    await (db.deleteFrom('email_sender_addresses' as any) as any).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Sender deleted' });
  });

  // ─── GET /api/admin/email/log ──────────────────────────────────────────────
  app.get('/api/admin/email/log', async (request: FastifyRequest<{ Querystring: { limit?: string; status?: string } }>, reply: FastifyReply) => {
    const { limit = '50', status } = request.query;
    let query = (db.selectFrom('email_send_log' as any) as any).selectAll().orderBy('created_at', 'desc').limit(parseInt(limit));
    if (status) query = query.where('status', '=', status);
    const logs = await query.execute();
    return reply.send({ statusCode: 200, data: logs });
  });
}
