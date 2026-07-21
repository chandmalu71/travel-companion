# Infrastructure - Neyya.ai

## Environments

| Environment | Domain | Branch | Auto-deploy |
|-------------|--------|--------|-------------|
| QA | qa.neyya.ai | `develop` | Yes |
| Staging | staging.neyya.ai | `release/*` | Yes |
| Production | neyya.ai | `main` | Manual approval |

## AWS Resources per Environment

- ECS Fargate cluster (API)
- RDS PostgreSQL (db.t3.micro for QA, db.t3.small for staging/prod)
- ElastiCache Redis (cache.t3.micro for QA, cache.t3.small for prod)
- S3 bucket (documents, static assets)
- CloudFront distribution (web app + CDN)
- SQS queues (email processing, notifications)
- Cognito User Pool (auth)

## Setup Steps

1. Configure AWS CLI: `aws configure`
2. Create ECR repository: `aws ecr create-repository --repository-name neyya-api`
3. Deploy infrastructure: see `cloudformation/` directory
4. Set GitHub secrets (see main README)
5. Push to `develop` branch to trigger QA deployment
