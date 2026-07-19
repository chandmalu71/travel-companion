#!/bin/bash
# Nayya - Setup SES Inbound Email for trips@nayya.ai
#
# Prerequisites:
# - DNS must be pointing to Route 53 (nameserver propagation complete)
# - ACM certificate must be issued
#
# This script:
# 1. Verifies the domain in SES
# 2. Deploys the CloudFormation stack (S3 + Lambda + SES rules)
# 3. Adds MX record to Route 53
# 4. Activates the receipt rule set

set -e
REGION="eu-west-1"
HOSTED_ZONE_ID="Z08178223AFNDR8ULDQ8X"
DOMAIN="nayya.ai"
ENVIRONMENT="${1:-qa}"
API_ENDPOINT="${2:-https://api-qa.nayya.ai}"

echo "=== Setting up SES inbound email for trips@${DOMAIN} (${ENVIRONMENT}) ==="
echo ""

# Step 1: Verify domain in SES
echo "=== Step 1: Verify domain in SES ==="
VERIFICATION_TOKEN=$(aws ses verify-domain-identity \
  --domain $DOMAIN \
  --region $REGION \
  --query "VerificationToken" \
  --output text 2>&1)
echo "Verification token: $VERIFICATION_TOKEN"

# Add TXT record for SES verification
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "{
  \"Changes\": [{
    \"Action\": \"UPSERT\",
    \"ResourceRecordSet\": {
      \"Name\": \"_amazonses.${DOMAIN}.\",
      \"Type\": \"TXT\",
      \"TTL\": 300,
      \"ResourceRecords\": [{\"Value\": \"\\\"${VERIFICATION_TOKEN}\\\"\"}]
    }
  }]
}" > /dev/null
echo "SES verification TXT record added to Route 53"

# Step 2: Add MX record for inbound email
echo ""
echo "=== Step 2: Add MX record for inbound email ==="
aws route53 change-resource-record-sets --hosted-zone-id $HOSTED_ZONE_ID --change-batch "{
  \"Changes\": [{
    \"Action\": \"UPSERT\",
    \"ResourceRecordSet\": {
      \"Name\": \"${DOMAIN}.\",
      \"Type\": \"MX\",
      \"TTL\": 300,
      \"ResourceRecords\": [{\"Value\": \"10 inbound-smtp.${REGION}.amazonaws.com\"}]
    }
  }]
}" > /dev/null
echo "MX record added: 10 inbound-smtp.${REGION}.amazonaws.com"

# Step 3: Deploy CloudFormation stack
echo ""
echo "=== Step 3: Deploy SES inbound CloudFormation stack ==="
aws cloudformation deploy \
  --template-file cloudformation/ses-inbound.yml \
  --stack-name "nayya-ses-inbound-${ENVIRONMENT}" \
  --parameter-overrides \
    Environment=$ENVIRONMENT \
    DomainName=$DOMAIN \
    ApiEndpoint=$API_ENDPOINT \
  --capabilities CAPABILITY_NAMED_IAM \
  --region $REGION
echo "CloudFormation stack deployed"

# Step 4: Activate the receipt rule set
echo ""
echo "=== Step 4: Activate receipt rule set ==="
aws ses set-active-receipt-rule-set \
  --rule-set-name "nayya-inbound-${ENVIRONMENT}" \
  --region $REGION 2>&1 || echo "Note: Only one rule set can be active at a time"
echo "Receipt rule set activated"

echo ""
echo "=== DONE ==="
echo ""
echo "Summary:"
echo "  Forwarding address: trips@${DOMAIN}"
echo "  Emails → S3 (nayya-inbound-email-${ENVIRONMENT}) → Lambda → API (${API_ENDPOINT})"
echo ""
echo "Note: SES domain verification may take up to 72 hours."
echo "Check status: aws ses get-identity-verification-attributes --identities ${DOMAIN} --region ${REGION}"
echo ""
echo "To test locally:"
echo "  curl -X POST ${API_ENDPOINT}/api/bookings/forward \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"from\":\"user@test.com\",\"subject\":\"Booking Confirmation\",\"textBody\":\"Your flight DL1234...\"}'"
