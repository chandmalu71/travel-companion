#!/usr/bin/env bash
set -euo pipefail

# ─── Environment Seed Script ─────────────────────────────────────────────────
# Seeds essential data (demo account, subscription plans, translation keys)
# into any environment. Used for both QA and Production initial setup.
#
# Usage:
#   ./scripts/seed-environment.sh -e qa        # Seed QA
#   ./scripts/seed-environment.sh -e production # Seed Production
#
# This ensures QA and Production have identical base data.
# Migrations handle: subscription plans, translation keys (auto-run on startup)
# This script handles: demo account + mock users (run manually after first deploy)

AWS_REGION="${AWS_REGION:-eu-west-1}"
AWS_PROFILE="${AWS_PROFILE:-neyya}"
ENVIRONMENT="${1:---help}"

# Parse args
while [[ $# -gt 0 ]]; do
  case $1 in
    -e|--env) ENVIRONMENT="$2"; shift 2 ;;
    *) shift ;;
  esac
done

if [[ "$ENVIRONMENT" == "--help" || -z "$ENVIRONMENT" ]]; then
  echo "Usage: ./scripts/seed-environment.sh -e <qa|production>"
  echo ""
  echo "Seeds the following into the target environment:"
  echo "  - Demo account (demo@neyya.ai)"
  echo "  - 5 demo companion users"
  echo "  - Mock data (trips, bookings, connections)"
  echo ""
  echo "Note: Subscription plans and translation keys are handled by"
  echo "      database migrations (019, 020) which run automatically on deploy."
  exit 0
fi

CLUSTER="neyya-${ENVIRONMENT}"
SERVICE="neyya-api-${ENVIRONMENT}"

echo "🌱 Seeding environment: ${ENVIRONMENT}"
echo "   Cluster: ${CLUSTER}"
echo ""

# Get running task
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --region "$AWS_REGION" --profile "$AWS_PROFILE" \
  --query 'taskArns[0]' --output text)

if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
  echo "❌ No running API tasks found in cluster ${CLUSTER}!"
  exit 1
fi

echo "   Task: ${TASK_ARN}"
echo ""

# Run demo account seed
echo "📦 Seeding demo account..."
aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container api \
  --interactive \
  --command "npx tsx packages/api/src/scripts/seed-demo-account.ts" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo ""

# Run original mock data seed (5 test users + their trips)
echo "📦 Seeding mock test data..."
aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container api \
  --interactive \
  --command "npx tsx packages/api/src/scripts/seed-mock-data.ts" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo ""
echo "✅ Environment ${ENVIRONMENT} seeded!"
echo ""
echo "Accounts available:"
echo "  demo@neyya.ai / TryNeyya2026 (Demo - Premium)"
echo "  alice@demo.neyya.ai / Demo1234 (Test user)"
echo "  bob@demo.neyya.ai / Demo1234 (Test user)"
echo ""
echo "Data created by migrations (automatic on deploy):"
echo "  - Subscription plans (Free, Pro, Premium)"
echo "  - 350 translation keys"
echo "  - 10 supported languages"
