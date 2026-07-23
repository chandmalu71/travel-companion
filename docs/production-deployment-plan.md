# Production Deployment Plan

**Last Updated:** July 23, 2026  
**QA Environment:** https://qa.neyya.ai (LIVE)  
**Target Production:** https://neyya.ai

---

## CI/CD Pipeline Status

The GitHub Actions pipeline (`.github/workflows/deploy-docker.yml`) is ready and handles:
- **develop branch** → auto-deploys to QA
- **main branch / manual dispatch** → deploys to Production

### What's Needed to Activate Production CI/CD

| Step | Action | Status |
|------|--------|--------|
| 1 | Add `AWS_ACCESS_KEY_ID` to GitHub Secrets | Pending |
| 2 | Add `AWS_SECRET_ACCESS_KEY` to GitHub Secrets | Pending |
| 3 | Deploy production infrastructure stacks | Pending |
| 4 | Create production secrets in Secrets Manager | Pending |
| 5 | DNS: point neyya.ai → production ALB | Pending |

**To set up GitHub Secrets:**
1. Go to GitHub repo → Settings → Secrets and variables → Actions
2. Add: `AWS_ACCESS_KEY_ID` (from `neyya-deploy` user)
3. Add: `AWS_SECRET_ACCESS_KEY` (from `neyya-deploy` user)
4. Add: `AWS_REGION` = `eu-west-1`

**Alternative (more secure): Use OIDC role assumption**
- Create an IAM role with GitHub OIDC trust policy
- Add `AWS_DEPLOY_ROLE_ARN` to GitHub Secrets
- The workflow already supports this via `aws-actions/configure-aws-credentials@v4`

---

## Production Infrastructure Deployment

Run these commands to create the production environment (identical to QA but with production params):

```bash
export AWS_PROFILE=neyya

# 1. Network stack (VPC, subnets, security groups)
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/network.yml \
  --stack-name neyya-production-network \
  --parameter-overrides Environment=production ProjectName=neyya \
  --region eu-west-1

# 2. RDS (larger instance for production)
aws rds create-db-instance \
  --db-instance-identifier neyya-db-production \
  --engine postgres --engine-version 16.14 \
  --db-instance-class db.t4g.small \
  --allocated-storage 50 --storage-type gp3 \
  --multi-az \
  --master-username neyya_admin \
  --master-user-password '<STRONG_PASSWORD>' \
  --db-name neyya \
  --region eu-west-1

# 3. ElastiCache Redis
aws elasticache create-cache-cluster \
  --cache-cluster-id neyya-redis-production \
  --engine redis --engine-version 7.0 \
  --cache-node-type cache.t4g.small \
  --num-cache-nodes 1 \
  --region eu-west-1

# 4. Secrets Manager (production values)
aws secretsmanager create-secret --name neyya/production/DATABASE_URL --secret-string "postgresql://..."
aws secretsmanager create-secret --name neyya/production/REDIS_URL --secret-string "redis://..."
aws secretsmanager create-secret --name neyya/production/JWT_SECRET --secret-string "$(openssl rand -base64 48)"
# ... (same keys as QA but with production values)

# 5. ECS stack
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/ecs-services.yml \
  --stack-name neyya-production-ecs \
  --parameter-overrides Environment=production ... \
  --capabilities CAPABILITY_NAMED_IAM

# 6. DNS (in Route 53)
# Point neyya.ai, api.neyya.ai, admin.neyya.ai to production ALB
```

---

## Features & Actions Pending Before Go-Live

### Critical (Must Fix)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 1 | **Weather API not working** — route returns 404, endpoint may not be registered | Users can't see weather on trips | 1-2 hours |
| 2 | **Family members route 404** — UI calls `/api/family` but API has `/api/family-members` | Family tab broken in Settings | 30 min |
| 3 | **OAuth callback URLs** — Google/Microsoft/Facebook need production redirect URIs configured | Users can't sign in via OAuth | 1 hour per provider |
| 4 | **Stripe webhook endpoint** — need to register `https://api.neyya.ai/api/webhooks/stripe` in Stripe dashboard | Payments won't process | 30 min |
| 5 | **SES production access** — currently in sandbox (can only send to verified emails) | Emails won't deliver | Request from AWS (24-48h) |
| 6 | **First/Last name in profile** — currently only `display_name`, no separate fields | Profile incomplete | 2 hours (DB + API + UI) |

### Important (Should Fix Before Public Launch)

| # | Item | Impact | Effort |
|---|------|--------|--------|
| 7 | Error tracking (Sentry) | Can't diagnose production issues | 2 hours |
| 8 | CloudWatch alarms (5xx rate, CPU) | No alerts on failures | 1 hour |
| 9 | Rate limiting verification | Could be abused | 1 hour |
| 10 | CORS production config | Currently allows QA domains | 30 min |
| 11 | Password reset flow | Users can't recover accounts | 3-4 hours |
| 12 | Email verification flow | Unverified accounts | 2-3 hours |
| 13 | NAT Gateway for private subnets | More secure than public IPs | 30 min + $32/mo |

### Nice to Have (Post-Launch)

| # | Item | Effort |
|---|------|--------|
| 14 | Mobile app (React Native) | 4-6 weeks |
| 15 | Bedrock real AI translations | 2-3 hours |
| 16 | Real-time WebSocket notifications | 1-2 days |
| 17 | Offline mode with sync | 1-2 weeks |
| 18 | Social media sharing | 2-3 days |

---

## Testing Scenarios Before Go-Live

### Authentication & Accounts
- [ ] Register new account with email/password
- [ ] Login with email/password
- [ ] Login with Google OAuth (production redirect)
- [ ] Login with Microsoft OAuth
- [ ] Login with Facebook OAuth
- [ ] Password reset flow (email delivery)
- [ ] Account settings update (name, language, currency)
- [ ] Delete account (GDPR compliance)

### Trip Management
- [ ] Create new trip (name, dates, destination)
- [ ] Edit trip details
- [ ] Invite member via email
- [ ] Accept trip invitation
- [ ] View trip timeline with bookings
- [ ] Set trip budget
- [ ] View trip map (Google Maps)
- [ ] View AI trip tips
- [ ] Chat with AI about trip tips
- [ ] Delete trip

### Bookings
- [ ] Manually add flight booking
- [ ] Manually add hotel booking
- [ ] Manually add car rental
- [ ] View booking details (all fields populate)
- [ ] Check-in button (if airline supports)
- [ ] Email auto-import (connect Gmail/Outlook)

### Expenses
- [ ] Add personal expense
- [ ] Add shared expense
- [ ] View expense split between members
- [ ] Multi-currency conversion works
- [ ] Trip expense summary shows correctly
- [ ] Budget progress bar accurate

### Messaging
- [ ] Send DM to connection
- [ ] Trip group chat works
- [ ] Messages display in order
- [ ] Unread indicator shows
- [ ] @AI mention generates response

### Subscriptions
- [ ] View current plan (Free)
- [ ] Start trial (30-day Premium)
- [ ] Upgrade via Stripe checkout (test card 4242...)
- [ ] Plan limits enforced (trip count, AI usage)
- [ ] Downgrade/cancel works

### Family & Connections
- [ ] Add family member (managed)
- [ ] Connect family member (linked account)
- [ ] View network connections
- [ ] Send connection request
- [ ] Accept/reject connection

### Admin Panel
- [ ] Login requires admin role
- [ ] Non-admin gets "Access denied"
- [ ] User list with search + pagination
- [ ] Impersonate user
- [ ] Suspend/reactivate user
- [ ] View translations editor
- [ ] OAuth provider toggle works
- [ ] Configuration saves persist

### Performance & Security
- [ ] API health check < 200ms
- [ ] Page load < 3 seconds
- [ ] Rate limiting triggers on abuse
- [ ] CORS blocks unauthorized origins
- [ ] JWT expiry handled (refresh token flow)
- [ ] SQL injection protected (parameterized queries)
- [ ] XSS protected (React auto-escaping + CSP headers)

---

## Production vs QA Differences

| Aspect | QA | Production |
|--------|----|----- ------|
| Domain | qa.neyya.ai | neyya.ai |
| RDS | db.t4g.micro, single-AZ | db.t4g.small, multi-AZ |
| Redis | cache.t4g.micro | cache.t4g.small |
| ECS tasks | 1 per service | 2+ per service (auto-scaling) |
| Stripe | Test keys (sk_test_) | Live keys (sk_live_) |
| OAuth | Test/dev credentials | Production redirect URIs |
| SES | Sandbox | Production (request needed) |
| Monitoring | Basic logs | CloudWatch alarms + Sentry |
| Backups | 7-day RDS auto | 30-day + cross-region |

---

## Deployment Sequence (Production)

1. Deploy infrastructure (network + RDS + Redis) — 30 min
2. Create secrets in Secrets Manager — 15 min
3. Deploy ECS stacks — 15 min
4. Run migrations (automatic on first deploy)
5. Seed data: `./scripts/seed-environment.sh -e production`
6. DNS cutover (neyya.ai → ALB) — 5 min
7. Verify health checks
8. Configure Stripe webhook
9. Update OAuth redirect URIs
10. Smoke test all critical paths
11. Monitor for 24 hours

**Estimated time:** 2-3 hours (plus 24-48h for SES production approval)
