/**
 * AI Chat Concierge API Routes
 *
 * Provides endpoints for the floating chat widget:
 * - POST /api/chat/sessions — create/resume session
 * - POST /api/chat/messages — send message and get AI response
 * - GET /api/chat/sessions/:id/messages — get message history
 * - POST /api/chat/sessions/:id/rate — rate conversation
 * - POST /api/chat/sessions/:id/escalate — request human support
 * - GET /api/chat/feedback — list public feature requests (voting board)
 * - POST /api/chat/feedback/:id/vote — vote on feature request
 *
 * Implements Requirement 49.
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type { Kysely } from 'kysely';
import { sql } from 'kysely';
import type { Database } from '../db/types.js';
import { getChatConciergeService, type ChatMessage, type ChatContext } from '../services/chat-concierge.js';

interface ChatRoutesOptions {
  db: Kysely<Database>;
}

export async function registerChatConciergeRoutes(
  app: FastifyInstance,
  options: ChatRoutesOptions,
): Promise<void> {
  const { db } = options;
  const concierge = getChatConciergeService();

  // ─── Rate Limiting (per IP for anonymous, per user for authenticated) ────

  const MESSAGE_LIMITS: Record<string, number> = {
    anonymous: 5,
    free: 10,
    pro: 50,
    premium: 999,
  };

  // ─── POST /api/chat/sessions — Create or resume a chat session ───────────

  app.post(
    '/api/chat/sessions',
    async (request: FastifyRequest<{
      Body: { session_token?: string; source?: string; page_url?: string };
    }>, reply: FastifyReply) => {
      const userId = (request as any).user?.userId ?? null;
      const { session_token, source, page_url } = request.body ?? {};

      // Try to resume existing session (within last 30 minutes)
      if (session_token) {
        const existing = await db
          .selectFrom('ai_chat_sessions')
          .selectAll()
          .where('session_token', '=', session_token)
          .where('ended_at', 'is', null)
          .where('started_at', '>', sql`NOW() - INTERVAL '30 minutes'`)
          .executeTakeFirst();

        if (existing) {
          return reply.send({ session: existing });
        }
      }

      // Create new session
      const token = session_token ?? generateToken();
      const session = await db
        .insertInto('ai_chat_sessions')
        .values({
          user_id: userId,
          session_token: token,
          source: source ?? (userId ? 'in_app' : 'landing_page'),
          page_url: page_url ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return reply.status(201).send({ session });
    },
  );

  // ─── POST /api/chat/messages — Send a message and get AI response ────────

  app.post(
    '/api/chat/messages',
    async (request: FastifyRequest<{
      Body: {
        session_id: string;
        content: string;
        page_url?: string;
        browser_info?: string;
      };
    }>, reply: FastifyReply) => {
      const { session_id, content, page_url, browser_info } = request.body;

      if (!session_id || !content?.trim()) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'session_id and content are required',
        });
      }

      if (content.length > 2000) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Message too long (max 2000 characters)',
        });
      }

      // Verify session exists
      const session = await db
        .selectFrom('ai_chat_sessions')
        .selectAll()
        .where('id', '=', session_id)
        .executeTakeFirst();

      if (!session) {
        return reply.status(404).send({ statusCode: 404, error: 'Session not found' });
      }

      // Check rate limit
      const userId = (request as any).user?.userId ?? null;
      const userPlan = userId ? await getUserPlan(db, userId) : 'anonymous';
      const limit = MESSAGE_LIMITS[userPlan] ?? MESSAGE_LIMITS.free;
      const todayCount = await getTodayMessageCount(db, session_id, userId, session.session_token);

      if (todayCount >= limit) {
        return reply.status(429).send({
          statusCode: 429,
          error: 'Daily message limit reached',
          limit,
          plan: userPlan,
          upgrade: userPlan !== 'premium',
        });
      }

      // Save user message
      await db
        .insertInto('ai_chat_messages')
        .values({
          session_id,
          role: 'user',
          content: content.trim(),
          intent_detected: null,
        })
        .execute();

      // Get conversation history
      const history = await db
        .selectFrom('ai_chat_messages')
        .select(['role', 'content'])
        .where('session_id', '=', session_id)
        .orderBy('created_at', 'asc')
        .execute();

      // Build context
      const context: ChatContext = {
        userId: userId ?? undefined,
        userName: userId ? await getUserName(db, userId) : undefined,
        userPlan,
        tripCount: userId ? await getUserTripCount(db, userId) : undefined,
        pageUrl: page_url ?? session.page_url ?? undefined,
        browserInfo: browser_info ?? undefined,
        isAnonymous: !userId,
      };

      // Generate AI response
      const aiResponse = await concierge.generateResponse(
        content.trim(),
        history as ChatMessage[],
        context,
      );

      // Save AI response
      await db
        .insertInto('ai_chat_messages')
        .values({
          session_id,
          role: 'assistant',
          content: aiResponse.content,
          ai_model: aiResponse.model,
          intent_detected: aiResponse.intent,
        })
        .execute();

      // Update session message count
      await db
        .updateTable('ai_chat_sessions')
        .set({ message_count: sql`message_count + 2` })
        .where('id', '=', session_id)
        .execute();

      // Auto-create feedback item if applicable
      let feedbackItem = null;
      if (aiResponse.shouldCreateFeedback && aiResponse.feedbackType) {
        feedbackItem = await db
          .insertInto('feedback_items')
          .values({
            chat_session_id: session_id,
            user_id: userId,
            type: aiResponse.feedbackType,
            title: content.trim().slice(0, 300),
            description: content.trim(),
            severity: aiResponse.feedbackSeverity ?? null,
            page_url: page_url ?? session.page_url ?? null,
            browser_info: browser_info ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return reply.send({
        message: {
          role: 'assistant',
          content: aiResponse.content,
          intent: aiResponse.intent,
        },
        shouldCaptureLead: aiResponse.shouldCaptureLead,
        feedbackCaptured: feedbackItem ? { id: feedbackItem.id, type: feedbackItem.type } : null,
      });
    },
  );

  // ─── GET /api/chat/sessions/:id/messages — Get message history ───────────

  app.get(
    '/api/chat/sessions/:id/messages',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      const messages = await db
        .selectFrom('ai_chat_messages')
        .select(['id', 'role', 'content', 'intent_detected', 'created_at'])
        .where('session_id', '=', id)
        .orderBy('created_at', 'asc')
        .execute();

      return reply.send({ messages });
    },
  );

  // ─── POST /api/chat/sessions/:id/rate — Rate satisfaction ────────────────

  app.post(
    '/api/chat/sessions/:id/rate',
    async (request: FastifyRequest<{
      Params: { id: string };
      Body: { rating: number };
    }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { rating } = request.body;

      if (!rating || rating < 1 || rating > 5) {
        return reply.status(400).send({ statusCode: 400, error: 'Rating must be 1-5' });
      }

      await db
        .updateTable('ai_chat_sessions')
        .set({ satisfaction_rating: rating })
        .where('id', '=', id)
        .execute();

      return reply.send({ success: true });
    },
  );

  // ─── POST /api/chat/sessions/:id/escalate — Escalate to human ───────────

  app.post(
    '/api/chat/sessions/:id/escalate',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      await db
        .updateTable('ai_chat_sessions')
        .set({ escalated: true })
        .where('id', '=', id)
        .execute();

      // Add system message
      await db
        .insertInto('ai_chat_messages')
        .values({
          session_id: id,
          role: 'system',
          content: 'Conversation escalated to human support. The team will review this conversation.',
        })
        .execute();

      return reply.send({
        success: true,
        message: 'Your conversation has been flagged for human review. You can also email support@neyya.ai directly.',
      });
    },
  );

  // ─── POST /api/chat/sessions/:id/end — End session ──────────────────────

  app.post(
    '/api/chat/sessions/:id/end',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const { id } = request.params;

      // Classify the session
      const messages = await db
        .selectFrom('ai_chat_messages')
        .select(['role', 'content'])
        .where('session_id', '=', id)
        .orderBy('created_at', 'asc')
        .execute();

      const { classification } = await concierge.classifySession(messages as ChatMessage[]);

      await db
        .updateTable('ai_chat_sessions')
        .set({
          ended_at: new Date(),
          ai_classification: classification,
        })
        .where('id', '=', id)
        .execute();

      return reply.send({ success: true, classification });
    },
  );

  // ─── GET /api/chat/feedback — Public feature request voting board ────────

  app.get(
    '/api/chat/feedback',
    async (request: FastifyRequest<{
      Querystring: { type?: string; status?: string; limit?: string; offset?: string };
    }>, reply: FastifyReply) => {
      let query = db
        .selectFrom('feedback_items')
        .selectAll()
        .where('is_public', '=', true);

      const { type, status, limit, offset } = request.query;

      if (type) query = query.where('type', '=', type);
      if (status) query = query.where('status', '=', status);

      const items = await query
        .orderBy('upvotes', 'desc')
        .orderBy('created_at', 'desc')
        .limit(Number(limit) || 20)
        .offset(Number(offset) || 0)
        .execute();

      return reply.send({ data: items });
    },
  );

  // ─── POST /api/chat/feedback/:id/vote — Vote on feature request ─────────

  app.post(
    '/api/chat/feedback/:id/vote',
    { preHandler: [(app as any).requireAuth] },
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (request as any).user!.userId;
      const { id } = request.params;

      // Check item exists and is public
      const item = await db
        .selectFrom('feedback_items')
        .select(['id', 'is_public'])
        .where('id', '=', id)
        .executeTakeFirst();

      if (!item || !item.is_public) {
        return reply.status(404).send({ statusCode: 404, error: 'Item not found or not public' });
      }

      // Toggle vote (add or remove)
      const existingVote = await db
        .selectFrom('feedback_votes')
        .select('id')
        .where('feedback_item_id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (existingVote) {
        // Remove vote
        await db.deleteFrom('feedback_votes').where('id', '=', existingVote.id).execute();
        await db
          .updateTable('feedback_items')
          .set({ upvotes: sql`GREATEST(upvotes - 1, 0)` })
          .where('id', '=', id)
          .execute();
        return reply.send({ voted: false });
      } else {
        // Add vote
        await db
          .insertInto('feedback_votes')
          .values({ feedback_item_id: id, user_id: userId })
          .execute();
        await db
          .updateTable('feedback_items')
          .set({ upvotes: sql`upvotes + 1` })
          .where('id', '=', id)
          .execute();
        return reply.send({ voted: true });
      }
    },
  );

  // ─── Admin: GET /api/admin/chat/sessions — List all sessions ─────────────

  app.get(
    '/api/admin/chat/sessions',
    async (request: FastifyRequest<{
      Querystring: { classification?: string; escalated?: string; limit?: string; offset?: string };
    }>, reply: FastifyReply) => {
      let query = db
        .selectFrom('ai_chat_sessions')
        .leftJoin('users', 'users.id', 'ai_chat_sessions.user_id')
        .select([
          'ai_chat_sessions.id',
          'ai_chat_sessions.user_id',
          'users.email as user_email',
          'users.display_name as user_name',
          'ai_chat_sessions.session_token',
          'ai_chat_sessions.source',
          'ai_chat_sessions.page_url',
          'ai_chat_sessions.started_at',
          'ai_chat_sessions.ended_at',
          'ai_chat_sessions.message_count',
          'ai_chat_sessions.ai_classification',
          'ai_chat_sessions.satisfaction_rating',
          'ai_chat_sessions.escalated',
          'ai_chat_sessions.resolved',
        ]);

      const { classification, escalated, limit, offset } = request.query;

      if (classification) {
        query = query.where('ai_chat_sessions.ai_classification', '=', classification);
      }
      if (escalated === 'true') {
        query = query.where('ai_chat_sessions.escalated', '=', true);
      }

      const sessions = await query
        .orderBy('ai_chat_sessions.started_at', 'desc')
        .limit(Number(limit) || 20)
        .offset(Number(offset) || 0)
        .execute();

      return reply.send({ data: sessions });
    },
  );

  // ─── Admin: GET /api/admin/chat/feedback — List all feedback items ───────

  app.get(
    '/api/admin/chat/feedback',
    async (request: FastifyRequest<{
      Querystring: { type?: string; status?: string; limit?: string; offset?: string };
    }>, reply: FastifyReply) => {
      let query = db
        .selectFrom('feedback_items')
        .leftJoin('users', 'users.id', 'feedback_items.user_id')
        .select([
          'feedback_items.id',
          'feedback_items.type',
          'feedback_items.title',
          'feedback_items.description',
          'feedback_items.severity',
          'feedback_items.status',
          'feedback_items.upvotes',
          'feedback_items.is_public',
          'feedback_items.page_url',
          'feedback_items.admin_notes',
          'feedback_items.created_at',
          'users.email as user_email',
          'users.display_name as user_name',
        ]);

      const { type, status, limit, offset } = request.query;

      if (type) query = query.where('feedback_items.type', '=', type);
      if (status) query = query.where('feedback_items.status', '=', status);

      const items = await query
        .orderBy('feedback_items.created_at', 'desc')
        .limit(Number(limit) || 20)
        .offset(Number(offset) || 0)
        .execute();

      return reply.send({ data: items });
    },
  );

  // ─── Admin: PUT /api/admin/chat/feedback/:id — Update feedback item ──────

  app.put(
    '/api/admin/chat/feedback/:id',
    async (request: FastifyRequest<{
      Params: { id: string };
      Body: { status?: string; is_public?: boolean; admin_notes?: string };
    }>, reply: FastifyReply) => {
      const { id } = request.params;
      const { status, is_public, admin_notes } = request.body;

      const updateFields: Record<string, unknown> = { updated_at: new Date() };
      if (status !== undefined) updateFields.status = status;
      if (is_public !== undefined) updateFields.is_public = is_public;
      if (admin_notes !== undefined) updateFields.admin_notes = admin_notes;

      const updated = await db
        .updateTable('feedback_items')
        .set(updateFields)
        .where('id', '=', id)
        .returningAll()
        .executeTakeFirst();

      if (!updated) {
        return reply.status(404).send({ statusCode: 404, error: 'Item not found' });
      }

      return reply.send({ data: updated });
    },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateToken(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = 'chat_';
  for (let i = 0; i < 32; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

async function getUserPlan(db: Kysely<Database>, userId: string): Promise<string> {
  try {
    const sub = await db
      .selectFrom('user_subscriptions' as any)
      .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
      .select(['subscription_plans.slug as plan_slug'])
      .where('user_subscriptions.user_id', '=', userId)
      .where('user_subscriptions.status', 'in', ['active', 'trialing'])
      .executeTakeFirst() as any;
    return sub?.plan_slug ?? 'free';
  } catch {
    return 'free';
  }
}

async function getUserName(db: Kysely<Database>, userId: string): Promise<string | undefined> {
  const user = await db
    .selectFrom('users')
    .select('display_name')
    .where('id', '=', userId)
    .executeTakeFirst();
  return user?.display_name ?? undefined;
}

async function getUserTripCount(db: Kysely<Database>, userId: string): Promise<number> {
  const result = await db
    .selectFrom('trips')
    .select(sql`COUNT(*)`.as('count'))
    .where('owner_id', '=', userId)
    .executeTakeFirst() as any;
  return Number(result?.count ?? 0);
}

async function getTodayMessageCount(
  db: Kysely<Database>,
  sessionId: string,
  userId: string | null,
  sessionToken: string | null,
): Promise<number> {
  // Count user messages today (across all sessions for this user/token)
  let query = db
    .selectFrom('ai_chat_messages')
    .innerJoin('ai_chat_sessions', 'ai_chat_sessions.id', 'ai_chat_messages.session_id')
    .select(sql`COUNT(*)`.as('count'))
    .where('ai_chat_messages.role', '=', 'user')
    .where('ai_chat_messages.created_at', '>', sql`NOW() - INTERVAL '24 hours'`);

  if (userId) {
    query = query.where('ai_chat_sessions.user_id', '=', userId);
  } else if (sessionToken) {
    query = query.where('ai_chat_sessions.session_token', '=', sessionToken);
  } else {
    query = query.where('ai_chat_sessions.id', '=', sessionId);
  }

  const result = await query.executeTakeFirst() as any;
  return Number(result?.count ?? 0);
}
