# Session: July 22, 2026 — Subscriptions, Analytics & Production Setup

## Summary

Major session covering subscription system fixes, in-house analytics, promotional pricing, plan enforcement, production infrastructure setup (SES, OAuth, Stripe), and initial deployment attempts.

---

## Features Implemented

### Subscription System Enhancements
- **Plan editing wired to real API** — Admin can edit plan pricing/limits via PUT /api/admin/plans/:slug, changes persist to DB and reflect on pricing page immediately
- **Campaigns CRUD** — Admin campaigns tab now fetches from DB (was hardcoded), full create/edit/enable/disable/delete
- **User Overrides with search autocomplete** — Type-ahead search for users, grant Pro/Premium with duration, persists to DB, loads on page mount
- **Plan badge next to logo** — Pro (blue gradient) / Premium (gold gradient) shown in sidebar when user is subscribed; "Upgrade" nav item hidden for paid users

### In-House Analytics
- **DB table:** analytics_events (user_id, session_id, event_type, page, element, metadata)
- **API:** POST /api/analytics/event, POST /api/analytics/batch, GET /api/admin/analytics
- **Client hook:** usePageViewTracker() auto-tracks page views; trackFeatureUse() / trackClick() for manual tracking
- **Admin page:** Summary stats, top pages, top features, events-by-day chart

### Promotional Pricing
- **Strikethrough pricing** — Original price in red with line-through, discounted price bold
- **Seasonal events** — event_type (summer, christmas, black_friday, etc.), theme_color, banner_text, banner_emoji
- **Timeline calendar view** — Gantt-style 12-month view with colored bars, inline pause/activate/edit/delete
- **Auto-activation** — Promotions auto-activate/deactivate based on date range
- **Seeded 3 events:** Summer Launch (50% off), Black Friday (60%), Christmas (40%)

### Plan Limit Enforcement
- **Server-side middleware** (packages/api/src/middleware/plan-limits.ts)
- **Enforced on:** trips, expenses (monthly), messages (daily), connections, family members, email aliases
- **Response:** 403 PLAN_LIMIT_REACHED with resource, limit, current, planName, upgradeUrl
- **Client:** usePlanLimit() hook + UpgradePrompt component

### Email Delivery Service
- **EmailService** with 3 providers: console (dev), AWS SES (prod), SendGrid (alt)
- **6 templates in DB:** verification, password_reset, trip_invitation, alias_verification, subscription_confirmation, welcome
- **3 sender addresses:** noreply@neyya.ai, trips@neyya.ai, support@neyya.ai
- **Admin page:** Templates (edit/preview/test), Senders (add/remove), Send Log (history)
- **Wired into app:** Welcome email on OAuth signup, alias verification, trip invitations
- **AWS SES domain verified** (neyya.ai in eu-west-1, DKIM SUCCESS)

### OAuth Integration
- **Google OAuth** — Full flow: /api/auth/google → consent → callback → JWT → dashboard
- **Microsoft OAuth** — Full flow using Azure AD 'common' tenant
- **Facebook OAuth** — Full flow using Graph API v19.0
- **Auth callback page** (/auth/callback) stores tokens and redirects to dashboard
- **Login/Register buttons** wired to real OAuth (was alert placeholders)

### Stripe Integration
- **Real Stripe SDK** (stripe@22.3.2) installed
- **createCheckoutSession()** — Dynamic pricing from DB, Stripe Checkout URL
- **handleWebhookEvent()** — checkout.session.completed, invoice.paid, invoice.payment_failed, customer.subscription.updated/deleted
- **createPortalSession()** — Self-service billing management
- **POST /api/subscription/portal** — Returns portal URL

### Privacy Policy & Legal
- **/privacy** page — Full GDPR-compliant privacy policy
- **App icon** — 1024x1024 PNG generated for Facebook app review

---

## Infrastructure Setup

### AWS Resources Created
- **SES:** neyya.ai domain verified (DKIM SUCCESS, eu-west-1)
- **Route 53:** Hosted zone for neyya.ai (Z07617883AZG8QODLF2DF)
- **DKIM CNAMEs:** 3 records in Route 53 for SES
- **QA subdomain CNAMEs:** qa.neyya.ai, admin-qa.neyya.ai, api-qa.neyya.ai (later removed)
- **SES email verified:** chand.malu@gmail.com (for sandbox testing)
- **Test email sent successfully** via SES

### External Accounts Created (credentials in .env)
- Google Cloud Console → OAuth 2.0 Client (Neyya.ai Web)
- Azure Portal → App Registration (Neyya.ai)
- Meta Developer → App (Neyya.ai) — pending live mode (needs privacy URL accessible)
- Stripe → Account (test mode, sk_test keys)

### Attempted & Reverted
- **Vercel deployment** — tried, hit serverless issues (cold starts, ESM bundling, Redis timeouts). Reverted.
- **Neon database** — created, seeded, then deleted (switching to RDS)
- **Upstash Redis** — created, then deleted (switching to ElastiCache)

---

## Documentation & Governance

### Requirements
- Added Req 34-45 to requirements.md (My Network through Email Delivery)
- Total: 45 requirements documented

### Confluence (7 pages updated)
- Features (v17): 44 requirements + comprehensive pending integrations table
- API Reference (v2): 80+ endpoints
- Database Schema (v2): 40+ tables, migration history
- Deployment & Infrastructure (v2): Architecture, launch sequence
- Development Guide (v2): Tech stack, rules, scripts
- Admin Panel Guide (v3): All pages, subscriptions tabs, analytics
- Project Overview (v2): Current stats

### Steering Updates
- **§16 Requirements-First Rule** — Must document requirement BEFORE coding
- **§8 Test Coverage** — 80% minimum, unit + E2E mandatory for every feature
- **§16 Confluence Sync** — Mandatory in same session as code change (table of which pages to update)
- **Hook:** .kiro/hooks/requirements-first.json (UserPromptSubmit trigger)

### Documents Created
- docs/production-readiness.md — Full gap analysis
- docs/infrastructure-decision.md — Neon/Upstash analysis (later superseded by Docker plan)
- docs/pending-tasks.md — Task tracker
- docs/subscription-badge-ab-test.md — 5 badge style options for future A/B test
- docs/docker-aws-deployment-plan.md — Docker + ECS architecture (next session plan)
- packages/api/.env.production.template — All production env vars documented
- scripts/deploy-production.sh — Manual deployment script

---

## Database Changes

### New Tables (created via manual SQL, not in migrations)
- subscription_promotions (discount_percent, applies_to, dates, event_type, theme_color, banner)
- analytics_events (user_id, session_id, event_type, page, element, metadata)
- email_templates (slug, name, subject, html_body, variables, sender_address_id)
- email_sender_addresses (email, name, purpose, is_verified)
- email_send_log (template_slug, to_email, status, attempts, errors)

### Migration Fixes
- 004_shared_trip_enhancements: Removed duplicate is_shared column add
- 006_home_location: Changed decimal(9,6) to numeric (Kysely compatibility)

---

## CI/CD Pipeline
- GitHub Actions workflows updated (ci.yml, deploy.yml) for Docker/AWS approach
- Branch strategy: develop → QA auto-deploy, main → production with manual approval
- GitHub Secrets added: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, QA_JWT_SECRET, QA_STRIPE_SECRET_KEY

---

## Decisions Made

- **Vercel abandoned** — Fastify doesn't suit serverless (cold starts, bundling, Redis issues)
- **Docker + AWS ECS chosen** — Reliable, matches local dev, no serverless adapters needed
- **Redis skipped on serverless** — Added graceful fallback to in-memory when Redis unavailable
- **Neon/Upstash abandoned** — Will use RDS + ElastiCache (same VPC, no cold starts)
- **pnpm version:** Set to 9.12.0 for build compatibility
- **Shared package:** Exports point to src/index.ts for local dev (tsx handles it)

---

## Next Session Tasks

1. Create Dockerfile for API
2. CloudFormation: RDS + ElastiCache + ECS + ALB + S3 + CloudFront
3. Update GitHub Actions for Docker build → ECR → ECS
4. Deploy, run migrations, seed data
5. Verify qa.neyya.ai works end-to-end
6. Admin auth guard (currently no login required)
7. Test coverage for critical paths
