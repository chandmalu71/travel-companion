# AWS Resources — QA Environment

Generated: 2026-07-19

## Region: eu-west-1 (Ireland)

### DNS & Certificates

| Resource | ID/ARN |
|----------|--------|
| Route 53 Hosted Zone | `Z08178223AFNDR8ULDQ8X` |
| ACM Cert (eu-west-1, ALB) | `arn:aws:acm:eu-west-1:824050487639:certificate/2e97524b-c86d-4529-a193-65c252d8575e` |
| ACM Cert (us-east-1, CloudFront) | `arn:aws:acm:us-east-1:824050487639:certificate/a25817aa-555a-42cd-9fa4-5cc97708095a` |

### Nameservers (for Squarespace)

```
ns-578.awsdns-08.net
ns-169.awsdns-21.com
ns-1614.awsdns-09.co.uk
ns-1422.awsdns-49.org
```

### Network (CloudFormation: neyya-qa-network)

| Resource | ID |
|----------|-----|
| VPC | `vpc-0c5627d262540f238` |
| Public Subnet 1 (eu-west-1a) | `subnet-041e6d76314b82d2a` |
| Public Subnet 2 (eu-west-1b) | `subnet-031625fddf4106d93` |
| Private Subnet 1 (eu-west-1a) | `subnet-050f4e679ed3f97ad` |
| Private Subnet 2 (eu-west-1b) | `subnet-0f2b4e04be480fcc6` |
| ALB Security Group | `sg-03b171379c5081cd7` |
| ECS Security Group | `sg-0dfa9b8253c3d3d78` |
| Database Security Group | `sg-08322aa68936b3933` |
| Redis Security Group | `sg-0ca7a30a8649c69ff` |

### Database (RDS PostgreSQL 16.14)

| Resource | Value |
|----------|-------|
| Instance ID | `neyya-db-qa` |
| Engine | PostgreSQL 16.14 |
| Instance Class | db.t3.micro |
| Storage | 20 GB gp3 |
| Master Username | `neyya_admin` |
| Master Password | `NeyyaQA2026SecurePass1` |
| Database Name | `neyya` |
| Endpoint | *(available after creation — check with `aws rds describe-db-instances`)* |
| Port | 5432 |

### Cache (ElastiCache Redis 7.1)

| Resource | Value |
|----------|-------|
| Cluster ID | `neyya-redis-qa` |
| Engine | Redis 7.1 |
| Node Type | cache.t3.micro |
| Endpoint | *(available after creation)* |
| Port | 6379 |

### Compute (ECS)

| Resource | Value |
|----------|-------|
| Cluster | `neyya-qa` |
| ECR Repository | `824050487639.dkr.ecr.eu-west-1.amazonaws.com/neyya-api` |

### Auth (Cognito)

| Resource | Value |
|----------|-------|
| User Pool ID | `eu-west-1_9ESLeIsB7` |
| Client ID | `4g2d7o9ffen9djium3c5scqoec` |

### Storage (S3)

| Bucket | Purpose |
|--------|---------|
| `neyya-web-qa` | Web static assets |
| `neyya-docs-qa` | Document storage |
| `neyya-web-production` | Production web assets |
| `neyya-docs-production` | Production documents |

### Queues (SQS)

| Queue | URL |
|-------|-----|
| Email Processing (FIFO) | `https://sqs.eu-west-1.amazonaws.com/824050487639/neyya-email-processing-qa.fifo` |
| Notifications | `https://sqs.eu-west-1.amazonaws.com/824050487639/neyya-notifications-qa` |

## Pending Actions

- [ ] Wait for DNS propagation (Squarespace → Route 53 NS)
- [ ] Wait for ACM certificate to become `ISSUED`
- [ ] Add HTTPS listener to ALB once cert is issued
- [ ] Set up CloudFront distribution for web app
- [ ] Push Docker image to ECR (via GitHub Actions on `develop` branch)
- [x] Create ALB + Target Group + HTTP Listener
- [x] Create ECS Task Definition + Service
- [x] Add DNS record (api-qa.neyya.ai → ALB)
- [x] Create IAM deploy user + GitHub secrets
- [x] Create `develop` branch for QA deploys

### ALB Details

| Resource | Value |
|----------|-------|
| ALB ARN | `arn:aws:elasticloadbalancing:eu-west-1:824050487639:loadbalancer/app/neyya-api-qa/41a6482757186d7f` |
| ALB DNS | `neyya-api-qa-356525978.eu-west-1.elb.amazonaws.com` |
| Target Group ARN | `arn:aws:elasticloadbalancing:eu-west-1:824050487639:targetgroup/neyya-api-qa-tg/1837469d0569f106` |

### GitHub Secrets Configured

| Secret | Status |
|--------|--------|
| `AWS_ACCESS_KEY_ID` | ✅ Set |
| `AWS_SECRET_ACCESS_KEY` | ✅ Set |
| `AWS_ACCOUNT_ID` | ✅ Set |

### GitHub Variables Configured

| Variable | Value |
|----------|-------|
| `AWS_REGION` | eu-west-1 |
| `ECR_REPOSITORY` | neyya-api |
