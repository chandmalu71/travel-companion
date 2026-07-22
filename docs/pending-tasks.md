# Pending Tasks — Production Launch

**Date:** July 2026
**Status:** In progress — blockers being resolved one by one

---

## Completed This Session

- [x] Email delivery service (SES) — code + templates + admin UI
- [x] SES domain verification (neyya.ai DKIM verified in eu-west-1)
- [x] Route 53 hosted zone created for neyya.ai
- [x] Nameservers updated in Squarespace → Route 53
- [x] SES personal email verified (chand.malu@gmail.com)
- [x] SES test email sent successfully
- [x] Google OAuth — code + credentials in .env
- [x] Microsoft OAuth — code + credentials in .env
- [x] Facebook OAuth — code + credentials in .env
- [x] Privacy Policy page created (/privacy)
- [x] App icon generated (1024x1024 PNG)
- [x] Subscription plan editing wired to real API
- [x] In-house analytics (event tracking + admin dashboard)
- [x] Promotional pricing with strikethrough
- [x] Seasonal event promotions (timeline calendar view)
- [x] Plan limit enforcement (server-side)
- [x] Admin campaigns CRUD (was placeholder)
- [x] Admin user overrides with search autocomplete
- [x] Plan badge next to logo (Pro/Premium)
- [x] Requirements synced (Req 34-45)
- [x] Confluence all pages updated (Features, API, DB, Deployment, Dev Guide, Admin, Overview)
- [x] Steering updated (requirements-first rule, test coverage, Confluence sync mandatory)
- [x] Requirements-first hook created

---

## Still Pending — Code Work (I can do)

### Critical for Launch

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 1 | **Stripe integration** — real checkout sessions, webhook handling, subscription lifecycle | 2 days | Needs Stripe account + keys |
| 2 | **SES production access** — request sent, waiting for AWS approval | 0 (waiting) | Can only send to verified emails until approved |
| 3 | **Terms of Service page** (/terms) | 0.5 hr | Needed for app stores + Facebook |
| 4 | **Test coverage** — unit tests for auth, trips, expenses, subscriptions, plan limits | 3-5 days | Biggest code gap |
| 5 | **Production env config** — Docker/Vercel config, CORS for neyya.ai, production secrets | 1 day | |
| 6 | **Wire email service into app** — replace console.log calls with EmailService.sendTemplate() | 0.5 day | auth register, password reset, invitations, alias verification |

### High Priority (Pre-Launch)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 7 | **Error tracking (Sentry)** — React error boundary + API error reporting | 0.5 day | Need Sentry DSN |
| 8 | **Production database (RDS)** — create Aurora PostgreSQL, run migrations | 1 day | AWS infrastructure |
| 9 | **Production Redis (ElastiCache)** — sessions, rate limiting | 0.5 day | AWS infrastructure |
| 10 | **CI/CD pipeline** — GitHub Actions (lint, test, build, deploy) | 1 day | |
| 11 | **CORS + security headers** — production domain allowlist, HSTS, CSP | 0.5 hr | |
| 12 | **Real weather API** — wire OpenWeatherMap (just needs API key) | 0.5 hr | |

### Post-Launch (Can Defer)

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 13 | Apple Sign-In | 1 day | Needs Apple Developer account ($99/yr) |
| 14 | Real AI (Bedrock) — tips, chat, booking parsing | 2-3 days | Needs Bedrock model access |
| 15 | Socket.io real-time messaging | 1-2 days | Polling works for now |
| 16 | Mobile app (React Native) | Weeks | Major effort |
| 17 | WhatsApp/SMS delivery (Twilio) | 1 day | |
| 18 | Offline sync (IndexedDB/SQLite) | 2-3 days | |
| 19 | E2E tests for messaging (multi-user) | 2 days | |
| 20 | Amadeus/Skyscanner integration | 2 days | Needs partner agreements |

---

## Pending — Requires YOUR Action

| # | Task | What You Need To Do |
|---|------|-------------------|
| 1 | **Stripe account** | Sign up at stripe.com, get API keys (secret + publishable + webhook secret) |
| 2 | **SES production access** | Wait for AWS approval (submitted), or re-submit if not done yet |
| 3 | **Facebook app review** | Fill remaining fields once neyya.ai is live (privacy URL, data deletion, category, icon) |
| 4 | **Google OAuth consent screen** | Click "Publish App" when ready for public users (currently Testing mode) |
| 5 | **OpenWeatherMap API key** | Sign up at openweathermap.org (free tier: 1000 calls/day) |
| 6 | **Sentry account** | Sign up at sentry.io, create project, get DSN |
| 7 | **Domain SSL** | Will be automatic via ACM when we set up CloudFront |
| 8 | **Apple Developer account** | $99/year — needed only for Apple Sign-In (can defer) |

---

## Infrastructure To Create (AWS)

| Resource | Purpose | Status |
|----------|---------|--------|
| Route 53 hosted zone (neyya.ai) | DNS | ✅ Created |
| SES domain identity | Email sending | ✅ Verified |
| RDS Aurora PostgreSQL | Production database | ❌ Not created |
| ElastiCache Redis | Sessions, cache, rate limiting | ❌ Not created |
| S3 bucket (neyya-uploads) | File/receipt storage | ❌ Not created |
| CloudFront distribution | CDN for web/admin | ❌ Not created |
| ACM certificate | SSL for neyya.ai | ❌ Not created |
| ECS Fargate (or Vercel) | API hosting | ❌ Not created |
| Secrets Manager | Store API keys, secrets | ❌ Not created |
| CloudWatch | Logging, alarms | ❌ Not created |

---

## Env Vars Status

| Variable | Status |
|----------|--------|
| GOOGLE_CLIENT_ID | ✅ Set |
| GOOGLE_CLIENT_SECRET | ✅ Set |
| MICROSOFT_CLIENT_ID | ✅ Set |
| MICROSOFT_CLIENT_SECRET | ✅ Set |
| FACEBOOK_APP_ID | ✅ Set |
| FACEBOOK_APP_SECRET | ✅ Set |
| STRIPE_SECRET_KEY | ❌ Needs Stripe account |
| STRIPE_WEBHOOK_SECRET | ❌ Needs Stripe account |
| OPENWEATHERMAP_API_KEY | ❌ Needs signup |
| SES_FROM_ADDRESS | ✅ noreply@neyya.ai (verified) |
| PII_ENCRYPTION_KEY | ✅ Set |
| JWT_SECRET | ✅ Set |
| DATABASE_URL | ✅ Set (localhost, needs production RDS) |
| REDIS_URL | ✅ Set (localhost, needs production ElastiCache) |

---

## Suggested Next Steps (Priority Order)

1. **Stripe** — create account, get keys, I build the integration
2. **Wire email service** — replace console.log with real sends
3. **Test coverage** — unit tests for critical paths
4. **Production infra** — RDS + Redis + S3 + CloudFront (can automate via CloudFormation)
5. **CI/CD** — GitHub Actions pipeline
6. **Deploy** — first deployment to production
7. **Smoke test** — verify all flows work end-to-end
8. **Beta invite** — first real users
