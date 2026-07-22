# Docker + AWS Deployment Plan

## Tasks 4-7: Production Infrastructure (Docker/AWS)

### Architecture

```
                    Route 53 (neyya.ai)
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
     CloudFront     CloudFront       ALB
     (S3 Static)   (S3 Static)   (ECS Fargate)
         │              │              │
    ┌─────────┐   ┌─────────┐   ┌─────────┐
    │   Web   │   │  Admin  │   │   API   │
    │  (S3)   │   │  (S3)   │   │ (Docker)│
    └─────────┘   └─────────┘   └────┬────┘
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                   │   RDS    │ │ElastiCache│ │    S3    │
                   │PostgreSQL│ │  Redis   │ │ (files)  │
                   └──────────┘ └──────────┘ └──────────┘
```

### Task 4: Production Database (RDS PostgreSQL)

**Create via CloudFormation:**
- Engine: PostgreSQL 16
- Instance: db.t4g.micro (free tier eligible)
- Storage: 20 GB gp3
- Region: eu-west-1
- VPC: default VPC or new VPC
- Security group: allow 5432 from ECS tasks only
- Multi-AZ: No (save cost for now)
- Automated backups: 7 days

### Task 5: Production Redis (ElastiCache)

**Create via CloudFormation:**
- Engine: Redis 7
- Node type: cache.t4g.micro
- Region: eu-west-1
- VPC: same as RDS
- Security group: allow 6379 from ECS tasks only

### Task 6: Domain + SSL + Hosting

**Already done:** Route 53 zone exists for neyya.ai

**Still needed:**
- ACM certificate for *.neyya.ai (us-east-1 for CloudFront)
- CloudFront distribution for web (qa.neyya.ai → S3 bucket)
- CloudFront distribution for admin (admin-qa.neyya.ai → S3 bucket)
- ALB + target group for API (api-qa.neyya.ai → ECS)
- Route 53 records pointing to CloudFront/ALB

### Task 7: Secrets Management

**AWS Secrets Manager:**
- JWT_SECRET
- GOOGLE_CLIENT_ID + SECRET
- MICROSOFT_CLIENT_ID + SECRET
- FACEBOOK_APP_ID + SECRET
- STRIPE_SECRET_KEY + WEBHOOK_SECRET
- PII_ENCRYPTION_KEY
- DATABASE_URL (auto from RDS)
- REDIS_URL (auto from ElastiCache)

---

## Implementation Steps

### Step 1: Create Dockerfile

```dockerfile
FROM node:20-alpine AS builder
WORKDIR /app
COPY pnpm-lock.yaml package.json pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/api/package.json packages/api/
RUN corepack enable && pnpm install --frozen-lockfile
COPY packages/shared/ packages/shared/
COPY packages/api/ packages/api/
RUN pnpm --filter @travel-companion/shared build

FROM node:20-alpine AS runner
WORKDIR /app
COPY --from=builder /app/ ./
EXPOSE 3000
CMD ["npx", "tsx", "packages/api/src/server.ts"]
```

### Step 2: Create CloudFormation template

Single stack that creates:
- VPC (or use default)
- RDS PostgreSQL
- ElastiCache Redis
- ECS Cluster + Service + Task Definition
- ALB + Target Group
- S3 buckets (web, admin)
- CloudFront distributions
- ACM certificates
- Security groups
- IAM roles

### Step 3: Update GitHub Actions

```yaml
on push to develop:
  1. Build Docker image
  2. Push to ECR
  3. Deploy to ECS (rolling update)
  4. Build web + admin (next build)
  5. Upload to S3
  6. Invalidate CloudFront
```

### Step 4: Run migrations + seed

After first deploy:
- Connect to RDS and run migrations
- Seed subscription plans + demo users

---

## Estimated Cost (monthly)

| Service | Spec | Cost |
|---------|------|------|
| ECS Fargate | 0.25 vCPU, 512MB, 1 task | ~$9 |
| RDS PostgreSQL | db.t4g.micro (free tier yr 1) | $0-15 |
| ElastiCache Redis | cache.t4g.micro | ~$12 |
| S3 (static sites) | 2 buckets | ~$1 |
| CloudFront | 2 distributions | ~$1 |
| ALB | 1 load balancer | ~$16 |
| ECR | Image storage | ~$1 |
| Secrets Manager | 8 secrets | ~$3 |
| **Total** | | **~$43-58/month** |

**With RDS free tier (year 1): ~$43/month**

---

## Prerequisites

- AWS CLI configured
- Docker installed locally (for testing)
- No Neon, Vercel, or Upstash needed
