# Infrastructure Decision: Neon + Upstash

**Date:** July 2026
**Decision:** Use serverless/pay-per-use services for database and cache instead of always-on instances.

---

## Architecture Choice

| Component | Service | Why |
|-----------|---------|-----|
| PostgreSQL | **Neon** (serverless) | Scales to zero, $0 when idle, PostgreSQL compatible |
| Redis | **Upstash** (serverless) | Pay-per-request, $0 when idle, Redis compatible |
| File Storage | **AWS S3** | Pay-per-use, pennies per GB |
| Email | **AWS SES** | Pay-per-email ($0.10/1000), already verified |
| CDN/Hosting | **Vercel** or **AWS CloudFront + S3** | To be decided |
| API Hosting | **Vercel** or **AWS ECS Fargate** | To be decided |
| DNS | **AWS Route 53** | Already configured (neyya.ai zone) |
| SSL | **AWS ACM** or Vercel auto-SSL | Free |
| Secrets | **AWS Secrets Manager** | $0.40/secret/month |

---

## Cost Projection

### Phase 1: Pre-Launch & Beta (0-100 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon PostgreSQL | Free (0.5GB, 190 compute hours) | $0 |
| Upstash Redis | Free (10K commands/day, 256MB) | $0 |
| AWS S3 | Free tier (5GB first year) | $0 |
| AWS SES | $0.10 per 1000 emails | ~$0.10 |
| AWS Route 53 | Hosted zone + queries | ~$0.50 |
| AWS Secrets Manager | 5 secrets | ~$2 |
| **Total** | | **~$3/month** |

### Phase 2: Early Growth (100-1,000 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon PostgreSQL | Launch (10GB, autoscale) | $19 |
| Upstash Redis | Pay-as-you-go | $2-5 |
| AWS S3 | Standard | $1-5 |
| AWS SES | | $1-5 |
| **Total** | | **~$25-35/month** |

### Phase 3: Growth (1,000-10,000 users)

| Service | Tier | Monthly Cost |
|---------|------|-------------|
| Neon PostgreSQL | Scale (50GB, read replicas) | $69 |
| Upstash Redis | Pro | $10-30 |
| AWS S3 | Standard | $5-20 |
| AWS SES | | $5-20 |
| **Total** | | **~$90-140/month** |

### Phase 4: Scale (10,000+ users) — Consider Migration

At this point, consider migrating to:
- AWS RDS Aurora (dedicated compute, sub-5ms latency)
- AWS ElastiCache (dedicated Redis cluster)
- Estimated: $200-500/month

Migration path: `pg_dump` from Neon → `pg_restore` to RDS. Redis data is ephemeral (sessions/cache rebuild automatically).

---

## Neon PostgreSQL Details

- **Connection string format:** `postgresql://user:pass@ep-xxx.eu-west-1.aws.neon.tech/neondb?sslmode=require`
- **Region:** eu-west-1 (Ireland) — matches our SES and target deployment
- **Features:** Connection pooling built-in, branching (for preview environments), autoscaling
- **Cold start:** ~100-500ms on first connection after idle (acceptable for our use case)
- **Compatibility:** Full PostgreSQL 16 — Kysely, migrations, all our queries work unchanged
- **Limits (free):** 0.5GB storage, 190 compute hours/month, 1 project, 10 branches

### Setup Steps
1. Sign up at neon.tech
2. Create project: `neyya-production`, region: `aws-eu-west-1`
3. Copy the connection string
4. Add to env: `DATABASE_URL=postgresql://...`

---

## Upstash Redis Details

- **Connection format:** `rediss://default:xxx@eu1-xxx.upstash.io:6379`
- **Region:** eu-west-1 (same as Neon)
- **Features:** REST API + native Redis protocol, TLS, global replication (optional)
- **Latency:** ~1-5ms (comparable to ElastiCache for our scale)
- **Limits (free):** 10K commands/day, 256MB storage, 1 database

### Setup Steps
1. Sign up at upstash.com
2. Create database: region `eu-west-1`, name `neyya-production`
3. Copy the Redis URL (TLS)
4. Add to env: `REDIS_URL=rediss://...`

---

## Why Not RDS + ElastiCache?

| Factor | RDS + ElastiCache | Neon + Upstash |
|--------|-------------------|----------------|
| Cost at 0 users | $27/month | $0 |
| Cost at 100 users | $27/month | $0 |
| Setup complexity | VPC, subnets, security groups | Just a connection string |
| Maintenance | Patches, backups, monitoring | Fully managed, zero ops |
| Scaling | Manual instance resize | Automatic |
| Migration effort | N/A (start here) | `pg_dump` to RDS when needed |

**Decision:** Start cheap, migrate when revenue justifies infrastructure cost.

---

## Deployment Strategy

**NOT auto-deploy.** Deployment happens ONLY when explicitly requested.

### Deployment Command
When ready to deploy, run:
```bash
./scripts/deploy-production.sh
```

This script will:
1. Build all packages (api, web, admin)
2. Run tests
3. Deploy API to Vercel/ECS
4. Deploy Web to Vercel
5. Deploy Admin to Vercel
6. Run database migrations on production Neon
7. Invalidate CloudFront cache (if using)

### Pre-Deploy Checklist
- [ ] All tests passing
- [ ] No uncommitted changes
- [ ] .env.production has all required variables
- [ ] Neon database created and accessible
- [ ] Upstash Redis created and accessible
- [ ] Domain DNS pointing to correct endpoint
- [ ] SSL certificate issued
