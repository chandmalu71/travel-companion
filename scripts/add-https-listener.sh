#!/usr/bin/env bash
set -euo pipefail

ALB_ARN="arn:aws:elasticloadbalancing:eu-west-1:008582147209:loadbalancer/app/neyya-qa-alb/88854f74de14d0a9"
CERT_ARN="arn:aws:acm:eu-west-1:008582147209:certificate/0ddbaa3e-e3b5-4c49-b391-0e424a1b1c94"
REGION="eu-west-1"
PROFILE="neyya"

# Create HTTPS listener
LISTENER_ARN=$(aws elbv2 create-listener \
  --load-balancer-arn "$ALB_ARN" \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn="$CERT_ARN" \
  --default-actions 'Type=fixed-response,FixedResponseConfig={StatusCode=404,ContentType=text/plain,MessageBody=NotFound}' \
  --region "$REGION" \
  --profile "$PROFILE" \
  --query "Listeners[0].ListenerArn" \
  --output text)

echo "HTTPS Listener created: $LISTENER_ARN"

# Get target group ARNs
API_TG=$(aws elbv2 describe-target-groups --names neyya-api-qa --region "$REGION" --profile "$PROFILE" --query "TargetGroups[0].TargetGroupArn" --output text)
WEB_TG=$(aws elbv2 describe-target-groups --names neyya-web-qa --region "$REGION" --profile "$PROFILE" --query "TargetGroups[0].TargetGroupArn" --output text)
ADMIN_TG=$(aws elbv2 describe-target-groups --names neyya-admin-qa --region "$REGION" --profile "$PROFILE" --query "TargetGroups[0].TargetGroupArn" --output text)

# Add routing rules to HTTPS listener
aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN" \
  --priority 1 \
  --conditions Field=host-header,Values=api-qa.neyya.ai \
  --actions Type=forward,TargetGroupArn="$API_TG" \
  --region "$REGION" --profile "$PROFILE" > /dev/null

aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN" \
  --priority 2 \
  --conditions Field=host-header,Values=qa.neyya.ai \
  --actions Type=forward,TargetGroupArn="$WEB_TG" \
  --region "$REGION" --profile "$PROFILE" > /dev/null

aws elbv2 create-rule \
  --listener-arn "$LISTENER_ARN" \
  --priority 3 \
  --conditions Field=host-header,Values=admin-qa.neyya.ai \
  --actions Type=forward,TargetGroupArn="$ADMIN_TG" \
  --region "$REGION" --profile "$PROFILE" > /dev/null

echo "Routing rules added for api-qa, qa, admin-qa"
echo ""
echo "HTTPS is now live:"
echo "  https://qa.neyya.ai"
echo "  https://admin-qa.neyya.ai"
echo "  https://api-qa.neyya.ai/api/health"
