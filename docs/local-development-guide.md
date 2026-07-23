# Local Development Guide

## Quick Start (Recommended for Daily Development)

```bash
# Start databases only (Postgres + Redis via Docker)
docker compose up postgres redis

# In separate terminals:
cd packages/api && pnpm dev      # API on http://localhost:3000
cd packages/web && pnpm dev      # Web on http://localhost:3001
cd packages/admin && pnpm dev    # Admin on http://localhost:3002
```

This gives you hot-reload, fast iteration, and uses your local `.env` file.

## Full Docker Mode (Test Production Build)

```bash
docker compose up --build
```

Builds all 3 services in containers — mimics what runs on QA/production. Use this to verify Docker builds before pushing.

## Running Tests Locally

```bash
# Unit tests (shared package)
pnpm --filter @travel-companion/shared test

# API tests (needs local Postgres running)
pnpm --filter @travel-companion/api test

# E2E tests (needs full stack running)
cd packages/web && pnpm test:e2e
```

## CI/CD Pipeline

| Trigger | What Happens | Cost |
|---------|-------------|------|
| Push to `develop` | Auto-deploys to QA (https://qa.neyya.ai) | ~$0.02/deploy |
| Push to `main` / manual dispatch | Deploys to Production | ~$0.02/deploy |

**Pipeline steps:** Tests → Build Docker images (parallel) → Push to ECR → Update ECS services → Health check

## Monthly Infrastructure Cost (QA)

| Service | Cost/month |
|---------|-----------|
| ECS Fargate (3 tasks) | ~$27 |
| ALB | ~$18 |
| RDS PostgreSQL | ~$13 |
| ElastiCache Redis | ~$12 |
| Other (ECR, Secrets, Logs) | ~$4 |
| **Total** | **~$74/month** |

## Pause QA to Save Money

```bash
# Stop all ECS services (saves ~$45/mo)
aws ecs update-service --cluster neyya-qa --service neyya-api-qa --desired-count 0 --profile neyya --region eu-west-1
aws ecs update-service --cluster neyya-qa --service neyya-web-qa --desired-count 0 --profile neyya --region eu-west-1
aws ecs update-service --cluster neyya-qa --service neyya-admin-qa --desired-count 0 --profile neyya --region eu-west-1

# Resume (takes ~90 seconds)
aws ecs update-service --cluster neyya-qa --service neyya-api-qa --desired-count 1 --profile neyya --region eu-west-1
aws ecs update-service --cluster neyya-qa --service neyya-web-qa --desired-count 1 --profile neyya --region eu-west-1
aws ecs update-service --cluster neyya-qa --service neyya-admin-qa --desired-count 1 --profile neyya --region eu-west-1
```

## Manual Deploy (Without CI/CD)

```bash
export AWS_PROFILE=neyya
./scripts/deploy.sh deploy -e qa          # Full build + push + ECS update
./scripts/deploy.sh deploy -e qa -s api   # Deploy only API
./scripts/deploy.sh status -e qa          # Check service status
./scripts/deploy.sh logs -e qa -s api     # Tail API logs
```

## Key URLs

| Environment | Web | Admin | API |
|-------------|-----|-------|-----|
| Local | http://localhost:3001 | http://localhost:3002 | http://localhost:3000 |
| QA | https://qa.neyya.ai | https://admin-qa.neyya.ai | https://api-qa.neyya.ai |
| Production | https://neyya.ai | https://admin.neyya.ai | https://api.neyya.ai |

## Test Accounts

| Account | Password | Role |
|---------|----------|------|
| chand.malu@gmail.com | !Neyya-AWS | super-admin |
| demo@neyya.ai | TryNeyya2026 | Premium (demo) |
| alice@demo.neyya.ai | Demo1234 | regular user |
