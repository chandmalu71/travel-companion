/**
 * AI Chat Concierge Service
 *
 * Provides a conversational AI assistant that:
 * - Answers product questions using RAG from documentation
 * - Detects user intent (help/bug/feature/feedback/lead)
 * - Captures feedback and bug reports
 * - Engages landing page visitors for lead generation
 *
 * Uses AWS Bedrock Claude for generation.
 * Implements Requirement 49.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';
import type { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ChatIntent =
  | 'help'
  | 'bug_report'
  | 'feature_request'
  | 'feedback'
  | 'product_inquiry'
  | 'escalation'
  | 'greeting'
  | 'general';

export interface ChatContext {
  userId?: string;
  userName?: string;
  userPlan?: string;
  tripCount?: number;
  pageUrl?: string;
  browserInfo?: string;
  isAnonymous: boolean;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface ChatResponse {
  content: string;
  intent: ChatIntent;
  model: string;
  shouldCaptureLead: boolean;
  shouldCreateFeedback: boolean;
  feedbackType?: 'bug' | 'feature_request' | 'feedback';
  feedbackSeverity?: 'low' | 'medium' | 'high' | 'critical';
}

// ─── RAG Knowledge Base ──────────────────────────────────────────────────────

const KNOWLEDGE_BASE = `
## Neyya.ai - Travel Companion Platform

### What is Neyya?
Neyya is an AI-powered travel companion that helps you plan, organise, and enjoy trips. It automatically extracts bookings from emails, creates smart timelines, provides personalised recommendations, and helps groups plan together in real-time.

### Key Features
1. **Email Booking Extraction** — Forward confirmation emails to trips@neyya.ai or connect your inbox. AI extracts flight, hotel, and car rental details automatically.
2. **Smart Trip Timeline** — Day-by-day view of your trip with all bookings, activities, and events.
3. **AI-Powered Search** — Find restaurants, activities, and attractions personalised to your preferences.
4. **Expense Tracking** — Track spending, scan receipts, split costs with travel companions.
5. **Collaborative Planning** — Invite friends/family to plan together in real-time with voting and chat.
6. **Weather Integration** — 14-day forecasts and alerts for your destination.
7. **Flight Check-in Reminders** — Never miss a check-in window with smart notifications.
8. **Gap Detection** — AI spots missing accommodation, transportation gaps, and scheduling conflicts.
9. **Document Storage** — Store boarding passes, visas, insurance docs in one place.
10. **Multi-Currency** — Track expenses in any currency with automatic conversion.
11. **AI Trip Tips** — Personalised packing lists, cultural tips, and activity suggestions.
12. **Messaging** — Chat with trip members, create polls, make group decisions.

### Pricing Plans
- **Free** — 3 trips, 20 bookings, basic features
- **Pro (€14.99/month)** — 20 trips, 200 bookings, AI search, expense export, priority support
- **Premium (€29.99/month)** — Unlimited trips & bookings, all features, family sharing, advanced AI

### How It Works
1. Sign up (email or Google/Microsoft/Facebook)
2. Create a trip or forward a booking email
3. AI builds your itinerary automatically
4. Invite travel companions to collaborate
5. Get smart recommendations and reminders throughout your trip

### Supported Platforms
- Web app (all browsers)
- Mobile app (iOS & Android) — coming soon
- Email forwarding (any email client)

### Data & Privacy
- End-to-end encryption for sensitive data (passport info)
- GDPR compliant (EU data storage, right to deletion)
- Data stored in AWS eu-west-1 (Ireland)
- No data sharing with third parties
- SOC2 compliance in progress

### Getting Help
- AI Chat (you're using it now!)
- Email: support@neyya.ai
- Help center: help.neyya.ai (coming soon)

### Common Questions
Q: Can I use Neyya for free?
A: Yes! The Free plan includes 3 trips and 20 bookings with core features.

Q: How do I add a booking?
A: Three ways: (1) Forward confirmation email to trips@neyya.ai, (2) Connect your email inbox for auto-scanning, (3) Add manually from the trip page.

Q: Can I share my trip with others?
A: Yes! Invite by email or generate a shareable link. Collaborators can view or edit depending on permissions.

Q: How does expense splitting work?
A: Create an expense group in your trip, add shared expenses, and choose equal/percentage/per-item splits. Neyya calculates who owes whom.

Q: Is my data secure?
A: Absolutely. We use AES-256 encryption, store data in EU data centres, and never share with third parties. Full GDPR compliance.

Q: Can I use it offline?
A: Selected trips can be downloaded for offline access (up to 10 trips). Changes sync when you're back online.
`;

// ─── Intent Detection ────────────────────────────────────────────────────────

const INTENT_PATTERNS: Record<ChatIntent, RegExp[]> = {
  bug_report: [
    /\b(bug|broken|error|crash|doesn'?t work|not working|issue|glitch|stuck)\b/i,
    /\b(can'?t (log|sign|open|load|see|find|save|delete))/i,
    /\b(page (is blank|won'?t load|broken))\b/i,
  ],
  feature_request: [
    /\b(i wish|can you add|would be (great|nice|cool)|please add|suggestion)\b/i,
    /\b(it would be|how about adding|feature request|you should)\b/i,
    /\b(any plans (to|for))\b/i,
  ],
  feedback: [
    /\b(i (think|feel|believe)|feedback|opinion|suggestion)\b/i,
    /\b(love (it|this|the)|great (app|feature|job)|well done|amazing)\b/i,
    /\b(could be better|needs improvement|disappointed)\b/i,
  ],
  escalation: [
    /\b(talk to (a |)(human|person|agent|support|someone))\b/i,
    /\b(not helpful|useless|terrible|want (to |)complain)\b/i,
    /\b(real (person|human|support))\b/i,
  ],
  product_inquiry: [
    /\b(pric(e|ing)|how much|cost|plan|subscri(be|ption)|free|pro|premium)\b/i,
    /\b(what (can|does)|features|capabilities|compare)\b/i,
    /\b(trial|upgrade|downgrade)\b/i,
  ],
  help: [
    /\b(how (do|can|to)|where (is|do|can)|help (me|with))\b/i,
    /\b(can'?t find|looking for|show me|explain|guide)\b/i,
    /\b(what (is|are) (the|my))\b/i,
  ],
  greeting: [
    /^(hi|hello|hey|good (morning|afternoon|evening)|howdy|yo)\b/i,
    /^(what'?s up|sup|hiya)\b/i,
  ],
  general: [],
};

function detectIntent(message: string): ChatIntent {
  for (const [intent, patterns] of Object.entries(INTENT_PATTERNS)) {
    if (intent === 'general') continue;
    for (const pattern of patterns) {
      if (pattern.test(message)) {
        return intent as ChatIntent;
      }
    }
  }
  return 'general';
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ChatConciergeService {
  private client: BedrockRuntimeClient;
  private model: string;

  constructor(region = 'eu-west-1', model = 'anthropic.claude-3-5-haiku-20241022-v1:0') {
    this.client = new BedrockRuntimeClient({ region });
    this.model = model;
  }

  /**
   * Generate a response for the user's message with full conversation history.
   */
  async generateResponse(
    userMessage: string,
    history: ChatMessage[],
    context: ChatContext,
  ): Promise<ChatResponse> {
    const intent = detectIntent(userMessage);

    const systemPrompt = this.buildSystemPrompt(context, intent);
    const messages = this.buildMessages(history, userMessage);

    try {
      const body = JSON.stringify({
        anthropic_version: 'bedrock-2023-05-31',
        max_tokens: 500,
        system: systemPrompt,
        messages,
      });

      const command = new InvokeModelCommand({
        modelId: this.model,
        contentType: 'application/json',
        accept: 'application/json',
        body,
      });

      const response = await this.client.send(command);
      const responseBody = JSON.parse(new TextDecoder().decode(response.body));
      const content = responseBody.content?.[0]?.text ?? 'I apologize, I encountered an issue. Please try again.';

      return {
        content,
        intent,
        model: this.model,
        shouldCaptureLead: intent === 'product_inquiry' && context.isAnonymous,
        shouldCreateFeedback: ['bug_report', 'feature_request', 'feedback'].includes(intent),
        feedbackType: intent === 'bug_report' ? 'bug'
          : intent === 'feature_request' ? 'feature_request'
          : intent === 'feedback' ? 'feedback'
          : undefined,
        feedbackSeverity: intent === 'bug_report' ? this.detectSeverity(userMessage) : undefined,
      };
    } catch (error: any) {
      // Fallback: use knowledge base directly without LLM
      const fallbackContent = this.generateFallbackResponse(intent, context);
      return {
        content: fallbackContent,
        intent,
        model: 'fallback',
        shouldCaptureLead: false,
        shouldCreateFeedback: false,
      };
    }
  }

  /**
   * Classify an entire conversation session after it ends.
   */
  async classifySession(messages: ChatMessage[]): Promise<{
    classification: string;
    summary: string;
  }> {
    const userMessages = messages.filter((m) => m.role === 'user').map((m) => m.content);
    const intents = userMessages.map(detectIntent);

    // Most frequent non-general intent
    const intentCounts = new Map<string, number>();
    for (const intent of intents) {
      if (intent !== 'general' && intent !== 'greeting') {
        intentCounts.set(intent, (intentCounts.get(intent) ?? 0) + 1);
      }
    }

    let classification = 'general';
    let maxCount = 0;
    for (const [intent, count] of intentCounts) {
      if (count > maxCount) {
        maxCount = count;
        classification = intent;
      }
    }

    const summary = userMessages.slice(0, 3).join(' | ').slice(0, 200);
    return { classification, summary };
  }

  // ─── Private Helpers ─────────────────────────────────────────────────────

  private buildSystemPrompt(context: ChatContext, intent: ChatIntent): string {
    const persona = context.isAnonymous
      ? `You are Neyya's AI assistant on the landing page. Be friendly, concise, and helpful. Your goal is to answer questions about Neyya and gently encourage sign-up when appropriate. Never be pushy.`
      : `You are Neyya's AI assistant. The user is ${context.userName ?? 'a user'} on the ${context.userPlan ?? 'Free'} plan with ${context.tripCount ?? 0} trips. Be helpful and concise.`;

    const intentInstructions: Record<ChatIntent, string> = {
      help: 'The user needs help with a feature. Provide clear step-by-step guidance based on the knowledge base.',
      bug_report: 'The user is reporting a bug. Acknowledge the issue, ask for details (what happened, what they expected, steps to reproduce), and assure them it will be looked into.',
      feature_request: 'The user wants a new feature. Acknowledge the idea enthusiastically, ask for a bit more detail if vague, and confirm it has been captured.',
      feedback: 'The user is giving feedback. Thank them sincerely and ask a follow-up question to get more detail.',
      product_inquiry: 'The user wants to know about features/pricing. Answer from the knowledge base. If they seem interested, mention they can sign up for free.',
      escalation: 'The user wants human help. Acknowledge this, let them know their conversation will be reviewed by the team, and provide support@neyya.ai as an alternative.',
      greeting: 'Greet the user warmly and ask how you can help.',
      general: 'Answer helpfully based on the knowledge base. If the topic is unclear, ask a clarifying question.',
    };

    return `${persona}

${intentInstructions[intent]}

## Knowledge Base
${KNOWLEDGE_BASE}

## Rules
- Keep responses under 150 words
- Use simple language, no jargon
- If you don't know something, say so honestly
- Never make up features that don't exist
- For bugs: always ask for the page URL and what happened
- For pricing: always mention the free tier exists
- Be warm but professional
- Use markdown formatting sparingly (bold for emphasis only)`;
  }

  private buildMessages(history: ChatMessage[], currentMessage: string) {
    // Keep last 10 messages for context window
    const recentHistory = history.slice(-10);
    const messages = recentHistory.map((m) => ({
      role: m.role === 'system' ? 'user' as const : m.role as 'user' | 'assistant',
      content: m.content,
    }));
    messages.push({ role: 'user', content: currentMessage });
    return messages;
  }

  private detectSeverity(message: string): 'low' | 'medium' | 'high' | 'critical' {
    const critical = /\b(crash|data loss|can'?t (log|sign) in|security|payment (fail|error))\b/i;
    const high = /\b(broken|not working|error|can'?t (save|load|delete))\b/i;
    const medium = /\b(slow|weird|unexpected|wrong)\b/i;

    if (critical.test(message)) return 'critical';
    if (high.test(message)) return 'high';
    if (medium.test(message)) return 'medium';
    return 'low';
  }

  private generateFallbackResponse(intent: ChatIntent, context: ChatContext): string {
    const responses: Record<ChatIntent, string> = {
      greeting: context.isAnonymous
        ? "Hi! I'm Neyya's AI assistant. I can answer questions about our travel planning platform, pricing, and features. How can I help?"
        : `Hi${context.userName ? ` ${context.userName}` : ''}! How can I help you today?`,
      help: "I'd be happy to help! Could you tell me more about what you're trying to do? I can guide you through most features of Neyya.",
      bug_report: "I'm sorry you're experiencing an issue. Could you tell me: 1) What page were you on? 2) What happened? 3) What did you expect to happen? I'll make sure the team looks into this.",
      feature_request: "Thanks for the suggestion! I'd love to hear more details about what you have in mind. What problem would this solve for you?",
      feedback: "Thank you for sharing your thoughts! Your feedback helps us improve. Could you tell me a bit more?",
      product_inquiry: "Neyya is an AI-powered travel companion with plans starting from Free (3 trips) to Premium (€29.99/mo, unlimited). What would you like to know more about?",
      escalation: "I understand you'd like to speak with a human. I've flagged this conversation for our support team. You can also email support@neyya.ai directly.",
      general: "I'm here to help! I can answer questions about Neyya's features, pricing, or how to use specific tools. What would you like to know?",
    };
    return responses[intent];
  }
}

// ─── Singleton ───────────────────────────────────────────────────────────────

let instance: ChatConciergeService | null = null;

export function getChatConciergeService(): ChatConciergeService {
  if (!instance) {
    instance = new ChatConciergeService(
      process.env.BEDROCK_REGION ?? 'eu-west-1',
      process.env.CONCIERGE_MODEL ?? 'anthropic.claude-3-5-haiku-20241022-v1:0',
    );
  }
  return instance;
}
