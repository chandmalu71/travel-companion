import { type Kysely, sql } from 'kysely';

/**
 * Migration 012: Trip Members & Groups
 *
 * Creates trip_groups and trip_travellers tables for managing
 * trip members organized into hierarchical groups.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Trip Groups
  await sql`CREATE TABLE IF NOT EXISTS trip_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    group_type VARCHAR(20) DEFAULT 'family',
    expense_split_mode VARCHAR(20) DEFAULT 'per_person',
    color VARCHAR(7),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_trip_groups_trip ON trip_groups(trip_id)`.execute(db);

  // Trip Travellers
  await sql`CREATE TABLE IF NOT EXISTS trip_travellers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    group_id UUID REFERENCES trip_groups(id) ON DELETE SET NULL,

    display_name VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(30),
    avatar_url TEXT,

    traveller_type VARCHAR(10) NOT NULL DEFAULT 'adult',
    date_of_birth DATE,
    passport_name VARCHAR(200),
    passport_number_encrypted TEXT,
    nationality VARCHAR(50),

    role VARCHAR(10) NOT NULL DEFAULT 'editor',
    status VARCHAR(10) NOT NULL DEFAULT 'active',

    invited_by UUID REFERENCES users(id),
    joined_at TIMESTAMPTZ,
    left_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_trip_travellers_trip ON trip_travellers(trip_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_trip_travellers_user ON trip_travellers(user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_trip_travellers_group ON trip_travellers(group_id)`.execute(db);

  // Add member_visibility setting to trips table
  await sql`ALTER TABLE trips ADD COLUMN IF NOT EXISTS member_visibility VARCHAR(20) DEFAULT 'full'`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trip_travellers`.execute(db);
  await sql`DROP TABLE IF EXISTS trip_groups`.execute(db);
  await sql`ALTER TABLE trips DROP COLUMN IF EXISTS member_visibility`.execute(db);
}
