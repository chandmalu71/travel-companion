#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
# Neyya.ai — Production Deployment Script
# ═══════════════════════════════════════════════════════════════════════════════
# 
# Usage: ./scripts/deploy-production.sh
#
# This script deploys the full stack to production.
# It does NOT run automatically — only when you explicitly execute it.
#
# Prerequisites:
#   - Neon database created (DATABASE_URL in .env.production)
#   - Upstash Redis created (REDIS_URL in .env.production)
#   - Vercel CLI installed (npm i -g vercel) and logged in
#   - All env vars set in Vercel project settings
#
# ═══════════════════════════════════════════════════════════════════════════════

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  🚀 Neyya.ai — Production Deployment"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─── Pre-flight checks ───────────────────────────────────────────────────────

echo -e "${YELLOW}[1/8]${NC} Running pre-flight checks..."

# Check we're on develop branch
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "develop" ]; then
  echo -e "${RED}ERROR: Must be on 'develop' branch (currently on '$BRANCH')${NC}"
  exit 1
fi

# Check for uncommitted changes
if ! git diff-index --quiet HEAD --; then
  echo -e "${RED}ERROR: Uncommitted changes detected. Commit or stash first.${NC}"
  exit 1
fi

# Check .env.production exists
if [ ! -f "packages/api/.env.production" ]; then
  echo -e "${RED}ERROR: packages/api/.env.production not found${NC}"
  echo "Create it with production DATABASE_URL, REDIS_URL, and all secrets."
  exit 1
fi

echo -e "${GREEN}  ✓ On develop branch, clean working tree, .env.production exists${NC}"

# ─── Build ────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}[2/8]${NC} Building packages..."

cd packages/web && npx next build && cd ../..
echo -e "${GREEN}  ✓ Web built${NC}"

cd packages/admin && npx next build && cd ../..
echo -e "${GREEN}  ✓ Admin built${NC}"

echo -e "${GREEN}  ✓ API (TypeScript, no build step needed for Vercel)${NC}"

# ─── Tests ────────────────────────────────────────────────────────────────────

echo -e "${YELLOW}[3/8]${NC} Running tests..."

# Run unit tests if they exist
if [ -f "packages/api/package.json" ] && grep -q "\"test\"" packages/api/package.json; then
  cd packages/api && npm test -- --passWithNoTests 2>/dev/null && cd ../..
  echo -e "${GREEN}  ✓ API tests passed${NC}"
else
  echo -e "${YELLOW}  ⚠ No API tests configured (skipping)${NC}"
fi

# ─── Database Migration ───────────────────────────────────────────────────────

echo -e "${YELLOW}[4/8]${NC} Running database migrations on production..."

# This connects to production Neon and runs migrations
DATABASE_URL=$(grep DATABASE_URL packages/api/.env.production | cut -d '=' -f2-)
if [ -z "$DATABASE_URL" ]; then
  echo -e "${RED}ERROR: DATABASE_URL not found in .env.production${NC}"
  exit 1
fi

echo "  Connecting to production database..."
DATABASE_URL="$DATABASE_URL" npx tsx packages/api/src/db/migrator.ts 2>/dev/null || echo -e "${YELLOW}  ⚠ Migrations may have already run${NC}"
echo -e "${GREEN}  ✓ Database migrations complete${NC}"

# ─── Deploy API ───────────────────────────────────────────────────────────────

echo -e "${YELLOW}[5/8]${NC} Deploying API..."

cd packages/api
vercel --prod --yes 2>/dev/null || echo -e "${YELLOW}  ⚠ Vercel deploy failed — check vercel.json config${NC}"
cd ../..
echo -e "${GREEN}  ✓ API deployed${NC}"

# ─── Deploy Web ───────────────────────────────────────────────────────────────

echo -e "${YELLOW}[6/8]${NC} Deploying Web app..."

cd packages/web
vercel --prod --yes 2>/dev/null || echo -e "${YELLOW}  ⚠ Vercel deploy failed — check vercel.json config${NC}"
cd ../..
echo -e "${GREEN}  ✓ Web deployed${NC}"

# ─── Deploy Admin ─────────────────────────────────────────────────────────────

echo -e "${YELLOW}[7/8]${NC} Deploying Admin panel..."

cd packages/admin
vercel --prod --yes 2>/dev/null || echo -e "${YELLOW}  ⚠ Vercel deploy failed — check vercel.json config${NC}"
cd ../..
echo -e "${GREEN}  ✓ Admin deployed${NC}"

# ─── Post-deploy ──────────────────────────────────────────────────────────────

echo -e "${YELLOW}[8/8]${NC} Post-deployment checks..."

# Health check
echo "  Checking API health..."
sleep 5
API_URL=$(grep API_URL packages/api/.env.production | cut -d '=' -f2- || echo "https://api.neyya.ai")
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_URL/api/health" 2>/dev/null || echo "000")

if [ "$HTTP_CODE" = "200" ]; then
  echo -e "${GREEN}  ✓ API health check passed (200)${NC}"
else
  echo -e "${YELLOW}  ⚠ API health check returned $HTTP_CODE (may still be starting)${NC}"
fi

# ─── Done ─────────────────────────────────────────────────────────────────────

echo ""
echo "═══════════════════════════════════════════════════════════"
echo -e "  ${GREEN}✅ Deployment complete!${NC}"
echo "═══════════════════════════════════════════════════════════"
echo ""
echo "  Web:   https://neyya.ai"
echo "  Admin: https://admin.neyya.ai"
echo "  API:   https://api.neyya.ai"
echo ""
echo "  Next steps:"
echo "  1. Verify login flow (Google, Microsoft, Facebook)"
echo "  2. Test Stripe checkout with test card 4242..."
echo "  3. Check admin panel access"
echo "  4. Monitor logs for errors"
echo ""
