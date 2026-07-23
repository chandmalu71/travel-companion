#!/usr/bin/env bash
set -euo pipefail

# ─── Neyya.ai Docker/AWS Deployment Script ────────────────────────────────────
# Usage:
#   ./scripts/deploy.sh <command> [options]
#
# Commands:
#   setup         First-time infrastructure setup (ECR + network + ECS)
#   build         Build Docker images locally
#   push          Push images to ECR
#   deploy        Deploy to ECS (build + push + update services)
#   status        Show current service status
#   logs          Tail logs for a service
#
# Options:
#   -e, --env     Environment (qa|production) [default: qa]
#   -s, --service Service to target (api|web|admin|all) [default: all]

# ─── Config ───────────────────────────────────────────────────────────────────
AWS_REGION="${AWS_REGION:-eu-west-1}"
PROJECT_NAME="${PROJECT_NAME:-neyya}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# ─── Defaults ─────────────────────────────────────────────────────────────────
ENVIRONMENT="qa"
SERVICE="all"
COMMAND=""

# ─── Parse args ───────────────────────────────────────────────────────────────
while [[ $# -gt 0 ]]; do
  case $1 in
    setup|build|push|deploy|status|logs)
      COMMAND="$1"
      shift
      ;;
    -e|--env)
      ENVIRONMENT="$2"
      shift 2
      ;;
    -s|--service)
      SERVICE="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

if [[ -z "$COMMAND" ]]; then
  echo "Usage: ./scripts/deploy.sh <command> [-e qa|production] [-s api|web|admin|all]"
  echo ""
  echo "Commands: setup, build, push, deploy, status, logs"
  exit 1
fi

# ─── Helpers ──────────────────────────────────────────────────────────────────
info() { echo -e "\033[0;36m→ $1\033[0m"; }
success() { echo -e "\033[0;32m✓ $1\033[0m"; }
error() { echo -e "\033[0;31m✗ $1\033[0m"; exit 1; }

get_account_id() {
  aws sts get-caller-identity --query Account --output text
}

get_ecr_uri() {
  local service=$1
  local account_id
  account_id=$(get_account_id)
  echo "${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com/${PROJECT_NAME}-${service}"
}

get_image_tag() {
  echo "${ENVIRONMENT}-$(git rev-parse --short HEAD)"
}

get_services() {
  if [[ "$SERVICE" == "all" ]]; then
    echo "api web admin"
  else
    echo "$SERVICE"
  fi
}

# ─── Commands ─────────────────────────────────────────────────────────────────

cmd_setup() {
  info "Setting up infrastructure for environment: ${ENVIRONMENT}"

  # Deploy ECR repositories
  info "Creating ECR repositories..."
  aws cloudformation deploy \
    --template-file "${PROJECT_ROOT}/infrastructure/cloudformation/ecr.yml" \
    --stack-name "${PROJECT_NAME}-ecr" \
    --parameter-overrides ProjectName="${PROJECT_NAME}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --region "${AWS_REGION}" \
    --no-fail-on-empty-changeset
  success "ECR repositories created"

  # Deploy network stack
  info "Creating network infrastructure..."
  aws cloudformation deploy \
    --template-file "${PROJECT_ROOT}/infrastructure/cloudformation/network.yml" \
    --stack-name "${PROJECT_NAME}-${ENVIRONMENT}-network" \
    --parameter-overrides \
      Environment="${ENVIRONMENT}" \
      ProjectName="${PROJECT_NAME}" \
    --region "${AWS_REGION}" \
    --no-fail-on-empty-changeset
  success "Network stack created"

  echo ""
  info "Next steps:"
  echo "  1. Create secrets in AWS Secrets Manager (${PROJECT_NAME}/${ENVIRONMENT}/*)"
  echo "  2. Create RDS PostgreSQL and ElastiCache Redis"
  echo "  3. Request ACM certificate for *.neyya.ai"
  echo "  4. Run: ./scripts/deploy.sh deploy -e ${ENVIRONMENT}"
  echo ""
  success "Infrastructure setup complete"
}

cmd_build() {
  info "Building Docker images..."
  local services
  services=$(get_services)
  local tag
  tag=$(get_image_tag)

  local api_domain
  if [[ "$ENVIRONMENT" == "production" ]]; then
    api_domain="https://api.neyya.ai"
  else
    api_domain="https://api-qa.neyya.ai"
  fi

  for svc in $services; do
    info "Building ${svc}..."
    docker build \
      --file "${PROJECT_ROOT}/packages/${svc}/Dockerfile" \
      --build-arg NEXT_PUBLIC_API_URL="${api_domain}" \
      --tag "${PROJECT_NAME}-${svc}:${tag}" \
      --tag "${PROJECT_NAME}-${svc}:${ENVIRONMENT}-latest" \
      "${PROJECT_ROOT}"
    success "Built ${svc}:${tag}"
  done
}

cmd_push() {
  info "Pushing images to ECR..."
  local account_id
  account_id=$(get_account_id)
  local services
  services=$(get_services)
  local tag
  tag=$(get_image_tag)

  # ECR login
  aws ecr get-login-password --region "${AWS_REGION}" | \
    docker login --username AWS --password-stdin "${account_id}.dkr.ecr.${AWS_REGION}.amazonaws.com"

  for svc in $services; do
    local ecr_uri
    ecr_uri=$(get_ecr_uri "$svc")
    info "Pushing ${svc} → ${ecr_uri}:${tag}"

    docker tag "${PROJECT_NAME}-${svc}:${tag}" "${ecr_uri}:${tag}"
    docker tag "${PROJECT_NAME}-${svc}:${ENVIRONMENT}-latest" "${ecr_uri}:${ENVIRONMENT}-latest"
    docker push "${ecr_uri}:${tag}"
    docker push "${ecr_uri}:${ENVIRONMENT}-latest"
    success "Pushed ${svc}"
  done
}

cmd_deploy() {
  cmd_build
  cmd_push

  info "Updating ECS services..."
  local cluster="${PROJECT_NAME}-${ENVIRONMENT}"
  local services
  services=$(get_services)
  local tag
  tag=$(get_image_tag)

  for svc in $services; do
    local ecr_uri
    ecr_uri=$(get_ecr_uri "$svc")
    local image="${ecr_uri}:${tag}"
    local task_family="${PROJECT_NAME}-${svc}-${ENVIRONMENT}"
    local service_name="${PROJECT_NAME}-${svc}-${ENVIRONMENT}"

    info "Updating ${svc} service with image ${tag}..."

    # Get current task definition and update image
    TASK_DEF=$(aws ecs describe-task-definition --task-definition "$task_family" --query taskDefinition --output json)
    NEW_TASK_DEF=$(echo "$TASK_DEF" | jq --arg IMAGE "$image" \
      '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)')

    NEW_TASK_ARN=$(aws ecs register-task-definition \
      --cli-input-json "$NEW_TASK_DEF" \
      --query 'taskDefinition.taskDefinitionArn' \
      --output text)

    aws ecs update-service \
      --cluster "$cluster" \
      --service "$service_name" \
      --task-definition "$NEW_TASK_ARN" \
      --force-new-deployment \
      --query 'service.serviceName' \
      --output text > /dev/null

    success "Updated ${svc}"
  done

  info "Waiting for services to stabilize..."
  for svc in $services; do
    local service_name="${PROJECT_NAME}-${svc}-${ENVIRONMENT}"
    aws ecs wait services-stable --cluster "$cluster" --services "$service_name"
    success "${svc} is stable"
  done

  echo ""
  success "Deployment complete!"
  if [[ "$ENVIRONMENT" == "production" ]]; then
    echo "  Web:   https://neyya.ai"
    echo "  Admin: https://admin.neyya.ai"
    echo "  API:   https://api.neyya.ai"
  else
    echo "  Web:   https://qa.neyya.ai"
    echo "  Admin: https://admin-qa.neyya.ai"
    echo "  API:   https://api-qa.neyya.ai"
  fi
}

cmd_status() {
  local cluster="${PROJECT_NAME}-${ENVIRONMENT}"
  info "ECS Cluster: ${cluster}"
  echo ""

  local services
  services=$(get_services)

  for svc in $services; do
    local service_name="${PROJECT_NAME}-${svc}-${ENVIRONMENT}"
    echo "─── ${svc} ───"
    aws ecs describe-services \
      --cluster "$cluster" \
      --services "$service_name" \
      --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount,TaskDef:taskDefinition}' \
      --output table 2>/dev/null || echo "  Service not found"
    echo ""
  done
}

cmd_logs() {
  local services
  services=$(get_services)
  local svc
  svc=$(echo "$services" | awk '{print $1}')  # Take first service if "all"

  info "Tailing logs for ${svc} (${ENVIRONMENT})..."
  aws logs tail "/ecs/${PROJECT_NAME}-${svc}-${ENVIRONMENT}" --follow --since 5m
}

# ─── Execute ──────────────────────────────────────────────────────────────────
case $COMMAND in
  setup)  cmd_setup ;;
  build)  cmd_build ;;
  push)   cmd_push ;;
  deploy) cmd_deploy ;;
  status) cmd_status ;;
  logs)   cmd_logs ;;
  *)      error "Unknown command: $COMMAND" ;;
esac
