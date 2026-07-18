# Nayya.ai — AWS Deployment & Domain Configuration Guide

## Table of Contents

1. [Overview](#overview)
2. [Architecture Summary](#architecture-summary)
3. [Domain Provider Configuration (Squarespace)](#domain-provider-configuration-squarespace)
4. [AWS Account Prerequisites](#aws-account-prerequisites)
5. [AWS Service Configuration](#aws-service-configuration)
6. [Environment Setup](#environment-setup)
7. [GitHub CI/CD Configuration](#github-cicd-configuration)
8. [DNS Records Reference](#dns-records-reference)
9. [SSL/TLS Certificates](#ssltls-certificates)
10. [Monitoring & Alerts](#monitoring--alerts)
11. [Cost Estimates](#cost-estimates)
12. [Troubleshooting](#troubleshooting)

---

## Overview

**Domain:** nayya.ai  
**Domain Registrar:** Squarespace  
**Cloud Provider:** AWS (us-east-1)  
**CI/CD:** GitHub Actions  
**Repository:** github.com/chandmalu71/travel-companion

### Environments

| Environment | Web URL | API URL | Branch Trigger |
|-------------|---------|---------|----------------|
| QA | https://qa.nayya.ai | https://api-qa.nayya.ai | `develop` |
| Staging | https://staging.nayya.ai | https://api-staging.nayya.ai | `release/*` |
| Production | https://nayya.ai | https://api.nayya.ai | `main` (manual approval) |

---

## Architecture Summary

```
Internet → CloudFront (Web) → S3 (static assets)
         → ALB (API)        → ECS Fargate → RDS PostgreSQL
                                           → ElastiCache Redis
                                           → S3 (documents)
```

### AWS Services Used

| Service | Purpose | Per-Env |
|---------|---------|---------|
| Route 53 | DNS management | Shared |
| ACM | SSL certificates | Shared |
| CloudFront | Web CDN | Yes |
| S3 | Web assets + documents | Yes |
| ALB | API load balancer | Yes |
| ECS Fargate | API containers | Yes |
| ECR | Docker image registry | Shared |
| RDS PostgreSQL | Database | Yes |
| ElastiCache Redis | Cache/sessions | Yes |
| Cognito | Authentication | Yes |
| SQS | Background job queues | Yes |
| SES | Email delivery | Shared |
| Secrets Manager | Credentials storage | Yes |
| CloudWatch | Logs & monitoring | Yes |

---

## Domain Provider Configuration (Squarespace)

### What You Need to Change

You're transferring DNS control from Squarespace to AWS Route 53. This gives AWS full control over all subdomains and routing.

### Step-by-Step Instructions

#### 1. Log into Squarespace

Go to: https://account.squarespace.com → Domains → nayya.ai

#### 2. Note Current Settings

Before making changes, screenshot your current DNS settings for backup.

#### 3. Change Nameservers to AWS Route 53

After creating the Route 53 hosted zone (see AWS section below), you'll get 4 nameserver records. They look like:

```
ns-1234.awsdns-12.org
ns-567.awsdns-34.net
ns-890.awsdns-56.co.uk
ns-1011.awsdns-78.com
```

In Squarespace:
1. Go to **Domains** → **nayya.ai** → **DNS** → **Nameservers**
2. Click **Use custom nameservers**
3. Remove the existing Squarespace nameservers
4. Add all 4 Route 53 nameserver values (one per field)
5. Click **Save**

#### 4. Wait for Propagation

- DNS propagation takes **24–48 hours**
- You can check progress at: https://dnschecker.org/#NS/nayya.ai
- During propagation, the site may be intermittently unreachable

#### 5. Verify Transfer

Once propagated, verify with:
```bash
dig NS nayya.ai
# Should return your Route 53 nameservers
```

### Important Notes

- **Do NOT delete the domain from Squarespace** — you still own it there
- **Do NOT let the domain expire** — keep auto-renew enabled in Squarespace
- You're only changing WHERE the DNS is managed, not WHERE the domain is registered
- Squarespace remains your registrar; Route 53 becomes your DNS host

---

## AWS Account Prerequisites

### 1. IAM User for CI/CD

Create a dedicated IAM user for GitHub Actions deployments:

```bash
# Create the user
aws iam create-user --user-name nayya-github-deployer

# Attach policies
aws iam attach-user-policy --user-name nayya-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonECS_FullAccess

aws iam attach-user-policy --user-name nayya-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryPowerUser

aws iam attach-user-policy --user-name nayya-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

aws iam attach-user-policy --user-name nayya-github-deployer \
  --policy-arn arn:aws:iam::aws:policy/CloudFrontFullAccess

# Create access key (save these securely!)
aws iam create-access-key --user-name nayya-github-deployer
```

**Save the AccessKeyId and SecretAccessKey** — you'll add them to GitHub Secrets.

### 2. AWS CLI Configuration

```bash
aws configure
# Region: us-east-1
# Output: json
```

---

## AWS Service Configuration

### Step 1: Route 53 — Hosted Zone

```bash
aws route53 create-hosted-zone \
  --name nayya.ai \
  --caller-reference "nayya-$(date +%s)"
```

**Output will include:**
```json
{
  "HostedZone": {
    "Id": "/hostedzone/Z1234567890ABC",
    "Name": "nayya.ai."
  },
  "DelegationSet": {
    "NameServers": [
      "ns-1234.awsdns-12.org",
      "ns-567.awsdns-34.net",
      "ns-890.awsdns-56.co.uk",
      "ns-1011.awsdns-78.com"
    ]
  }
}
```

**→ Use these NameServers in the Squarespace configuration above.**

Save the Hosted Zone ID — you'll need it for DNS record creation.

### Step 2: ACM — SSL Certificate

```bash
# Request a wildcard certificate (covers nayya.ai and *.nayya.ai)
aws acm request-certificate \
  --domain-name nayya.ai \
  --subject-alternative-names "*.nayya.ai" \
  --validation-method DNS \
  --region us-east-1
```

**Output:**
```json
{
  "CertificateArn": "arn:aws:acm:us-east-1:123456789012:certificate/abc-123-def"
}
```

Then validate it by adding the CNAME record to Route 53:
```bash
# Get the validation CNAME
aws acm describe-certificate \
  --certificate-arn <CertificateArn> \
  --query "Certificate.DomainValidationOptions[0].ResourceRecord"

# Add it to Route 53 (or use the Console — ACM has a "Create record in Route 53" button)
```

### Step 3: ECR — Docker Image Registry

```bash
aws ecr create-repository \
  --repository-name nayya-api \
  --image-scanning-configuration scanOnPush=true \
  --region us-east-1
```

### Step 4: VPC & Network (per environment)

Deploy the CloudFormation stack:

```bash
# QA Environment
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/network.yml \
  --stack-name nayya-qa-network \
  --parameter-overrides Environment=qa ProjectName=nayya \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Staging Environment
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/network.yml \
  --stack-name nayya-staging-network \
  --parameter-overrides Environment=staging ProjectName=nayya \
  --capabilities CAPABILITY_IAM \
  --region us-east-1

# Production Environment
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/network.yml \
  --stack-name nayya-production-network \
  --parameter-overrides Environment=production ProjectName=nayya \
  --capabilities CAPABILITY_IAM \
  --region us-east-1
```

### Step 5: RDS PostgreSQL (per environment)

```bash
# Create DB subnet group first
aws rds create-db-subnet-group \
  --db-subnet-group-name nayya-qa-db-subnet \
  --db-subnet-group-description "Nayya QA DB subnets" \
  --subnet-ids <PrivateSubnet1Id> <PrivateSubnet2Id>

# Create the database
aws rds create-db-instance \
  --db-instance-identifier nayya-db-qa \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t3.micro \
  --allocated-storage 20 \
  --storage-type gp3 \
  --master-username nayya_admin \
  --master-user-password "<STRONG_PASSWORD>" \
  --db-name nayya \
  --vpc-security-group-ids <DatabaseSecurityGroupId> \
  --db-subnet-group-name nayya-qa-db-subnet \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --multi-az false \
  --region us-east-1
```

**Sizing by environment:**
| Environment | Instance Class | Storage | Multi-AZ |
|-------------|---------------|---------|----------|
| QA | db.t3.micro | 20 GB | No |
| Staging | db.t3.small | 20 GB | No |
| Production | db.t3.medium | 50 GB | Yes |

### Step 6: ElastiCache Redis (per environment)

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name nayya-qa-redis-subnet \
  --cache-subnet-group-description "Nayya QA Redis subnets" \
  --subnet-ids <PrivateSubnet1Id> <PrivateSubnet2Id>

# Create Redis cluster
aws elasticache create-cache-cluster \
  --cache-cluster-id nayya-redis-qa \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t3.micro \
  --num-cache-nodes 1 \
  --cache-subnet-group-name nayya-qa-redis-subnet \
  --security-group-ids <RedisSecurityGroupId>
```

### Step 7: S3 Buckets (per environment)

```bash
# Web app static assets
aws s3 mb s3://nayya-web-qa --region us-east-1
aws s3 mb s3://nayya-web-staging --region us-east-1
aws s3 mb s3://nayya-web-production --region us-east-1

# Document storage
aws s3 mb s3://nayya-docs-qa --region us-east-1
aws s3 mb s3://nayya-docs-staging --region us-east-1
aws s3 mb s3://nayya-docs-production --region us-east-1

# Enable versioning on document buckets
aws s3api put-bucket-versioning \
  --bucket nayya-docs-production \
  --versioning-configuration Status=Enabled
```

### Step 8: CloudFront Distribution (per environment)

Create via Console or CLI. Key settings:

```
Origin: s3://nayya-web-qa.s3.amazonaws.com
Alternate Domain Names (CNAME): qa.nayya.ai
SSL Certificate: Select the ACM wildcard cert
Default Root Object: index.html
Custom Error Response: 404 → /index.html (for SPA routing)
Comment: nayya-qa
```

### Step 9: ECS Cluster & Service (per environment)

```bash
# Create cluster
aws ecs create-cluster --cluster-name nayya-qa

# Register task definition (see packages/api/ecs-task-def.json)
aws ecs register-task-definition --cli-input-json file://infrastructure/ecs-task-def-qa.json

# Create ALB, target group, and listener (via Console recommended)
# Then create the service:
aws ecs create-service \
  --cluster nayya-qa \
  --service-name nayya-api-qa \
  --task-definition nayya-api-qa \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[<PrivateSubnet1>,<PrivateSubnet2>],securityGroups=[<ECSSecurityGroupId>],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=<TargetGroupArn>,containerName=api,containerPort=3000"
```

### Step 10: Cognito User Pool (per environment)

```bash
aws cognito-idp create-user-pool \
  --pool-name nayya-qa \
  --auto-verified-attributes email \
  --username-attributes email \
  --policies "PasswordPolicy={MinimumLength=8,RequireUppercase=true,RequireLowercase=true,RequireNumbers=true,RequireSymbols=false}" \
  --region us-east-1

# Create app client
aws cognito-idp create-user-pool-client \
  --user-pool-id <UserPoolId> \
  --client-name nayya-web-qa \
  --no-generate-secret \
  --explicit-auth-flows ALLOW_USER_PASSWORD_AUTH ALLOW_REFRESH_TOKEN_AUTH
```

### Step 11: SQS Queues (per environment)

```bash
# Email processing queue
aws sqs create-queue \
  --queue-name nayya-email-processing-qa.fifo \
  --attributes "FifoQueue=true,ContentBasedDeduplication=true,VisibilityTimeout=120"

# Notification queue
aws sqs create-queue \
  --queue-name nayya-notifications-qa \
  --attributes "VisibilityTimeout=30"
```

### Step 12: Secrets Manager

Store all sensitive values:

```bash
aws secretsmanager create-secret \
  --name nayya/qa/database \
  --secret-string '{"host":"<RDS_ENDPOINT>","port":5432,"username":"nayya_admin","password":"<PASSWORD>","database":"nayya"}'

aws secretsmanager create-secret \
  --name nayya/qa/redis \
  --secret-string '{"url":"redis://<REDIS_ENDPOINT>:6379"}'

aws secretsmanager create-secret \
  --name nayya/qa/cognito \
  --secret-string '{"userPoolId":"<POOL_ID>","clientId":"<CLIENT_ID>","region":"us-east-1"}'

aws secretsmanager create-secret \
  --name nayya/qa/api-keys \
  --secret-string '{"googlePlacesApiKey":"","openExchangeRatesKey":"","openWeatherMapKey":""}'
```

---

## Environment Setup

### Environment Variables (ECS Task Definition)

Each ECS task needs these environment variables:

```json
{
  "environment": [
    { "name": "NODE_ENV", "value": "production" },
    { "name": "PORT", "value": "3000" },
    { "name": "HOST", "value": "0.0.0.0" },
    { "name": "CORS_ORIGIN", "value": "https://qa.nayya.ai" },
    { "name": "LOG_LEVEL", "value": "info" }
  ],
  "secrets": [
    { "name": "DATABASE_URL", "valueFrom": "arn:aws:secretsmanager:...:nayya/qa/database" },
    { "name": "REDIS_URL", "valueFrom": "arn:aws:secretsmanager:...:nayya/qa/redis" },
    { "name": "COGNITO_USER_POOL_ID", "valueFrom": "arn:aws:secretsmanager:...:nayya/qa/cognito:userPoolId" },
    { "name": "COGNITO_CLIENT_ID", "valueFrom": "arn:aws:secretsmanager:...:nayya/qa/cognito:clientId" }
  ]
}
```

---

## GitHub CI/CD Configuration

### Repository Secrets

Go to: GitHub → Repository → Settings → Secrets and Variables → Actions

| Secret Name | Value | Notes |
|-------------|-------|-------|
| `AWS_ACCESS_KEY_ID` | From IAM user creation | Deploy user |
| `AWS_SECRET_ACCESS_KEY` | From IAM user creation | Deploy user |
| `AWS_ACCOUNT_ID` | 12-digit account number | e.g., 123456789012 |

### Repository Variables

| Variable Name | Value |
|---------------|-------|
| `AWS_REGION` | us-east-1 |
| `ECR_REPOSITORY` | nayya-api |

### GitHub Environments

Create in GitHub → Settings → Environments:

**`qa`**
- No protection rules
- Deployment branch: `develop`

**`staging`**
- No protection rules
- Deployment branches: `release/*`

**`production`**
- Required reviewers: (add yourself or team leads)
- Deployment branch: `main`
- Wait timer: 5 minutes (optional)

### Branch Protection Rules

Set in GitHub → Settings → Branches:

**`main` branch:**
- Require pull request before merging
- Require status checks: `lint-and-typecheck`, `unit-tests`, `build`
- Require branches to be up to date

**`develop` branch:**
- Require status checks: `lint-and-typecheck`, `unit-tests`

---

## DNS Records Reference

After Route 53 hosted zone is active, create these records:

### A/CNAME Records

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `nayya.ai` | A (Alias) | CloudFront distribution (prod) | Production web |
| `www.nayya.ai` | CNAME | `nayya.ai` | www redirect |
| `qa.nayya.ai` | CNAME | CloudFront distribution (qa) | QA web |
| `staging.nayya.ai` | CNAME | CloudFront distribution (staging) | Staging web |
| `api.nayya.ai` | A (Alias) | ALB (prod) | Production API |
| `api-qa.nayya.ai` | CNAME | ALB DNS (qa) | QA API |
| `api-staging.nayya.ai` | CNAME | ALB DNS (staging) | Staging API |

### MX Records (if using SES for email)

| Record | Type | Priority | Value |
|--------|------|----------|-------|
| `nayya.ai` | MX | 10 | `inbound-smtp.us-east-1.amazonaws.com` |

### TXT Records

| Record | Type | Value | Purpose |
|--------|------|-------|---------|
| `nayya.ai` | TXT | `v=spf1 include:amazonses.com ~all` | SPF for SES |
| `_dmarc.nayya.ai` | TXT | `v=DMARC1; p=quarantine; rua=mailto:admin@nayya.ai` | DMARC |

---

## SSL/TLS Certificates

### ACM Certificate

- **Type:** Wildcard
- **Domains covered:** `nayya.ai`, `*.nayya.ai`
- **Validation:** DNS (add CNAME to Route 53)
- **Auto-renewal:** Yes (ACM handles this automatically)
- **Used by:** CloudFront distributions + ALBs

### Verification

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn <your-cert-arn> \
  --query "Certificate.Status"
# Should return: "ISSUED"
```

---

## Monitoring & Alerts

### CloudWatch Alarms (recommended)

```bash
# API 5xx errors > 5 in 5 minutes
aws cloudwatch put-metric-alarm \
  --alarm-name nayya-qa-api-5xx \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1

# RDS CPU > 80%
aws cloudwatch put-metric-alarm \
  --alarm-name nayya-qa-db-cpu \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2
```

### Log Groups

| Log Group | Source |
|-----------|--------|
| `/ecs/nayya-api-qa` | API container logs |
| `/ecs/nayya-api-staging` | API container logs |
| `/ecs/nayya-api-production` | API container logs |

---

## Cost Estimates

### QA Environment (monthly)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| ECS Fargate | 0.25 vCPU, 0.5 GB, 1 task | ~$10 |
| RDS | db.t3.micro, 20 GB | ~$15 |
| ElastiCache | cache.t3.micro | ~$12 |
| S3 | < 1 GB | ~$1 |
| CloudFront | < 10 GB transfer | ~$1 |
| Route 53 | 1 hosted zone | ~$0.50 |
| ALB | 1 LB, low traffic | ~$16 |
| **Total QA** | | **~$56/month** |

### Production Environment (monthly)

| Service | Spec | Est. Cost |
|---------|------|-----------|
| ECS Fargate | 0.5 vCPU, 1 GB, 2 tasks | ~$40 |
| RDS | db.t3.medium, 50 GB, Multi-AZ | ~$70 |
| ElastiCache | cache.t3.small | ~$25 |
| S3 | ~10 GB | ~$3 |
| CloudFront | ~100 GB transfer | ~$10 |
| ALB | moderate traffic | ~$20 |
| Cognito | < 50k MAU (free tier) | $0 |
| SES | < 62k emails/month (free tier) | $0 |
| **Total Production** | | **~$168/month** |

---

## Troubleshooting

### Domain not resolving after NS change

- Wait 48 hours for full propagation
- Check with: `dig NS nayya.ai @8.8.8.8`
- Verify nameservers match Route 53 values exactly

### SSL certificate stuck in "Pending validation"

- Ensure the CNAME validation record exists in Route 53
- Check: `dig CNAME _abc123.nayya.ai` should return the ACM validation value
- Can take up to 30 minutes after adding the record

### ECS deployment failing

```bash
# Check service events
aws ecs describe-services --cluster nayya-qa --services nayya-api-qa \
  --query "services[0].events[:5]"

# Check task stopped reason
aws ecs describe-tasks --cluster nayya-qa --tasks <task-arn> \
  --query "tasks[0].stoppedReason"
```

### API returns 502/503 from ALB

- Check ECS task is running and healthy
- Verify security groups allow ALB → ECS on port 3000
- Check health check path responds: `GET /api/health`

### Database connection refused

- Verify RDS security group allows inbound from ECS security group
- Check the DATABASE_URL format: `postgresql://user:pass@host:5432/dbname`
- Ensure RDS instance is in the same VPC and private subnets

---

## Quick Reference: Complete Setup Order

1. ☐ Create Route 53 hosted zone → get NS records
2. ☐ Update Squarespace nameservers → point to Route 53
3. ☐ Request ACM wildcard certificate → validate via DNS
4. ☐ Create ECR repository
5. ☐ Deploy CloudFormation network stack (per env)
6. ☐ Create RDS PostgreSQL (per env)
7. ☐ Create ElastiCache Redis (per env)
8. ☐ Create S3 buckets (per env)
9. ☐ Create CloudFront distributions (per env)
10. ☐ Create ALB + target groups (per env)
11. ☐ Create ECS cluster + service (per env)
12. ☐ Create Cognito user pool (per env)
13. ☐ Create SQS queues (per env)
14. ☐ Store secrets in Secrets Manager
15. ☐ Add DNS records (A/CNAME for all subdomains)
16. ☐ Configure GitHub secrets and environments
17. ☐ Push to `develop` → verify QA deployment
18. ☐ Run E2E tests against qa.nayya.ai
19. ☐ Create `release/1.0` branch → verify staging
20. ☐ Merge to `main` with approval → verify production
