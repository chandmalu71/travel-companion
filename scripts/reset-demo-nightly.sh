#!/usr/bin/env bash
set -euo pipefail

# ─── Nightly Demo Account Reset ──────────────────────────────────────────────
# Resets the demo account data in QA environment.
# Removes any user-created data while preserving the seeded demo content.
#
# This script is designed to run via cron or AWS EventBridge + ECS RunTask.
#
# Usage:
#   ./scripts/reset-demo-nightly.sh          # Uses neyya AWS profile
#   AWS_PROFILE=neyya ./scripts/reset-demo-nightly.sh

AWS_REGION="${AWS_REGION:-eu-west-1}"
AWS_PROFILE="${AWS_PROFILE:-neyya}"
CLUSTER="neyya-qa"
SERVICE="neyya-api-qa"

echo "🔄 Nightly demo reset starting..."
echo "   Cluster: $CLUSTER"
echo "   Time: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# Get a running task
TASK_ARN=$(aws ecs list-tasks --cluster "$CLUSTER" --service-name "$SERVICE" \
  --desired-status RUNNING --region "$AWS_REGION" --profile "$AWS_PROFILE" \
  --query 'taskArns[0]' --output text)

if [ "$TASK_ARN" = "None" ] || [ -z "$TASK_ARN" ]; then
  echo "❌ No running API tasks found!"
  exit 1
fi

echo "   Task: $TASK_ARN"

# Run the reset script inside the container
aws ecs execute-command \
  --cluster "$CLUSTER" \
  --task "$TASK_ARN" \
  --container api \
  --interactive \
  --command "npx tsx packages/api/src/scripts/seed-demo-account.ts --reset" \
  --region "$AWS_REGION" \
  --profile "$AWS_PROFILE"

echo ""
echo "✅ Demo reset complete!"
