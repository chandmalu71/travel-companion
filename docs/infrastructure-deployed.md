# Infrastructure Deployment Summary

**Date:** July 23, 2026  
**Environment:** QA  
**AWS Account:** 008582147209  
**Region:** eu-west-1 (Ireland)

---

## What Was Achieved

A full Docker-based AWS deployment pipeline for the Neyya.ai travel companion platform — from zero infrastructure to a live, HTTPS-secured QA environment accessible at:

| Service | URL | Status |
|---------|-----|--------|
| Web App | https://qa.neyya.ai | Live |
| Admin Panel | https://admin-qa.neyya.ai | Live |
| API Server | https://api-qa.neyya.ai | Live |

---

## Architecture Deployed

```
                    Route 53 (neyya.ai)
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
         qa.neyya.ai  admin-qa    api-qa.neyya.ai
              │       .neyya.ai        │
              └──────────┼─────────────┘
                         │
                    ALB (HTTPS:443)
                    *.neyya.ai cert
                    Host-based routing
                         │
              ┌──────────┼──────────────┐
              ▼          ▼              ▼
         ┌────────┐ ┌────────┐    ┌────────┐
         │  Web   │ │ Admin  │    │  API   │
         │ :3001  │ │ :3002  │    │ :3000  │
         │Next.js │ │Next.js │    │Fastify │
         └────────┘ └────────┘    └───┬────┘
          (Fargate)  (Fargate)        │ (Fargate)
                                      │
                         ┌────────────┼────────────┐
                         ▼            ▼            ▼
                   ┌──────────┐ ┌──────────┐ ┌──────────┐
                   │   RDS    │ │ElastiCache│ │  Secrets │
                   │PG 16.14  │ │ Redis 7  │ │ Manager  │
                   └──────────┘ └──────────┘ └──────────┘
```

---

## AWS Resources Created

### Networking (CloudFormation: `neyya-qa-network`)
- **VPC:** `vpc-00154b0ec4bf3c310` (10.0.0.0/16)
- **Public Subnets:** 2 (eu-west-1a, eu-west-1b) — for ALB + ECS tasks
- **Private Subnets:** 2 — for RDS + Redis
- **Internet Gateway** with route tables
- **Security Groups:** ALB (80/443 from internet), ECS (3000-3002 from ALB), Database (5432 from ECS), Redis (6379 from ECS)

### Container Registry (CloudFormation: `neyya-ecr`)
- `neyya-api` — Fastify API server image
- `neyya-web` — Next.js web app image (standalone mode)
- `neyya-admin` — Next.js admin panel image (standalone mode)
- Image scanning on push enabled
- Lifecycle policy: keep last 10 images

### Compute (CloudFormation: `neyya-qa-ecs`)
- **ECS Cluster:** `neyya-qa` (Container Insights enabled)
- **ALB:** `neyya-qa-alb` with HTTPS listener (ACM cert: `*.neyya.ai`)
- **3 Fargate Services** (0.25 vCPU, 512MB RAM each):
  - `neyya-api-qa` — API with health check at `/api/health`
  - `neyya-web-qa` — Web frontend
  - `neyya-admin-qa` — Admin panel (auth-gated)
- **IAM Roles:**
  - ECS Execution Role (ECR pull + Secrets Manager access)
  - API Task Role (S3, SES, Bedrock, SQS, Cognito)
  - Web/Admin Task Roles (minimal)

### Database
- **RDS PostgreSQL 16.14** (`neyya-db-qa`)
  - Instance: db.t4g.micro
  - Storage: 20 GB gp3
  - Endpoint: `neyya-db-qa.c30ciogw8as5.eu-west-1.rds.amazonaws.com`
  - 18 migrations applied, 40+ tables
  - 7-day automated backups

### Cache
- **ElastiCache Redis 7.0** (`neyya-redis-qa`)
  - Node: cache.t4g.micro
  - Endpoint: `neyya-redis-qa.ijkmmf.0001.euw1.cache.amazonaws.com`
  - Used for: sessions, rate limiting, caching

### Secrets (AWS Secrets Manager)
- `neyya/qa/DATABASE_URL`
- `neyya/qa/REDIS_URL`
- `neyya/qa/JWT_SECRET` (auto-generated 48-byte)
- `neyya/qa/PII_ENCRYPTION_KEY` (auto-generated 32-byte hex)
- `neyya/qa/GOOGLE_CLIENT_ID` (placeholder)
- `neyya/qa/GOOGLE_CLIENT_SECRET` (placeholder)
- `neyya/qa/STRIPE_SECRET_KEY` (placeholder)
- `neyya/qa/STRIPE_WEBHOOK_SECRET` (placeholder)

### DNS & SSL
- **ACM Certificate:** `*.neyya.ai` + `neyya.ai` (ISSUED, DNS-validated)
- **Route 53 Records** (in management account `824050487639`):
  - `api-qa.neyya.ai` → ALB CNAME
  - `qa.neyya.ai` → ALB CNAME
  - `admin-qa.neyya.ai` → ALB CNAME

### CloudWatch Logs
- `/ecs/neyya-api-qa` (30-day retention)
- `/ecs/neyya-web-qa` (14-day retention)
- `/ecs/neyya-admin-qa` (14-day retention)

---

## Docker Configuration

### Images (multi-stage builds, linux/amd64)
| Image | Base | Size | Build Time |
|-------|------|------|------------|
| neyya-api | node:20-alpine | ~180MB | ~60s |
| neyya-web | node:20-alpine (standalone) | ~120MB | ~90s |
| neyya-admin | node:20-alpine (standalone) | ~100MB | ~50s |

### Files Created
- `packages/api/Dockerfile` — API with tsx runtime
- `packages/web/Dockerfile` — Next.js standalone with build-arg for API URL
- `packages/admin/Dockerfile` — Next.js standalone with auth gate
- `docker-compose.yml` — local development (postgres + redis + all 3 services)
- `.dockerignore` — excludes node_modules, .git, docs, tests

---

## CI/CD Pipeline

### GitHub Actions (`.github/workflows/deploy-docker.yml`)
- **Trigger:** Push to `develop` (auto QA) or manual dispatch
- **Steps:** Test → Build 3 images (parallel matrix) → Push to ECR → Update ECS services → Wait for stability → Health check
- **Auth:** OIDC role assumption (no long-lived keys in GitHub)

### Manual Deploy Script (`scripts/deploy.sh`)
```bash
./scripts/deploy.sh setup -e qa    # First-time infra setup
./scripts/deploy.sh build -e qa    # Build Docker images
./scripts/deploy.sh push -e qa     # Push to ECR
./scripts/deploy.sh deploy -e qa   # Full build+push+ECS update
./scripts/deploy.sh status -e qa   # Check service status
./scripts/deploy.sh logs -e qa     # Tail CloudWatch logs
```

---

## Issues Resolved During Deployment

| Issue | Root Cause | Fix |
|-------|-----------|-----|
| ECS tasks can't pull secrets | Private subnets, no NAT/VPC endpoints | Moved tasks to public subnets with public IPs |
| Docker image pull fails | Built for ARM (Apple Silicon) | Rebuild with `--platform linux/amd64` |
| API crashes: `tsx not found` | `pnpm install --prod` removes devDeps | Added `pnpm add tsx -w` after prod install |
| DB connection: `no pg_hba.conf entry` | RDS requires SSL | Added `?sslmode=require` to DATABASE_URL |
| DB connection: `self-signed cert` | Node.js rejects RDS CA | Changed to `?sslmode=no-verify` for QA |
| Web app "Network error" on login | `NEXT_PUBLIC_API_URL` was placeholder | Fixed Dockerfile to use `ARG` properly |
| ALB HTTPS fails | ACM cert not yet validated | Created HTTP listener first, added HTTPS after cert issued |
| Admin shows full UI without login | No auth gate | Added AuthProvider + LoginScreen + role check |

---

## Monthly Cost Estimate (QA)

| Service | Spec | Cost/month |
|---------|------|------------|
| ECS Fargate | 3 tasks × 0.25 vCPU × 512MB | ~$27 |
| ALB | 1 load balancer + LCU | ~$18 |
| RDS PostgreSQL | db.t4g.micro (free tier yr 1) | $0-13 |
| ElastiCache Redis | cache.t4g.micro | ~$12 |
| ECR | 3 repos, ~500MB total | ~$1 |
| Secrets Manager | 8 secrets | ~$3 |
| CloudWatch Logs | ~1GB/month | ~$2 |
| Route 53 | 1 hosted zone + queries | ~$1 |
| **Total** | | **~$64-77/month** |

---

## Security Measures

- HTTPS everywhere (valid ACM certificate)
- No secrets in code/images — all via Secrets Manager
- ECS tasks run with minimal IAM permissions
- Database not publicly accessible
- Redis not publicly accessible
- Admin panel requires authentication + `admin_role` check
- Demo accounts have NO admin access
- Passwords hashed with SHA-256

---

## What's Still Needed for Production

1. **NAT Gateway or VPC Endpoints** — for private subnet deployment (more secure)
2. **Real OAuth credentials** — Google + Microsoft (currently placeholders)
3. **Real Stripe keys** — test mode at minimum
4. **SES domain verification** — for transactional emails
5. **Monitoring** — CloudWatch alarms (5xx rate, CPU, memory)
6. **Error tracking** — Sentry integration
7. **Backup verification** — test RDS snapshot restore
8. **Production environment** — separate stacks with Multi-AZ RDS, larger instances
