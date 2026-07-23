# Production Launch — Action Checklist

**Target:** Go live at https://neyya.ai  
**Current:** QA live at https://qa.neyya.ai  
**Estimated Total Effort:** 1-2 days  
**Last Updated:** July 23, 2026

---

## Phase 1: Infrastructure (Day 1 Morning)

- [x] **1.1** Deploy ECR repositories (shared across environments)
- [x] **1.2** Deploy QA network stack (VPC, subnets, security groups)
- [x] **1.3** Create QA RDS PostgreSQL (db.t4g.micro)
- [x] **1.4** Create QA ElastiCache Redis (cache.t4g.micro)
- [x] **1.5** Create QA secrets in Secrets Manager (all keys)
- [x] **1.6** Deploy QA ECS stack (cluster, ALB, 3 services)
- [x] **1.7** QA ACM certificate issued (*.neyya.ai)
- [x] **1.8** QA HTTPS listener configured
- [ ] **1.9** Deploy production network stack
- [ ] **1.10** Create production RDS (db.t4g.small, Multi-AZ, 50GB)
- [ ] **1.11** Create production ElastiCache Redis (cache.t4g.small)
- [ ] **1.12** Create production secrets in Secrets Manager (`neyya/production/*`)
- [ ] **1.13** Request production ACM certificate
- [ ] **1.14** Deploy production ECS stack

## Phase 2: DNS & SSL (Day 1 Afternoon)

- [x] **2.1** QA ACM DNS validation record added
- [x] **2.2** QA HTTPS listener on ALB
- [x] **2.3** QA Route 53 records (api-qa, qa, admin-qa → ALB)
- [x] **2.4** QA domains load correctly over HTTPS
- [ ] **2.5** Production ACM DNS validation record
- [ ] **2.6** Production HTTPS listener on ALB
- [ ] **2.7** Production Route 53 records:
  - `neyya.ai` → production ALB (ALIAS record)
  - `api.neyya.ai` → production ALB
  - `admin.neyya.ai` → production ALB
- [ ] **2.8** Verify all production domains load over HTTPS
- [ ] **2.9** Update CORS_ORIGINS in API to: `https://neyya.ai,https://admin.neyya.ai`

## Phase 3: External Services (Day 1 Afternoon)

- [x] **3.1** Google OAuth — QA credentials configured in Secrets Manager
- [x] **3.2** Microsoft OAuth — QA credentials configured
- [x] **3.3** Facebook OAuth — QA credentials configured
- [x] **3.4** Stripe — test keys configured (`sk_test_`, `pk_test_`)
- [x] **3.5** OpenWeatherMap — API key configured
- [x] **3.6** AWS SES — domain verified (`neyya.ai`)
- [ ] **3.7** Google OAuth — add production redirect URI: `https://api.neyya.ai/api/auth/google/callback`
- [ ] **3.8** Microsoft OAuth — add production redirect URI
- [ ] **3.9** Facebook OAuth — add production domain + redirect URI
- [ ] **3.10** Stripe — switch to live keys (`sk_live_`, `pk_live_`)
- [ ] **3.11** Stripe — register production webhook: `https://api.neyya.ai/api/webhooks/stripe`
- [ ] **3.12** AWS SES — request production access (move out of sandbox)
  - **Wait time: 24-48 hours**

## Phase 4: Data & Seed (Day 1 Evening)

- [x] **4.1** QA migrations ran (21 migrations applied)
- [x] **4.2** QA demo + mock data seeded
- [x] **4.3** QA admin account created (`chand.malu@gmail.com` with super-admin)
- [x] **4.4** Subscription plans seeded (Free/Pro/Premium at €14.99/€29.99)
- [x] **4.5** Translation keys seeded (350+ keys)
- [ ] **4.6** Production migrations verified
- [ ] **4.7** Production data seeded: `./scripts/seed-environment.sh -e production`
- [ ] **4.8** Production admin account created

## Phase 5: Testing & Verification (Day 2 Morning)

- [ ] **5.1** Health check: `curl https://api.neyya.ai/api/health`
- [ ] **5.2** Login with demo account: `demo@neyya.ai` / `TryNeyya2026`
- [ ] **5.3** Login with admin: `chand.malu@gmail.com` / `!Neyya-AWS`
- [ ] **5.4** Test Google OAuth login (production redirect)
- [ ] **5.5** Test trip creation and booking addition
- [ ] **5.6** Test expense creation (shared + personal)
- [ ] **5.7** Test messaging (send message in trip chat)
- [ ] **5.8** Test subscription upgrade flow (Stripe checkout with live test card)
- [ ] **5.9** Test admin panel login + user list
- [ ] **5.10** Test admin impersonation
- [ ] **5.11** Verify weather tab loads on a trip
- [ ] **5.12** Verify AI tips display on trips
- [ ] **5.13** Verify map tab shows Google Maps
- [ ] **5.14** Admin translations page shows all 350+ keys

## Phase 6: Monitoring & Safety (Day 2 Afternoon)

- [ ] **6.1** Set up CloudWatch alarms:
  - API 5xx error rate > 5% (alarm)
  - ECS CPU > 80% (warning)
  - RDS connections > 80% (warning)
  - RDS free storage < 5GB (alarm)
- [ ] **6.2** Set up Sentry error tracking (optional but recommended):
  - Create Sentry project
  - Add `SENTRY_DSN` to secrets
  - Add Sentry SDK to API
- [ ] **6.3** Enable RDS automated backups (30-day retention)
- [ ] **6.4** Enable RDS deletion protection
- [ ] **6.5** Set up nightly demo reset (EventBridge → ECS RunTask or cron):
  ```bash
  ./scripts/reset-demo-nightly.sh
  ```

## Phase 7: Go Live (Day 2)

- [ ] **7.1** Final smoke test on all critical paths
- [ ] **7.2** Announce to pilot users (share demo link)
- [ ] **7.3** Monitor CloudWatch logs for first 24 hours
- [ ] **7.4** Verify no 5xx errors in first hour
- [ ] **7.5** Check that demo account reset works overnight

---

## Blockers That Require Waiting

| Item | Wait Time | Can Proceed Without? |
|------|-----------|---------------------|
| SES production access | 24-48 hours | Yes (emails won't send but app works) |
| ACM cert DNS validation | 5-30 minutes | No (need HTTPS) |
| DNS propagation | 1-5 minutes | Minimal wait |

---

## Post-Launch (Week 1)

- [ ] Set up ECS auto-scaling (min: 1, max: 3 per service)
- [ ] Add NAT Gateway for private subnet security
- [ ] Wire Bedrock for real AI translations
- [ ] Set up cross-region RDS backup
- [ ] Review and tighten IAM permissions
- [ ] Add password reset + email verification flow
- [ ] Write Playwright E2E smoke tests
- [ ] Add custom domain to Stripe customer portal

---

## Quick Reference — Production vs QA

| | QA | Production |
|---|---|---|
| Web | qa.neyya.ai | neyya.ai |
| API | api-qa.neyya.ai | api.neyya.ai |
| Admin | admin-qa.neyya.ai | admin.neyya.ai |
| RDS | db.t4g.micro / single-AZ | db.t4g.small / multi-AZ |
| Stripe | sk_test_ | sk_live_ |
| SES | sandbox | production |
| Deploy | push to `develop` | push to `main` or manual dispatch |
