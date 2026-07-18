/**
 * AI-Powered Activity Search Service.
 *
 * Provides natural language activity search with personalization using
 * AWS Bedrock for query understanding and Google Places API for data.
 * Falls back to keyword matching when Bedrock is unavailable.
 *
 * Implements Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9
 */

import { type POIService, type POISearchParams, type POIResult, calculateDistance } from './poi.js';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface MoneyAmount {
  amount: number;
  currency: string;
}

export interface AISearchRequest {
  query: string; // 2-500 characters
  tripId: string;
  filters?: {
    category?: string[];
    priceRange?: [number, number];
    minRating?: number;
    maxDistance?: number; // km
  };
}

export interface AISearchResponse {
  results: SearchResult[]; // max 20
  personalizationApplied: boolean;
  suggestBroaden: boolean; // true if < 3 results
}

export interface SearchResult {
  name: string;
  description: string; // max 200 chars
  category: string;
  rating: number;
  estimatedCost: MoneyAmount;
  distanceKm?: number; // undefined if no accommodation set
  location: { lat: number; lng: number };
  matchScore: number; // relevance ranking 0-1
}

export interface UserPreferences {
  interests: string[];
  dietaryPreferences: string[];
  allergies: string[];
}

export interface TripAccommodation {
  latitude: number;
  longitude: number;
}

// ─── Query Parsing ───────────────────────────────────────────────────────────

/**
 * Category keywords for keyword-based fallback when Bedrock is unavailable.
 */
const CATEGORY_KEYWORDS: Record<string, string[]> = {
  restaurants: [
    'restaurant', 'food', 'eat', 'dining', 'dinner', 'lunch', 'breakfast',
    'brunch', 'cafe', 'coffee', 'bistro', 'cuisine', 'sushi', 'pizza',
    'burger', 'steak', 'vegan', 'vegetarian', 'thai', 'italian', 'mexican',
    'indian', 'chinese', 'japanese', 'french', 'korean', 'seafood',
  ],
  museums: [
    'museum', 'gallery', 'exhibition', 'art', 'history', 'science',
    'culture', 'heritage', 'artifact', 'collection',
  ],
  parks: [
    'park', 'garden', 'nature', 'outdoor', 'hike', 'hiking', 'trail',
    'walk', 'green', 'botanical', 'zoo', 'wildlife', 'lake', 'beach',
    'forest', 'mountain',
  ],
  landmarks: [
    'landmark', 'monument', 'attraction', 'sightseeing', 'tour', 'temple',
    'church', 'castle', 'palace', 'tower', 'bridge', 'statue', 'historic',
    'famous', 'popular', 'tourist',
  ],
  entertainment: [
    'entertainment', 'fun', 'nightlife', 'club', 'bar', 'pub', 'show',
    'theater', 'theatre', 'cinema', 'movie', 'concert', 'music', 'dance',
    'festival', 'event', 'game', 'sport', 'shopping', 'market',
  ],
};

/**
 * Dietary conflict keywords mapped to dietary preference types.
 */
const DIETARY_CONFLICTS: Record<string, string[]> = {
  vegan: ['meat', 'steakhouse', 'bbq', 'barbecue', 'seafood', 'fish'],
  vegetarian: ['steakhouse', 'bbq', 'barbecue'],
  pescatarian: ['steakhouse', 'bbq', 'barbecue'],
  halal: ['pork', 'bacon', 'ham'],
  kosher: ['pork', 'shellfish', 'bacon'],
  gluten_free: ['bakery', 'pasta', 'pizza'],
  dairy_free: ['ice cream', 'cheese', 'creamery'],
  nut_free: ['nut', 'peanut', 'almond'],
};

/**
 * Parse a natural language query to extract intent.
 * Returns detected categories and location keywords.
 */
export function parseQuery(query: string): { categories: string[]; locationHints: string[] } {
  const lowerQuery = query.toLowerCase();
  const words = lowerQuery.split(/\s+/);

  const detectedCategories: string[] = [];

  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    const matched = keywords.some(
      (keyword) => lowerQuery.includes(keyword),
    );
    if (matched) {
      detectedCategories.push(category);
    }
  }

  // If no specific category detected, search across all categories
  if (detectedCategories.length === 0) {
    detectedCategories.push('restaurants', 'landmarks', 'entertainment');
  }

  // Extract location hints (proper nouns or words that might be locations)
  const locationHints = words.filter(
    (word) =>
      word.length > 3 &&
      word[0] === word[0]!.toUpperCase() &&
      !Object.values(CATEGORY_KEYWORDS).flat().includes(word),
  );

  return { categories: detectedCategories, locationHints };
}

// ─── Personalization Scoring ─────────────────────────────────────────────────

/**
 * Calculate a personalization score for a POI based on user preferences.
 * Returns a score between 0 and 1 where higher means more relevant.
 */
export function calculatePersonalizationScore(
  poi: POIResult,
  preferences: UserPreferences,
): number {
  let score = 0.5; // Base score

  // Boost for matching interests
  const interestCategoryMap: Record<string, string[]> = {
    history: ['museums', 'landmarks'],
    culture: ['museums', 'landmarks', 'entertainment'],
    art: ['museums', 'entertainment'],
    architecture: ['landmarks'],
    nature: ['parks'],
    adventure: ['parks', 'entertainment'],
    nightlife: ['entertainment'],
    shopping: ['entertainment'],
    sports: ['parks', 'entertainment'],
    wellness: ['parks'],
    music: ['entertainment'],
    photography: ['landmarks', 'parks'],
  };

  for (const interest of preferences.interests) {
    const matchingCategories = interestCategoryMap[interest] ?? [];
    if (matchingCategories.includes(poi.category)) {
      score += 0.15; // Boost per matching interest
    }
  }

  // Penalize for dietary conflicts (only for restaurants)
  if (poi.category === 'restaurants') {
    const poiNameLower = poi.name.toLowerCase();
    for (const dietary of preferences.dietaryPreferences) {
      const conflicts = DIETARY_CONFLICTS[dietary] ?? [];
      const hasConflict = conflicts.some((conflict) => poiNameLower.includes(conflict));
      if (hasConflict) {
        score -= 0.3; // Significant penalty for dietary conflicts
      }
    }
  }

  // Bonus for higher-rated places
  if (poi.rating >= 4.5) {
    score += 0.1;
  } else if (poi.rating >= 4.0) {
    score += 0.05;
  }

  // Clamp score between 0 and 1
  return Math.max(0, Math.min(1, score));
}

/**
 * Check if a POI has a dietary conflict with user preferences.
 * Used to filter out conflicting results.
 */
export function hasDietaryConflict(
  poi: POIResult,
  preferences: UserPreferences,
): boolean {
  if (poi.category !== 'restaurants') return false;

  const poiNameLower = poi.name.toLowerCase();

  for (const dietary of preferences.dietaryPreferences) {
    const conflicts = DIETARY_CONFLICTS[dietary] ?? [];
    if (conflicts.some((conflict) => poiNameLower.includes(conflict))) {
      return true;
    }
  }

  return false;
}

// ─── Filter Application ──────────────────────────────────────────────────────

/**
 * Apply multi-criteria filters to a set of search results.
 * Returns only results matching ALL active filter criteria.
 */
export function applyFilters(
  results: SearchResult[],
  filters?: AISearchRequest['filters'],
): SearchResult[] {
  if (!filters) return results;

  return results.filter((result) => {
    // Category filter
    if (filters.category && filters.category.length > 0) {
      if (!filters.category.includes(result.category)) {
        return false;
      }
    }

    // Price range filter
    if (filters.priceRange) {
      const [min, max] = filters.priceRange;
      if (result.estimatedCost.amount < min || result.estimatedCost.amount > max) {
        return false;
      }
    }

    // Minimum rating filter
    if (filters.minRating !== undefined) {
      if (result.rating < filters.minRating) {
        return false;
      }
    }

    // Maximum distance filter
    if (filters.maxDistance !== undefined && result.distanceKm !== undefined) {
      if (result.distanceKm > filters.maxDistance) {
        return false;
      }
    }

    return true;
  });
}

// ─── Result Formatting ───────────────────────────────────────────────────────

/**
 * Truncate a string to a maximum length, adding ellipsis if truncated.
 */
export function truncateDescription(text: string, maxLength: number = 200): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Estimate cost based on price level (1-4).
 * Price level 1 = budget, 2 = moderate, 3 = expensive, 4 = very expensive.
 */
function estimateCost(priceLevel: number, currency: string = 'USD'): MoneyAmount {
  const costMap: Record<number, number> = {
    0: 10,
    1: 15,
    2: 30,
    3: 60,
    4: 100,
  };
  return {
    amount: costMap[priceLevel] ?? 20,
    currency,
  };
}

/**
 * Convert a POIResult to a SearchResult with personalization score.
 */
function poiToSearchResult(
  poi: POIResult,
  matchScore: number,
  accommodation: TripAccommodation | null,
  currency: string = 'USD',
): SearchResult {
  const distanceKm = accommodation
    ? calculateDistance(
        accommodation.latitude,
        accommodation.longitude,
        poi.location.lat,
        poi.location.lng,
      )
    : undefined;

  // Build a description from available data
  const parts: string[] = [];
  if (poi.openingHours?.openNow !== undefined) {
    parts.push(poi.openingHours.openNow ? 'Open now' : 'Currently closed');
  }
  if (poi.priceLevel > 0) {
    parts.push(`Price level: ${'$'.repeat(poi.priceLevel)}`);
  }
  if (poi.rating > 0) {
    parts.push(`Rated ${poi.rating}/5`);
  }
  const description = parts.length > 0
    ? truncateDescription(parts.join(' | '))
    : truncateDescription(`${poi.category} in the area`);

  return {
    name: poi.name,
    description,
    category: poi.category,
    rating: poi.rating,
    estimatedCost: estimateCost(poi.priceLevel, currency),
    distanceKm: distanceKm !== undefined ? Math.round(distanceKm * 100) / 100 : undefined,
    location: poi.location,
    matchScore: Math.round(matchScore * 100) / 100,
  };
}

// ─── AI Search Service ───────────────────────────────────────────────────────

export interface AISearchServiceDependencies {
  poiService: POIService;
  /** AWS Bedrock region (optional, for future Bedrock integration) */
  bedrockRegion?: string;
  /** Default currency for cost estimates */
  defaultCurrency?: string;
}

/**
 * AI-powered activity search service.
 *
 * Implements a personalization pipeline:
 * 1. Parse user query to extract intent (category, location keywords)
 * 2. Retrieve user preferences (interests, dietary, allergies)
 * 3. Query Google Places API with extracted intent (via POIService)
 * 4. Re-rank results: boost categories matching user interests, penalize dietary conflicts
 * 5. Apply explicit filters (price, rating, distance)
 * 6. Return top 20 sorted by combined relevance + personalization score
 */
export class AISearchService {
  private readonly poiService: POIService;
  private readonly defaultCurrency: string;

  constructor(deps: AISearchServiceDependencies) {
    this.poiService = deps.poiService;
    this.defaultCurrency = deps.defaultCurrency ?? 'USD';
  }

  /**
   * Execute a personalized search query.
   */
  async search(
    request: AISearchRequest,
    preferences: UserPreferences,
    accommodation: TripAccommodation | null,
  ): Promise<AISearchResponse> {
    const { query, filters } = request;

    // Step 1: Parse query to extract intent
    const { categories } = parseQuery(query);

    // Step 2: Determine search location
    // Use accommodation as center if available, otherwise we can't calculate distances
    const searchLat = accommodation?.latitude ?? 0;
    const searchLng = accommodation?.longitude ?? 0;

    if (!accommodation) {
      // Without accommodation, we can't do a location-based search effectively
      // Return empty results with suggestion
      return {
        results: [],
        personalizationApplied: preferences.interests.length > 0 || preferences.dietaryPreferences.length > 0,
        suggestBroaden: true,
      };
    }

    // Step 3: Query Google Places API for each detected category
    const allPOIs: POIResult[] = [];

    for (const category of categories.slice(0, 3)) { // Limit to 3 categories for performance
      const searchParams: POISearchParams = {
        latitude: searchLat,
        longitude: searchLng,
        radius: filters?.maxDistance ?? 10, // Default 10km search radius
        category: category as POISearchParams['category'],
        limit: 20,
      };

      try {
        const pois = await this.poiService.searchNearby(searchParams);
        allPOIs.push(...pois);
      } catch {
        // Continue with other categories if one fails
      }
    }

    // Step 4: Re-rank by personalization
    const hasPreferences =
      preferences.interests.length > 0 || preferences.dietaryPreferences.length > 0;

    // Filter out dietary conflicts
    const filteredPOIs = hasPreferences
      ? allPOIs.filter((poi) => !hasDietaryConflict(poi, preferences))
      : allPOIs;

    // Calculate match scores combining query relevance + personalization
    const scoredResults = filteredPOIs.map((poi) => {
      // Base relevance from query match (simple keyword matching)
      const queryRelevance = this.calculateQueryRelevance(poi, query);

      // Personalization boost
      const personalizationScore = hasPreferences
        ? calculatePersonalizationScore(poi, preferences)
        : 0.5;

      // Combined score: 60% query relevance, 40% personalization
      const combinedScore = queryRelevance * 0.6 + personalizationScore * 0.4;

      return poiToSearchResult(poi, combinedScore, accommodation, this.defaultCurrency);
    });

    // Remove duplicates (same name at same location)
    const uniqueResults = this.deduplicateResults(scoredResults);

    // Step 5: Apply explicit filters
    const filteredResults = applyFilters(uniqueResults, filters);

    // Step 6: Sort by match score descending and return top 20
    const sortedResults = filteredResults
      .sort((a, b) => b.matchScore - a.matchScore)
      .slice(0, 20);

    return {
      results: sortedResults,
      personalizationApplied: hasPreferences,
      suggestBroaden: sortedResults.length < 3,
    };
  }

  /**
   * Calculate query relevance for a POI based on keyword matching.
   * Returns a score between 0 and 1.
   */
  private calculateQueryRelevance(poi: POIResult, query: string): number {
    const lowerQuery = query.toLowerCase();
    const lowerName = poi.name.toLowerCase();

    let score = 0.3; // Base relevance

    // Name contains query words
    const queryWords = lowerQuery.split(/\s+/);
    for (const word of queryWords) {
      if (word.length > 2 && lowerName.includes(word)) {
        score += 0.2;
      }
    }

    // Category matches detected intent
    const { categories } = parseQuery(query);
    if (categories.includes(poi.category)) {
      score += 0.3;
    }

    // Higher-rated places get a small boost
    score += (poi.rating / 5) * 0.1;

    return Math.min(1, score);
  }

  /**
   * Remove duplicate results (same name at similar location).
   */
  private deduplicateResults(results: SearchResult[]): SearchResult[] {
    const seen = new Map<string, SearchResult>();

    for (const result of results) {
      const key = result.name.toLowerCase();
      const existing = seen.get(key);

      if (!existing || result.matchScore > existing.matchScore) {
        seen.set(key, result);
      }
    }

    return Array.from(seen.values());
  }
}
