/**
 * Email Aliases Routes
 *
 * Allows users to add multiple email addresses to their account.
 * Forwarded booking confirmations from any verified alias are matched to the account.
 *
 * Endpoints:
 *  - GET    /api/email-aliases           — list user's aliases
 *  - POST   /api/email-aliases           — add new alias (sends verification)
 *  - POST   /api/email-aliases/verify    — verify alias with token
 *  - DELETE /api/email-aliases/:id       — remove alias
 *  - GET    /api/email-aliases/lookup    — internal: find user by email (checks aliases too)
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { randomBytes } from 'node:crypto';

const MAX_ALIASES_DEFAULT = 5;

interface EmailAliasOptions {
  db: Kysely<Database>;
}

export async function registerEmailAliasRoutes(
  app: FastifyInstance,
  options: EmailAliasOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/email-aliases ────────────────────────────────────────────────
  app.get('/api/email-aliases', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const aliases = await db
      .selectFrom('user_email_aliases' as any)
      .selectAll()
      .where('user_id', '=', userId)
      .orderBy('created_at', 'asc')
      .execute();

    return reply.send({
      statusCode: 200,
      data: (aliases as any[]).map((a: any) => ({
        id: a.id,
        email: a.email,
        isVerified: a.is_verified,
        source: a.source,
        createdAt: a.created_at,
        verifiedAt: a.verified_at,
      })),
    });
  });

  // ─── POST /api/email-aliases ───────────────────────────────────────────────
  app.post('/api/email-aliases', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { email } = request.body as any;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return reply.status(400).send({ statusCode: 400, error: 'Valid email required' });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check limit
    const count = await db
      .selectFrom('user_email_aliases' as any)
      .select(db.fn.count<number>('id').as('count'))
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if ((count as any)?.count >= MAX_ALIASES_DEFAULT) {
      return reply.status(400).send({ statusCode: 400, error: 'LIMIT_REACHED', message: `Maximum ${MAX_ALIASES_DEFAULT} email aliases allowed` });
    }

    // Check if email is already used (primary or alias)
    const existingUser = await db.selectFrom('users').select('id').where('email', '=', normalizedEmail).executeTakeFirst();
    if (existingUser) {
      return reply.status(409).send({ statusCode: 409, error: 'DUPLICATE', message: 'This email is already associated with an account' });
    }

    const existingAlias = await db.selectFrom('user_email_aliases' as any).select('id').where('email', '=', normalizedEmail).executeTakeFirst();
    if (existingAlias) {
      return reply.status(409).send({ statusCode: 409, error: 'DUPLICATE', message: 'This email is already registered as an alias' });
    }

    // Generate verification token
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    await db.insertInto('user_email_aliases' as any).values({
      user_id: userId,
      email: normalizedEmail,
      is_verified: false,
      verification_token: token,
      verification_expires_at: expiresAt,
      source: 'manual',
    } as any).execute();

    // In production: send verification email with link containing the token
    // In dev: auto-log the token
    console.log(`[DEV] Email alias verification token for ${normalizedEmail}: ${token}`);

    return reply.status(201).send({
      statusCode: 201,
      message: 'Verification email sent. Check your inbox.',
      data: { email: normalizedEmail, verificationRequired: true },
      // Dev only: include token for testing
      _devToken: token,
    });
  });

  // ─── POST /api/email-aliases/verify ────────────────────────────────────────
  app.post('/api/email-aliases/verify', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const { token } = request.body as any;
    if (!token) return reply.status(400).send({ statusCode: 400, error: 'Token required' });

    const alias = await db
      .selectFrom('user_email_aliases' as any)
      .selectAll()
      .where('verification_token', '=', token)
      .where('is_verified', '=', false)
      .executeTakeFirst();

    if (!alias) {
      return reply.status(404).send({ statusCode: 404, error: 'Invalid or expired token' });
    }

    if ((alias as any).verification_expires_at && new Date((alias as any).verification_expires_at) < new Date()) {
      return reply.status(410).send({ statusCode: 410, error: 'Token expired. Please add the email again.' });
    }

    await db.updateTable('user_email_aliases' as any)
      .set({ is_verified: true, verified_at: new Date(), verification_token: null } as any)
      .where('id', '=', (alias as any).id)
      .execute();

    return reply.send({ statusCode: 200, message: 'Email verified successfully', data: { email: (alias as any).email } });
  });

  // ─── DELETE /api/email-aliases/:id ─────────────────────────────────────────
  app.delete('/api/email-aliases/:id', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const result = await db.deleteFrom('user_email_aliases' as any)
      .where('id', '=', id)
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!result || result.numDeletedRows === 0n) {
      return reply.status(404).send({ statusCode: 404, error: 'Alias not found' });
    }

    return reply.send({ statusCode: 200, message: 'Email alias removed' });
  });

  // ─── GET /api/email-aliases/lookup?email=x ─────────────────────────────────
  // Internal endpoint: find user by primary email OR verified alias
  // Used by the booking-forward ingestion system
  app.get('/api/email-aliases/lookup', async (request: FastifyRequest<{ Querystring: { email: string } }>, reply: FastifyReply) => {
    const { email } = request.query as any;
    if (!email) return reply.status(400).send({ statusCode: 400, error: 'email query param required' });

    const normalizedEmail = email.toLowerCase().trim();

    // Check primary email
    const user = await db.selectFrom('users').select(['id', 'email', 'display_name']).where('email', '=', normalizedEmail).executeTakeFirst();
    if (user) {
      return reply.send({ statusCode: 200, data: { userId: user.id, email: user.email, name: user.display_name, matchedVia: 'primary' } });
    }

    // Check verified aliases
    const alias = await db
      .selectFrom('user_email_aliases' as any)
      .innerJoin('users', 'users.id', 'user_email_aliases.user_id' as any)
      .select(['users.id as user_id', 'users.email as primary_email', 'users.display_name'])
      .where('user_email_aliases.email' as any, '=', normalizedEmail)
      .where('user_email_aliases.is_verified' as any, '=', true)
      .executeTakeFirst();

    if (alias) {
      return reply.send({ statusCode: 200, data: { userId: (alias as any).user_id, email: (alias as any).primary_email, name: (alias as any).display_name, matchedVia: 'alias' } });
    }

    return reply.status(404).send({ statusCode: 404, error: 'No user found for this email' });
  });
}
