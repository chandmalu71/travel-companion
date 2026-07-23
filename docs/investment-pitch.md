# Neyya.ai — Investment Pitch

## The AI-Native Travel Companion

---

## The Problem

Travelling in groups is broken. A single trip generates chaos across 5+ disconnected tools:

- **Gmail** for booking confirmations
- **Google Sheets** for splitting expenses
- **WhatsApp** for group coordination
- **TripAdvisor** for finding restaurants
- **Google Maps** for navigation
- **Weather apps** for packing decisions

**The result:** missed connections, forgotten bookings, awkward "you owe me €47" conversations, and hours wasted on logistics instead of enjoying the trip.

For the 1.4 billion international travellers in 2024, this fragmentation costs time, money, and peace of mind. Group travellers (67% of leisure trips) suffer the most — coordination friction kills spontaneity.

---

## The Solution: Neyya.ai

Neyya is an **AI-native travel companion** that eliminates trip chaos by unifying planning, bookings, expenses, and communication into one intelligent platform.

**What makes it different:**

1. **Automatic booking import** — Connect your email, and Neyya's AI extracts every flight, hotel, and car rental into a unified timeline. No manual entry.

2. **AI-powered trip intelligence** — Personalised tips, itinerary gap detection ("you have no hotel for night 3"), weather-aware packing suggestions, and dietary/allergy-conscious restaurant discovery.

3. **Real-time group expense splitting** — Track shared costs as they happen. Receipt scanning, multi-currency conversion, and automatic settlement calculations. No more spreadsheets.

4. **Collaborative trip planning** — Shared itineraries, group messaging with AI assistant, polls for decision-making, and family visibility controls.

5. **One-tap flight check-in** — Check into flights directly from the app without juggling airline apps.

---

## Why Now

Three forces converging make this the right moment:

**1. AI cost collapse**
LLM inference costs dropped 95% in 18 months. Complex email parsing that cost $0.10/email in 2024 now costs $0.0003. This makes AI-powered features economically viable at consumer price points.

**2. Post-COVID travel boom**
International tourist arrivals reached 1.4B in 2024 (UNWTO), with group/family travel growing 23% YoY. Travellers now expect digital-first experiences.

**3. "Super app" fatigue**
Consumers are tired of juggling 5+ apps per trip. The market is ready for a unified, intelligent solution — but existing players (TripIt, Google Travel) haven't evolved beyond basic itinerary views.

---

## Market Opportunity

### Total Addressable Market (TAM)

| Segment | Size | Source |
|---------|------|--------|
| Global travel tech market | $820B by 2030 | Allied Market Research |
| Online travel market | $1.1T by 2028 | Statista |
| Travel app market | $28.5B by 2027 | Grand View Research |

### Serviceable Addressable Market (SAM)

- 1.4B international travellers (2024)
- 67% travel in groups (940M group trips/year)
- Average 3.2 trips/year per active traveller
- **SAM: ~€12B** (trip planning + expense management tools for group travellers)

### Serviceable Obtainable Market (SOM)

- Year 1 target: 50K active users (Finland, UK, India early markets)
- Year 3 target: 2M active users across Europe + India
- **SOM Year 3: ~€150M ARR potential** (at 10% Pro/Premium conversion)

---

## Business Model

### Freemium SaaS (B2C)

| Plan | Price | Target |
|------|-------|--------|
| Free | €0 | Casual travellers, 2 trips/year, basic features |
| Pro | €14.99/mo | Frequent travellers, unlimited trips, AI features, expense splitting |
| Premium | €29.99/mo | Power users, families, priority AI, advanced analytics, unlimited storage |

**Unit Economics (target at scale):**
- CAC: €8-12 (organic + referral-heavy)
- LTV: €180-400 (18-month avg retention for travel apps)
- LTV:CAC ratio: 15-30x

### Future B2B Revenue (Year 2+)
- Corporate travel management
- Travel agency white-label
- Airline/hotel integration partnerships (booking referral fees)

---

## Competitive Landscape

No single competitor covers our full feature set:

| | Neyya | TripIt | Wanderlog | Splitwise | Lambus |
|---|:---:|:---:|:---:|:---:|:---:|
| AI email parsing | ✅ | ✅ | ❌ | ❌ | ⚠️ |
| AI personalisation | ✅ | ❌ | ❌ | ❌ | ❌ |
| Expense splitting | ✅ | ❌ | ❌ | ✅ | ✅ |
| Receipt scanning | ✅ | ❌ | ❌ | ✅ | ❌ |
| Gap detection | ✅ | ❌ | ❌ | ❌ | ❌ |
| Group messaging | ✅ | ❌ | ❌ | ❌ | ⚠️ |
| Weather integration | ✅ | ❌ | ❌ | ❌ | ❌ |
| Multi-language (10) | ✅ | ⚠️ | ❌ | ✅ | ⚠️ |
| Dietary/allergy awareness | ✅ | ❌ | ❌ | ❌ | ❌ |

**Key insight:** Competitors are either booking-focused (TripIt) OR expense-focused (Splitwise) OR planning-focused (Wanderlog). Nobody combines all three with AI intelligence. Neyya is the first to unify the full travel lifecycle.

---

## Product & Technology

### Current State: Production-Ready MVP

- **55,800 lines of code** across API, web app, and admin panel
- **44 requirements fully implemented** with end-to-end functionality
- **Deployed on AWS** (ECS/Fargate, RDS, Redis, CloudFront)
- **Live QA environment:** https://qa.neyya.ai
- **10 languages** supported with AI auto-translation
- **3-tier subscription system** with Stripe integration

### AI Architecture: Cost-Optimised Tiered System

```
Request → Tier 0 (rules/regex, free)
  → Tier 1 (Amazon Nova Lite, $0.0003/call)
    → Tier 2 (Claude Haiku, $0.002/call)
      → Tier 3 (External APIs, as needed)
```

**Result:** Average AI cost per user per month: €0.03-0.08 (95%+ gross margin on AI features).

### Tech Stack
- **Backend:** Node.js/Fastify, PostgreSQL, Redis
- **Frontend:** Next.js (React), Tailwind CSS
- **AI:** AWS Bedrock (Claude, Nova), tiered escalation
- **Infrastructure:** AWS ECS/Fargate, fully containerised
- **CI/CD:** GitHub Actions, automated Docker deployments

---

## The "AI Founder" Advantage

Neyya was built in **5 days** with AI-assisted development — 113 commits, 37 PRs, 55,800 LOC. This isn't a liability; it's a **structural advantage**:

- **10x development velocity** — features that take competitors 3 months ship in days
- **Near-zero engineering cost** — no 5-person engineering team needed at this stage
- **Capital efficiency** — seed funding goes to growth and partnerships, not headcount
- **Rapid iteration** — user feedback → production changes in hours, not sprints

This is the new paradigm: **one domain expert + AI = full product team**. It's not about having less; it's about being lean, fast, and unfundable to replicate at this speed.

---

## Go-to-Market Strategy

### Phase 1: Pilot (Q3 2026)
- Launch in Finland (home market, high travel spend per capita)
- 500 pilot users via personal network + travel communities
- Validate core loop: email connect → trip created → expenses split → repeat

### Phase 2: Growth (Q4 2026 - Q1 2027)
- Expand to UK and India (English-speaking, large expat populations)
- Content marketing: "The trip planning app that reads your inbox"
- Referral loops: group trips naturally invite 3-5 new users per trip
- App Store launch (React Native mobile)

### Phase 3: Scale (2027)
- B2B partnerships: travel agencies, corporate travel
- Airline/hotel booking integrations (referral revenue)
- Premium API for travel tech ecosystem

### Viral Growth Mechanics
- **Built-in network effect:** Every group trip invites 3-5 non-users
- **Expense splitting requires all participants** → natural onboarding
- **Shareable trip highlights** → social proof and discovery
- **Family plans** → household-level adoption

---

## Financial Projections

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Active Users | 50K | 500K | 2M |
| Paying Users (10% conversion) | 5K | 50K | 200K |
| ARPU (monthly) | €18 | €20 | €22 |
| MRR | €90K | €1M | €4.4M |
| ARR | €1.1M | €12M | €53M |
| Gross Margin | 85% | 88% | 90% |
| Monthly Burn | €30K | €150K | €400K |

---

## What We're Looking For

### Pre-Seed / Seed Round

- **Amount:** To be determined based on investor interest
- **Use of funds:**
  - 40% — Growth & user acquisition (pilots, marketing, partnerships)
  - 30% — Product development (mobile app, B2B features, airline integrations)
  - 20% — Infrastructure & AI costs (scaling, Bedrock, CDN)
  - 10% — Operations (legal, compliance, GDPR)

### What investors get:
- A production-ready product (not a pitch deck — a working app)
- Capital-efficient AI-native company (10x output per $ vs traditional dev)
- First-mover in the "unified AI travel companion" category
- Multi-market expansion playbook (Finland → UK → India → global)
- Clear path to B2B revenue diversification

---

## Team

**Founder:** Product visionary with deep travel industry knowledge and technical execution capability. Leveraging AI-assisted development to maintain 10x velocity without traditional engineering overhead.

**Advisory needs:** Travel industry partnerships, B2B sales, mobile growth marketing.

---

## Why Neyya Will Win

1. **Full-stack solution** — Only app combining bookings + expenses + planning + AI in one experience
2. **AI-native cost structure** — 95%+ gross margins; AI handles what competitors need humans for
3. **Network effects** — Group trips are inherently viral; every user brings 3-5 more
4. **Speed advantage** — Ship features in days while competitors take quarters
5. **Global from day one** — 10 languages, multi-currency, locale-aware from the start
6. **Data moat** — Every trip processed makes the AI smarter at parsing, suggesting, and personalising

---

## Contact

**Product:** https://qa.neyya.ai (live demo available)  
**Deck:** This document  
**Next step:** Pilot partnership or investment conversation

---

*Neyya.ai — Your trips, intelligently managed.*
