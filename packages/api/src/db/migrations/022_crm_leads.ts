import { type Kysely, sql } from 'kysely';

/**
 * Migration 022: CRM Leads & Consent Records
 *
 * Lead capture from landing page + GDPR consent audit trail.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // CRM Leads table
  await sql`CREATE TABLE IF NOT EXISTS crm_leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    full_name VARCHAR(200) NOT NULL,
    country VARCHAR(100),
    city VARCHAR(100),
    travel_style VARCHAR(20), -- 'solo', 'couple', 'group', 'family'
    trips_per_year VARCHAR(10), -- '1-2', '3-5', '6+'
    
    -- Source tracking
    source_page VARCHAR(200),
    utm_source VARCHAR(100),
    utm_medium VARCHAR(100),
    utm_campaign VARCHAR(100),
    referrer TEXT,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_type VARCHAR(20), -- 'desktop', 'mobile', 'tablet'
    
    -- Conversion tracking
    converted_to_user BOOLEAN DEFAULT FALSE,
    converted_user_id UUID,
    converted_at TIMESTAMPTZ,
    
    -- Consent
    marketing_consent BOOLEAN DEFAULT FALSE,
    terms_consent BOOLEAN DEFAULT FALSE,
    consent_timestamp TIMESTAMPTZ,
    
    -- Status
    status VARCHAR(20) DEFAULT 'new', -- 'new', 'contacted', 'converted', 'unsubscribed'
    tags TEXT[] DEFAULT '{}',
    notes TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT crm_leads_email_unique UNIQUE (email)
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_status ON crm_leads(status)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_country ON crm_leads(country)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_crm_leads_created ON crm_leads(created_at)`.execute(db);

  // Consent records (GDPR audit trail)
  await sql`CREATE TABLE IF NOT EXISTS consent_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    lead_id UUID REFERENCES crm_leads(id) ON DELETE SET NULL,
    consent_type VARCHAR(50) NOT NULL, -- 'terms', 'marketing', 'cookie_essential', 'cookie_analytics', 'cookie_marketing'
    granted BOOLEAN NOT NULL,
    policy_version VARCHAR(20) DEFAULT 'v1.0',
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    withdrawn_at TIMESTAMPTZ
  )`.execute(db);

  await sql`CREATE INDEX IF NOT EXISTS idx_consent_user ON consent_records(user_id)`.execute(db);
  await sql`CREATE INDEX IF NOT EXISTS idx_consent_lead ON consent_records(lead_id)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS consent_records`.execute(db);
  await sql`DROP TABLE IF EXISTS crm_leads`.execute(db);
}
