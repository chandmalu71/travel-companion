import { type Kysely, sql } from 'kysely';

/**
 * Migration 024: CRM Advanced Features
 *
 * - A/B testing for email campaigns
 * - Lead scoring
 * - Referral tracking
 */
export async function up(db: Kysely<any>): Promise<void> {
  // A/B test variants for campaigns
  await sql`CREATE TABLE IF NOT EXISTS ab_test_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    variant_name VARCHAR(10) NOT NULL DEFAULT 'A',
    subject VARCHAR(500) NOT NULL,
    preview_text VARCHAR(200),
    body_html TEXT,
    percentage INTEGER DEFAULT 50,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    is_winner BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Lead scores (auto-calculated from engagement)
  await sql`CREATE TABLE IF NOT EXISTS lead_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES crm_leads(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score INTEGER DEFAULT 0,
    score_breakdown JSONB DEFAULT '{}',
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT lead_scores_unique UNIQUE (lead_id, user_id)
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_lead_scores_score ON lead_scores(score DESC)`.execute(db);

  // Referrals
  await sql`CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_user_id UUID NOT NULL REFERENCES users(id),
    referral_code VARCHAR(20) NOT NULL UNIQUE,
    referred_email VARCHAR(255),
    referred_user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    reward_type VARCHAR(50),
    reward_granted BOOLEAN DEFAULT FALSE,
    reward_granted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    converted_at TIMESTAMPTZ
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code)`.execute(db);

  // Add referral_code to users table
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by UUID REFERENCES users(id)`.execute(db);
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_count INTEGER DEFAULT 0`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS referrals`.execute(db);
  await sql`DROP TABLE IF EXISTS lead_scores`.execute(db);
  await sql`DROP TABLE IF EXISTS ab_test_variants`.execute(db);
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS referral_code`.execute(db);
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS referred_by`.execute(db);
  await sql`ALTER TABLE users DROP COLUMN IF EXISTS referral_count`.execute(db);
}
