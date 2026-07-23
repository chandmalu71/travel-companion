# Production Launch — Action Checklist

**Target:** Go live at https://neyya.ai  
**Current:** QA live at https://qa.neyya.ai  
**Estimated Total Effort:** 1-2 days

---

## Phase 1: Infrastructure (Day 1 Morning)

- [ ] **1.1** Deploy production network stack
  ```bash
  ./scripts/deploy.sh setup -e production
  ```
- [ ] **1.2** Create production RDS (db.t4g.small, Multi-AZ, 50GB)
- [ ] **1.3** Create production ElastiCache Redis (cache.t4g.small)
- [ ] **1.4** Create production secrets in Secrets Manager (`neyya/production/*`)
  - DATABASE_URL, REDIS_URL, JWT_SECRET, PII_ENCRYPTION_KEY
  - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
  - MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET
  - FACEBOOK_APP_ID, FACEBOOK_APP_SECRET
  - STRIPE_SECRET_KEY (live key), STRIPE_WEBHOOK_SECRET, STRIPE_PUBLISHABLE_KEY
  - OPENWEATHERMAP_API_KEY
- [ ] **1.5** Request ACM certificate for production (`*.neyya.ai` in production account)
- [ ] **1.6** Deploy production ECS stack (ecs-services.yml with production params)
- [ ] **1.7** Build and push production Docker images
  ```bash
  ./scripts/deploy.sh deploy -e production
  ```

## Phase 2: DNS & SSL (Day 1 Afternoon)

- [ ] **2.1** Add ACM DNS validation record for production cert
- [ ] **2.2** Add HTTPS listener to production ALB (once cert is issued)
- [ ] **2.3** Point Route 53 records:
  - `neyya.ai` → production ALB (ALIAS record)
  - `api.neyya.ai` → production ALB
  - `admin.neyya.ai` → production ALB
- [ ] **2.4** Verify all 3 domains load correctly over HTTPS
- [ ] **2.5** Update CORS_ORIGINS in API to: `https://neyya.ai,https://admin.neyya.ai`

## Phase 3: External Services (Day 1 Afternoon)

- [ ] **3.1** Google OAuth — add production redirect URI: `https://api.neyya.ai/api/auth/google/callback`
- [ ] **3.2** Microsoft OAuth — add production redirect URI: `https://api.neyya.ai/api/auth/microsoft/callback`
- [ ] **3.3** Facebook OAuth — add production redirect URI and domain
- [ ] **3.4** Stripe — switch to live keys (`sk_live_`, `pk_live_`)
- [ ] **3.5** Stripe — register production webhook: `https://api.neyya.ai/api/webhooks/stripe`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`
- [ ] **3.6** AWS SES — request production access (move out of sandbox)
  - Go to SES → Account dashboard → Request production access
  - Explain use case: transactional emails (verification, password reset, trip invites)
  - **Wait time: 24-48 hours**
- [ ] **3.7** Verify SES `neyya.ai` domain is verified in production account

## Phase 4: Data & Seed (Day 1 Evening)

- [ ] **4.1** Verify migrations ran on first deploy (check API logs)
- [ ] **4.2** Run demo + mock data seed:
  ```bash
  ./scripts/seed-environment.sh -e production
  ```
- [ ] **4.3** Create admin account (`chand.malu@gmail.com` with super-admin role)
- [ ] **4.4** Verify subscription plans are seeded (Free/Pro/Premium at €14.99/€29.99)
- [ ] **4.5** Verify translation keys are seeded (350 keys)

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
