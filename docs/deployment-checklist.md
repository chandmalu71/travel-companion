# AWS Deployment Checklist

**Account:** 008582147209  
**Region:** eu-west-1 (Ireland)  
**Date:** July 2026

---

## Pre-requisites

- [ ] Docker Desktop installed locally
- [ ] AWS CLI v2 installed (`brew install awscli`)
- [ ] Access credentials configured for account `008582147209`

---

## Step 1: AWS Account Access (do this first)

```bash
# Option A: Assume role from management account (824050487639)
aws sts assume-role \
  --role-arn "arn:aws:iam::008582147209:role/OrganizationAccountAccessRole" \
  --role-session-name "neyya-setup"

# Option B: Configure profile with new IAM user credentials
aws configure --profile neyya
# Access Key: <from IAM console>
# Secret Key: <from IAM console>
# Region: eu-west-1
# Output: json

# Verify
aws sts get-caller-identity --profile neyya
# Should show Account: 008582147209
```

Set profile for all subsequent commands:
```bash
export AWS_PROFILE=neyya
export AWS_REGION=eu-west-1
```

---

## Step 2: Deploy ECR Repositories

```bash
./scripts/deploy.sh setup -e qa
```

Or manually:
```bash
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/ecr.yml \
  --stack-name neyya-ecr \
  --parameter-overrides ProjectName=neyya \
  --region eu-west-1
```

**Verify:** 3 repositories created (neyya-api, neyya-web, neyya-admin)

---

## Step 3: Deploy Network Stack

```bash
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/network.yml \
  --stack-name neyya-qa-network \
  --parameter-overrides Environment=qa ProjectName=neyya \
  --region eu-west-1
```

**Verify:** VPC, 2 public subnets, 2 private subnets, security groups created.  
**Note down:** VPC ID, Subnet IDs, Security Group IDs from outputs.

---

## Step 4: Create RDS PostgreSQL

```bash
# Get subnet IDs from network stack
PRIVATE_SUBNET_1=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet1Id'].OutputValue" --output text)
PRIVATE_SUBNET_2=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='PrivateSubnet2Id'].OutputValue" --output text)
DB_SG=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='DatabaseSecurityGroupId'].OutputValue" --output text)

# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name neyya-qa-db-subnet \
  --db-subnet-group-description "Neyya QA DB subnets" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Create database
aws rds create-db-instance \
  --db-instance-identifier neyya-db-qa \
  --engine postgres \
  --engine-version 16.4 \
  --db-instance-class db.t4g.micro \
  --allocated-storage 20 \
  --storage-type gp3 \
  --master-username neyya_admin \
  --master-user-password "<GENERATE_STRONG_PASSWORD>" \
  --db-name neyya \
  --vpc-security-group-ids $DB_SG \
  --db-subnet-group-name neyya-qa-db-subnet \
  --no-publicly-accessible \
  --backup-retention-period 7 \
  --region eu-west-1
```

**Wait ~5 min** for RDS to become available. Note the endpoint.

---

## Step 5: Create ElastiCache Redis

```bash
REDIS_SG=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='RedisSecurityGroupId'].OutputValue" --output text)

aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name neyya-qa-redis-subnet \
  --cache-subnet-group-description "Neyya QA Redis subnets" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

aws elasticache create-cache-cluster \
  --cache-cluster-id neyya-redis-qa \
  --engine redis \
  --engine-version 7.0 \
  --cache-node-type cache.t4g.micro \
  --num-cache-nodes 1 \
  --cache-subnet-group-name neyya-qa-redis-subnet \
  --security-group-ids $REDIS_SG
```

**Wait ~5 min** for Redis to become available. Note the endpoint.

---

## Step 6: Create Secrets in Secrets Manager

```bash
# Database URL (use the RDS endpoint from step 4)
aws secretsmanager create-secret --name neyya/qa/DATABASE_URL \
  --secret-string "postgresql://neyya_admin:<PASSWORD>@<RDS_ENDPOINT>:5432/neyya"

# Redis URL (use ElastiCache endpoint from step 5)
aws secretsmanager create-secret --name neyya/qa/REDIS_URL \
  --secret-string "redis://<REDIS_ENDPOINT>:6379"

# JWT Secret (generate a random one)
aws secretsmanager create-secret --name neyya/qa/JWT_SECRET \
  --secret-string "$(openssl rand -base64 48)"

# PII Encryption Key
aws secretsmanager create-secret --name neyya/qa/PII_ENCRYPTION_KEY \
  --secret-string "$(openssl rand -hex 32)"

# OAuth (use placeholders until ready)
aws secretsmanager create-secret --name neyya/qa/GOOGLE_CLIENT_ID \
  --secret-string "placeholder"
aws secretsmanager create-secret --name neyya/qa/GOOGLE_CLIENT_SECRET \
  --secret-string "placeholder"

# Stripe (use test keys)
aws secretsmanager create-secret --name neyya/qa/STRIPE_SECRET_KEY \
  --secret-string "sk_test_placeholder"
aws secretsmanager create-secret --name neyya/qa/STRIPE_WEBHOOK_SECRET \
  --secret-string "whsec_placeholder"
```

---

## Step 7: Request ACM Certificate

```bash
# Must be in us-east-1 if using CloudFront, but for ALB use eu-west-1
aws acm request-certificate \
  --domain-name "*.neyya.ai" \
  --subject-alternative-names "neyya.ai" \
  --validation-method DNS \
  --region eu-west-1

# Note the CertificateArn from the output
# Then add the CNAME validation record in Route 53
```

---

## Step 8: Build & Push Docker Images

```bash
# Build all images
./scripts/deploy.sh build -e qa

# Push to ECR
./scripts/deploy.sh push -e qa
```

---

## Step 9: Deploy ECS Services

```bash
# Get values from previous stacks
VPC_ID=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='VPCId'].OutputValue" --output text)
PUBLIC_SUBNET_1=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='PublicSubnet1Id'].OutputValue" --output text)
PUBLIC_SUBNET_2=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='PublicSubnet2Id'].OutputValue" --output text)
ALB_SG=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='ALBSecurityGroupId'].OutputValue" --output text)
ECS_SG=$(aws cloudformation describe-stacks --stack-name neyya-qa-network \
  --query "Stacks[0].Outputs[?OutputKey=='ECSSecurityGroupId'].OutputValue" --output text)
CERT_ARN="<from step 7>"

# Get ECR image URIs
ACCOUNT_ID=008582147209
API_IMAGE="${ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/neyya-api:qa-latest"
WEB_IMAGE="${ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/neyya-web:qa-latest"
ADMIN_IMAGE="${ACCOUNT_ID}.dkr.ecr.eu-west-1.amazonaws.com/neyya-admin:qa-latest"

# Deploy ECS stack
aws cloudformation deploy \
  --template-file infrastructure/cloudformation/ecs-services.yml \
  --stack-name neyya-qa-ecs \
  --parameter-overrides \
    Environment=qa \
    VPCId=$VPC_ID \
    PublicSubnet1=$PUBLIC_SUBNET_1 \
    PublicSubnet2=$PUBLIC_SUBNET_2 \
    PrivateSubnet1=$PRIVATE_SUBNET_1 \
    PrivateSubnet2=$PRIVATE_SUBNET_2 \
    ALBSecurityGroup=$ALB_SG \
    ECSSecurityGroup=$ECS_SG \
    CertificateArn=$CERT_ARN \
    ApiImageUri=$API_IMAGE \
    WebImageUri=$WEB_IMAGE \
    AdminImageUri=$ADMIN_IMAGE \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

---

## Step 10: DNS Setup (Route 53)

Point domains to the ALB:
```bash
ALB_DNS=$(aws cloudformation describe-stacks --stack-name neyya-qa-ecs \
  --query "Stacks[0].Outputs[?OutputKey=='ALBDnsName'].OutputValue" --output text)
ALB_ZONE=$(aws cloudformation describe-stacks --stack-name neyya-qa-ecs \
  --query "Stacks[0].Outputs[?OutputKey=='ALBHostedZoneId'].OutputValue" --output text)

# Create A records (alias) for:
# - api-qa.neyya.ai → ALB
# - qa.neyya.ai → ALB
# - admin-qa.neyya.ai → ALB
# (Easiest to do in Route 53 console)
```

---

## Step 11: Run Database Migrations

Connect to RDS through a bastion or ECS exec:
```bash
# Enable ECS exec on the API service
aws ecs update-service --cluster neyya-qa --service neyya-api-qa --enable-execute-command

# Connect to running task
TASK_ARN=$(aws ecs list-tasks --cluster neyya-qa --service-name neyya-api-qa \
  --query 'taskArns[0]' --output text)
aws ecs execute-command --cluster neyya-qa --task $TASK_ARN \
  --container api --interactive --command "/bin/sh"

# Inside the container, run migrations
npx tsx packages/api/src/db/migrate.ts
```

---

## Step 12: Verify Deployment

```bash
# Health check
curl https://api-qa.neyya.ai/api/health

# Service status
./scripts/deploy.sh status -e qa

# Tail logs
./scripts/deploy.sh logs -e qa -s api
```

---

## Estimated Time

| Step | Time |
|------|------|
| Account access setup | 10 min |
| ECR + Network stacks | 5 min |
| RDS creation | 5-10 min (wait) |
| ElastiCache creation | 5-10 min (wait) |
| Secrets | 5 min |
| ACM certificate | 5 min (+validation) |
| Docker build + push | 10-15 min |
| ECS stack deployment | 10-15 min |
| DNS setup | 5 min |
| Migrations | 5 min |
| **Total** | **~60-90 min** |

---

## Estimated Monthly Cost (QA)

| Service | Cost |
|---------|------|
| ECS Fargate (3 tasks, 0.25 vCPU/512MB) | ~$27 |
| ALB | ~$16 |
| RDS db.t4g.micro | ~$13 (or free tier yr 1) |
| ElastiCache cache.t4g.micro | ~$12 |
| ECR (image storage) | ~$1 |
| Secrets Manager (8 secrets) | ~$3 |
| CloudWatch Logs | ~$2 |
| **Total** | **~$74/month** |
