# AI Chat Concierge — Requirements

**Date:** July 2026  
**Priority:** High (CRM engagement feature)  
**Status:** Requirements complete, implementation planned

---

## Overview

A floating AI chat widget present on all pages (landing page + in-app) that serves as:
1. **Help desk** — answers product questions using RAG from documentation
2. **Feedback collector** — captures bug reports, feature requests, and general feedback
3. **Lead generator** — engages landing page visitors and captures them as CRM leads
4. **Engagement tool** — proactively asks for feedback at key moments
5. **Support escalation** — flags conversations for human review when AI can't resolve

The AI automatically detects the user's intent and switches mode seamlessly, storing all interactions for analysis and CRM enrichment.

---

## Behaviour Modes (Auto-Detected)

| Mode | Trigger Phrases | AI Action |
|------|-----------------|-----------|
| **Help/Support** | "how do I...", "where is...", "can't find..." | Answer from RAG knowledge base |
| **Bug Report** | "bug", "broken", "error", "doesn't work" | Ask for details, capture as bug |
| **Feature Request** | "I wish...", "can you add...", "it would be great if..." | Capture request, acknowledge |
| **General Feedback** | "I think...", "suggestion", "feedback" | Capture feedback, thank user |
| **Product Inquiry** | "pricing", "features", "how much", "what can..." | Answer from docs, offer lead capture |
| **Escalation** | "talk to human", "support team", "not helpful" | Flag for human review, create CRM note |

---

## Landing Page Behaviour (Not Logged In)

- Widget shows after 30 seconds or on scroll to 50%
- Greeting: "Hi! I'm Neyya's AI assistant. Ask me anything about travel planning."
- Can answer product questions (features, pricing, how it works)
- If user seems interested → offer to capture email: "Want early access? Drop your email!"
- Captured email → auto-creates CRM lead with source='ai_chat'
- No authentication required for basic Q&A
- Chat history stored by session ID (cookie-based)

## In-App Behaviour (Logged In)

- Widget always accessible (bottom-right bubble)
- Greeting: "Hi {{name}}! Need help with anything?"
- Full context: knows user's plan, trip count, last activity
- Can help with: "How do I split expenses?", "How do I invite someone to my trip?"
- Proactive triggers:
  - After 3rd trip created: "How's your experience? Any feedback?"
  - After trial day 14: "What do you think of Premium features?"
  - After plan limit hit: "Need more? Want me to explain our Pro plan?"
- Bug reports auto-include: page URL, browser, user ID
- All chats linked to user's CRM contact record

---

## RAG Knowledge Base

### Data Sources (embedded in vector DB)

| Source | Content | Update Frequency |
|--------|---------|-----------------|
| Product features | From requirements.md — all 48 features described | On release |
| FAQ content | Common questions + answers | Manual updates |
| Pricing & plans | Plan details, limits, what's included | On price change |
| How-to guides | Step-by-step for key workflows | On feature change |
| Travel tips | General travel advice (from trip tips system) | Periodic |
| Release notes | What's new in each release | On deploy |

### Technical Approach

**Recommended: AWS Bedrock Knowledge Base**
- Upload documentation to S3 bucket
- Bedrock automatically chunks, embeds, and indexes
- Query via RetrieveAndGenerate API
- No vector DB management needed
- Costs: ~$0.002 per query (embedding) + LLM cost per response

**Alternative: Custom RAG**
- Embed docs with Amazon Titan Embeddings
- Store in PostgreSQL with pgvector extension
- Query: embed user message → find top-5 similar chunks → inject as context
- More control but more maintenance

**My recommendation:** Start with Bedrock Knowledge Base (simpler, managed). Switch to custom only if you need fine-grained control.

---

## Chat Storage & Analysis

### Database Tables

```sql
-- Chat sessions
CREATE TABLE ai_chat_sessions (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),       -- null if anonymous
  lead_id UUID REFERENCES crm_leads(id),   -- null if not captured
  session_token VARCHAR(100),              -- for anonymous visitors
  source VARCHAR(20),                      -- 'landing_page', 'in_app', 'admin'
  page_url TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  message_count INTEGER DEFAULT 0,
  ai_classification VARCHAR(50),           -- auto-categorized: support, bug, feature_request, general, lead
  satisfaction_rating INTEGER,             -- 1-5 if user rates
  escalated BOOLEAN DEFAULT FALSE,
  resolved BOOLEAN DEFAULT FALSE
);

-- Individual messages
CREATE TABLE ai_chat_messages (
  id UUID PRIMARY KEY,
  session_id UUID REFERENCES ai_chat_sessions(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,               -- 'user', 'assistant', 'system'
  content TEXT NOT NULL,
  ai_model VARCHAR(100),
  rag_sources TEXT[],                      -- which docs were used for RAG
  intent_detected VARCHAR(50),             -- per-message intent classification
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extracted feedback items (from AI analysis)
CREATE TABLE feedback_items (
  id UUID PRIMARY KEY,
  chat_session_id UUID REFERENCES ai_chat_sessions(id),
  user_id UUID REFERENCES users(id),
  type VARCHAR(20) NOT NULL,               -- 'bug', 'feature_request', 'feedback', 'question'
  title VARCHAR(300),                      -- AI-generated summary
  description TEXT,                        -- Full detail extracted by AI
  severity VARCHAR(10),                    -- 'low', 'medium', 'high', 'critical' (for bugs)
  page_url TEXT,
  browser_info TEXT,
  status VARCHAR(20) DEFAULT 'new',        -- 'new', 'triaged', 'planned', 'implemented', 'closed', 'rejected'
  upvotes INTEGER DEFAULT 0,
  admin_notes TEXT,
  is_public BOOLEAN DEFAULT FALSE,         -- visible in voting board after moderation
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Feature voting (after admin approves for public)
CREATE TABLE feedback_votes (
  id UUID PRIMARY KEY,
  feedback_item_id UUID REFERENCES feedback_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (feedback_item_id, user_id)
);
```

### AI Auto-Classification

After each conversation ends (or after 3+ messages), AI analyses the chat and:
1. Classifies the overall session (support/bug/feature_request/general/lead)
2. Extracts actionable items (bug description, feature request summary)
3. Assigns severity for bugs
4. Creates entries in `feedback_items` table
5. Updates CRM contact with engagement data

### Admin Analytics

Weekly AI summary generated automatically:
- "12 users asked about offline mode this week (+50% from last week)"
- "3 critical bugs reported: login timeout, expense sync failure, map not loading"
- "Top feature requests: photo sharing (7 votes), WhatsApp integration (4 votes)"

---

## Feedback Routing

| Category | Auto-Action |
|----------|-------------|
| Bug report (critical) | Create feedback_item + notify admin immediately |
| Bug report (low/medium) | Create feedback_item, surface in admin dashboard |
| Feature request | Create feedback_item (status: 'new', not public yet) |
| Feature request (admin approves) | Mark as public → visible in voting board |
| Lead inquiry | Create/update CRM lead, send welcome email |
| Support (resolved by AI) | Mark session as resolved, no admin action |
| Support (unresolved) | Flag as escalated, show in admin |
| Positive feedback | Store, use in testimonials (with consent) |

---

## Widget Design

### Visual
- Floating bubble: bottom-right corner, 56px circle
- Brand colour (Neyya green #32CD32)
- Subtle pulse animation when proactive message available
- Opens: slide-up chat panel (400px wide, 500px tall)
- Mobile: full-screen overlay
- Shows on: landing page, all in-app pages, admin panel

### Chat Panel
- Header: "Neyya AI" + online indicator + minimize button
- Message area: user (right, green bubble) + AI (left, gray bubble)
- Typing indicator ("Neyya is thinking...")
- Quick action buttons below input: "Report Bug" | "Request Feature" | "Get Help"
- Input: text field + send button
- Footer: "Powered by AI · Talk to human"

### Proactive Messages
- Appear as notification dot on bubble
- Open with pre-written prompt: "How's your experience so far?"
- Triggered by events (3rd trip, trial day 14, plan limit)
- Max 1 proactive per session (don't annoy users)

---

## CRM Integration

### Contact Enrichment
- Each chat session linked to user_id or lead_id
- CRM contact detail shows: "Last chat: 2 days ago, discussed pricing"
- Chat count + topics as CRM fields
- Sentiment score (positive/neutral/negative) from chat analysis

### Campaign Triggers
- User asked about Pro features → trigger "Upgrade" email campaign
- User reported bug → trigger "We fixed it!" email when resolved
- User requested feature → trigger "It's here!" email when shipped
- Positive feedback → ask for app store review

### Lead Generation
- Anonymous chat on landing → capture email → CRM lead (source: ai_chat)
- Higher quality leads (they engaged enough to chat)
- AI can qualify: "Are you planning a trip soon?" → warm vs cold lead

---

## Technical Stack

| Component | Technology |
|-----------|-----------|
| Chat UI | React floating widget component |
| AI Backend | Bedrock Claude (conversation) |
| RAG | Bedrock Knowledge Base (S3 → auto-embed → search) |
| Storage | PostgreSQL (chat sessions, messages, feedback) |
| Real-time | HTTP streaming (SSE) for AI responses |
| Analytics | Scheduled AI batch analysis (weekly summary) |

---

## Plan Limits

| Tier | Chat Messages/Day | Features |
|------|-------------------|----------|
| Anonymous (landing) | 5 messages | RAG Q&A only |
| Free | 10 messages/day | Help + feedback |
| Pro | 50 messages/day | Help + feedback + proactive tips |
| Premium | Unlimited | All + priority responses + escalation |

---

## Acceptance Criteria

1. Floating chat widget visible on all pages (landing + in-app)
2. AI answers product questions using RAG from documentation
3. AI detects intent (help/bug/feature/feedback) and switches mode automatically
4. Bug reports captured with page URL, browser info, and severity
5. Feature requests stored in feedback_items (admin-moderated before public)
6. Landing page visitors can be captured as leads through chat
7. All conversations stored and linked to CRM contacts
8. Admin can view all chat sessions with AI classification
9. Admin feedback board shows bugs + feature requests with status management
10. Users can vote on public feature requests
11. Proactive messages trigger at key moments (3rd trip, trial day 14)
12. "Talk to human" escalates and creates CRM note
13. Weekly AI summary of top themes, bugs, and requests
14. Chat history visible in CRM contact detail view
15. Campaign triggers based on chat content (upgrade nudge, resolution notification)
