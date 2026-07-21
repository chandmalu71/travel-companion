/**
 * User Preferences Routes
 *
 * Manages user interests, dietary preferences, allergies,
 * language selection, and display currencies.
 *
 * Routes:
 * - GET /api/users/:userId/preferences - Get user preferences
 * - PUT /api/users/:userId/preferences - Update user preferences
 *
 * Preferences are applied within 5 seconds without restart.
 *
 * Implements Requirements: 20.1, 20.2, 20.3, 20.7, 20.9, 20.12, 20.13, 20.14
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Constants ───────────────────────────────────────────────────────────────

export const INTEREST_CATEGORIES = [
  'adventure',
  'arts_culture',
  'beaches',
  'food_drink',
  'history',
  'nature',
  'nightlife',
  'photography',
  'relaxation',
  'shopping',
  'sports',
  'wellness',
] as const;

export const DIETARY_PREFERENCES = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten_free',
  'dairy_free',
  'halal',
  'kosher',
  'nut_free',
  'low_carb',
  'keto',
  'none',
] as const;

export const KNOWN_ALLERGIES = [
  'peanuts',
  'tree_nuts',
  'shellfish',
  'fish',
  'eggs',
  'milk',
  'soy',
  'wheat',
  'sesame',
  'sulfites',
] as const;

export const SUPPORTED_LANGUAGES = [
  'en', 'es', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh',
  'ar', 'hi', 'ru', 'nl', 'sv', 'no', 'da', 'fi', 'pl', 'tr', 'th',
] as const;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserPreferences {
  interests: string[];
  dietaryPreferences: string[];
  allergies: string[]; // known + custom (max 50 chars each)
  language: string;
  displayCurrencies: string[]; // first = default
  temperatureUnit: 'celsius' | 'fahrenheit';
  distanceUnit: 'km' | 'miles';
  notificationEnabled: boolean;
}

interface UpdatePreferencesBody {
  interests?: string[];
  dietaryPreferences?: string[];
  allergies?: string[];
  language?: string;
  displayCurrencies?: string[];
  temperatureUnit?: 'celsius' | 'fahrenheit';
  distanceUnit?: 'km' | 'miles';
  notificationEnabled?: boolean;
}

interface PreferencesRoutesOptions {
  db: Kysely<Database>;
}

// Default preferences (no filters, English, device locale currency)
export const DEFAULT_PREFERENCES: UserPreferences = {
  interests: [],
  dietaryPreferences: [],
  allergies: [],
  language: 'en',
  displayCurrencies: ['USD'],
  temperatureUnit: 'celsius',
  distanceUnit: 'km',
  notificationEnabled: true,
};

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerPreferencesRoutes(
  app: FastifyInstance,
  options: PreferencesRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/users/:userId/preferences ────────────────────────────────

  app.get(
    '/api/users/:userId/preferences',
    async (request: FastifyRequest<{ Params: { userId: string } }>, reply: FastifyReply) => {
      const authenticatedUserId = (request as any).userId as string;
      const { userId } = request.params;

      // Support "me" as alias for authenticated user
      const targetUserId = userId === 'me' ? authenticatedUserId : userId;

      // Users can only read their own preferences
      if (authenticatedUserId !== targetUserId) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'FORBIDDEN',
          message: 'You can only view your own preferences',
        });
      }

      const prefs = await db
        .selectFrom('user_preferences')
        .selectAll()
        .where('user_id', '=', targetUserId)
        .executeTakeFirst();

      if (!prefs) {
        return reply.send({
          statusCode: 200,
          data: DEFAULT_PREFERENCES,
        });
      }

      const response: UserPreferences = {
        interests: parseJsonArray(prefs.interests),
        dietaryPreferences: parseJsonArray(prefs.dietary_preferences),
        allergies: parseJsonArray(prefs.allergies),
        language: prefs.language ?? 'en',
        displayCurrencies: parseJsonArray(prefs.display_currencies),
        temperatureUnit: (prefs.temperature_unit as 'celsius' | 'fahrenheit') ?? 'celsius',
        distanceUnit: (prefs.distance_unit as 'km' | 'miles') ?? 'km',
        notificationEnabled: prefs.notification_enabled ?? true,
      };

      return reply.send({ statusCode: 200, data: response });
    },
  );

  // ─── PUT /api/users/:userId/preferences ────────────────────────────────

  app.put(
    '/api/users/:userId/preferences',
    async (
      request: FastifyRequest<{ Params: { userId: string }; Body: UpdatePreferencesBody }>,
      reply: FastifyReply,
    ) => {
      const authenticatedUserId = (request as any).userId as string;
      const { userId } = request.params;
      const body = request.body;

      // Support "me" as alias for authenticated user
      const targetUserId = userId === 'me' ? authenticatedUserId : userId;

      if (authenticatedUserId !== targetUserId) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'FORBIDDEN',
          message: 'You can only update your own preferences',
        });
      }

      // Validate
      const errors = validatePreferences(body);
      if (errors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Invalid preferences',
          details: { errors },
        });
      }

      const updateValues: Record<string, unknown> = {
        user_id: targetUserId,
        updated_at: new Date(),
      };

      if (body.interests !== undefined) {
        updateValues['interests'] = body.interests;
      }
      if (body.dietaryPreferences !== undefined) {
        updateValues['dietary_preferences'] = body.dietaryPreferences;
      }
      if (body.allergies !== undefined) {
        updateValues['allergies'] = body.allergies;
      }
      if (body.language !== undefined) {
        updateValues['language'] = body.language;
      }
      if (body.displayCurrencies !== undefined) {
        updateValues['display_currencies'] = body.displayCurrencies;
      }
      if (body.temperatureUnit !== undefined) {
        updateValues['temperature_unit'] = body.temperatureUnit;
      }
      if (body.distanceUnit !== undefined) {
        updateValues['distance_unit'] = body.distanceUnit;
      }
      if (body.notificationEnabled !== undefined) {
        updateValues['notification_enabled'] = body.notificationEnabled;
      }

      // Upsert preferences
      await db
        .insertInto('user_preferences')
        .values(updateValues as any)
        .onConflict((oc) =>
          oc.column('user_id').doUpdateSet(updateValues as any),
        )
        .execute();

      return reply.send({
        statusCode: 200,
        message: 'Preferences updated successfully',
        data: body,
      });
    },
  );
}

// ─── Validation ──────────────────────────────────────────────────────────────

function validatePreferences(body: UpdatePreferencesBody): string[] {
  const errors: string[] = [];

  if (body.interests) {
    const invalid = body.interests.filter(
      (i) => !INTEREST_CATEGORIES.includes(i as any),
    );
    if (invalid.length > 0) {
      errors.push(`Invalid interests: ${invalid.join(', ')}. Valid: ${INTEREST_CATEGORIES.join(', ')}`);
    }
  }

  if (body.dietaryPreferences) {
    const invalid = body.dietaryPreferences.filter(
      (d) => !DIETARY_PREFERENCES.includes(d as any),
    );
    if (invalid.length > 0) {
      errors.push(`Invalid dietary preferences: ${invalid.join(', ')}`);
    }
  }

  if (body.allergies) {
    for (const allergy of body.allergies) {
      if (allergy.length > 50) {
        errors.push(`Allergy "${allergy.slice(0, 20)}..." exceeds 50 character limit`);
      }
    }
  }

  if (body.language && !SUPPORTED_LANGUAGES.includes(body.language as any)) {
    errors.push(`Unsupported language: ${body.language}`);
  }

  if (body.displayCurrencies) {
    for (const currency of body.displayCurrencies) {
      if (currency.length !== 3) {
        errors.push(`Invalid currency code: ${currency} (must be 3 letters)`);
      }
    }
  }

  if (body.temperatureUnit && !['celsius', 'fahrenheit'].includes(body.temperatureUnit)) {
    errors.push('temperatureUnit must be "celsius" or "fahrenheit"');
  }

  if (body.distanceUnit && !['km', 'miles'].includes(body.distanceUnit)) {
    errors.push('distanceUnit must be "km" or "miles"');
  }

  return errors;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJsonArray(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as string[];
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) return value as string[];
  return [];
}
