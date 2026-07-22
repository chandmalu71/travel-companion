# Production Readiness Assessment

**Date:** July 2026
**Status:** Development Complete — Infrastructure & Integration Pending

---

## Summary

The Neyya.ai travel companion application has **44 requirements fully implemented** in code. All features work end-to-end in the development environment with mocks and stubs. The gap to production is:

1. External service credentials (Stripe, OAuth, SES, weather API)
2. Cloud infrastructure (RDS, Redis, S3, CDN)
3. Test coverage (unit + E2E)
4. Monitoring & error tracking

---

## Critical Blockers (Cannot Launch Without)

| # | Item | Current State | What's Needed | Effort |
|---|------|--------------|---------------|--------|
| 1 | Email delivery | console.log in dev | AWS SES or SendGrid: domain verification, templates | 1 day |
| 2 | Real OAuth (Google + Microsoft) | Local dev mock | Google Cloud Console + Azure AD app registration, redirect URIs | 1-2 days |
| 3 | Stripe payment | Stubs in place | Stripe account, API keys, webhook endpoint, customer portal | 2 days |
| 4 | Production PostgreSQL | localhost:5432 | AWS RDS or Aurora PostgreSQL (eu-west-1) | 1 day |
| 5 | Production Redis | localhost:6379 | AWS ElastiCache (sessions, rate limiting, cache) | 0.5 day |
| 6 | Domain + SSL + Hosting | Not configured | neyya.ai DNS (Route 53), CloudFront/Vercel, HTTPS cert | 1 day |
| 7 | Secrets management | .env file | AWS Secrets Manager or SSM Parameter Store | 0.5 day |

**Minimum viable launch effort: ~7 working days**

---

## High Priority (Should Have for Launch)

| # | Item | Current State | What's Needed | Effort |
|---|------|--------------|---------------|--------|
| 8 | Test coverage | Low | Unit tests for API + E2E for core flows | 3-5 days |
| 9 | Error tracking | None | Sentry DSN, error boundary, source maps | 0.5 day |
| 10 | Real weather API | Mock data | OpenWeatherMap API key (free tier OK) | 0.5 day |
| 11 | File upload to S3 | Local filesystem | S3 bucket, IAM policy, pre-signed URLs | 1 day |
| 12 | Rate limiting tuning | Dev defaults | Production thresholds per endpoint | 0.5 day |
| 13 | CORS production config | localhost:3001 | neyya.ai domain allowlist | 0.5 hour |

---

## Core Feature Gaps (Functional)

| Feature | Gap | Impact | Effort |
|---------|-----|--------|--------|
| Booking extraction from email | Regex-based, misses complex formats | Medium — some bookings won't auto-detect | 3 days (AI parsing) |
| Real AI tips/chat | Hardcoded/stub responses | Medium — "AI-powered" needs real AI | 2 days (Bedrock wiring) |
| Notification delivery | In-app only, no email/push | Low for web MVP | 2 days |
| Offline mode | Designed, not built | Low for web, critical for mobile | Deferred |

---

## Not Needed for Launch (Post-Launch)

- Mobile app (React Native)
- WhatsApp/SMS delivery (Twilio)
- Amadeus/Skyscanner integration
- Social media sharing platform APIs
- Real-time WebSocket (polling works)
- AWS Cost Explorer integration
- Multi-region deployment
- Bedrock auto-translation (manual via admin for now)

---

## Recommended Launch Sequence

### Phase 1 — Infrastructure (Week 1)
1. Set up AWS resources: RDS, ElastiCache, S3, SES
2. Deploy API + Web + Admin (ECS/Fargate or Vercel)
3. Configure domain (neyya.ai), SSL, CloudFront
4. Wire secrets (Secrets Manager/SSM)

### Phase 2 — External Services (Week 1-2)
5. Stripe: production keys, webhook verification, customer portal
6. Google + Microsoft OAuth: production credentials, redirect URIs
7. SES: domain verification, email templates (verification, reset, invite)
8. OpenWeatherMap: API key

### Phase 3 — Quality (Week 2)
9. Core E2E tests: auth, trips, expenses, subscriptions, messaging
10. Error tracking: Sentry DSN + React error boundary
11. Monitoring: CloudWatch alarms (5xx rate, latency, DB connections)
12. Load test: key endpoints (login, trips, expenses)

### Phase 4 — Launch
13. DNS cutover (neyya.ai → CloudFront)
14. Smoke test all critical paths
15. Invite beta users (convert demo accounts to real signups)
16. Monitor first 48 hours closely

---

## Current Architecture

```
┌────────────────────────────────────────────────────────┐
│                    neyya.ai (CDN)                       │
├──────────┬──────────┬──────────────────────────────────┤
│  Web     │  Admin   │  Landing Page                    │
│  :3001   │  :3002   │  (same as web)                   │
│  Next.js │  Next.js │                                  │
└────┬─────┴────┬─────┴──────────────────────────────────┘
     │          │
     └────┬─────┘
          │ API calls
          ▼
┌─────────────────────────────────────────┐
│         API Server (:3000)              │
│         Fastify + TypeScript            │
├─────────────────────────────────────────┤
│  Routes: auth, trips, bookings,         │
│  expenses, messaging, subscriptions,    │
│  analytics, connections, family,        │
│  email-aliases, weather, admin          │
└────┬────────────┬───────────────────────┘
     │            │
     ▼            ▼
┌─────────┐  ┌─────────┐  ┌─────────┐
│PostgreSQL│  │  Redis  │  │   S3    │
│  (RDS)  │  │(Elasti) │  │ (files) │
└─────────┘  └─────────┘  └─────────┘
```

---

## Database (21 migrations, 40+ tables)

Key tables: users, trips, bookings, expenses, family_members, user_connections, messages, conversations, subscription_plans, user_subscriptions, subscription_promotions, subscription_campaigns, analytics_events, user_email_aliases, translation_keys, supported_currencies, supported_languages

---

## Environment Variables Required for Production

```env
# Database
DATABASE_URL=postgresql://user:pass@rds-host:5432/travel_companion

# Redis
REDIS_URL=redis://elasticache-host:6379

# Auth
JWT_SECRET=<random-256-bit>
COGNITO_USER_POOL_ID=eu-west-1_XXXXXX
COGNITO_CLIENT_ID=xxxxxxxxxx

# OAuth
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxx
MICROSOFT_CLIENT_ID=xxx
MICROSOFT_CLIENT_SECRET=xxx

# Stripe
STRIPE_SECRET_KEY=sk_live_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
STRIPE_PUBLISHABLE_KEY=pk_live_xxx

# Email
SES_REGION=eu-west-1
SES_FROM_ADDRESS=noreply@neyya.ai

# Storage
S3_BUCKET=neyya-uploads
S3_REGION=eu-west-1

# Weather
OPENWEATHERMAP_API_KEY=xxx

# AI
BEDROCK_REGION=eu-west-1
BEDROCK_MODEL_ID=anthropic.claude-3-haiku-20240307-v1:0

# Encryption
PII_ENCRYPTION_KEY=<32-byte-hex>

# App
APP_URL=https://neyya.ai
ADMIN_URL=https://admin.neyya.ai
API_URL=https://api.neyya.ai
```
