import { type Kysely, sql } from 'kysely';

/**
 * Migration 018: Messaging & Communications
 *
 * Full messaging system with:
 * - Conversations (DM, group, family, trip, broadcast)
 * - Messages with threading support
 * - Emoji reactions + formal polls
 * - Trip Decisions (promoted from chat)
 * - Real-time delivery via WebSocket (Socket.io)
 */
export async function up(db: Kysely<any>): Promise<void> {
  // ─── Conversations ─────────────────────────────────────────────────────────
  await db.schema
    .createTable('conversations')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('type', 'varchar(20)', (col) => col.notNull())
    // types: 'dm', 'group', 'family', 'trip', 'broadcast'
    .addColumn('name', 'varchar(200)') // null for DM, set for groups
    .addColumn('trip_id', 'uuid', (col) => col.references('trips.id').onDelete('cascade'))
    .addColumn('created_by', 'uuid', (col) => col.notNull())
    .addColumn('last_message_at', 'timestamptz')
    .addColumn('last_message_preview', 'varchar(200)')
    .addColumn('is_archived', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_conversations_trip').on('conversations').column('trip_id').execute();
  await db.schema.createIndex('idx_conversations_type').on('conversations').column('type').execute();

  // ─── Conversation Participants ─────────────────────────────────────────────
  await db.schema
    .createTable('conversation_participants')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('conversation_id', 'uuid', (col) => col.notNull().references('conversations.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('role', 'varchar(20)', (col) => col.defaultTo('member'))
    // roles: 'owner', 'co-owner', 'member'
    .addColumn('last_read_at', 'timestamptz')
    .addColumn('is_muted', 'boolean', (col) => col.defaultTo(false))
    .addColumn('joined_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_conv_participants_conv').on('conversation_participants').column('conversation_id').execute();
  await db.schema.createIndex('idx_conv_participants_user').on('conversation_participants').column('user_id').execute();
  await db.schema.createIndex('idx_conv_participants_pair').on('conversation_participants').columns(['conversation_id', 'user_id']).unique().execute();

  // ─── Messages ──────────────────────────────────────────────────────────────
  await db.schema
    .createTable('messages')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('conversation_id', 'uuid', (col) => col.notNull().references('conversations.id').onDelete('cascade'))
    .addColumn('sender_id', 'uuid', (col) => col.notNull())
    .addColumn('parent_message_id', 'uuid') // null = top-level, set = threaded reply
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('content_type', 'varchar(20)', (col) => col.defaultTo('text'))
    // content_types: 'text', 'image', 'link', 'ai_response', 'broadcast', 'poll', 'system'
    .addColumn('metadata', 'jsonb') // for links (unfurl data), images (url, size), AI context
    .addColumn('is_edited', 'boolean', (col) => col.defaultTo(false))
    .addColumn('is_deleted', 'boolean', (col) => col.defaultTo(false))
    .addColumn('ai_model', 'varchar(100)') // set if this is an AI response
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_messages_conv').on('messages').columns(['conversation_id', 'created_at']).execute();
  await db.schema.createIndex('idx_messages_thread').on('messages').column('parent_message_id').execute();
  await db.schema.createIndex('idx_messages_sender').on('messages').column('sender_id').execute();

  // ─── Message Reactions ─────────────────────────────────────────────────────
  await db.schema
    .createTable('message_reactions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('message_id', 'uuid', (col) => col.notNull().references('messages.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('emoji', 'varchar(10)', (col) => col.notNull()) // 👍❤️😂🎉👎 etc.
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_reactions_message').on('message_reactions').column('message_id').execute();
  await db.schema.createIndex('idx_reactions_unique').on('message_reactions').columns(['message_id', 'user_id', 'emoji']).unique().execute();

  // ─── Polls ─────────────────────────────────────────────────────────────────
  await db.schema
    .createTable('polls')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('message_id', 'uuid', (col) => col.notNull().references('messages.id').onDelete('cascade'))
    .addColumn('question', 'varchar(500)', (col) => col.notNull())
    .addColumn('options', 'jsonb', (col) => col.notNull()) // [{ id, text }]
    .addColumn('is_multiple_choice', 'boolean', (col) => col.defaultTo(false))
    .addColumn('is_anonymous', 'boolean', (col) => col.defaultTo(false))
    .addColumn('closes_at', 'timestamptz') // null = no deadline
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_polls_message').on('polls').column('message_id').execute();

  // ─── Poll Votes ────────────────────────────────────────────────────────────
  await db.schema
    .createTable('poll_votes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('poll_id', 'uuid', (col) => col.notNull().references('polls.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('option_id', 'varchar(50)', (col) => col.notNull()) // references options[].id in poll
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_poll_votes_poll').on('poll_votes').column('poll_id').execute();
  await db.schema.createIndex('idx_poll_votes_unique').on('poll_votes').columns(['poll_id', 'user_id', 'option_id']).unique().execute();

  // ─── Trip Decisions ────────────────────────────────────────────────────────
  await db.schema
    .createTable('trip_decisions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('proposed_by', 'uuid', (col) => col.notNull())
    .addColumn('source_message_id', 'uuid', (col) => col.references('messages.id').onDelete('set null'))
    .addColumn('title', 'varchar(300)', (col) => col.notNull())
    .addColumn('description', 'text')
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('proposed'))
    // statuses: 'proposed', 'voting', 'approved', 'rejected', 'promoted'
    .addColumn('promoted_to', 'varchar(30)') // 'tip', 'favorite', 'timeline_event'
    .addColumn('promoted_item_id', 'uuid') // ID of the promoted item
    .addColumn('votes_for', 'integer', (col) => col.defaultTo(0))
    .addColumn('votes_against', 'integer', (col) => col.defaultTo(0))
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema.createIndex('idx_trip_decisions_trip').on('trip_decisions').column('trip_id').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('trip_decisions').execute();
  await db.schema.dropTable('poll_votes').execute();
  await db.schema.dropTable('polls').execute();
  await db.schema.dropTable('message_reactions').execute();
  await db.schema.dropTable('messages').execute();
  await db.schema.dropTable('conversation_participants').execute();
  await db.schema.dropTable('conversations').execute();
}
