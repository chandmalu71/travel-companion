import { describe, it, expect } from 'vitest';
import {
  calculateDistance,
  POIService,
  POIApiError,
  buildCacheKey,
  CATEGORY_TO_GOOGLE_TYPES,
  POI_CACHE_TTL,
  type POISearchParams,
} from './poi.js';

// ─── calculateDistance (Haversine) ───────────────────────────────────────────

describe('calculateDistance', () => {
  it('returns 0 for the same point', () => {
    const d = calculateDistance(48.8566, 2.3522, 48.8566, 2.3522);
    expect(d).toBe(0);
  });

  it('calculates correct distance between Paris and London (~340 km)', () => {
    const d = calculateDistance(48.8566, 2.3522, 51.5074, -0.1278);
    expect(d).toBeGreaterThan(330);
    expect(d).toBeLessThan(350);
  });

  it('calculates correct distance between New York and Los Angeles (~3940 km)', () => {
    const d = calculateDistance(40.7128, -74.006, 34.0522, -118.2437);
    expect(d).toBeGreaterThan(3900);
    expect(d).toBeLessThan(4000);
  });

  it('handles antipodal points (half the circumference ~20000 km)', () => {
    const d = calculateDistance(0, 0, 0, 180);
    expect(d).toBeGreaterThan(19900);
    expect(d).toBeLessThan(20100);
  });

  it('calculates short distances accurately (< 1km)', () => {
    // ~100m apart
    const d = calculateDistance(48.8566, 2.3522, 48.8575, 2.3522);
    expect(d).toBeGreaterThan(0.09);
    expect(d).toBeLessThan(0.11);
  });
});

// ─── buildCacheKey ───────────────────────────────────────────────────────────

describe('buildCacheKey', () => {
  it('builds correct cache key with category', () => {
    const key = buildCacheKey({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      category: 'restaurants',
    });
    expect(key).toBe('poi:48.8566:2.3522:5:restaurants');
  });

  it('builds correct cache key without category', () => {
    const key = buildCacheKey({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 10,
    });
    expect(key).toBe('poi:48.8566:2.3522:10:all');
  });

  it('rounds coordinates to 4 decimal places', () => {
    const key = buildCacheKey({
      latitude: 48.85661234,
      longitude: 2.35221234,
      radius: 5,
      category: 'parks',
    });
    expect(key).toBe('poi:48.8566:2.3522:5:parks');
  });
});

// ─── POI_CACHE_TTL ───────────────────────────────────────────────────────────

describe('POI_CACHE_TTL', () => {
  it('is 24 hours in seconds', () => {
    expect(POI_CACHE_TTL).toBe(86400);
  });
});

// ─── CATEGORY_TO_GOOGLE_TYPES ────────────────────────────────────────────────

describe('CATEGORY_TO_GOOGLE_TYPES', () => {
  it('maps restaurants to restaurant', () => {
    expect(CATEGORY_TO_GOOGLE_TYPES['restaurants']).toEqual(['restaurant']);
  });

  it('maps museums to museum', () => {
    expect(CATEGORY_TO_GOOGLE_TYPES['museums']).toEqual(['museum']);
  });

  it('maps parks to park', () => {
    expect(CATEGORY_TO_GOOGLE_TYPES['parks']).toEqual(['park']);
  });

  it('maps landmarks to tourist_attraction', () => {
    expect(CATEGORY_TO_GOOGLE_TYPES['landmarks']).toEqual(['tourist_attraction']);
  });

  it('maps entertainment to multiple types', () => {
    expect(CATEGORY_TO_GOOGLE_TYPES['entertainment']).toEqual([
      'amusement_park',
      'night_club',
      'movie_theater',
    ]);
  });
});

// ─── POIService ──────────────────────────────────────────────────────────────

describe('POIService', () => {
  const mockGoogleResponse = {
    status: 'OK',
    results: [
      {
        place_id: 'place1',
        name: 'Le Petit Bistro',
        types: ['restaurant', 'food'],
        rating: 4.5,
        price_level: 2,
        geometry: { location: { lat: 48.857, lng: 2.352 } },
        opening_hours: {
          open_now: true,
          weekday_text: ['Monday: 9:00 AM – 10:00 PM'],
        },
        photos: [{ photo_reference: 'ref123', width: 800, height: 600 }],
      },
      {
        place_id: 'place2',
        name: 'Cafe de Flore',
        types: ['restaurant', 'cafe'],
        rating: 4.2,
        price_level: 3,
        geometry: { location: { lat: 48.854, lng: 2.332 } },
        opening_hours: { open_now: false },
      },
      {
        place_id: 'place3',
        name: 'Chez Michel',
        types: ['restaurant'],
        rating: 3.8,
        price_level: 1,
        geometry: { location: { lat: 48.86, lng: 2.36 } },
      },
    ],
  };

  function createMockFetch(response: unknown, ok = true, status = 200) {
    return async () =>
      ({
        ok,
        status,
        json: async () => response,
      }) as Response;
  }

  it('searches nearby POIs and returns sorted results', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch(mockGoogleResponse),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      category: 'restaurants',
      limit: 20,
    });

    expect(results.length).toBe(3);
    // Results should be sorted by distance ascending
    expect(results[0]!.distanceKm).toBeLessThanOrEqual(results[1]!.distanceKm);
    expect(results[1]!.distanceKm).toBeLessThanOrEqual(results[2]!.distanceKm);
  });

  it('maps POI fields correctly', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch(mockGoogleResponse),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      category: 'restaurants',
    });

    const poi = results.find((r) => r.placeId === 'place1')!;
    expect(poi).toBeDefined();
    expect(poi.name).toBe('Le Petit Bistro');
    expect(poi.category).toBe('restaurants');
    expect(poi.rating).toBe(4.5);
    expect(poi.priceLevel).toBe(2);
    expect(poi.location).toEqual({ lat: 48.857, lng: 2.352 });
    expect(poi.openingHours).not.toBeNull();
    expect(poi.openingHours!.openNow).toBe(true);
    expect(poi.photoUrl).toContain('ref123');
    expect(poi.distanceKm).toBeGreaterThan(0);
  });

  it('respects limit parameter', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch(mockGoogleResponse),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      category: 'restaurants',
      limit: 2,
    });

    expect(results.length).toBe(2);
  });

  it('enforces max limit of 20', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch(mockGoogleResponse),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      limit: 100, // more than max
    });

    // Since mock only has 3 results, just verify it doesn't crash
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('returns empty array for ZERO_RESULTS', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch({ status: 'ZERO_RESULTS', results: [] }),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
    });

    expect(results).toEqual([]);
  });

  it('throws POIApiError for REQUEST_DENIED', async () => {
    const service = new POIService({
      apiKey: 'invalid-key',
      fetchFn: createMockFetch({
        status: 'REQUEST_DENIED',
        results: [],
        error_message: 'API key is invalid',
      }),
    });

    await expect(
      service.searchNearby({ latitude: 48.8566, longitude: 2.3522, radius: 5 }),
    ).rejects.toThrow(POIApiError);
  });

  it('throws POIApiError for OVER_QUERY_LIMIT with retryable=true', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch({
        status: 'OVER_QUERY_LIMIT',
        results: [],
        error_message: 'Rate limit exceeded',
      }),
    });

    try {
      await service.searchNearby({ latitude: 48.8566, longitude: 2.3522, radius: 5 });
      expect.fail('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(POIApiError);
      expect((e as POIApiError).retryable).toBe(true);
    }
  });

  it('throws POIApiError for HTTP errors', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch({}, false, 500),
    });

    await expect(
      service.searchNearby({ latitude: 48.8566, longitude: 2.3522, radius: 5 }),
    ).rejects.toThrow(POIApiError);
  });

  it('handles POI without optional fields (no photos, no opening_hours, no price_level)', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch({
        status: 'OK',
        results: [
          {
            place_id: 'minimal',
            name: 'Minimal Place',
            types: ['park'],
            geometry: { location: { lat: 48.86, lng: 2.35 } },
          },
        ],
      }),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
    });

    expect(results.length).toBe(1);
    expect(results[0]!.placeId).toBe('minimal');
    expect(results[0]!.rating).toBe(0);
    expect(results[0]!.priceLevel).toBe(0);
    expect(results[0]!.openingHours).toBeNull();
    expect(results[0]!.photoUrl).toBeUndefined();
  });

  it('infers category from Google types when no category specified', async () => {
    const service = new POIService({
      apiKey: 'test-key',
      fetchFn: createMockFetch({
        status: 'OK',
        results: [
          {
            place_id: 'p1',
            name: 'Museum X',
            types: ['museum', 'point_of_interest'],
            geometry: { location: { lat: 48.86, lng: 2.35 } },
          },
        ],
      }),
    });

    const results = await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 5,
      // no category specified
    });

    expect(results[0]!.category).toBe('museums');
  });

  it('constructs correct Google Places API URL with parameters', async () => {
    let capturedUrl = '';
    const service = new POIService({
      apiKey: 'my-api-key',
      fetchFn: async (url: string | URL | Request) => {
        capturedUrl = typeof url === 'string' ? url : url.toString();
        return {
          ok: true,
          status: 200,
          json: async () => ({ status: 'ZERO_RESULTS', results: [] }),
        } as Response;
      },
    });

    await service.searchNearby({
      latitude: 48.8566,
      longitude: 2.3522,
      radius: 10,
      category: 'museums',
    });

    expect(capturedUrl).toContain('nearbysearch/json');
    expect(capturedUrl).toContain('location=48.8566%2C2.3522');
    expect(capturedUrl).toContain('radius=10000'); // 10km * 1000
    expect(capturedUrl).toContain('type=museum');
    expect(capturedUrl).toContain('key=my-api-key');
  });
});
