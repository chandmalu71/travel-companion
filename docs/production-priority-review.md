# Production Readiness — Priority Review

**Date:** July 24, 2026  
**Current State:** QA deployed, CI/CD active, all core features built  
**Target:** Production launch on neyya.ai

---

## Current Infrastructure Status

| Component | QA Status | Production Status |
|-----------|-----------|-------------------|
| ECS Fargate (API/Web/Admin) | ✅ Running | ❌ Not deployed |
| RDS PostgreSQL | ✅ Running | ❌ Not deployed |
| ElastiCache Redis | ✅ Running | ❌ Not deployed |
| ALB + HTTPS | ✅ Running | ❌ Not deployed |
| ECR (Docker images) | ✅ 3 repos | ✅ Same repos |
| CI/CD (GitHub Actions) | ✅ Auto-deploy | ✅ Manual trigger ready |
| SES (Email) | ✅ Sandbox | ❌ Need production access |
| DNS (Route 53) | ✅ QA subdomains | ❌ Production A records |
| ACM Certificate | ✅ *.neyya.ai | ✅ Covers production |
| Secrets Manager | ✅ QA secrets | ❌ Production secrets needed |

---

## 🔴 CRITICAL — Must Fix Before Launch

These are hard blockers. The app cannot go live without them.

| # | Task | Effort | Owner | Status |
|---|------|--------|-------|--------|
| 1 | **SES production access request** | 0 (waiting) | AWS/You | Submit request — currently sandbox (can only send to verified emails) |
| 2 | **Production infrastructure deploy** | 2-3 hrs | Dev | Run CloudFormation stacks for prod (network, ECS, RDS, Redis) |
| 3 | **Production secrets** | 1 hr | You/Dev | Live Stripe keys, OAuth redirect URIs for neyya.ai, production DB URL |
| 4 | **DNS cutover** | 15 min | Dev | neyya.ai, api.neyya.ai, admin.neyya.ai → production ALB |
| 5 | **Cookie consent banner** | 2 hrs | Dev | GDPR requirement — block non-essential cookies until consent |
| 6 | **Stripe live keys** | 30 min | You | Switch from test to live keys in production secrets |
| 7 | **Wire transactional emails** | 2 hrs | Dev | Password reset, email verification, invitation emails via SES (currently console.log) |

**Estimated critical path: 1-2 days of dev work + waiting for SES approval (24-48h)**

---

## 🟠 HIGH PRIORITY — Should Have for Launch

These won't break the app but will significantly impact user experience or trust.

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 8 | **Email verification flow** | 2 hrs | Send verification email on register, verify link endpoint |
| 9 | **Password change/reset flow** | 2 hrs | Forgot password → SES email → reset page |
| 10 | **Error tracking (Sentry)** | 1 hr | React error boundary + API error middleware (needs Sentry DSN) |
| 11 | **Account deletion (GDPR)** | 2 hrs | Delete all user data, send confirmation, hard-delete after 30-day grace |
| 12 | **Rate limiting on auth routes** | 30 min | Prevent brute-force (already have rate-limit plugin, just wire it) |
| 13 | **Demo account Oliver fix** | 15 min | Fix family member duplicate in seed data |
| 14 | **OpenWeatherMap live API key** | 15 min | Replace mock weather with real data (just needs key) |
| 15 | **Automation scheduled processor** | 1 hr | EventBridge rule to call /api/admin/automations/process every 15 min |

**Estimated: 1-2 days of dev work**

---

## 🟡 MEDIUM PRIORITY — Good to Have

Polish items that improve the product but are not blocking launch.

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 16 | **Avatar upload** | 2 hrs | S3 presigned URL flow + profile display |
| 17 | **Admin chat sessions page** | 3 hrs | View all AI chat conversations in admin |
| 18 | **Admin feedback board page** | 2 hrs | Triage bugs/feature requests from chat |
| 19 | **A/B variant assignment during email sends** | 2 hrs | Split traffic between variants |
| 20 | **Lead score scheduled recalculation** | 1 hr | Cron/EventBridge to recompute scores |
| 21 | **Referral auto-reward on conversion** | 1 hr | When referred user upgrades, credit referrer |
| 22 | **Proactive chat triggers** | 2 hrs | 3rd trip, trial day 14, plan limit messages |
| 23 | **Social media OAuth connections** | 3 hrs | FB/IG/Twitter/LinkedIn actual posting (currently UI only) |
| 24 | **Dark mode for all sub-pages** | 3-4 hrs | Remaining pages need dark:* variants (settings, trips, expenses) |

**Estimated: 3-5 days of dev work**

---

## 🟢 LOW PRIORITY — Post-Launch / Nice to Have

Can safely defer to after launch. Not expected by early users.

| # | Task | Effort | Notes |
|---|------|--------|-------|
| 25 | Apple Sign-In | 1 day | Needs Apple Developer ($99/yr) |
| 26 | Bedrock Knowledge Base (replace inline RAG) | 2 days | Current inline knowledge base works fine |
| 27 | Weekly AI summary generation | 1 day | Batch analysis of chat themes |
| 28 | Socket.io real-time messaging | 2 days | Polling works for now |
| 29 | Trip Photos & Gallery (full impl) | 1 week | Deferred to mobile phase |
| 30 | AI Social Sharing (actual posting) | 3 days | Premium feature, UI stub exists |
| 31 | Mobile app (React Native) | Weeks | Major effort, post-launch |
| 32 | WhatsApp/SMS notifications (Twilio) | 1 day | Push + email covers launch |
| 33 | Offline sync (IndexedDB) | 3 days | Web app doesn't need this urgently |
| 34 | Amadeus/Skyscanner integration | 2 days | Needs partner agreements |
| 35 | E2E test suite expansion | 3-5 days | Current 28 tests cover core flows |

---

## Launch Checklist (Sequential Order)

```
1. [ ] Submit SES production access request (24-48h wait)
2. [ ] Deploy production CloudFormation stacks
3. [ ] Create production secrets in Secrets Manager
4. [ ] Set live Stripe keys
5. [ ] Build cookie consent banner
6. [ ] Wire transactional emails (register verify, password reset, invitations)
7. [ ] DNS cutover (neyya.ai → production ALB)
8. [ ] Smoke test all critical flows
9. [ ] Update Google/Microsoft/Facebook OAuth redirect URIs
10. [ ] Run seed data on production (plans, currencies, languages)
11. [ ] Create admin account on production
12. [ ] Go live announcement
```

---

## What's Already Working (No Action Needed)

- ✅ Full trip management (CRUD, timeline, map, members, groups)
- ✅ Booking extraction from email (Gmail/Outlook/IMAP)
- ✅ Expense tracking with receipt scanning, budgets, splitting
- ✅ AI search, POI engine, trip tips
- ✅ Messaging (DM, group, trip chat, polls, decisions)
- ✅ Subscriptions (Free/Pro/Premium with plan limits)
- ✅ CRM (leads, campaigns, automations, scoring, referrals)
- ✅ AI Chat Concierge (floating widget + backend)
- ✅ Landing page with lead capture
- ✅ Legal pages (Privacy, Terms, Cookies, GDPR)
- ✅ Admin panel (users, trips, CRM, subscriptions, config, translations)
- ✅ OAuth (Google, Microsoft, Facebook)
- ✅ Dark/light mode toggle
- ✅ Internationalisation (20+ languages, currency conversion)
- ✅ Docker/ECS deployment pipeline
- ✅ Demo account with rich data
- ✅ 26 database migrations applied

---

## Recommendation

**Fastest path to production (2-3 days):**
1. Items 1-7 (critical) can be done in parallel with SES approval wait
2. Cookie consent banner is the only significant code work
3. Transactional email wiring is straightforward (patterns exist in email.ts)
4. Production deploy is mostly running existing CloudFormation stacks with production params

**After soft launch, prioritize:** items 8-15 (high priority) in the first week.
