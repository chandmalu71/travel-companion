import { type Kysely, sql } from 'kysely';

/**
 * Migration 023: Email Campaign Tables
 *
 * Supports: email templates, campaigns, automation sequences, send tracking.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Email templates (reusable)
  await sql`CREATE TABLE IF NOT EXISTS email_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    subject VARCHAR(500) NOT NULL,
    preview_text VARCHAR(200),
    body_html TEXT NOT NULL,
    body_text TEXT,
    category VARCHAR(50) DEFAULT 'general',
    personalization_tokens TEXT[] DEFAULT '{}',
    created_by UUID,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Email campaigns
  await sql`CREATE TABLE IF NOT EXISTS email_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    template_id UUID REFERENCES email_templates(id),
    segment VARCHAR(100),
    status VARCHAR(20) DEFAULT 'draft',
    scheduled_at TIMESTAMPTZ,
    sent_at TIMESTAMPTZ,
    total_recipients INTEGER DEFAULT 0,
    total_sent INTEGER DEFAULT 0,
    total_opened INTEGER DEFAULT 0,
    total_clicked INTEGER DEFAULT 0,
    total_unsubscribed INTEGER DEFAULT 0,
    total_bounced INTEGER DEFAULT 0,
    created_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_campaigns_status ON email_campaigns(status)`.execute(db);

  // Individual email sends (tracking per recipient)
  await sql`CREATE TABLE IF NOT EXISTS email_sends (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID REFERENCES email_campaigns(id) ON DELETE CASCADE,
    automation_id VARCHAR(100),
    recipient_email VARCHAR(255) NOT NULL,
    recipient_name VARCHAR(200),
    recipient_type VARCHAR(20) DEFAULT 'lead',
    lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    subject VARCHAR(500),
    status VARCHAR(20) DEFAULT 'queued',
    ses_message_id VARCHAR(200),
    opened_at TIMESTAMPTZ,
    clicked_at TIMESTAMPTZ,
    bounced_at TIMESTAMPTZ,
    unsubscribed_at TIMESTAMPTZ,
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_sends_campaign ON email_sends(campaign_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_sends_recipient ON email_sends(recipient_email)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_sends_status ON email_sends(status)`.execute(db);

  // Automation sequences (welcome series, trial conversion, etc.)
  await sql`CREATE TABLE IF NOT EXISTS email_automations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(200) NOT NULL,
    trigger_event VARCHAR(50) NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    steps JSONB NOT NULL DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Seed default automation sequences
  await sql`INSERT INTO email_automations (name, trigger_event, is_active, steps) VALUES
    ('Welcome Series', 'lead_signup', true, '[{"day":0,"subject":"Welcome to Neyya! Your travel companion awaits"},{"day":2,"subject":"Plan your first trip in 2 minutes"},{"day":5,"subject":"10,000 travellers trust Neyya"},{"day":14,"subject":"Last chance: Your exclusive early access offer"}]'::jsonb),
    ('Trial Conversion', 'trial_started', true, '[{"day":1,"subject":"Your 30-day Premium trial is active!"},{"day":14,"subject":"You have used amazing features"},{"day":25,"subject":"5 days left to upgrade"},{"day":29,"subject":"Last day! Special offer: 20% off annual"},{"day":30,"subject":"Trial ended"}]'::jsonb)
  ON CONFLICT DO NOTHING`.execute(db);

  // Unsubscribe records
  await sql`CREATE TABLE IF NOT EXISTS email_unsubscribes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    reason VARCHAR(200),
    unsubscribed_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS email_unsubscribes`.execute(db);
  await sql`DROP TABLE IF EXISTS email_sends`.execute(db);
  await sql`DROP TABLE IF EXISTS email_campaigns`.execute(db);
  await sql`DROP TABLE IF EXISTS email_automations`.execute(db);
  await sql`DROP TABLE IF EXISTS email_templates`.execute(db);
}
