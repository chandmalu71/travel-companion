import { type Kysely, sql } from 'kysely';

/**
 * Migration 032: Fix template slug constraint + re-seed templates
 *
 * Migration 031 may have failed on ON CONFLICT because the unique constraint
 * wasn't created properly. This migration:
 * 1. Ensures the slug column and constraint exist
 * 2. Re-seeds all templates using DELETE + INSERT (avoids ON CONFLICT issues)
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Ensure columns exist
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`.execute(db);
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'marketing'`.execute(db);
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS sender_address VARCHAR(200)`.execute(db);

  // Drop existing constraint/index if any, then recreate
  await sql`DROP INDEX IF EXISTS idx_email_templates_slug`.execute(db);
  await sql`ALTER TABLE email_templates DROP CONSTRAINT IF EXISTS email_templates_slug_unique`.execute(db);
  await sql`ALTER TABLE email_templates ADD CONSTRAINT email_templates_slug_unique UNIQUE (slug)`.execute(db);

  // Delete old seeded templates (by slug) and re-insert cleanly
  await sql`DELETE FROM email_templates WHERE slug IS NOT NULL`.execute(db);

  // ─── System Templates ──────────────────────────────────────────────────────
  await sql`INSERT INTO email_templates (slug, name, subject, body_html, type, category, sender_address, is_active) VALUES
    ('welcome', 'Welcome', 'Welcome to Neyya, {{name}}!', '<div>Welcome template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('email_verification', 'Email Verification', 'Verify your email address', '<div>Verification template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('password_reset', 'Password Reset', 'Reset your Neyya password', '<div>Reset template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('trip_invitation', 'Trip Invitation', '{{inviterName}} invited you to {{tripName}}', '<div>Invitation template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('alias_verification', 'Alias Verification', 'Verify your email alias', '<div>Alias verification template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('subscription_confirmed', 'Subscription Confirmed', 'Welcome to {{planName}}!', '<div>Subscription confirmed template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('subscription_cancelled', 'Subscription Cancelled', 'Your subscription has been cancelled', '<div>Subscription cancelled template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('payment_failed', 'Payment Failed', 'Action needed: Payment failed', '<div>Payment failed template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('account_deletion', 'Account Deletion', 'Your Neyya account has been deleted', '<div>Account deletion template</div>', 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true),
    ('security_alert', 'Security Alert', 'New login to your Neyya account', '<div>Security alert template</div>', 'system', 'transactional', 'Neyya Security <security@neyya.ai>', true)
  `.execute(db);

  // ─── Marketing Templates ───────────────────────────────────────────────────
  await sql`INSERT INTO email_templates (slug, name, subject, body_html, type, category, sender_address, is_active) VALUES
    ('mkt_trial_ending', 'Trial Ending', '{{name}}, your trial ends in 3 days', '<div>Trial ending template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_upgrade_nudge', 'Upgrade Nudge', 'You have hit your plan limit', '<div>Upgrade nudge template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_reengagement', 'Re-engagement', 'We miss you, {{name}}!', '<div>Re-engagement template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_weekly_digest', 'Weekly Travel Digest', 'Your week ahead: {{tripCount}} trips', '<div>Weekly digest template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_feature_announcement', 'Feature Announcement', 'New in Neyya: {{featureName}}', '<div>Feature announcement template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_referral', 'Referral Invite', 'Give a month, get a month free', '<div>Referral template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_post_trip_feedback', 'Post-Trip Feedback', 'How was your trip to {{destination}}?', '<div>Feedback template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_seasonal_promo', 'Seasonal Promotion', '{{promoTitle}} — {{discount}}% off Premium', '<div>Seasonal promo template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_birthday', 'Birthday Wishes', 'Happy Birthday, {{name}}!', '<div>Birthday template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true),
    ('mkt_milestone', 'Milestone Celebration', 'Congrats! {{milestoneTitle}}', '<div>Milestone template</div>', 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true)
  `.execute(db);

  // ─── Ensure discount_codes table exists ────────────────────────────────────
  await sql`CREATE TABLE IF NOT EXISTS discount_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) NOT NULL UNIQUE,
    discount_percent INTEGER NOT NULL,
    is_one_time BOOLEAN DEFAULT FALSE,
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    valid_from TIMESTAMPTZ DEFAULT NOW(),
    valid_until TIMESTAMPTZ,
    automation_id UUID,
    created_by UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  // No-op — templates remain
}
