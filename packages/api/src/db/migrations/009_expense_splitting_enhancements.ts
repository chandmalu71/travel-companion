import { type Kysely, sql } from 'kysely';

/**
 * Migration 009: Expense Splitting Enhancements
 *
 * Adds per-member split tracking, payer attribution, partial settlements,
 * and split preferences (remember last config).
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add payer_id to expenses (who actually paid — may differ from user_id who created it)
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS payer_id UUID REFERENCES users(id)`.execute(db);
  // Default payer_id to user_id for existing rows
  await sql`UPDATE expenses SET payer_id = user_id WHERE payer_id IS NULL`.execute(db);

  // Per-member split detail table
  await sql`CREATE TABLE IF NOT EXISTS expense_split_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    expense_id UUID NOT NULL REFERENCES expenses(id) ON DELETE CASCADE,
    member_id UUID NOT NULL REFERENCES group_members(id) ON DELETE CASCADE,
    split_type VARCHAR(20) NOT NULL,
    percentage DECIMAL(5,2),
    amount DECIMAL(12,2),
    items TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_split_members_expense ON expense_split_members(expense_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_split_members_member ON expense_split_members(member_id)`.execute(db);

  // Add partial settlement support
  await sql`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS amount_paid DECIMAL(12,2) DEFAULT 0`.execute(db);
  await sql`ALTER TABLE settlements ADD COLUMN IF NOT EXISTS notes TEXT`.execute(db);

  // Split preferences per user per trip (remember last split config)
  await sql`CREATE TABLE IF NOT EXISTS split_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    default_split_type VARCHAR(20) NOT NULL DEFAULT 'equal',
    default_included_members TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_split_prefs_user_trip ON split_preferences(user_id, trip_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS split_preferences`.execute(db);
  await sql`DROP TABLE IF EXISTS expense_split_members`.execute(db);
  await sql`ALTER TABLE expenses DROP COLUMN IF EXISTS payer_id`.execute(db);
  await sql`ALTER TABLE settlements DROP COLUMN IF EXISTS amount_paid`.execute(db);
  await sql`ALTER TABLE settlements DROP COLUMN IF EXISTS notes`.execute(db);
}
