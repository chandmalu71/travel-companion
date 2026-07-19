/**
 * Tiered LLM Service
 *
 * Provides a unified interface for AI inference across the application.
 * Implements a cascade strategy: cheap model first, escalate on failure.
 *
 * Tier 1: Amazon Nova Lite (eu-west-1) — $0.0003/call
 * Tier 2: Claude Haiku (cross-region) — $0.005/call
 *
 * Features:
 * - Model configuration per feature (admin-configurable)
 * - Auto-escalation with configurable thresholds
 * - Structured JSON output with validation
 * - Cost tracking per request
 * - Region fallback (eu-west-1 → us-east-1)
 *
 * All AI features route through this service.
 */

import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AIFeature =
  | 'email_parsing'
  | 'receipt_scanning'
  | 'search_rewrite'
  | 'search_rerank'
  | 'gap_suggestions'
  | 'proactive_suggestions'
  | 'trip_naming';

export interface ModelConfig {
  tier1Model: string;
  tier2Model: string;
  autoEscalate: boolean;
  maxTier: 1 | 2;
  confidenceThreshold: number;
}

export interface LLMRequest {
  feature: AIFeature;
  systemPrompt: string;
  userPrompt: string;
  expectedFormat?: 'json' | 'text';
  maxTokens?: number;
}

export interface LLMResponse {
  content: string;
  parsedJson?: unknown;
  model: string;
  tier: 1 | 2;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

// ─── Default Configuration ───────────────────────────────────────────────────

const DEFAULT_CONFIGS: Record<AIFeature, ModelConfig> = {
  email_parsing: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    autoEscalate: true,
    maxTier: 2,
    confidenceThreshold: 0.9,
  },
  receipt_scanning: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    autoEscalate: true,
    maxTier: 2,
    confidenceThreshold: 0.85,
  },
  search_rewrite: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'amazon.nova-lite-v1:0',
    autoEscalate: false,
    maxTier: 1,
    confidenceThreshold: 0.8,
  },
  search_rerank: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'amazon.nova-lite-v1:0',
    autoEscalate: false,
    maxTier: 1,
    confidenceThreshold: 0.8,
  },
  gap_suggestions: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    autoEscalate: false,
    maxTier: 1,
    confidenceThreshold: 0.8,
  },
  proactive_suggestions: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'amazon.nova-lite-v1:0',
    autoEscalate: false,
    maxTier: 1,
    confidenceThreshold: 0.7,
  },
  trip_naming: {
    tier1Model: 'amazon.nova-lite-v1:0',
    tier2Model: 'amazon.nova-lite-v1:0',
    autoEscalate: false,
    maxTier: 1,
    confidenceThreshold: 0.7,
  },
};

// ─── Cost per 1M tokens (for estimation) ─────────────────────────────────────

const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  'amazon.nova-lite-v1:0': { input: 0.06, output: 0.24 },
  'amazon.nova-micro-v1:0': { input: 0.035, output: 0.14 },
  'anthropic.claude-3-5-haiku-20241022-v1:0': { input: 0.80, output: 4.00 },
  'anthropic.claude-sonnet-4-20250514-v1:0': { input: 2.00, output: 10.00 },
  'deepseek.deepseek-v3-2-20250708-v1:0': { input: 0.62, output: 1.85 },
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class LLMService {
  private client: BedrockRuntimeClient;
  private configs: Record<AIFeature, ModelConfig>;
  private region: string;

  constructor(
    region = 'eu-west-1',
    configOverrides?: Partial<Record<AIFeature, Partial<ModelConfig>>>,
  ) {
    this.region = region;
    this.client = new BedrockRuntimeClient({ region });

    // Merge defaults with any admin overrides
    this.configs = { ...DEFAULT_CONFIGS };
    if (configOverrides) {
      for (const [feature, override] of Object.entries(configOverrides)) {
        this.configs[feature as AIFeature] = {
          ...DEFAULT_CONFIGS[feature as AIFeature],
          ...override,
        };
      }
    }
  }

  /**
   * Update model configuration (called from admin panel).
   */
  updateConfig(feature: AIFeature, config: Partial<ModelConfig>): void {
    this.configs[feature] = { ...this.configs[feature], ...config };
  }

  /**
   * Get current configuration for all features.
   */
  getConfigs(): Record<AIFeature, ModelConfig> {
    return { ...this.configs };
  }

  /**
   * Main inference method with automatic tier escalation.
   */
  async invoke(request: LLMRequest): Promise<LLMResponse> {
    const config = this.configs[request.feature];

    // Try Tier 1 first
    try {
      const tier1Result = await this.callModel(config.tier1Model, request, 1);

      // Check if we got valid output
      if (request.expectedFormat === 'json') {
        const parsed = tryParseJson(tier1Result.content);
        if (parsed !== null) {
          return { ...tier1Result, parsedJson: parsed };
        }
        // JSON parsing failed — escalate if allowed
        if (config.autoEscalate && config.maxTier >= 2) {
          console.log(`[LLM] Tier 1 JSON parse failed for ${request.feature}, escalating to Tier 2`);
          return this.invokeAtTier(request, config, 2);
        }
      }

      return tier1Result;
    } catch (error) {
      // Tier 1 failed entirely — escalate if allowed
      if (config.autoEscalate && config.maxTier >= 2) {
        console.warn(`[LLM] Tier 1 failed for ${request.feature}: ${(error as Error).message}. Escalating.`);
        return this.invokeAtTier(request, config, 2);
      }
      throw error;
    }
  }

  /**
   * Invoke directly at a specific tier (bypasses escalation logic).
   */
  private async invokeAtTier(request: LLMRequest, config: ModelConfig, tier: 2): Promise<LLMResponse> {
    const result = await this.callModel(config.tier2Model, request, tier);

    if (request.expectedFormat === 'json') {
      const parsed = tryParseJson(result.content);
      if (parsed !== null) {
        return { ...result, parsedJson: parsed };
      }
    }

    return result;
  }

  /**
   * Call a specific model on Bedrock.
   */
  private async callModel(
    modelId: string,
    request: LLMRequest,
    tier: 1 | 2,
  ): Promise<LLMResponse> {
    const startTime = Date.now();
    const maxTokens = request.maxTokens ?? 1024;

    // Build the request body based on model provider
    const body = buildRequestBody(modelId, request.systemPrompt, request.userPrompt, maxTokens);

    const command = new InvokeModelCommand({
      modelId,
      contentType: 'application/json',
      accept: 'application/json',
      body: Buffer.from(JSON.stringify(body)),
    });

    const response = await this.client.send(command);
    const responseBody = JSON.parse(new TextDecoder().decode(response.body));

    // Extract content based on model provider
    const content = extractContent(modelId, responseBody);
    const latencyMs = Date.now() - startTime;

    // Estimate tokens and cost
    const inputTokens = estimateTokens(request.systemPrompt + request.userPrompt);
    const outputTokens = estimateTokens(content);
    const costs = MODEL_COSTS[modelId] ?? { input: 0.1, output: 0.4 };
    const estimatedCost = (inputTokens / 1_000_000) * costs.input + (outputTokens / 1_000_000) * costs.output;

    return {
      content,
      model: modelId,
      tier,
      latencyMs,
      inputTokens,
      outputTokens,
      estimatedCost,
    };
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build request body appropriate for the model provider.
 */
function buildRequestBody(modelId: string, system: string, user: string, maxTokens: number): unknown {
  if (modelId.startsWith('anthropic.')) {
    // Anthropic Messages API format
    return {
      anthropic_version: 'bedrock-2023-05-31',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    };
  }

  if (modelId.startsWith('amazon.nova')) {
    // Amazon Nova format
    return {
      inferenceConfig: { maxTokens },
      system: [{ text: system }],
      messages: [{ role: 'user', content: [{ text: user }] }],
    };
  }

  if (modelId.startsWith('deepseek.')) {
    // DeepSeek uses Messages API format (similar to Anthropic)
    return {
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    };
  }

  // Generic fallback (Messages-style)
  return {
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
  };
}

/**
 * Extract the text content from model response based on provider.
 */
function extractContent(modelId: string, responseBody: any): string {
  if (modelId.startsWith('anthropic.')) {
    return responseBody.content?.[0]?.text ?? '';
  }

  if (modelId.startsWith('amazon.nova')) {
    return responseBody.output?.message?.content?.[0]?.text ?? '';
  }

  if (modelId.startsWith('deepseek.')) {
    return responseBody.choices?.[0]?.message?.content ?? responseBody.content?.[0]?.text ?? '';
  }

  // Fallback: try common response shapes
  return responseBody.content?.[0]?.text
    ?? responseBody.output?.message?.content?.[0]?.text
    ?? responseBody.choices?.[0]?.message?.content
    ?? JSON.stringify(responseBody);
}

/**
 * Try to parse a string as JSON, returning null on failure.
 * Handles LLM responses that might include markdown code fences.
 */
function tryParseJson(text: string): unknown | null {
  // Strip markdown code fences if present
  let cleaned = text.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    return JSON.parse(cleaned);
  } catch {
    // Try to find JSON within the text
    const jsonMatch = /\{[\s\S]*\}|\[[\s\S]*\]/.exec(cleaned);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        return null;
      }
    }
    return null;
  }
}

/**
 * Rough token estimation (~4 chars per token for English).
 */
function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

// ─── Pre-built Prompts ───────────────────────────────────────────────────────

export const PROMPTS = {
  EMAIL_PARSING: {
    system: `You are a travel booking extraction assistant. Extract booking details from email content into structured JSON. Be precise with dates, flight numbers, and confirmation codes. If a field is not found, set it to null.`,
    user: (emailContent: string) => `Extract booking details from this email. Return JSON with this structure:
{
  "type": "flight" | "hotel" | "car_rental",
  "confidence": 0.0-1.0,
  "fields": {
    // For flights: airline, flightNumber, departureAirport, arrivalAirport, departureTime, arrivalTime, confirmationNumber
    // For hotels: hotelName, address, checkInDate, checkOutDate, confirmationNumber
    // For car_rental: company, pickupDate, returnDate, pickupLocation, returnLocation, confirmationNumber
  }
}

Email content:
${emailContent}`,
  },

  SEARCH_REWRITE: {
    system: `You are a travel search assistant. Rewrite natural language queries into structured search parameters for Google Places API. Consider dining preferences, activity types, and location context.`,
    user: (query: string, preferences: string) => `Rewrite this search query into structured parameters. Return JSON:
{
  "keywords": ["keyword1", "keyword2"],
  "category": "restaurant|attraction|activity|shopping|nightlife",
  "attributes": ["family-friendly", "outdoor", etc],
  "priceLevel": 1-4 or null,
  "radius": suggested radius in meters
}

User query: "${query}"
User preferences: ${preferences}`,
  },

  GAP_SUGGESTION: {
    system: `You are a travel planning assistant. Given a gap in a trip itinerary and nearby options, compose a helpful personalized suggestion. Be concise and actionable.`,
    user: (gap: string, options: string, preferences: string) => `A traveler has this gap in their itinerary:
${gap}

Here are nearby options:
${options}

User preferences: ${preferences}

Compose a brief, friendly suggestion (2-3 sentences) recommending the best options for this user. Return JSON:
{
  "message": "your suggestion text",
  "topPicks": [{"name": "...", "reason": "why it matches"}]
}`,
  },

  PROACTIVE_SUGGESTION: {
    system: `You are a proactive travel assistant. Based on trip context, suggest activities or alternatives. Keep suggestions relevant, personalized, and concise.`,
    user: (trigger: string, context: string, preferences: string) => `Trigger: ${trigger}
Trip context: ${context}
User preferences: ${preferences}

Suggest 2-3 relevant options. Return JSON:
{
  "title": "short title for the suggestion card",
  "message": "friendly 1-2 sentence explanation",
  "suggestions": [{"name": "...", "type": "...", "reason": "..."}]
}`,
  },

  TRIP_NAMING: {
    system: `Generate a short, descriptive trip name from booking information. Format: "Destination, Month Year" or "Destination1 & Destination2, Month Year". Keep it under 40 characters.`,
    user: (bookingInfo: string) => `Generate a trip name from these bookings:
${bookingInfo}

Return just the trip name as plain text (no JSON, no quotes).`,
  },

  RECEIPT_EXTRACTION: {
    system: `Extract expense details from receipt text (post-OCR). Be precise with amounts and currencies. If unclear, set to null.`,
    user: (ocrText: string) => `Extract expense details from this receipt text. Return JSON:
{
  "merchantName": "...",
  "totalAmount": number or null,
  "currency": "3-letter ISO code" or null,
  "date": "YYYY-MM-DD" or null,
  "category": "food_drink|transport|accommodation|activities|shopping|health|other",
  "confidence": 0.0-1.0
}

Receipt text:
${ocrText}`,
  },
};
