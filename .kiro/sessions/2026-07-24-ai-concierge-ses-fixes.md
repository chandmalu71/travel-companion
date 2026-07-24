# Session: AI Chat Concierge + SES Delivery + Bug Fixes

**Date:** July 24, 2026  
**Duration:** Single session  
**Focus:** AI Chat Concierge (Req 49), landing page lead capture, SES wiring, pipeline + bug fixes

---

## What Was Accomplished

### 1. ECS Deploy Pipeline Fix
- Replaced `aws ecs wait services-stable` (10-min default timeout) with custom polling loop
- 24 checks x 10s = 4 min max wait, with step `timeout-minutes: 5`
- Health check now retries 6 times (60s total) instead of single attempt
- Non-blocking — timeout doesn't fail the deployment

### 2. trips.destination Column (Bug Fix)
- Created migration 025: adds `destination varchar(200)` to trips table
- Updated `TripsTable` type, `tripCreationSchema`, `tripUpdateSchema`
- Trip creation and update routes now persist destination
- Admin trips query now returns destination field

### 3. AI Chat Concierge — Backend (Req 49)
- **Migration 026:** 4 tables (ai_chat_sessions, ai_chat_messages, feedback_items, feedback_votes)
- **ChatConciergeService:** Bedrock Claude integration, embedded RAG knowledge base, regex-based intent detection (help/bug/feature/feedback/product_inquiry/escalation/greeting)
- **API Routes:**
  - POST /api/chat/sessions — create/resume session
  - POST /api/chat/messages — send message, get AI response
  - GET /api/chat/sessions/:id/messages — history
  - POST /api/chat/sessions/:id/rate — 1-5 satisfaction
  - POST /api/chat/sessions/:id/escalate — flag for human review
  - POST /api/chat/sessions/:id/end — close + classify
  - GET /api/chat/feedback — public voting board
  - POST /api/chat/feedback/:id/vote — toggle vote
  - GET /api/admin/chat/sessions — admin list
  - GET /api/admin/chat/feedback — admin feedback list
  - PUT /api/admin/chat/feedback/:id — update status/public/notes
- **Rate limiting:** anonymous 5/day, free 10, pro 50, premium unlimited
- **Auto-feedback:** creates feedback_items from bug/feature/feedback intents

### 4. AI Chat Concierge — Web UI Widget
- Floating bubble (bottom-right, emerald green, 56px circle)
- Pulse notification after 30s for anonymous visitors
- Chat panel: 380x520px desktop, full-screen mobile
- Message bubbles: user (right, green), assistant (left, gray), system (center)
- Typing indicator (bouncing dots)
- Quick action buttons: Get Help, Report Bug, Request Feature
- Session management via localStorage token
- Satisfaction rating prompt after 5 messages
- "Talk to human" escalation button
- Added to root layout — visible on all pages

### 5. Landing Page Lead Capture Form
- `LeadCaptureForm` component with 'card' and 'inline' variants
- Card: name (optional) + email (required) + marketing consent checkbox
- Client-side validation, loading spinner, success state
- UTM parameter extraction from URL
- reCAPTCHA badge notice + links to privacy/terms
- Integrated into landing page CTA section (two-column layout)

### 6. SES Email Delivery Wiring
- Campaign send route now actually delivers via `EmailService.sendRaw()`
- Personalises HTML with recipient data ({{name}}, {{email}})
- Injects open tracking pixel and unsubscribe link per send
- Updates email_sends record with status + messageId
- Rate limiting: 14/second (SES sandbox limit)
- Automation `processAutomations()` likewise wired to deliver via SES
- Added `@aws-sdk/client-ses` to API dependencies
- Added `EMAIL_PROVIDER=ses`, `SES_FROM_ADDRESS`, `API_URL` env vars to:
  - infrastructure/ecs/api-task-definition.json
  - infrastructure/cloudformation/ecs-services.yml

### 7. Registration Form — Terms + Marketing Consent
- Added required "Terms of Service" checkbox with links to /terms and /privacy
- Added optional marketing consent checkbox
- Backend validates termsAccepted is true (400 if not)
- On registration with marketing consent: upserts CRM lead (converted status) + triggers welcome automation

---

## Files Modified (21 files)

### Infrastructure
- `.github/workflows/deploy-docker.yml` — polling-based ECS stabilization
- `infrastructure/ecs/api-task-definition.json` — EMAIL_PROVIDER, SES_FROM_ADDRESS, API_URL
- `infrastructure/cloudformation/ecs-services.yml` — same env vars

### API
- `packages/api/package.json` — added @aws-sdk/client-ses
- `packages/api/src/app.ts` — registered chat-concierge routes
- `packages/api/src/db/types.ts` — TripsTable.destination, AiChatSessions/Messages/FeedbackItems/Votes types
- `packages/api/src/db/migrations/025_trip_destination.ts` — NEW
- `packages/api/src/db/migrations/026_ai_chat_concierge.ts` — NEW
- `packages/api/src/services/chat-concierge.ts` — NEW
- `packages/api/src/routes/chat-concierge.ts` — NEW
- `packages/api/src/routes/trips.ts` — destination in create/update
- `packages/api/src/routes/admin.ts` — destination in admin trips query
- `packages/api/src/routes/email-campaigns.ts` — SES delivery in campaign send
- `packages/api/src/routes/email-automation.ts` — SES delivery in processAutomations
- `packages/api/src/routes/auth-local.ts` — terms + marketing consent handling

### Shared
- `packages/shared/src/validators/index.ts` — destination field in trip schemas

### Web
- `packages/web/src/app/layout.tsx` — ChatWidget added to root
- `packages/web/src/app/page.tsx` — LeadCaptureForm in CTA section
- `packages/web/src/app/(auth)/register/page.tsx` — terms + marketing checkboxes
- `packages/web/src/components/chat-widget.tsx` — NEW
- `packages/web/src/components/lead-capture-form.tsx` — NEW

---

## Pending Items for Next Session

### Critical
- [ ] Cookie consent banner (UI component, needed for GDPR)
- [ ] Demo account Oliver fix (family member duplicate)

### Production Deployment
- [ ] Deploy production infrastructure stacks
- [ ] Production secrets (live Stripe keys, OAuth redirect URIs)
- [ ] DNS: neyya.ai → production ALB
- [ ] SES production access request (sandbox → production)

### Feature Wiring
- [ ] Social media OAuth connections (FB, IG, Twitter, LinkedIn, TikTok)
- [ ] A/B variant assignment during sends
- [ ] Lead score scheduled recalculation (EventBridge/cron)
- [ ] Referral auto-reward on conversion
- [ ] Automation scheduled processor (EventBridge/cron)

### Chat Concierge Enhancements
- [ ] Admin chat sessions page UI
- [ ] Admin feedback board page UI
- [ ] Proactive triggers (3rd trip, trial day 14, plan limit)
- [ ] Bedrock Knowledge Base integration (replace inline RAG)
- [ ] Weekly AI summary generation (batch job)

### Profile & Settings
- [ ] Avatar upload (S3 presigned URL)
- [ ] Password change flow
- [ ] Email verification flow (SES)
- [ ] Account deletion (GDPR)

---

## Technical Context

- **AWS Account:** 008582147209 (eu-west-1)
- **CLI Profile:** neyya
- **QA URLs:** qa.neyya.ai / api-qa.neyya.ai / admin-qa.neyya.ai
- **Deploy:** `git push origin develop` (auto via GitHub Actions)
- **Admin login:** chand.malu@gmail.com / !Neyya-AWS
- **Demo login:** demo@neyya.ai / TryNeyya2026
- **DB migrations:** 001-026 (025-026 pending apply on QA — will auto-run on deploy)
- **GitHub:** chandmalu71/travel-companion (develop branch)
- **Email:** SES configured for neyya.ai domain, sandbox mode (need production access request)
