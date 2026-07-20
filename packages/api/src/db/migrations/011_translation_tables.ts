import { type Kysely, sql } from 'kysely';

/**
 * Migration 011: Translation Tables
 *
 * Creates translation_keys and translations tables for the i18n system.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS translation_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(200) NOT NULL UNIQUE,
    namespace VARCHAR(50) NOT NULL,
    english_text TEXT NOT NULL,
    context TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_translation_keys_namespace ON translation_keys(namespace)`.execute(db);

  await sql`CREATE TABLE IF NOT EXISTS translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL,
    text TEXT NOT NULL,
    is_auto BOOLEAN DEFAULT FALSE,
    is_reviewed BOOLEAN DEFAULT FALSE,
    last_edited_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (key_id, language_code)
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_translations_language ON translations(language_code)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_translations_key ON translations(key_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS translations`.execute(db);
  await sql`DROP TABLE IF EXISTS translation_keys`.execute(db);
}
