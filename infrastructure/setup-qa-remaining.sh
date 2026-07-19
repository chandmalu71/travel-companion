#!/bin/bash
# Nayya QA Environment - Remaining AWS Setup
# Run this script after VPC, RDS, and Redis are ready.

set -e
REGION="eu-west-1"
ACCOUNT_ID="824050487639"
VPC_ID="vpc-0c5627d262540f238"
PUBLIC_SUBNET_1="subnet-041e6d76314b82d2a"
PUBLIC_SUBNET_2="subnet-031625fddf4106d93"
PRIVATE_SUBNET_1="subnet-050f4e679ed3f97ad"
PRIVATE_SUBNET_2="subnet-0f2b4e04be480fcc6"
ALB_SG="sg-03b171379c5081cd7"
ECS_SG="sg-0dfa9b8253c3d3d78"
ALB_ARN="arn:aws:elasticloadbalancing:eu-west-1:824050487639:loadbalancer/app/nayya-api-qa/41a6482757186d7f"
ALB_DNS="nayya-api-qa-356525978.eu-west-1.elb.amazonaws.com"
ACM_CERT="arn:aws:acm:eu-west-1:824050487639:certificate/2e97524b-c86d-4529-a193-65c252d8575e"
HOSTED_ZONE_ID="Z08178223AFNDR8ULDQ8X"

RDS_ENDPOINT="nayya-db-qa.cbk448k6i3hd.eu-west-1.rds.amazonaws.com"
REDIS_ENDPOINT="nayya-redis-qa.a73fv3.0001.euw1.cache.amazonaws.com"
COGNITO_POOL_ID="eu-west-1_9ESLeIsB7"
COGNITO_CLIENT_ID="4g2d7o9ffen9djium3c5scqoec"
SQS_URL="https://sqs.eu-west-1.amazonaws.com/824050487639/nayya-email-processing-qa.fifo"

echo "=== Step 1: Create Target Group ==="
TG_ARN=$(aws elbv2 create-target-group \
  --name nayya-api-qa-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --healthy-threshold-count 2 \
  --region $REGION \
  --query "TargetGroups[0].TargetGroupArn" \
  --output text)
echo "Target Group: $TG_ARN"

echo "=== Step 2: Create HTTP Listener (port 80) ==="
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions "Type=forward,TargetGroupArn=$TG_ARN" \
  --region $REGION > /dev/null
echo "HTTP Listener created"

echo "=== Step 3: Create ECS Task Execution Role ==="
# Check if role exists
if ! aws iam get-role --role-name nayya-ecs-execution-role 2>/dev/null; then
  aws iam create-role \
    --role-name nayya-ecs-execution-role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ecs-tasks.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' > /dev/null
  aws iam attach-role-policy \
    --role-name nayya-ecs-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
  echo "ECS Execution Role created"
else
  echo "ECS Execution Role already exists"
fi

echo "=== Step 4: Create CloudWatch Log Group ==="
aws logs create-log-group --log-group-name /ecs/nayya-api-qa --region $REGION 2>/dev/null || true
echo "Log group created"

echo "=== Step 5: Register ECS Task Definition ==="
TASK_DEF=$(cat <<EOF
{
  "family": "nayya-api-qa",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "256",
  "memory": "512",
  "executionRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/nayya-ecs-execution-role",
  "containerDefinitions": [{
    "name": "api",
    "image": "${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/nayya-api:qa-latest",
    "portMappings": [{"containerPort": 3000, "protocol": "tcp"}],
    "environment": [
      {"name": "NODE_ENV", "value": "production"},
      {"name": "PORT", "value": "3000"},
      {"name": "HOST", "value": "0.0.0.0"},
      {"name": "LOG_LEVEL", "value": "info"},
      {"name": "CORS_ORIGIN", "value": "https://qa.nayya.ai"},
      {"name": "DATABASE_URL", "value": "postgresql://nayya_admin:NayyaQA2026SecurePass1@${RDS_ENDPOINT}:5432/nayya"},
      {"name": "REDIS_URL", "value": "redis://${REDIS_ENDPOINT}:6379"},
      {"name": "COGNITO_USER_POOL_ID", "value": "${COGNITO_POOL_ID}"},
      {"name": "COGNITO_CLIENT_ID", "value": "${COGNITO_CLIENT_ID}"},
      {"name": "COGNITO_REGION", "value": "${REGION}"},
      {"name": "SQS_EMAIL_QUEUE_URL", "value": "${SQS_URL}"}
    ],
    "logConfiguration": {
      "logDriver": "awslogs",
      "options": {
        "awslogs-group": "/ecs/nayya-api-qa",
        "awslogs-region": "${REGION}",
        "awslogs-stream-prefix": "api"
      }
    },
    "essential": true
  }]
}
EOF
)

echo "$TASK_DEF" > /tmp/nayya-task-def.json
aws ecs register-task-definition --cli-input-json file:///tmp/nayya-task-def.json --region $REGION > /dev/null
echo "Task definition registered"

echo "=== Step 6: Create ECS Service ==="
aws ecs create-service \
  --cluster nayya-qa \
  --service-name nayya-api-qa \
  --task-definition nayya-api-qa \
  --desired-count 1 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=api,containerPort=3000" \
  --region $REGION > /dev/null 2>&1 || echo "Service may already exist"
echo "ECS Service created (will fail initially until Docker image is pushed)"

echo "=== Step 7: Add DNS Record for API ==="
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "{
  \"Changes\": [{
    \"Action\": \"UPSERT\",
    \"ResourceRecordSet\": {
      \"Name\": \"api-qa.nayya.ai.\",
      \"Type\": \"CNAME\",
      \"TTL\": 300,
      \"ResourceRecords\": [{\"Value\": \"$ALB_DNS\"}]
    }
  }]
}" > /dev/null
echo "DNS record api-qa.nayya.ai → $ALB_DNS created"

echo ""
echo "=== DONE ==="
echo ""
echo "Summary:"
echo "  ALB DNS: $ALB_DNS"
echo "  Target Group: $TG_ARN"
echo "  API URL: http://api-qa.nayya.ai (after DNS propagation)"
echo ""
echo "Next steps:"
echo "  1. Build and push Docker image to ECR"
echo "  2. ECS will auto-deploy once image is available"
echo "  3. Add HTTPS listener once ACM certificate is ISSUED"
echo "  4. Set up CloudFront for web app"
