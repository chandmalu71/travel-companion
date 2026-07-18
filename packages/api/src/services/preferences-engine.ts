/**
 * Preferences Engine
 *
 * Wires user preferences into AI search and POI results:
 * - Excludes results conflicting with dietary/allergy preferences
 * - Labels restaurants accommodating dietary needs
 * - Boosts results matching user interest categories
 * - Provides currency toggle for switching display currencies
 * - Provides in-app currency converter accessible from expense/booking views
 *
 * Implements Requirements: 20.4, 20.5, 20.6, 20.10, 20.11
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type SearchResult } from './ai-search.js';
import { type POIResult } from './poi.js';
import { type CurrencyService } from './currency.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface UserPreferencesData {
  interests: string[];
  dietaryPreferences: string[];
  allergies: string[];
  displayCurrencies: string[];
  language: string;
}

export interface FilteredSearchResult extends SearchResult {
  dietaryCompatible: boolean;
  dietaryLabels: string[];
  interestBoost: number;
  excluded: boolean;
  exclusionReason?: string;
}

export interface FilteredPOIResult extends POIResult {
  dietaryCompatible: boolean;
  dietaryIndicator: string | null;
  matchesInterests: boolean;
}

export interface CurrencyToggleResult {
  originalAmount: number;
  originalCurrency: string;
  displayAmounts: Array<{
    currency: string;
    amount: number;
    isDefault: boolean;
  }>;
}

// ─── Dietary conflict mappings ───────────────────────────────────────────────

/**
 * Keywords that indicate a restaurant/place conflicts with a dietary preference.
 * If a result contains any of these keywords AND the user has the corresponding
 * dietary preference, it's flagged or excluded.
 */
const DIETARY_CONFLICTS: Record<string, string[]> = {
  vegetarian: ['steakhouse', 'bbq', 'barbecue', 'meat market', 'butcher'],
  vegan: ['steakhouse', 'bbq', 'barbecue', 'meat', 'butcher', 'dairy', 'cheese shop'],
  pescatarian: ['steakhouse', 'bbq', 'barbecue', 'meat market', 'butcher'],
  gluten_free: ['bakery', 'pasta', 'pizza'],
  dairy_free: ['ice cream', 'cheese shop', 'creamery'],
  halal: ['pork', 'bacon', 'ham'],
  kosher: ['pork', 'shellfish', 'bacon'],
  nut_free: ['nut', 'peanut', 'almond'],
};

/**
 * Keywords that indicate a restaurant accommodates specific dietary needs.
 */
const DIETARY_ACCOMMODATING: Record<string, string[]> = {
  vegetarian: ['vegetarian', 'vegan', 'plant-based', 'veggie'],
  vegan: ['vegan', 'plant-based'],
  gluten_free: ['gluten-free', 'gluten free', 'celiac-friendly'],
  halal: ['halal', 'halal-certified'],
  kosher: ['kosher', 'kosher-certified'],
};

/**
 * Interest category → POI/search category mappings for boosting.
 */
const INTEREST_TO_CATEGORY: Record<string, string[]> = {
  adventure: ['outdoor', 'adventure', 'sport', 'hiking', 'climbing', 'kayaking'],
  arts_culture: ['museum', 'gallery', 'art', 'theater', 'cultural'],
  beaches: ['beach', 'coastal', 'seaside', 'waterfront'],
  food_drink: ['restaurant', 'cafe', 'bar', 'food', 'dining', 'cuisine'],
  history: ['historic', 'museum', 'monument', 'heritage', 'castle'],
  nature: ['park', 'garden', 'nature', 'wildlife', 'forest', 'mountain'],
  nightlife: ['bar', 'club', 'nightclub', 'pub', 'lounge', 'nightlife'],
  photography: ['viewpoint', 'scenic', 'landmark', 'vista'],
  relaxation: ['spa', 'wellness', 'massage', 'hot spring', 'retreat'],
  shopping: ['shopping', 'mall', 'market', 'boutique', 'store'],
  sports: ['stadium', 'arena', 'sport', 'gym', 'fitness'],
  wellness: ['spa', 'yoga', 'meditation', 'wellness', 'health'],
};

// ─── Service ─────────────────────────────────────────────────────────────────

export class PreferencesEngine {
  constructor(
    private readonly db: Kysely<Database>,
    private readonly currencyService: CurrencyService,
  ) {}

  /**
   * Get user preferences from the database.
   */
  async getUserPreferences(userId: string): Promise<UserPreferencesData> {
    const prefs = await this.db
      .selectFrom('user_preferences')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!prefs) {
      return {
        interests: [],
        dietaryPreferences: [],
        allergies: [],
        displayCurrencies: ['USD'],
        language: 'en',
      };
    }

    return {
      interests: parseJsonArray(prefs.interests),
      dietaryPreferences: parseJsonArray(prefs.dietary_preferences),
      allergies: parseJsonArray(prefs.allergies),
      displayCurrencies: parseJsonArray(prefs.display_currencies),
      language: prefs.language ?? 'en',
    };
  }

  /**
   * Apply user preferences to AI search results.
   * - Excludes results conflicting with dietary/allergy preferences
   * - Labels accommodating results
   * - Boosts results matching interest categories
   */
  applyToSearchResults(
    results: SearchResult[],
    preferences: UserPreferencesData,
  ): FilteredSearchResult[] {
    return results.map((result) => {
      const dietary = checkDietaryCompatibility(result, preferences);
      const interestBoost = calculateInterestBoost(result, preferences);

      return {
        ...result,
        dietaryCompatible: dietary.compatible,
        dietaryLabels: dietary.labels,
        interestBoost,
        excluded: dietary.shouldExclude,
        exclusionReason: dietary.exclusionReason,
        // Adjust match score with interest boost
        matchScore: Math.min(1, result.matchScore + interestBoost * 0.15),
      };
    });
  }

  /**
   * Apply user preferences to POI results.
   * - Displays dietary compatibility indicator on restaurants
   * - Flags results matching user interests
   */
  applyToPOIResults(
    results: POIResult[],
    preferences: UserPreferencesData,
  ): FilteredPOIResult[] {
    return results.map((result) => {
      const isRestaurant = isRestaurantCategory(result.category);
      let dietaryCompatible = true;
      let dietaryIndicator: string | null = null;

      if (isRestaurant && preferences.dietaryPreferences.length > 0) {
        const compat = checkPOIDietaryCompat(result, preferences);
        dietaryCompatible = compat.compatible;
        dietaryIndicator = compat.indicator;
      }

      const matchesInterests = doesMatchInterests(result, preferences);

      return {
        ...result,
        dietaryCompatible,
        dietaryIndicator,
        matchesInterests,
      };
    });
  }

  /**
   * Filter out excluded results (those conflicting with dietary preferences).
   * Returns only non-excluded results.
   */
  filterExcluded(results: FilteredSearchResult[]): FilteredSearchResult[] {
    return results.filter((r) => !r.excluded);
  }

  /**
   * Re-rank results by boosted match score.
   */
  reRankByPreferences(results: FilteredSearchResult[]): FilteredSearchResult[] {
    return [...results].sort((a, b) => b.matchScore - a.matchScore);
  }

  /**
   * Convert an amount to all user display currencies.
   * Provides the currency toggle functionality.
   */
  async convertToDisplayCurrencies(
    amount: number,
    fromCurrency: string,
    preferences: UserPreferencesData,
  ): Promise<CurrencyToggleResult> {
    const displayAmounts: CurrencyToggleResult['displayAmounts'] = [];

    for (let i = 0; i < preferences.displayCurrencies.length; i++) {
      const targetCurrency = preferences.displayCurrencies[i]!;

      if (targetCurrency.toUpperCase() === fromCurrency.toUpperCase()) {
        displayAmounts.push({
          currency: targetCurrency,
          amount,
          isDefault: i === 0,
        });
      } else {
        try {
          const conversion = await this.currencyService.convert(
            amount,
            fromCurrency,
            targetCurrency,
          );
          displayAmounts.push({
            currency: targetCurrency,
            amount: conversion.convertedAmount,
            isDefault: i === 0,
          });
        } catch {
          // Skip currencies that fail to convert
        }
      }
    }

    return {
      originalAmount: amount,
      originalCurrency: fromCurrency,
      displayAmounts,
    };
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

function checkDietaryCompatibility(
  result: SearchResult,
  preferences: UserPreferencesData,
): {
  compatible: boolean;
  shouldExclude: boolean;
  labels: string[];
  exclusionReason?: string;
} {
  const nameAndDesc = `${result.name} ${result.description} ${result.category}`.toLowerCase();
  const labels: string[] = [];
  let shouldExclude = false;
  let exclusionReason: string | undefined;

  // Check for conflicts
  for (const pref of preferences.dietaryPreferences) {
    const conflicts = DIETARY_CONFLICTS[pref] ?? [];
    for (const keyword of conflicts) {
      if (nameAndDesc.includes(keyword)) {
        shouldExclude = true;
        exclusionReason = `Conflicts with ${pref} preference (contains "${keyword}")`;
        break;
      }
    }

    // Check for accommodating labels
    const accommodating = DIETARY_ACCOMMODATING[pref] ?? [];
    for (const keyword of accommodating) {
      if (nameAndDesc.includes(keyword)) {
        labels.push(`${pref}-friendly`);
        break;
      }
    }
  }

  // Check allergies
  for (const allergy of preferences.allergies) {
    if (nameAndDesc.includes(allergy.toLowerCase())) {
      shouldExclude = true;
      exclusionReason = `Contains allergen: ${allergy}`;
      break;
    }
  }

  return {
    compatible: !shouldExclude,
    shouldExclude,
    labels,
    exclusionReason,
  };
}

function calculateInterestBoost(
  result: SearchResult,
  preferences: UserPreferencesData,
): number {
  if (preferences.interests.length === 0) return 0;

  const nameAndCategory = `${result.name} ${result.description} ${result.category}`.toLowerCase();
  let boost = 0;

  for (const interest of preferences.interests) {
    const matchingKeywords = INTEREST_TO_CATEGORY[interest] ?? [];
    for (const keyword of matchingKeywords) {
      if (nameAndCategory.includes(keyword)) {
        boost += 0.1;
        break; // Only count once per interest
      }
    }
  }

  return Math.min(boost, 0.5); // Cap at 0.5
}

function checkPOIDietaryCompat(
  result: POIResult,
  preferences: UserPreferencesData,
): { compatible: boolean; indicator: string | null } {
  const nameLower = `${result.name} ${result.category}`.toLowerCase();

  // Check if accommodating
  for (const pref of preferences.dietaryPreferences) {
    const accommodating = DIETARY_ACCOMMODATING[pref] ?? [];
    for (const keyword of accommodating) {
      if (nameLower.includes(keyword)) {
        return { compatible: true, indicator: `✓ ${pref}-friendly` };
      }
    }
  }

  // Check for conflicts
  for (const pref of preferences.dietaryPreferences) {
    const conflicts = DIETARY_CONFLICTS[pref] ?? [];
    for (const keyword of conflicts) {
      if (nameLower.includes(keyword)) {
        return { compatible: false, indicator: `⚠ May not accommodate ${pref}` };
      }
    }
  }

  return { compatible: true, indicator: null };
}

function doesMatchInterests(
  result: POIResult,
  preferences: UserPreferencesData,
): boolean {
  if (preferences.interests.length === 0) return false;

  const nameAndCategory = `${result.name} ${result.category}`.toLowerCase();

  for (const interest of preferences.interests) {
    const matchingKeywords = INTEREST_TO_CATEGORY[interest] ?? [];
    for (const keyword of matchingKeywords) {
      if (nameAndCategory.includes(keyword)) {
        return true;
      }
    }
  }

  return false;
}

function isRestaurantCategory(category: string): boolean {
  const restaurantKeywords = ['restaurant', 'cafe', 'bar', 'food', 'dining', 'bakery', 'bistro'];
  const lower = category.toLowerCase();
  return restaurantKeywords.some((k) => lower.includes(k));
}

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
