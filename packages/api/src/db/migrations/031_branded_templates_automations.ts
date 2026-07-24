import { type Kysely, sql } from 'kysely';

/**
 * Migration 031: Branded Email Templates, Automations, Discount Codes
 *
 * - Adds slug + type columns to email_templates
 * - Seeds 10 system templates + 10 marketing templates (branded HTML)
 * - Seeds 10 automations (all disabled by default)
 * - Creates discount_codes table
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Add slug and type columns
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS slug VARCHAR(100)`.execute(db);
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'marketing'`.execute(db);
  await sql`ALTER TABLE email_templates ADD COLUMN IF NOT EXISTS sender_address VARCHAR(200)`.execute(db);
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS idx_email_templates_slug ON email_templates (slug) WHERE slug IS NOT NULL`.execute(db);

  // Update existing templates with slugs
  await sql`UPDATE email_templates SET type = 'system' WHERE category = 'transactional' OR name ILIKE '%welcome%' OR name ILIKE '%verification%' OR name ILIKE '%reset%' OR name ILIKE '%invitation%'`.execute(db);

  // ─── Branded HTML wrapper ─────────────────────────────────────────────────
  const brandedWrap = (content: string, showUnsubscribe: boolean) => `
<div style="font-family:'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
  <div style="background:linear-gradient(135deg,#32CD32,#22a022);padding:24px 32px;text-align:center;">
    <img src="https://qa.neyya.ai/logo-white.svg" alt="Neyya" style="height:36px;" />
  </div>
  <div style="padding:32px;">
    ${content}
  </div>
  <div style="background:#f8f9fa;padding:20px 32px;border-top:1px solid #eee;text-align:center;">
    <p style="font-size:11px;color:#999;margin:0 0 4px;">Samriddhi Capital Oy &middot; Business ID: 3629801-3</p>
    <p style="font-size:11px;color:#999;margin:0;">Made with ❤️ in Finland</p>
    ${showUnsubscribe ? '<p style="font-size:11px;color:#999;margin:8px 0 0;"><a href="{{unsubscribeUrl}}" style="color:#999;">Unsubscribe</a></p>' : ''}
  </div>
</div>`;

  // ─── System Templates (10) ─────────────────────────────────────────────────
  const systemTemplates = [
    { slug: 'welcome', name: 'Welcome', subject: 'Welcome to Neyya, {{name}}!', body: brandedWrap('<h2 style="color:#333;">Welcome aboard, {{name}}!</h2><p>We\'re thrilled to have you. Neyya is your AI-powered travel companion — plan trips, track expenses, and discover amazing places.</p><p style="text-align:center;margin:24px 0;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Start Planning</a></p><p style="color:#666;">Need help? Just reply to this email or use the chat widget in the app.</p>', false) },
    { slug: 'email_verification', name: 'Email Verification', subject: 'Verify your email address', body: brandedWrap('<h2 style="color:#333;">Verify your email</h2><p>Hi {{name}}, please confirm your email address by clicking the button below:</p><p style="text-align:center;margin:24px 0;"><a href="{{verifyUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Verify Email</a></p><p style="font-size:12px;color:#666;">This link expires in 24 hours. If you didn\'t create an account, ignore this email.</p>', false) },
    { slug: 'password_reset', name: 'Password Reset', subject: 'Reset your Neyya password', body: brandedWrap('<h2 style="color:#333;">Password Reset</h2><p>Hi {{name}}, you requested a password reset. Click below to set a new password:</p><p style="text-align:center;margin:24px 0;"><a href="{{resetUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a></p><p style="font-size:12px;color:#666;">This link expires in 1 hour. If you didn\'t request this, ignore this email.</p>', false) },
    { slug: 'trip_invitation', name: 'Trip Invitation', subject: '{{inviterName}} invited you to {{tripName}}', body: brandedWrap('<h2 style="color:#333;">You\'re invited!</h2><p><strong>{{inviterName}}</strong> wants you to join their trip: <strong>{{tripName}}</strong></p><p style="text-align:center;margin:24px 0;"><a href="{{acceptUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation</a></p><p style="text-align:center;"><a href="{{declineUrl}}" style="color:#999;font-size:12px;">Decline</a></p>', false) },
    { slug: 'alias_verification', name: 'Alias Verification', subject: 'Verify your email alias', body: brandedWrap('<h2 style="color:#333;">Verify Email Alias</h2><p>Hi {{name}}, you added <strong>{{aliasEmail}}</strong> as an email alias. Please verify it:</p><p style="text-align:center;margin:24px 0;"><a href="{{verifyUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Verify Alias</a></p>', false) },
    { slug: 'subscription_confirmed', name: 'Subscription Confirmed', subject: 'Welcome to {{planName}}!', body: brandedWrap('<h2 style="color:#333;">Subscription Active!</h2><p>Hi {{name}}, your <strong>{{planName}}</strong> plan is now active. Enjoy all the premium features:</p><ul style="color:#666;"><li>Unlimited trips & bookings</li><li>AI-powered recommendations</li><li>Priority support</li></ul><p style="text-align:center;margin:24px 0;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Go to Dashboard</a></p>', false) },
    { slug: 'subscription_cancelled', name: 'Subscription Cancelled', subject: 'Your subscription has been cancelled', body: brandedWrap('<h2 style="color:#333;">Subscription Cancelled</h2><p>Hi {{name}}, your {{planName}} subscription has been cancelled. You\'ll retain access until {{endDate}}.</p><p style="color:#666;">We\'re sorry to see you go. If you change your mind, you can resubscribe anytime from Settings.</p><p style="text-align:center;margin:24px 0;"><a href="{{resubscribeUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Resubscribe</a></p>', false) },
    { slug: 'payment_failed', name: 'Payment Failed', subject: 'Action needed: Payment failed', body: brandedWrap('<h2 style="color:#cc0000;">Payment Failed</h2><p>Hi {{name}}, we couldn\'t process your payment for {{planName}}. Please update your payment method to avoid losing access.</p><p style="text-align:center;margin:24px 0;"><a href="{{updatePaymentUrl}}" style="background:#cc0000;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Update Payment</a></p><p style="font-size:12px;color:#666;">We\'ll retry automatically in 3 days.</p>', false) },
    { slug: 'account_deletion', name: 'Account Deletion', subject: 'Your Neyya account has been deleted', body: brandedWrap('<h2 style="color:#333;">Account Deleted</h2><p>Hi {{name}}, your Neyya account and all associated data have been permanently deleted as requested.</p><p style="color:#666;">If this was a mistake or you\'d like to return in the future, you\'re always welcome to create a new account.</p><p style="color:#666;">Thank you for being part of the Neyya community.</p>', false) },
    { slug: 'security_alert', name: 'Security Alert', subject: 'New login to your Neyya account', body: brandedWrap('<h2 style="color:#333;">New Login Detected</h2><p>Hi {{name}}, we noticed a new login to your account:</p><table style="border-collapse:collapse;margin:16px 0;width:100%;"><tr><td style="padding:8px 12px;background:#f8f9fa;border:1px solid #eee;color:#666;width:120px;">IP Address</td><td style="padding:8px 12px;border:1px solid #eee;font-weight:600;">{{ipAddress}}</td></tr><tr><td style="padding:8px 12px;background:#f8f9fa;border:1px solid #eee;color:#666;">Device</td><td style="padding:8px 12px;border:1px solid #eee;font-weight:600;">{{device}}</td></tr><tr><td style="padding:8px 12px;background:#f8f9fa;border:1px solid #eee;color:#666;">Time</td><td style="padding:8px 12px;border:1px solid #eee;font-weight:600;">{{loginTime}}</td></tr></table><p>If this was you, no action needed. If not, <a href="{{changePasswordUrl}}" style="color:#32CD32;font-weight:600;">change your password immediately</a>.</p>', false) },
  ];

  for (const t of systemTemplates) {
    await sql`INSERT INTO email_templates (slug, name, subject, body_html, type, category, sender_address, is_active)
      VALUES (${t.slug}, ${t.name}, ${t.subject}, ${t.body}, 'system', 'transactional', 'Neyya <noreply@neyya.ai>', true)
      ON CONFLICT (slug) DO UPDATE SET body_html = ${t.body}, subject = ${t.subject}, type = 'system', sender_address = 'Neyya <noreply@neyya.ai>'`.execute(db);
  }

  // ─── Marketing Templates (10) ──────────────────────────────────────────────
  const marketingTemplates = [
    { slug: 'mkt_trial_ending', name: 'Trial Ending', subject: '{{name}}, your trial ends in 3 days', body: brandedWrap('<h2 style="color:#333;">Don\'t lose your superpowers!</h2><p>Hi {{name}}, your Premium trial ends in <strong>3 days</strong>. Keep all the features you\'ve been enjoying:</p><ul style="color:#666;"><li>Unlimited trips & bookings</li><li>AI-powered recommendations</li><li>Receipt scanning & expense export</li></ul><p style="text-align:center;margin:24px 0;"><a href="{{upgradeUrl}}" style="background:#32CD32;color:white;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:600;font-size:16px;">Upgrade Now</a></p>', true) },
    { slug: 'mkt_upgrade_nudge', name: 'Upgrade Nudge', subject: 'You\'ve hit your plan limit', body: brandedWrap('<h2 style="color:#333;">Ready for more?</h2><p>Hi {{name}}, you\'ve reached your {{limitName}} limit on the Free plan. Upgrade to Pro for:</p><ul style="color:#666;"><li>20 trips (vs 3)</li><li>200 bookings</li><li>AI search & expense export</li></ul><p style="text-align:center;margin:24px 0;"><a href="{{upgradeUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Unlock Pro — €14.99/mo</a></p>', true) },
    { slug: 'mkt_reengagement', name: 'Re-engagement', subject: 'We miss you, {{name}}!', body: brandedWrap('<h2 style="color:#333;">Your trips miss you!</h2><p>Hi {{name}}, it\'s been a while since you visited Neyya. Here\'s what\'s new:</p><ul style="color:#666;"><li>AI Trip Tips — personalised packing lists & local advice</li><li>Booking scan — snap a confirmation, we do the rest</li><li>Dark mode — easier on the eyes</li></ul><p style="text-align:center;margin:24px 0;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Come Back</a></p>{{discountBlock}}', true) },
    { slug: 'mkt_weekly_digest', name: 'Weekly Travel Digest', subject: 'Your week ahead: {{tripCount}} trips', body: brandedWrap('<h2 style="color:#333;">Your Travel Week</h2><p>Hi {{name}}, here\'s what\'s coming up:</p>{{tripsSummary}}<p style="text-align:center;margin:24px 0;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">View Dashboard</a></p>', true) },
    { slug: 'mkt_feature_announcement', name: 'Feature Announcement', subject: 'New in Neyya: {{featureName}}', body: brandedWrap('<h2 style="color:#333;">Something exciting is here!</h2><p>Hi {{name}}, we just launched <strong>{{featureName}}</strong>:</p><p style="color:#666;">{{featureDescription}}</p><p style="text-align:center;margin:24px 0;"><a href="{{featureUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Try It Now</a></p>', true) },
    { slug: 'mkt_referral', name: 'Referral Invite', subject: 'Give a month, get a month free', body: brandedWrap('<h2 style="color:#333;">Share the love!</h2><p>Hi {{name}}, invite a friend to Neyya and you both get a <strong>free month of Pro</strong>.</p><p style="text-align:center;margin:24px 0;background:#f0fdf0;padding:16px;border-radius:8px;"><span style="font-size:20px;font-weight:700;color:#32CD32;">{{referralCode}}</span><br/><span style="font-size:12px;color:#666;">Share this code with friends</span></p><p style="text-align:center;"><a href="{{referralUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Invite Friends</a></p>', true) },
    { slug: 'mkt_post_trip_feedback', name: 'Post-Trip Feedback', subject: 'How was your trip to {{destination}}?', body: brandedWrap('<h2 style="color:#333;">How was {{destination}}?</h2><p>Hi {{name}}, welcome back! We\'d love to hear about your trip:</p><p style="text-align:center;margin:24px 0;"><a href="{{feedbackUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Share Feedback (2 min)</a></p><p style="color:#666;font-size:12px;">Your feedback helps us improve Neyya for everyone.</p>', true) },
    { slug: 'mkt_seasonal_promo', name: 'Seasonal Promotion', subject: '{{promoTitle}} — {{discount}}% off Premium', body: brandedWrap('<h2 style="color:#333;">{{promoTitle}}</h2><p>Hi {{name}}, for a limited time get <strong>{{discount}}% off</strong> Neyya Premium:</p><p style="text-align:center;margin:24px 0;background:#fff8ed;padding:16px;border-radius:8px;border:1px solid #ffb84d;"><span style="font-size:24px;font-weight:700;color:#FF8C00;">{{discount}}% OFF</span><br/><span style="font-size:12px;color:#666;">Use code: <strong>{{promoCode}}</strong> at checkout</span></p><p style="text-align:center;"><a href="{{upgradeUrl}}" style="background:#FF8C00;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Claim Offer</a></p><p style="font-size:11px;color:#999;text-align:center;">Expires: {{expiresDate}}</p>', true) },
    { slug: 'mkt_birthday', name: 'Birthday Wishes', subject: 'Happy Birthday, {{name}}! 🎂', body: brandedWrap('<h2 style="color:#333;">Happy Birthday! 🎂🎉</h2><p>Hi {{name}}, from all of us at Neyya — wishing you an amazing day and many wonderful travels ahead!</p><p style="color:#666;">As a birthday gift, here\'s a special treat:</p><p style="text-align:center;margin:24px 0;background:#f0fdf0;padding:16px;border-radius:8px;"><span style="font-size:20px;font-weight:700;color:#32CD32;">{{birthdayOffer}}</span></p><p style="text-align:center;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Plan Your Birthday Trip</a></p>', true) },
    { slug: 'mkt_milestone', name: 'Milestone Celebration', subject: 'Congrats! {{milestoneTitle}}', body: brandedWrap('<h2 style="color:#333;">{{milestoneTitle}} 🎉</h2><p>Hi {{name}}, {{milestoneDescription}}</p><p style="color:#666;">Here\'s to many more adventures together!</p><p style="text-align:center;margin:24px 0;"><a href="{{dashboardUrl}}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Keep Exploring</a></p>', true) },
  ];

  for (const t of marketingTemplates) {
    await sql`INSERT INTO email_templates (slug, name, subject, body_html, type, category, sender_address, is_active)
      VALUES (${t.slug}, ${t.name}, ${t.subject}, ${t.body}, 'marketing', 'marketing', 'Neyya <hello@neyya.ai>', true)
      ON CONFLICT (slug) DO UPDATE SET body_html = ${t.body}, subject = ${t.subject}, type = 'marketing', sender_address = 'Neyya <hello@neyya.ai>'`.execute(db);
  }

  // ─── Automations (10, all disabled) ────────────────────────────────────────
  // Delete existing seeded automations and re-create all 10
  await sql`DELETE FROM email_automations`.execute(db);

  const automations = [
    { name: 'Welcome Series', trigger: 'user_registered', steps: [
      { day: 0, subject: 'Welcome to Neyya, {{name}}!', template_slug: 'welcome' },
      { day: 2, subject: 'Plan your first trip in 2 minutes', body: 'Quick guide to creating your first trip and importing bookings.' },
      { day: 5, subject: '10,000 travellers trust Neyya', body: 'Social proof + feature highlights.' },
      { day: 14, subject: 'How is your experience so far?', body: 'Feedback request + feature discovery.' },
    ]},
    { name: 'Trial Conversion', trigger: 'trial_started', steps: [
      { day: 1, subject: 'Your Premium trial is active!', body: 'Here is what you can do with Premium.' },
      { day: 14, subject: 'Halfway through your trial', body: 'Features you have used + what you are missing.' },
      { day: 25, subject: '5 days left on your trial', body: 'Urgency + upgrade CTA.' },
      { day: 29, subject: 'Last day! Special offer inside', body: '20% off if you upgrade today.' },
    ]},
    { name: 'Re-engagement', trigger: 'user_inactive_30d', steps: [
      { day: 30, subject: 'We miss you, {{name}}!', template_slug: 'mkt_reengagement' },
      { day: 37, subject: 'New features you missed', body: 'Changelog highlights since last visit.' },
      { day: 45, subject: 'Special offer to welcome you back', body: 'Discount code offer (configurable).' },
    ]},
    { name: 'Plan Limit Nudge', trigger: 'plan_limit_reached', steps: [
      { day: 0, subject: 'You have reached your limit', template_slug: 'mkt_upgrade_nudge' },
      { day: 3, subject: 'Here is what Pro unlocks for you', body: 'Feature comparison + testimonials.' },
    ]},
    { name: 'Post-Trip Feedback', trigger: 'trip_ended', steps: [
      { day: 1, subject: 'How was your trip to {{destination}}?', template_slug: 'mkt_post_trip_feedback' },
      { day: 3, subject: 'Quick question about {{destination}}', body: 'Follow-up if no response.' },
      { day: 7, subject: 'Last chance to share your thoughts', body: 'Final reminder, won\'t ask again.' },
      { day: 15, subject: 'We would love your feedback', body: 'Gentle final nudge, then suppress.' },
    ]},
    { name: 'Referral Reminder', trigger: 'no_referral_30d', steps: [
      { day: 30, subject: 'Invite a friend, both get a free month', template_slug: 'mkt_referral' },
    ]},
    { name: '3rd Trip Upsell', trigger: 'trip_created_3rd', steps: [
      { day: 0, subject: 'You are a power traveller!', body: 'You have created 3 trips — Pro gives you unlimited.' },
    ]},
    { name: 'Booking Streak', trigger: 'bookings_5_in_week', steps: [
      { day: 0, subject: 'Busy traveller! Unlock unlimited bookings', body: 'You added 5+ bookings this week. Premium = unlimited.' },
    ]},
    { name: 'Life Events & Birthdays', trigger: 'milestone_due', steps: [
      { day: 0, subject: '{{milestoneTitle}}', template_slug: 'mkt_birthday' },
    ]},
    { name: 'First Expense Logged', trigger: 'first_expense', steps: [
      { day: 1, subject: 'Tips for tracking travel expenses', body: 'Budget tips, receipt scanning, expense splitting guide.' },
    ]},
  ];

  for (const a of automations) {
    await sql`INSERT INTO email_automations (name, trigger_event, is_active, steps)
      VALUES (${a.name}, ${a.trigger}, false, ${JSON.stringify(a.steps)}::jsonb)
      ON CONFLICT DO NOTHING`.execute(db);
  }

  // ─── Discount Codes Table ──────────────────────────────────────────────────
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

  await sql`CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes (code) WHERE is_active = true`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS discount_codes`.execute(db);
  await sql`ALTER TABLE email_templates DROP COLUMN IF EXISTS slug`.execute(db);
  await sql`ALTER TABLE email_templates DROP COLUMN IF EXISTS type`.execute(db);
  await sql`ALTER TABLE email_templates DROP COLUMN IF EXISTS sender_address`.execute(db);
}
