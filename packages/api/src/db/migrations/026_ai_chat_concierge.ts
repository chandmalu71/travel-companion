import { type Kysely, sql } from 'kysely';

/**
 * Migration 026: AI Chat Concierge
 *
 * Creates tables for the floating AI chat widget:
 * - ai_chat_sessions: conversation sessions (anonymous or authenticated)
 * - ai_chat_messages: individual messages in each session
 * - feedback_items: extracted bugs, feature requests, feedback
 * - feedback_votes: user votes on public feature requests
 */
export async function up(db: Kysely<any>): Promise<void> {
  // ─── AI Chat Sessions ──────────────────────────────────────────────────────
  await db.schema
    .createTable('ai_chat_sessions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('lead_id', 'uuid', (col) => col.references('crm_leads.id').onDelete('set null'))
    .addColumn('session_token', 'varchar(100)')
    .addColumn('source', 'varchar(20)', (col) => col.notNull().defaultTo('in_app'))
    .addColumn('page_url', 'text')
    .addColumn('started_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('ended_at', 'timestamptz')
    .addColumn('message_count', 'integer', (col) => col.defaultTo(0))
    .addColumn('ai_classification', 'varchar(50)')
    .addColumn('satisfaction_rating', 'integer')
    .addColumn('escalated', 'boolean', (col) => col.defaultTo(false))
    .addColumn('resolved', 'boolean', (col) => col.defaultTo(false))
    .execute();

  await sql`CREATE INDEX idx_ai_chat_sessions_user ON ai_chat_sessions (user_id) WHERE user_id IS NOT NULL`.execute(db);
  await sql`CREATE INDEX idx_ai_chat_sessions_token ON ai_chat_sessions (session_token) WHERE session_token IS NOT NULL`.execute(db);
  await sql`CREATE INDEX idx_ai_chat_sessions_started ON ai_chat_sessions (started_at DESC)`.execute(db);

  // ─── AI Chat Messages ──────────────────────────────────────────────────────
  await db.schema
    .createTable('ai_chat_messages')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('session_id', 'uuid', (col) =>
      col.notNull().references('ai_chat_sessions.id').onDelete('cascade'))
    .addColumn('role', 'varchar(10)', (col) => col.notNull())
    .addColumn('content', 'text', (col) => col.notNull())
    .addColumn('ai_model', 'varchar(100)')
    .addColumn('rag_sources', 'text')
    .addColumn('intent_detected', 'varchar(50)')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await sql`CREATE INDEX idx_ai_chat_messages_session ON ai_chat_messages (session_id, created_at ASC)`.execute(db);

  // ─── Feedback Items ────────────────────────────────────────────────────────
  await db.schema
    .createTable('feedback_items')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('chat_session_id', 'uuid', (col) =>
      col.references('ai_chat_sessions.id').onDelete('set null'))
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('type', 'varchar(20)', (col) => col.notNull())
    .addColumn('title', 'varchar(300)')
    .addColumn('description', 'text')
    .addColumn('severity', 'varchar(10)')
    .addColumn('page_url', 'text')
    .addColumn('browser_info', 'text')
    .addColumn('status', 'varchar(20)', (col) => col.defaultTo('new'))
    .addColumn('upvotes', 'integer', (col) => col.defaultTo(0))
    .addColumn('admin_notes', 'text')
    .addColumn('is_public', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  await sql`CREATE INDEX idx_feedback_items_type ON feedback_items (type, status)`.execute(db);
  await sql`CREATE INDEX idx_feedback_items_user ON feedback_items (user_id) WHERE user_id IS NOT NULL`.execute(db);
  await sql`CREATE INDEX idx_feedback_items_public ON feedback_items (is_public, upvotes DESC) WHERE is_public = true`.execute(db);

  // ─── Feedback Votes ────────────────────────────────────────────────────────
  await db.schema
    .createTable('feedback_votes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('feedback_item_id', 'uuid', (col) =>
      col.notNull().references('feedback_items.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addUniqueConstraint('feedback_votes_item_user_unique', ['feedback_item_id', 'user_id'])
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('feedback_votes').ifExists().execute();
  await db.schema.dropTable('feedback_items').ifExists().execute();
  await db.schema.dropTable('ai_chat_messages').ifExists().execute();
  await db.schema.dropTable('ai_chat_sessions').ifExists().execute();
}
