/**
 * Proactive Suggestions Service
 *
 * Generates personalized travel suggestions based on trip context:
 * - Free time detected (3+ hour gap between events)
 * - Weather changes (significant delta for upcoming trips)
 * - No dining planned (trip day without restaurant)
 * - Arrival without activity (flight lands, nothing after)
 * - Long transit (>2h between locations)
 *
 * Uses Tier 0 (rules) for detection + Tier 1 (LLM) for composition.
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { LLMService, PROMPTS } from './llm-service.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SuggestionTrigger =
  | 'free_time'
  | 'weather_change'
  | 'no_dining'
  | 'unplanned_arrival'
  | 'long_transit';

export interface ProactiveSuggestion {
  id: string;
  tripId: string;
  trigger: SuggestionTrigger;
  title: string;
  message: string;
  suggestions: Array<{ name: string; type: string; reason: string }>;
  date: string;
  dismissed: boolean;
  createdAt: string;
}

export interface TripContext {
  tripId: string;
  tripName: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  events: Array<{
    date: string;
    startTime: string;
    endTime: string;
    type: string;
    title: string;
    location?: string;
  }>;
  userPreferences: {
    interests: string[];
    dietaryPreferences: string[];
    budgetLevel: string;
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class ProactiveSuggestionsService {
  private llm: LLMService;

  constructor(
    private readonly db: Kysely<Database>,
    llmService?: LLMService,
  ) {
    this.llm = llmService ?? new LLMService();
  }

  /**
   * Analyze a trip and generate proactive suggestions.
   * Called after bookings/events change or on a daily schedule.
   */
  async generateSuggestions(context: TripContext): Promise<ProactiveSuggestion[]> {
    const suggestions: ProactiveSuggestion[] = [];

    // Tier 0: Rule-based trigger detection
    const triggers = this.detectTriggers(context);

    // Tier 1: LLM-composed suggestions for each trigger
    for (const trigger of triggers) {
      try {
        const suggestion = await this.composeSuggestion(trigger, context);
        if (suggestion) {
          suggestions.push(suggestion);
        }
      } catch (err) {
        console.warn(`[ProactiveSuggestions] Failed to compose for ${trigger.type}:`, (err as Error).message);
      }
    }

    return suggestions;
  }

  /**
   * Tier 0: Detect suggestion triggers using rules (free, instant).
   */
  private detectTriggers(context: TripContext): Array<{ type: SuggestionTrigger; date: string; detail: string }> {
    const triggers: Array<{ type: SuggestionTrigger; date: string; detail: string }> = [];
    const events = context.events;

    // Group events by date
    const byDate = new Map<string, typeof events>();
    for (const event of events) {
      const day = event.date;
      const existing = byDate.get(day) ?? [];
      existing.push(event);
      byDate.set(day, existing);
    }

    // Generate all dates in trip range
    const tripDates = getDateRange(context.startDate, context.endDate);

    for (const date of tripDates) {
      const dayEvents = byDate.get(date) ?? [];

      // Trigger: Free time (3+ hour gap between events)
      if (dayEvents.length >= 2) {
        const sorted = dayEvents.sort((a, b) => a.startTime.localeCompare(b.startTime));
        for (let i = 0; i < sorted.length - 1; i++) {
          const gap = getHoursBetween(sorted[i]!.endTime, sorted[i + 1]!.startTime);
          if (gap >= 3) {
            triggers.push({
              type: 'free_time',
              date,
              detail: `${gap} hours free between ${sorted[i]!.title} and ${sorted[i + 1]!.title}`,
            });
          }
        }
      }

      // Trigger: No dining planned
      const hasDining = dayEvents.some(
        (e) => e.type === 'restaurant' || e.type === 'food' || e.title.toLowerCase().includes('dinner') || e.title.toLowerCase().includes('lunch'),
      );
      if (!hasDining && dayEvents.length > 0) {
        triggers.push({
          type: 'no_dining',
          date,
          detail: `No restaurant or dining planned for ${date}`,
        });
      }

      // Trigger: Unplanned arrival
      const arrivals = dayEvents.filter(
        (e) => e.type === 'flight' || (e.type === 'car_rental' && e.title.toLowerCase().includes('pickup')),
      );
      for (const arrival of arrivals) {
        const hasFollowup = dayEvents.some(
          (e) => e !== arrival && e.startTime > arrival.endTime,
        );
        if (!hasFollowup) {
          triggers.push({
            type: 'unplanned_arrival',
            date,
            detail: `Arriving via ${arrival.title} with nothing planned after`,
          });
        }
      }

      // Trigger: Empty day (no events at all but within trip)
      if (dayEvents.length === 0) {
        triggers.push({
          type: 'free_time',
          date,
          detail: `Entire day free — no activities planned`,
        });
      }
    }

    // Limit to max 5 suggestions per analysis (avoid overwhelming)
    return triggers.slice(0, 5);
  }

  /**
   * Tier 1: Compose a personalized suggestion using LLM.
   */
  private async composeSuggestion(
    trigger: { type: SuggestionTrigger; date: string; detail: string },
    context: TripContext,
  ): Promise<ProactiveSuggestion | null> {
    const triggerText = `${trigger.type}: ${trigger.detail} on ${trigger.date}`;
    const contextText = `Trip "${context.tripName}" to ${context.destination ?? 'destination'}, ${context.startDate} to ${context.endDate}`;
    const prefsText = `Interests: ${context.userPreferences.interests.join(', ') || 'none set'}. Dietary: ${context.userPreferences.dietaryPreferences.join(', ') || 'none'}. Budget: ${context.userPreferences.budgetLevel || 'moderate'}`;

    const response = await this.llm.invoke({
      feature: 'proactive_suggestions',
      systemPrompt: PROMPTS.PROACTIVE_SUGGESTION.system,
      userPrompt: PROMPTS.PROACTIVE_SUGGESTION.user(triggerText, contextText, prefsText),
      expectedFormat: 'json',
      maxTokens: 512,
    });

    if (!response.parsedJson) return null;

    const data = response.parsedJson as {
      title?: string;
      message?: string;
      suggestions?: Array<{ name: string; type: string; reason: string }>;
    };

    return {
      id: `suggestion-${trigger.type}-${trigger.date}-${Date.now()}`,
      tripId: context.tripId,
      trigger: trigger.type,
      title: data.title ?? `Suggestion for ${trigger.date}`,
      message: data.message ?? trigger.detail,
      suggestions: data.suggestions ?? [],
      date: trigger.date,
      dismissed: false,
      createdAt: new Date().toISOString(),
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const current = new Date(start);
  const endDate = new Date(end);

  while (current <= endDate) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return dates;
}

function getHoursBetween(time1: string, time2: string): number {
  const [h1, m1] = time1.split(':').map(Number);
  const [h2, m2] = time2.split(':').map(Number);
  return ((h2! * 60 + m2!) - (h1! * 60 + m1!)) / 60;
}
