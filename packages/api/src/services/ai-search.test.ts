import { describe, it, expect } from 'vitest';
import {
  parseQuery,
  calculatePersonalizationScore,
  hasDietaryConflict,
  applyFilters,
  truncateDescription,
  AISearchService,
  type UserPreferences,
  type SearchResult,
  type AISearchRequest,
} from './ai-search.js';
import { POIService, type POIResult } from './poi.js';

// ─── parseQuery ──────────────────────────────────────────────────────────────

describe('parseQuery', () => {
  it('detects restaurant category from food-related keywords', () => {
    const result = parseQuery('best sushi restaurants');
    expect(result.categories).toContain('restaurants');
  });

  it('detects museum category', () => {
    const result = parseQuery('art museum near me');
    expect(result.categories).toContain('museums');
  });

  it('detects park category from outdoor keywords', () => {
    const result = parseQuery('hiking trails and nature parks');
    expect(result.categories).toContain('parks');
  });

  it('detects entertainment category', () => {
    const result = parseQuery('nightlife clubs and bars');
    expect(result.categories).toContain('entertainment');
  });

  it('detects landmark category from sightseeing keywords', () => {
    const result = parseQuery('famous landmarks to visit');
    expect(result.categories).toContain('landmarks');
  });

  it('returns default categories when no specific match', () => {
    const result = parseQuery('things to do');
    expect(result.categories.length).toBeGreaterThan(0);
  });

  it('detects multiple categories from a complex query', () => {
    const result = parseQuery('restaurants and museum nearby');
    expect(result.categories).toContain('restaurants');
    expect(result.categories).toContain('museums');
  });
});

// ─── calculatePersonalizationScore ───────────────────────────────────────────

describe('calculatePersonalizationScore', () => {
  const basePOI: POIResult = {
    placeId: 'test-1',
    name: 'Test Place',
    category: 'museums',
    rating: 4.0,
    distanceKm: 2,
    openingHours: null,
    priceLevel: 2,
    location: { lat: 48.8566, lng: 2.3522 },
  };

  it('returns base score for user with no preferences', () => {
    const score = calculatePersonalizationScore(basePOI, {
      interests: [],
      dietaryPreferences: [],
      allergies: [],
    });
    // Base score + rating bonus
    expect(score).toBeGreaterThanOrEqual(0.5);
    expect(score).toBeLessThanOrEqual(1.0);
  });

  it('boosts score for matching interests', () => {
    const withInterest = calculatePersonalizationScore(basePOI, {
      interests: ['history'], // history matches museums
      dietaryPreferences: [],
      allergies: [],
    });
    const withoutInterest = calculatePersonalizationScore(basePOI, {
      interests: [],
      dietaryPreferences: [],
      allergies: [],
    });
    expect(withInterest).toBeGreaterThan(withoutInterest);
  });

  it('penalizes restaurants with dietary conflicts', () => {
    const restaurantPOI: POIResult = {
      ...basePOI,
      name: 'Big Steakhouse',
      category: 'restaurants',
    };
    const score = calculatePersonalizationScore(restaurantPOI, {
      interests: [],
      dietaryPreferences: ['vegan'],
      allergies: [],
    });
    // Should be penalized because steakhouse conflicts with vegan
    expect(score).toBeLessThan(0.5);
  });

  it('does not penalize non-restaurants for dietary preferences', () => {
    const parkPOI: POIResult = {
      ...basePOI,
      name: 'Steakhouse Park',
      category: 'parks',
    };
    const score = calculatePersonalizationScore(parkPOI, {
      interests: [],
      dietaryPreferences: ['vegan'],
      allergies: [],
    });
    // Parks should not be penalized for dietary preferences
    expect(score).toBeGreaterThanOrEqual(0.5);
  });

  it('gives extra boost for highly rated places', () => {
    const highRated: POIResult = { ...basePOI, rating: 4.8 };
    const lowRated: POIResult = { ...basePOI, rating: 3.0 };
    const highScore = calculatePersonalizationScore(highRated, {
      interests: [],
      dietaryPreferences: [],
      allergies: [],
    });
    const lowScore = calculatePersonalizationScore(lowRated, {
      interests: [],
      dietaryPreferences: [],
      allergies: [],
    });
    expect(highScore).toBeGreaterThan(lowScore);
  });

  it('clamps score between 0 and 1', () => {
    // Many interests matching should still cap at 1
    const score = calculatePersonalizationScore(basePOI, {
      interests: ['history', 'culture', 'art', 'architecture'],
      dietaryPreferences: [],
      allergies: [],
    });
    expect(score).toBeLessThanOrEqual(1);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─── hasDietaryConflict ──────────────────────────────────────────────────────

describe('hasDietaryConflict', () => {
  const basePOI: POIResult = {
    placeId: 'test-1',
    name: 'Test Restaurant',
    category: 'restaurants',
    rating: 4.0,
    distanceKm: 2,
    openingHours: null,
    priceLevel: 2,
    location: { lat: 48.8566, lng: 2.3522 },
  };

  it('returns true for steakhouse with vegan preference', () => {
    const poi: POIResult = { ...basePOI, name: 'The Steakhouse' };
    expect(hasDietaryConflict(poi, {
      interests: [],
      dietaryPreferences: ['vegan'],
      allergies: [],
    })).toBe(true);
  });

  it('returns false for non-conflicting restaurant', () => {
    const poi: POIResult = { ...basePOI, name: 'Green Salad Bar' };
    expect(hasDietaryConflict(poi, {
      interests: [],
      dietaryPreferences: ['vegan'],
      allergies: [],
    })).toBe(false);
  });

  it('returns false for non-restaurant POIs', () => {
    const poi: POIResult = { ...basePOI, category: 'parks', name: 'BBQ Park' };
    expect(hasDietaryConflict(poi, {
      interests: [],
      dietaryPreferences: ['vegan'],
      allergies: [],
    })).toBe(false);
  });

  it('returns false when no dietary preferences set', () => {
    const poi: POIResult = { ...basePOI, name: 'Steakhouse' };
    expect(hasDietaryConflict(poi, {
      interests: [],
      dietaryPreferences: [],
      allergies: [],
    })).toBe(false);
  });
});

// ─── applyFilters ────────────────────────────────────────────────────────────

describe('applyFilters', () => {
  const sampleResults: SearchResult[] = [
    {
      name: 'Restaurant A',
      description: 'A nice restaurant',
      category: 'restaurants',
      rating: 4.5,
      estimatedCost: { amount: 30, currency: 'USD' },
      distanceKm: 2,
      location: { lat: 48.856, lng: 2.352 },
      matchScore: 0.8,
    },
    {
      name: 'Museum B',
      description: 'A great museum',
      category: 'museums',
      rating: 4.0,
      estimatedCost: { amount: 15, currency: 'USD' },
      distanceKm: 5,
      location: { lat: 48.86, lng: 2.35 },
      matchScore: 0.7,
    },
    {
      name: 'Park C',
      description: 'A beautiful park',
      category: 'parks',
      rating: 3.5,
      estimatedCost: { amount: 0, currency: 'USD' },
      distanceKm: 8,
      location: { lat: 48.87, lng: 2.34 },
      matchScore: 0.6,
    },
  ];

  it('returns all results when no filters applied', () => {
    const filtered = applyFilters(sampleResults);
    expect(filtered).toHaveLength(3);
  });

  it('returns all results with empty filter object', () => {
    const filtered = applyFilters(sampleResults, {});
    expect(filtered).toHaveLength(3);
  });

  it('filters by category', () => {
    const filtered = applyFilters(sampleResults, { category: ['restaurants'] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe('Restaurant A');
  });

  it('filters by multiple categories', () => {
    const filtered = applyFilters(sampleResults, { category: ['restaurants', 'museums'] });
    expect(filtered).toHaveLength(2);
  });

  it('filters by price range', () => {
    const filtered = applyFilters(sampleResults, { priceRange: [10, 20] });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe('Museum B');
  });

  it('filters by minimum rating', () => {
    const filtered = applyFilters(sampleResults, { minRating: 4.0 });
    expect(filtered).toHaveLength(2);
    expect(filtered.every((r) => r.rating >= 4.0)).toBe(true);
  });

  it('filters by maximum distance', () => {
    const filtered = applyFilters(sampleResults, { maxDistance: 3 });
    expect(filtered).toHaveLength(1);
    expect(filtered[0]!.name).toBe('Restaurant A');
  });

  it('applies multiple filters simultaneously', () => {
    const filtered = applyFilters(sampleResults, {
      category: ['restaurants', 'museums'],
      minRating: 4.0,
      maxDistance: 10,
    });
    expect(filtered).toHaveLength(2);
  });

  it('returns empty array when no results match all filters', () => {
    const filtered = applyFilters(sampleResults, {
      category: ['restaurants'],
      minRating: 5.0,
    });
    expect(filtered).toHaveLength(0);
  });

  it('does not filter by distance when distanceKm is undefined', () => {
    const resultsWithoutDistance: SearchResult[] = [
      { ...sampleResults[0]!, distanceKm: undefined },
    ];
    const filtered = applyFilters(resultsWithoutDistance, { maxDistance: 1 });
    // Should not be filtered out since distance is undefined
    expect(filtered).toHaveLength(1);
  });
});

// ─── truncateDescription ─────────────────────────────────────────────────────

describe('truncateDescription', () => {
  it('returns original text if within limit', () => {
    expect(truncateDescription('Short text')).toBe('Short text');
  });

  it('truncates text exceeding max length with ellipsis', () => {
    const longText = 'A'.repeat(250);
    const result = truncateDescription(longText);
    expect(result.length).toBe(200);
    expect(result.endsWith('...')).toBe(true);
  });

  it('handles custom max length', () => {
    const text = 'Hello World, this is a test string that is quite long';
    const result = truncateDescription(text, 20);
    expect(result.length).toBe(20);
    expect(result.endsWith('...')).toBe(true);
  });

  it('does not truncate text at exactly max length', () => {
    const text = 'A'.repeat(200);
    expect(truncateDescription(text)).toBe(text);
  });

  it('handles empty string', () => {
    expect(truncateDescription('')).toBe('');
  });
});

// ─── AISearchService ─────────────────────────────────────────────────────────

describe('AISearchService', () => {
  const mockPOIs: POIResult[] = [
    {
      placeId: 'place1',
      name: 'Italian Restaurant',
      category: 'restaurants',
      rating: 4.5,
      distanceKm: 1.5,
      openingHours: { openNow: true },
      priceLevel: 2,
      location: { lat: 48.857, lng: 2.352 },
    },
    {
      placeId: 'place2',
      name: 'Art Museum',
      category: 'museums',
      rating: 4.2,
      distanceKm: 3,
      openingHours: null,
      priceLevel: 1,
      location: { lat: 48.86, lng: 2.34 },
    },
    {
      placeId: 'place3',
      name: 'City Park',
      category: 'parks',
      rating: 4.0,
      distanceKm: 2,
      openingHours: { openNow: true },
      priceLevel: 0,
      location: { lat: 48.855, lng: 2.35 },
    },
  ];

  function createMockPOIService(results: POIResult[] = mockPOIs): POIService {
    return {
      searchNearby: async () => results,
    } as unknown as POIService;
  }

  it('returns results with max 20 items', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'restaurants near me', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(response.results.length).toBeLessThanOrEqual(20);
  });

  it('sets suggestBroaden to true when fewer than 3 results', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService([mockPOIs[0]!]),
    });

    const response = await service.search(
      { query: 'restaurant', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(response.suggestBroaden).toBe(true);
  });

  it('sets suggestBroaden to false when 3 or more results', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(mockPOIs),
    });

    const response = await service.search(
      { query: 'things to do', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(response.suggestBroaden).toBe(false);
  });

  it('applies personalization when user has preferences', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'things to do', tripId: 'trip-1' },
      { interests: ['history', 'art'], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(response.personalizationApplied).toBe(true);
  });

  it('sets personalizationApplied to false when no preferences', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'restaurants', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    expect(response.personalizationApplied).toBe(false);
  });

  it('filters out dietary conflicts', async () => {
    const poiWithConflict: POIResult[] = [
      {
        placeId: 'steak1',
        name: 'Big Steakhouse',
        category: 'restaurants',
        rating: 4.5,
        distanceKm: 1,
        openingHours: null,
        priceLevel: 3,
        location: { lat: 48.857, lng: 2.352 },
      },
      {
        placeId: 'veg1',
        name: 'Green Salad Bar',
        category: 'restaurants',
        rating: 4.0,
        distanceKm: 2,
        openingHours: null,
        priceLevel: 1,
        location: { lat: 48.86, lng: 2.34 },
      },
    ];

    const service = new AISearchService({
      poiService: createMockPOIService(poiWithConflict),
    });

    const response = await service.search(
      { query: 'restaurants', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: ['vegan'], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    // Steakhouse should be filtered out
    const names = response.results.map((r) => r.name);
    expect(names).not.toContain('Big Steakhouse');
    expect(names).toContain('Green Salad Bar');
  });

  it('returns empty results with suggestBroaden when no accommodation', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'restaurants', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      null, // No accommodation
    );

    expect(response.results).toHaveLength(0);
    expect(response.suggestBroaden).toBe(true);
  });

  it('truncates descriptions to max 200 characters', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'things to do', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (const result of response.results) {
      expect(result.description.length).toBeLessThanOrEqual(200);
    }
  });

  it('includes matchScore between 0 and 1 for each result', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'restaurant', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (const result of response.results) {
      expect(result.matchScore).toBeGreaterThanOrEqual(0);
      expect(result.matchScore).toBeLessThanOrEqual(1);
    }
  });

  it('results are sorted by matchScore descending', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'things to do', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (let i = 1; i < response.results.length; i++) {
      expect(response.results[i]!.matchScore).toBeLessThanOrEqual(response.results[i - 1]!.matchScore);
    }
  });

  it('applies explicit filters', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      {
        query: 'things to do',
        tripId: 'trip-1',
        filters: { minRating: 4.3 },
      },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (const result of response.results) {
      expect(result.rating).toBeGreaterThanOrEqual(4.3);
    }
  });

  it('deduplicates results with the same name', async () => {
    const duplicatePOIs: POIResult[] = [
      {
        placeId: 'place1a',
        name: 'Le Bistro',
        category: 'restaurants',
        rating: 4.5,
        distanceKm: 1,
        openingHours: null,
        priceLevel: 2,
        location: { lat: 48.857, lng: 2.352 },
      },
      {
        placeId: 'place1b',
        name: 'Le Bistro',
        category: 'restaurants',
        rating: 4.0,
        distanceKm: 2,
        openingHours: null,
        priceLevel: 2,
        location: { lat: 48.858, lng: 2.353 },
      },
    ];

    const service = new AISearchService({
      poiService: createMockPOIService(duplicatePOIs),
    });

    const response = await service.search(
      { query: 'restaurant', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    const names = response.results.map((r) => r.name);
    const uniqueNames = [...new Set(names)];
    expect(names.length).toBe(uniqueNames.length);
  });

  it('includes estimatedCost for each result', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'restaurants', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (const result of response.results) {
      expect(result.estimatedCost).toBeDefined();
      expect(result.estimatedCost.amount).toBeGreaterThanOrEqual(0);
      expect(result.estimatedCost.currency).toBe('USD');
    }
  });

  it('includes distance when accommodation is provided', async () => {
    const service = new AISearchService({
      poiService: createMockPOIService(),
    });

    const response = await service.search(
      { query: 'things to do', tripId: 'trip-1' },
      { interests: [], dietaryPreferences: [], allergies: [] },
      { latitude: 48.8566, longitude: 2.3522 },
    );

    for (const result of response.results) {
      expect(result.distanceKm).toBeDefined();
      expect(result.distanceKm).toBeGreaterThanOrEqual(0);
    }
  });
});
