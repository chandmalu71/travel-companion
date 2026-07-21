/**
 * Messaging & Communications Routes
 *
 * Full messaging system with DM, group, family, trip chat, and broadcast.
 * Supports threaded replies, emoji reactions, polls, and trip decisions.
 *
 * Endpoints:
 *  - GET    /api/conversations                    — list user's conversations
 *  - POST   /api/conversations                    — create conversation (DM/group/family)
 *  - GET    /api/conversations/:id/messages       — get messages (with threads)
 *  - POST   /api/conversations/:id/messages       — send a message
 *  - PUT    /api/messages/:id                     — edit/delete message
 *  - POST   /api/messages/:id/reactions           — add reaction
 *  - DELETE /api/messages/:id/reactions/:emoji     — remove reaction
 *  - POST   /api/conversations/:id/polls          — create a poll
 *  - POST   /api/polls/:id/vote                   — vote on a poll
 *  - GET    /api/trips/:tripId/decisions          — get trip decisions
 *  - POST   /api/trips/:tripId/decisions          — promote message to decision
 *  - PUT    /api/trips/:tripId/decisions/:id      — update decision status/vote
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { randomUUID } from 'node:crypto';

interface MessagingOptions {
  db: Kysely<Database>;
}

export async function registerMessagingRoutes(
  app: FastifyInstance,
  options: MessagingOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/conversations ────────────────────────────────────────────────
  app.get('/api/conversations', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const conversations = await db
      .selectFrom('conversation_participants')
      .innerJoin('conversations', 'conversations.id', 'conversation_participants.conversation_id')
      .select([
        'conversations.id', 'conversations.type', 'conversations.name',
        'conversations.trip_id', 'conversations.last_message_at',
        'conversations.last_message_preview', 'conversations.is_archived',
        'conversations.created_at',
        'conversation_participants.last_read_at',
        'conversation_participants.is_muted',
      ])
      .where('conversation_participants.user_id', '=', userId)
      .where('conversations.is_archived', '=', false)
      .orderBy('conversations.last_message_at', 'desc')
      .limit(50)
      .execute();

    // Get participant counts and names for each conversation
    const data = await Promise.all(conversations.map(async (conv) => {
      const participants = await db
        .selectFrom('conversation_participants')
        .innerJoin('users', 'users.id', 'conversation_participants.user_id')
        .select(['users.display_name', 'users.id as user_id'])
        .where('conversation_participants.conversation_id', '=', conv.id)
        .execute();

      const hasUnread = conv.last_message_at && (!conv.last_read_at || new Date(conv.last_message_at) > new Date(conv.last_read_at));

      return {
        id: conv.id,
        type: conv.type,
        name: conv.name ?? participants.filter(p => p.user_id !== userId).map(p => p.display_name).join(', ') ?? 'Chat',
        tripId: conv.trip_id,
        participantCount: participants.length,
        participants: participants.map(p => ({ id: p.user_id, name: p.display_name })),
        lastMessageAt: conv.last_message_at,
        lastMessagePreview: conv.last_message_preview,
        hasUnread,
        isMuted: conv.is_muted,
      };
    }));

    return reply.send({ statusCode: 200, data });
  });

  // ─── POST /api/conversations ───────────────────────────────────────────────
  app.post('/api/conversations', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { type, name, participantIds, tripId } = request.body as any;

    if (!type || !['dm', 'group', 'family', 'trip', 'broadcast'].includes(type)) {
      return reply.status(400).send({ statusCode: 400, error: 'Invalid conversation type' });
    }

    // For DM, check if conversation already exists between these two users
    if (type === 'dm' && participantIds?.length === 1) {
      const existingDm = await db
        .selectFrom('conversations')
        .innerJoin('conversation_participants as cp1', 'cp1.conversation_id', 'conversations.id')
        .innerJoin('conversation_participants as cp2', 'cp2.conversation_id', 'conversations.id')
        .select('conversations.id')
        .where('conversations.type', '=', 'dm')
        .where('cp1.user_id', '=', userId)
        .where('cp2.user_id', '=', participantIds[0])
        .executeTakeFirst();

      if (existingDm) {
        return reply.send({ statusCode: 200, data: { id: existingDm.id, existing: true } });
      }
    }

    // Create conversation
    const conv = await db.insertInto('conversations').values({
      type,
      name: name ?? null,
      trip_id: tripId ?? null,
      created_by: userId,
    }).returningAll().executeTakeFirstOrThrow();

    // Add creator as participant (owner)
    await db.insertInto('conversation_participants').values({
      conversation_id: conv.id, user_id: userId, role: 'owner',
    }).execute();

    // Add other participants
    if (participantIds?.length > 0) {
      for (const pid of participantIds) {
        await db.insertInto('conversation_participants').values({
          conversation_id: conv.id, user_id: pid, role: 'member',
        }).onConflict(oc => oc.columns(['conversation_id', 'user_id']).doNothing()).execute();
      }
    }

    return reply.status(201).send({ statusCode: 201, data: { id: conv.id, type: conv.type, name: conv.name } });
  });

  // ─── GET /api/conversations/:id/messages ───────────────────────────────────
  app.get('/api/conversations/:id/messages', async (request: FastifyRequest<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const limit = parseInt((request.query as any).limit ?? '50', 10);

    // Verify participant
    const participant = await db.selectFrom('conversation_participants')
      .select('id').where('conversation_id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    if (!participant) return reply.status(403).send({ statusCode: 403, error: 'Not a participant' });

    // Get messages (top-level only, threads loaded separately)
    const messages = await db
      .selectFrom('messages')
      .leftJoin('users', 'users.id', 'messages.sender_id')
      .select([
        'messages.id', 'messages.sender_id', 'messages.content',
        'messages.content_type', 'messages.metadata', 'messages.parent_message_id',
        'messages.is_edited', 'messages.is_deleted', 'messages.ai_model',
        'messages.created_at', 'messages.updated_at',
        'users.display_name as sender_name',
      ])
      .where('messages.conversation_id', '=', id)
      .where('messages.parent_message_id', 'is', null) // top-level only
      .where('messages.is_deleted', '=', false)
      .orderBy('messages.created_at', 'desc')
      .limit(limit)
      .execute();

    // Get thread counts and reactions for each message
    const data = await Promise.all(messages.reverse().map(async (msg) => {
      const threadCount = await db.selectFrom('messages')
        .select(db.fn.count<number>('id').as('count'))
        .where('parent_message_id', '=', msg.id).where('is_deleted', '=', false)
        .executeTakeFirst();

      const reactions = await db.selectFrom('message_reactions')
        .select(['emoji', db.fn.count<number>('id').as('count')])
        .where('message_id', '=', msg.id)
        .groupBy('emoji')
        .execute();

      return {
        id: msg.id,
        senderId: msg.sender_id,
        senderName: msg.sender_name,
        content: msg.content,
        contentType: msg.content_type,
        metadata: msg.metadata,
        isEdited: msg.is_edited,
        aiModel: msg.ai_model,
        threadCount: threadCount?.count ?? 0,
        reactions: reactions.map(r => ({ emoji: r.emoji, count: r.count })),
        createdAt: msg.created_at,
      };
    }));

    // Mark as read
    await db.updateTable('conversation_participants')
      .set({ last_read_at: new Date() })
      .where('conversation_id', '=', id).where('user_id', '=', userId).execute();

    return reply.send({ statusCode: 200, data });
  });

  // ─── GET /api/messages/:id/thread ──────────────────────────────────────────
  app.get('/api/messages/:id/thread', async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;

    const replies = await db
      .selectFrom('messages')
      .leftJoin('users', 'users.id', 'messages.sender_id')
      .select([
        'messages.id', 'messages.sender_id', 'messages.content',
        'messages.content_type', 'messages.is_edited', 'messages.created_at',
        'users.display_name as sender_name',
      ])
      .where('messages.parent_message_id', '=', id)
      .where('messages.is_deleted', '=', false)
      .orderBy('messages.created_at', 'asc')
      .execute();

    return reply.send({ statusCode: 200, data: replies.map(r => ({
      id: r.id, senderId: r.sender_id, senderName: r.sender_name,
      content: r.content, contentType: r.content_type, isEdited: r.is_edited, createdAt: r.created_at,
    }))});
  });

  // ─── POST /api/conversations/:id/messages ──────────────────────────────────
  app.post('/api/conversations/:id/messages', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { content, contentType, parentMessageId, metadata } = request.body as any;

    if (!content || content.length > 5000) {
      return reply.status(400).send({ statusCode: 400, error: 'Content required (max 5000 chars)' });
    }

    // Verify participant
    const participant = await db.selectFrom('conversation_participants')
      .select('id').where('conversation_id', '=', id).where('user_id', '=', userId).executeTakeFirst();
    if (!participant) return reply.status(403).send({ statusCode: 403, error: 'Not a participant' });

    // Handle @AI mentions
    let aiResponse: string | null = null;
    if (content.includes('@AI') || content.includes('@ai')) {
      const conv = await db.selectFrom('conversations').select(['trip_id', 'name']).where('id', '=', id).executeTakeFirst();
      aiResponse = generateAiChatResponse(content.replace(/@[Aa][Ii]\s*/g, ''), conv?.name ?? 'your trip');
    }

    // Insert message
    const msg = await db.insertInto('messages').values({
      conversation_id: id,
      sender_id: userId,
      content,
      content_type: contentType ?? 'text',
      parent_message_id: parentMessageId ?? null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    }).returningAll().executeTakeFirstOrThrow();

    // Update conversation last_message
    await db.updateTable('conversations').set({
      last_message_at: new Date(),
      last_message_preview: content.slice(0, 200),
      updated_at: new Date(),
    }).where('id', '=', id).execute();

    // If @AI was mentioned, insert AI response
    if (aiResponse) {
      await db.insertInto('messages').values({
        conversation_id: id,
        sender_id: userId, // AI messages attributed to sender but marked as ai_response
        content: aiResponse,
        content_type: 'ai_response',
        parent_message_id: msg.id, // threaded under the original
        ai_model: 'mock-dev (production: bedrock)',
      }).execute();
    }

    // Get sender name for response
    const sender = await db.selectFrom('users').select('display_name').where('id', '=', userId).executeTakeFirst();

    return reply.status(201).send({
      statusCode: 201,
      data: {
        id: msg.id,
        senderId: userId,
        senderName: sender?.display_name,
        content: msg.content,
        contentType: msg.content_type,
        createdAt: msg.created_at,
        aiResponse: aiResponse ? { content: aiResponse, model: 'mock-dev' } : undefined,
      },
    });
  });

  // ─── PUT /api/messages/:id ─────────────────────────────────────────────────
  app.put('/api/messages/:id', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { content, isDeleted } = request.body as any;

    const msg = await db.selectFrom('messages').select(['sender_id']).where('id', '=', id).executeTakeFirst();
    if (!msg || msg.sender_id !== userId) return reply.status(403).send({ statusCode: 403, error: 'Can only edit your own messages' });

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (content) { updates.content = content; updates.is_edited = true; }
    if (isDeleted) { updates.is_deleted = true; }

    await db.updateTable('messages').set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: isDeleted ? 'Message deleted' : 'Message updated' });
  });

  // ─── POST /api/messages/:id/reactions ──────────────────────────────────────
  app.post('/api/messages/:id/reactions', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { emoji } = request.body as any;
    if (!emoji) return reply.status(400).send({ statusCode: 400, error: 'Emoji required' });

    await db.insertInto('message_reactions').values({ message_id: id, user_id: userId, emoji })
      .onConflict(oc => oc.columns(['message_id', 'user_id', 'emoji']).doNothing()).execute();

    return reply.status(201).send({ statusCode: 201, message: 'Reaction added' });
  });

  // ─── DELETE /api/messages/:id/reactions/:emoji ──────────────────────────────
  app.delete('/api/messages/:id/reactions/:emoji', async (request: FastifyRequest<{ Params: { id: string; emoji: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id, emoji } = request.params;
    await db.deleteFrom('message_reactions').where('message_id', '=', id).where('user_id', '=', userId).where('emoji', '=', emoji).execute();
    return reply.send({ statusCode: 200, message: 'Reaction removed' });
  });

  // ─── POST /api/conversations/:id/polls ─────────────────────────────────────
  app.post('/api/conversations/:id/polls', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { question, options, isMultipleChoice, closesAt } = request.body as any;

    if (!question || !options || options.length < 2) {
      return reply.status(400).send({ statusCode: 400, error: 'Question and at least 2 options required' });
    }

    const pollOptions = options.map((text: string) => ({ id: randomUUID(), text }));

    // Create poll message
    const msg = await db.insertInto('messages').values({
      conversation_id: id, sender_id: userId, content: `📊 Poll: ${question}`, content_type: 'poll',
    }).returningAll().executeTakeFirstOrThrow();

    // Create poll
    const poll = await db.insertInto('polls').values({
      message_id: msg.id, question, options: JSON.stringify(pollOptions),
      is_multiple_choice: isMultipleChoice ?? false, closes_at: closesAt ?? null,
    }).returningAll().executeTakeFirstOrThrow();

    await db.updateTable('conversations').set({ last_message_at: new Date(), last_message_preview: `📊 Poll: ${question}` }).where('id', '=', id).execute();

    return reply.status(201).send({ statusCode: 201, data: { messageId: msg.id, pollId: poll.id, question, options: pollOptions } });
  });

  // ─── POST /api/polls/:id/vote ──────────────────────────────────────────────
  app.post('/api/polls/:id/vote', async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { optionId } = request.body as any;
    if (!optionId) return reply.status(400).send({ statusCode: 400, error: 'optionId required' });

    await db.insertInto('poll_votes').values({ poll_id: id, user_id: userId, option_id: optionId })
      .onConflict(oc => oc.columns(['poll_id', 'user_id', 'option_id']).doNothing()).execute();

    // Get updated vote counts
    const votes = await db.selectFrom('poll_votes').select(['option_id', db.fn.count<number>('id').as('count')])
      .where('poll_id', '=', id).groupBy('option_id').execute();

    return reply.send({ statusCode: 200, data: { votes: votes.map(v => ({ optionId: v.option_id, count: v.count })) } });
  });

  // ─── GET /api/trips/:tripId/decisions ──────────────────────────────────────
  app.get('/api/trips/:tripId/decisions', async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { tripId } = request.params;

    const decisions = await db
      .selectFrom('trip_decisions')
      .leftJoin('users', 'users.id', 'trip_decisions.proposed_by')
      .select([
        'trip_decisions.id', 'trip_decisions.title', 'trip_decisions.description',
        'trip_decisions.status', 'trip_decisions.promoted_to', 'trip_decisions.votes_for',
        'trip_decisions.votes_against', 'trip_decisions.created_at',
        'users.display_name as proposed_by_name',
      ])
      .where('trip_decisions.trip_id', '=', tripId)
      .orderBy('trip_decisions.created_at', 'desc')
      .execute();

    return reply.send({ statusCode: 200, data: decisions });
  });

  // ─── POST /api/trips/:tripId/decisions ─────────────────────────────────────
  app.post('/api/trips/:tripId/decisions', async (request: FastifyRequest<{ Params: { tripId: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { tripId } = request.params;
    const { title, description, sourceMessageId } = request.body as any;

    if (!title) return reply.status(400).send({ statusCode: 400, error: 'Title required' });

    const decision = await db.insertInto('trip_decisions').values({
      trip_id: tripId, proposed_by: userId, title,
      description: description ?? null, source_message_id: sourceMessageId ?? null,
    }).returningAll().executeTakeFirstOrThrow();

    return reply.status(201).send({ statusCode: 201, data: decision });
  });

  // ─── PUT /api/trips/:tripId/decisions/:id ──────────────────────────────────
  app.put('/api/trips/:tripId/decisions/:id', async (request: FastifyRequest<{ Params: { tripId: string; id: string }; Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

    const { id } = request.params;
    const { status, voteFor, voteAgainst, promotedTo } = request.body as any;

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (status) updates.status = status;
    if (voteFor) updates.votes_for = sql`votes_for + 1`;
    if (voteAgainst) updates.votes_against = sql`votes_against + 1`;
    if (promotedTo) { updates.promoted_to = promotedTo; updates.status = 'promoted'; }

    await db.updateTable('trip_decisions').set(updates).where('id', '=', id).execute();
    return reply.send({ statusCode: 200, message: 'Decision updated' });
  });
}

// ─── AI Chat Response (for @AI mentions) ─────────────────────────────────────

function generateAiChatResponse(question: string, context: string): string {
  const lower = question.toLowerCase();

  if (lower.includes('restaurant') || lower.includes('food') || lower.includes('eat')) {
    return `🤖 Based on your trip to **${context}**, here are some restaurant suggestions:\n\n1. 🍽️ Try local cuisine at highly-rated spots near your hotel\n2. 🍽️ Book popular restaurants 1-2 weeks ahead\n3. 🍽️ Lunch menus are usually 30-40% cheaper than dinner\n\n_Mark this as a Trip Decision if the group agrees!_`;
  }
  if (lower.includes('activit') || lower.includes('do') || lower.includes('visit')) {
    return `🤖 Here are top activities for **${context}**:\n\n1. 🎯 Visit the main historical attractions (book online for skip-the-line)\n2. 🎯 Take a guided walking tour on Day 1\n3. 🎯 Reserve a day trip for nearby highlights\n\n_Vote on which activities the group wants to do!_`;
  }
  if (lower.includes('hotel') || lower.includes('stay') || lower.includes('accommodation')) {
    return `🤖 For accommodation in **${context}**:\n\n- Central location saves transport time and money\n- Book with free cancellation for flexibility\n- Check reviews from the last 3 months\n\n_Create a poll to vote on which hotel the group prefers!_`;
  }

  return `🤖 Great question about **${context}**! Here's my suggestion:\n\nI'd recommend researching this together as a group. You can:\n- 📊 Create a **poll** to vote on options\n- ✅ Mark the best answer as a **Trip Decision**\n- ⭐ Save it to your trip **Favorites**\n\n_Everyone in this chat can vote and contribute!_`;
}

// Need sql import for raw SQL in vote increment
import { sql } from 'kysely';
