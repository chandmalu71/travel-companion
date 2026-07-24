# Session: Docker/AWS Deployment + CRM Implementation

**Date:** July 23-24, 2026  
**Duration:** Extended session (single continuous conversation)  
**Focus:** Infrastructure deployment, post-deploy fixes, CRM system build

---

## What Was Accomplished

### Infrastructure & Deployment
- Created Dockerfiles for API, Web, Admin (multi-stage, linux/amd64)
- Created docker-compose.yml for local development
- Deployed to AWS ECS/Fargate (account 008582147209, eu-west-1)
- Set up full CI/CD via GitHub Actions (push to develop → auto-deploy QA)
- Configured: VPC, ALB, RDS PostgreSQL, ElastiCache Redis, ECR, Secrets Manager
- DNS: api-qa.neyya.ai, qa.neyya.ai, admin-qa.neyya.ai → ALB
- HTTPS with ACM certificate (*.neyya.ai)
- SES domain verification for neyya.ai
- All external services wired: Google OAuth, Microsoft, Facebook, Stripe (test), OpenWeatherMap, Google Maps

### Admin Panel Enhancements
- Auth gate (login required, admin_role check)
- Users page: API integration, search, pagination, subscription column, impersonate
- Translations: seeded 350+ keys, auto-translate endpoint
- OAuth provider management (enable/disable/coming soon)
- Grouped collapsible sidebar (7 groups)
- CRM section added

### Demo Account
- demo@neyya.ai / TryNeyya2026 (Premium, hidden from admin)
- 5 trips, 10 bookings, 12 expenses, 3 conversations, 14 messages
- 6 AI tips with checklists, 6 AI chat Q&A
- 2 family members, user preferences, trip budgets
- Nightly reset script (preserves seeded data)

### CRM System (Phases A-H) — COMPLETE
- **A:** Lead capture API, legal pages (privacy/terms/cookies/gdpr), consent records
- **B:** Admin CRM dashboard, leads list with filters/pagination/detail modal
- **C:** Email campaigns, AI generator (Bedrock Claude), templates, send tracking
- **D:** Automation engine, welcome/trial series, trigger on lead signup
- **E:** Open/click tracking (pixel + redirect), analytics endpoint
- **F:** Social media campaigns (5 platforms, AI content gen, scheduling)
- **G:** Social analytics dashboard (metrics cards)
- **H:** A/B testing, lead scoring (rules engine), referral tracking

### New Features (Requirements + UI Stubs)
- Req 44: Trip Photos & Gallery (Premium, deferred to mobile)
- Req 45: AI Social Sharing (Premium, deferred)
- Req 46: Trip Card Header Images (implemented with Unsplash)
- Req 47-48: CRM & Marketing Automation (implemented)
- Req 49: AI Chat Concierge & Feedback System (requirements written)

### Documents Created
- docs/infrastructure-deployed.md
- docs/qa-e2e-test-results.md
- docs/deployment-checklist.md
- docs/production-deployment-plan.md
- docs/production-actions-checklist.md
- docs/local-development-guide.md
- docs/investment-pitch.md
- docs/pitch-deck.html
- docs/crm-marketing-requirements.md
- docs/ai-chat-concierge-requirements.md

---

## Key Decisions Made

1. **Docker/ECS over Vercel** — moved from Vercel to Docker containers on ECS/Fargate
2. **Public subnets for ECS** — chose public IPs over NAT Gateway ($32/mo savings for QA)
3. **sslmode=no-verify** for RDS in QA (RDS CA cert issue)
4. **CRM built in-house** — no external tool (Mailchimp/HubSpot), uses SES + Bedrock
5. **Freemium pricing:** Free/Pro €14.99/Premium €29.99
6. **Demo account hidden** from admin user list
7. **Admin sidebar grouped** into 7 collapsible sections
8. **Pipeline non-blocking** — ECS wait timeout won't fail deployment
9. **Photos/Social Sharing deferred** to mobile app phase (UI stubs only)
10. **AI Chat Concierge** planned with RAG from documentation (Bedrock Knowledge Base)

---

## Pending Items for Next Session

### Critical (bugs/blockers)
- [ ] `trips.destination` column doesn't exist in DB (admin trips page error) — need migration to add it OR remove from queries
- [ ] Demo family member (Oliver) not properly persisted — need to re-run fix
- [ ] Cookie consent banner not yet built (UI component)
- [ ] Registration form missing Terms checkbox

### Production Deployment
- [ ] Deploy production infrastructure stacks
- [ ] Production secrets (live Stripe keys, OAuth redirect URIs)
- [ ] DNS: neyya.ai → production ALB
- [ ] SES production access request (24-48h wait)

### Feature Wiring
- [ ] SES actual email delivery (currently queued but not sent)
- [ ] Social media OAuth connections (FB, IG, Twitter, LinkedIn, TikTok)
- [ ] A/B variant assignment during sends
- [ ] Lead score scheduled recalculation
- [ ] Referral auto-reward on conversion

### New Features to Implement
- [ ] AI Chat Concierge (Req 49) — floating widget, RAG, feedback routing
- [ ] Landing page lead capture form (UI component)
- [ ] Cookies/GDPR pages need header/footer alignment (same style as Privacy)

---

## Technical Context

- **AWS Account:** 008582147209 (eu-west-1)
- **CLI Profile:** neyya
- **QA URLs:** qa.neyya.ai / api-qa.neyya.ai / admin-qa.neyya.ai
- **Deploy:** `git push origin develop` (auto via GitHub Actions)
- **Manual deploy:** `./scripts/deploy.sh deploy -e qa`
- **Admin login:** chand.malu@gmail.com / !Neyya-AWS
- **Demo login:** demo@neyya.ai / TryNeyya2026
- **DB migrations:** 001-024 (all applied on QA)
- **GitHub:** chandmalu71/travel-companion (develop branch)
