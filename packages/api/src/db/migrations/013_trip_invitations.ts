import { type Kysely, sql } from 'kysely';

/**
 * Migration 013: Trip Invitations
 *
 * Creates trip_invitations table for managing invitations to trips
 * via email, phone, WhatsApp, or shareable link.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE TABLE IF NOT EXISTS trip_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    invited_by UUID NOT NULL REFERENCES users(id),
    channel VARCHAR(10) NOT NULL,
    recipient VARCHAR(255),
    role VARCHAR(10) NOT NULL DEFAULT 'editor',
    group_id UUID REFERENCES trip_groups(id) ON DELETE SET NULL,
    message TEXT,
    expires_at TIMESTAMPTZ,
    token VARCHAR(64) NOT NULL UNIQUE,
    status VARCHAR(10) NOT NULL DEFAULT 'pending',
    accepted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_trip_invitations_trip ON trip_invitations(trip_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_trip_invitations_token ON trip_invitations(token)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_trip_invitations_status ON trip_invitations(status)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS trip_invitations`.execute(db);
}
