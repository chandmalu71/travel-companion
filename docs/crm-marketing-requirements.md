# CRM & Marketing Automation — Requirements

**Date:** July 2026  
**Priority:** High  
**Status:** Phase A in progress, Phases B-H planned

---

## Overview

A built-in CRM and marketing automation platform integrated into the Neyya admin panel. Manages the full funnel from lead capture through conversion, engagement, and retention — with AI-powered content generation for both email and social media campaigns.

---

## Phase A: Lead Capture & Legal Documents

### A.1 Lead Capture Form (Landing Page)

**Fields:**
- Full Name (required)
- Email Address (required, validated format + MX record check)
- Country / City (auto-detected from IP via GeoIP, editable)
- "How do you travel?" (select: solo / couple / group / family)
- "Trips per year" (select: 1-2 / 3-5 / 6+)
- Marketing consent checkbox (GDPR opt-in)
- Terms of Service agreement checkbox

**Security:**
- Google reCAPTCHA v3 (invisible, score-based, threshold 0.5)
- Rate limiting (max 5 submissions per IP per hour)
- Email validation (format + disposable email blacklist)

**Storage:**
- All leads stored in `crm_leads` database table
- Source tracking: page, UTM params, referrer, device
- IP-based geolocation stored
- Timestamp + consent record

**Behaviour:**
- On submit: show success message + "Check your inbox for a welcome email"
- Trigger welcome email (automated)
- Lead visible immediately in Admin CRM

### A.2 Cookie Consent (GDPR)

- Banner at bottom of page on first visit
- Categories: Essential (always on), Analytics, Marketing
- Accept All / Reject All / Customize buttons
- Stores consent in cookie + database
- Respects consent for analytics (Google Analytics, tracking pixels)
- Link to full Cookie Policy page
- Re-consent if policy changes

### A.3 Legal Pages

Create the following pages:
- **Privacy Policy** (`/privacy`) — data collection, storage, sharing, rights
- **Terms of Service** (`/terms`) — usage rules, liability, account termination
- **Cookie Policy** (`/cookies`) — what cookies, why, how to control
- **GDPR Rights** (section in Privacy) — access, rectify, delete, portability, object

### A.4 Registration Consent

Update the registration form:
- Add checkbox: "I agree to the Terms of Service and Privacy Policy"
- Add checkbox: "I consent to receive product updates and tips" (optional, pre-unchecked)
- Store consent timestamp + version of terms agreed to

---

## Phase B: Admin CRM UI

### B.1 Contacts View

- Unified view: leads + registered users + churned users
- Columns: Name, Email, Country, Lifecycle Stage, Plan, Last Active, Created
- Search by name/email
- Pagination (10/20/50/100)
- Sort by any column
- Bulk actions: tag, add to segment, send email

### B.2 Lifecycle Stages (auto-tracked)

```
Lead → Free User → Trial → Pro → Premium → Churned
  ↑                                            │
  └────────────── Win-back ────────────────────┘
```

### B.3 Contact Detail View

- Profile (name, email, country, travel style, plan)
- Activity timeline (signup, trip created, upgraded, email opened, etc.)
- Tags (auto + manual)
- Email history (sent emails, opens, clicks)
- Notes (admin can add internal notes)

### B.4 Segments (Dynamic Lists)

- Pre-built: "New leads this week", "Trial expiring in 3 days", "Inactive 7 days"
- Custom: build with filters (country, plan, trips_count, last_active, tags)
- Auto-updating (recalculates on view)
- Use for campaign targeting

### B.5 Import Existing Users

- Auto-import all registered users into CRM contacts
- Map: email, display_name, created_at → CRM fields
- Calculate lifecycle stage from subscription status
- One-time migration + ongoing sync on new registrations

---

## Phase C: Email Campaigns (AI-Powered)

### C.1 Email Template Builder

- Visual editor (blocks: header, text, image, button, divider)
- AI text generator: "Write a welcome email for new travel enthusiasts"
- Personalization tokens: {{name}}, {{city}}, {{plan}}, {{trip_count}}
- Image suggestions from Unsplash based on content
- Preview (desktop + mobile)
- HTML export for manual send

### C.2 AI Email Generator (Bedrock)

- Prompt: describe what you want to communicate
- Tone: friendly / urgent / educational / promotional
- Output: subject line + preview text + full body
- Can generate multiple variations (A/B testing)
- Suggest optimal send time based on segment timezone

### C.3 Welcome Series (Automated)

Trigger: new lead signup  
Sequence:
1. **Day 0:** Welcome + "Here's what Neyya does" + CTA: Create account
2. **Day 2:** "Plan your first trip in 2 minutes" + feature highlight
3. **Day 5:** Social proof ("10,000 travellers trust Neyya") + CTA: Sign up
4. **Day 14:** Last chance + offer (if not converted)

### C.4 Trial Conversion Series (Automated)

Trigger: trial started  
Sequence:
1. **Day 1:** "Your 30-day Premium trial is active!" + feature tour
2. **Day 14:** "You've used X features — here's what you'd lose"
3. **Day 25:** "5 days left — upgrade now to keep unlimited access"
4. **Day 29:** "Last day! Special offer: 20% off annual"
5. **Day 30:** "Trial ended — you're now on Free. Here's what changed"

### C.5 Delivery (SES)

- Send via AWS SES (neyya.ai verified domain)
- Unsubscribe link in every email (one-click)
- Bounce + complaint handling
- Sending rate: respect SES limits
- From: neyya@neyya.ai or specific campaign address

---

## Phase D: Campaign Automation Engine

### D.1 Trigger-Based Campaigns

| Trigger | Action |
|---------|--------|
| Lead signup | Welcome series |
| Account created | Onboarding series |
| Trial started | Trial conversion series |
| Trial expiring (3 days) | Urgency email |
| Inactive 7 days | Re-engagement |
| Inactive 30 days | Win-back offer |
| Plan limit hit | Upgrade nudge |
| Subscription cancelled | Churn prevention |

### D.2 Campaign Builder (Admin UI)

- Create: name, segment, template, schedule
- Preview: see exactly what recipients will get
- Test send: send to yourself first
- Schedule: send now, or schedule for optimal time
- Pause/resume running campaigns

---

## Phase E: Email Analytics

### E.1 Tracking

- Open tracking (invisible pixel)
- Click tracking (link wrapping via redirect)
- Unsubscribe tracking
- Bounce tracking (hard + soft)
- Conversion tracking (opened email → signed up / upgraded)

### E.2 Dashboard

- Sent, Delivered, Opened, Clicked, Unsubscribed (per campaign)
- Open rate, CTR, conversion rate
- Best performing subject lines
- Geographic distribution of opens
- Device breakdown (mobile vs desktop)

---

## Phase F: Social Media Campaigns (AI-Powered)

### F.1 Platforms

- Facebook (page posts + ads)
- Instagram (feed posts + stories + reels)
- Twitter/X (posts + threads)
- LinkedIn (company page posts)
- TikTok (video posts)

### F.2 AI Content Generator

- Prompt: "Create a post about our new trip planning feature"
- Output: platform-specific text (char limits respected) + hashtags
- Image: AI selects relevant travel stock photo OR generates branded graphic
- Video script (TikTok/Reels): suggest hook + script + CTA
- Calendar: suggest optimal posting times per platform

### F.3 Campaign Types

| Type | Description |
|------|-------------|
| Organic post | Free post to your brand page |
| Paid ad | Boosted post / targeted ad (requires ad account) |
| Series | Multi-post campaign (e.g., "5 travel tips this week") |
| Cross-platform | Same message adapted for all platforms |

### F.4 Publishing

- Draft → Review → Schedule → Published
- Multi-platform: one click to publish to all selected platforms
- Calendar view: see all scheduled posts across platforms
- Queue: auto-space posts (don't flood followers)

### F.5 Connected Accounts

- OAuth connection per platform (in Admin → Settings → Social Accounts)
- Facebook: Page access token
- Instagram: Business account via Facebook
- Twitter/X: OAuth 2.0
- LinkedIn: Company page access
- TikTok: Creator API

---

## Phase G: Social Media Analytics

### G.1 Organic Performance

- Per post: impressions, reach, engagement (likes + comments + shares)
- Overall: follower growth, engagement rate, best content type
- Compare: this week vs last week, this month vs last month

### G.2 Paid Ad Performance

- Spend, impressions, clicks, CTR, CPC, conversions
- ROAS (return on ad spend)
- Audience breakdown (age, gender, location)
- Compare campaigns

### G.3 Unified Dashboard

- All platforms in one view
- Top performing posts (across platforms)
- Content performance by type (image, video, carousel, text)
- Recommended actions ("Your Instagram engagement is down 15% — try posting a Reel")

---

## Phase H: Advanced Features

### H.1 A/B Testing (Email)
- Test 2-4 subject lines on 10% of segment, send winner to rest
- Test content variations (different CTA, different image)

### H.2 Lead Scoring
- Assign score based on: email opens, page visits, trips created, feature usage
- Auto-promote: high-score leads → prioritized for outreach
- Alert: "This lead scored 90 — ready to convert"

### H.3 Referral Tracking
- "Invite a friend" link with tracking
- Reward: inviter gets X when friend upgrades
- Leaderboard in admin

---

## Data Model Overview

### New Tables

```
crm_leads           — captured leads (pre-registration)
crm_contacts        — unified view (leads + users + computed fields)
crm_segments        — dynamic list definitions
crm_tags            — contact tags
crm_contact_tags    — many-to-many
crm_email_templates — reusable email templates
crm_campaigns       — email + social campaigns
crm_campaign_sends  — individual email send records
crm_email_events    — opens, clicks, bounces
crm_automations     — trigger-based automation rules
crm_automation_logs — execution history
social_accounts     — connected social platforms
social_posts        — scheduled/published posts
social_post_metrics — performance data per post
social_ad_campaigns — paid ad campaigns
consent_records     — GDPR consent audit trail
```

---

## Technical Dependencies

- **AWS SES** — email delivery (already verified)
- **AWS Bedrock** — AI content generation (already configured)
- **Google reCAPTCHA v3** — bot protection (need API key)
- **GeoIP service** — IP to country/city (free: ip-api.com or MaxMind GeoLite2)
- **Facebook Graph API** — page posts + ads
- **Instagram Graph API** — via Facebook
- **Twitter API v2** — posts + analytics
- **LinkedIn API** — company page posts
- **TikTok API** — creator posting

---

## Estimated Cost

| Component | Cost |
|-----------|------|
| SES email sending | $0.10 per 1,000 emails |
| Bedrock AI generation | ~$0.002 per email/post |
| reCAPTCHA | Free (up to 10K assessments/month) |
| GeoIP (ip-api.com) | Free (1000 req/day) or MaxMind ($26/month) |
| Social API access | Free (organic), variable (ads) |
| **Total platform cost** | **~$5-20/month** at startup scale |
