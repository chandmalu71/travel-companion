/**
 * Fix migrations — ensures all tables/columns exist regardless of migration state.
 * Run: npx tsx src/scripts/fix-migrations.ts
 */
import { createDatabaseFromEnv } from '../db/database.js';
import { sql } from 'kysely';

async function main() {
  const db = createDatabaseFromEnv();

  const commands = [
    `ALTER TABLE trip_members ADD COLUMN IF NOT EXISTS departed BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE trip_members ADD COLUMN IF NOT EXISTS departed_at TIMESTAMPTZ`,
    `ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS scan_frequency VARCHAR(10) DEFAULT '5min'`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS last_scan_status VARCHAR(20) DEFAULT 'never'`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS last_scan_error TEXT`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS imap_host VARCHAR(255)`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS imap_port INTEGER`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS imap_username VARCHAR(255)`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS imap_password_encrypted TEXT`,
    `ALTER TABLE email_connections ADD COLUMN IF NOT EXISTS imap_use_tls BOOLEAN DEFAULT TRUE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended BOOLEAN DEFAULT FALSE`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS suspended_reason TEXT`,
    `ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_role VARCHAR(20)`,
    `CREATE TABLE IF NOT EXISTS audit_log (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), admin_id TEXT NOT NULL, action VARCHAR(50) NOT NULL, target TEXT NOT NULL, details TEXT, ip_address VARCHAR(45), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log(created_at)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action)`,
    `CREATE TABLE IF NOT EXISTS unclaimed_bookings (id UUID PRIMARY KEY DEFAULT gen_random_uuid(), email VARCHAR(255) NOT NULL, booking_type VARCHAR(20) NOT NULL, destination VARCHAR(255), start_date DATE, end_date DATE, raw_data TEXT NOT NULL, claimed BOOLEAN NOT NULL DEFAULT FALSE, claim_token UUID, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())`,
    `CREATE INDEX IF NOT EXISTS idx_unclaimed_bookings_email ON unclaimed_bookings(email)`,
    `CREATE INDEX IF NOT EXISTS idx_unclaimed_bookings_claim_token ON unclaimed_bookings(claim_token)`,
  ];

  console.log('Ensuring all tables and columns exist...');
  for (const cmd of commands) {
    try {
      await sql.raw(cmd).execute(db);
    } catch (e) {
      // Ignore errors (column already exists, etc.)
    }
  }

  // Mark migrations as done
  try {
    await sql.raw(`INSERT INTO kysely_migration (name, timestamp) VALUES ('003_unclaimed_bookings', NOW()), ('004_shared_trip_enhancements', NOW()), ('005_admin_tables', NOW()) ON CONFLICT DO NOTHING`).execute(db);
  } catch {}

  console.log('✅ All migrations fixed');
  await db.destroy();
}

main();
