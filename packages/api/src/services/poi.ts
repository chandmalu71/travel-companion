/**
 * POI (Points of Interest) Engine Service.
 *
 * Discovers and presents points of interest near destinations using
 * Google Places API (Nearby Search). Results are cached in Redis with
 * a 24-hour TTL.
 *
 * Implements Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface POISearchParams {
  latitude: number;
  longitude: number;
  radius: number; // 1-50 km, default 5
  category?: 'restaurants' | 'museums' | 'parks' | 'landmarks' | 'entertainment';
  limit?: number; // max 20
}

export interface OpeningHours {
  openNow: boolean;
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
  weekdayText?: string[];
}

export interface POIResult {
  placeId: string;
  name: string;
  category: string;
  rating: number; // 1-5
  distanceKm: number;
  openingHours: OpeningHours | null;
  priceLevel: number; // 1-4
  location: { lat: number; lng: number };
  photoUrl?: string;
}

export interface POISearchResponse {
  results: POIResult[];
  total: number;
  cached: boolean;
}

export interface POIErrorResponse {
  error: string;
  message: string;
  retryable: boolean;
}

// ─── Category Mapping ────────────────────────────────────────────────────────

/**
 * Maps application categories to Google Places API types.
 */
export const CATEGORY_TO_GOOGLE_TYPES: Record<string, string[]> = {
  restaurants: ['restaurant'],
  museums: ['museum'],
  parks: ['park'],
  landmarks: ['tourist_attraction'],
  entertainment: ['amusement_park', 'night_club', 'movie_theater'],
};

// ─── Distance Calculation ────────────────────────────────────────────────────

/**
 * Calculate distance between two geographic coordinates using the Haversine formula.
 * Returns the distance in kilometers.
 */
export function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const EARTH_RADIUS_KM = 6371;

  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
}

// ─── Google Places API Response Types ────────────────────────────────────────

interface GooglePlaceResult {
  place_id: string;
  name: string;
  types?: string[];
  rating?: number;
  price_level?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  opening_hours?: {
    open_now?: boolean;
    periods?: Array<{
      open: { day: number; time: string };
      close?: { day: number; time: string };
    }>;
    weekday_text?: string[];
  };
  photos?: Array<{
    photo_reference: string;
    width: number;
    height: number;
  }>;
}

interface GooglePlacesResponse {
  status: string;
  results: GooglePlaceResult[];
  error_message?: string;
}

// ─── POI Service ─────────────────────────────────────────────────────────────

export interface POIServiceDependencies {
  apiKey: string;
  /** Custom fetch function (for testing) */
  fetchFn?: typeof fetch;
}

/**
 * POI Service that searches for points of interest using Google Places API.
 */
export class POIService {
  private readonly apiKey: string;
  private readonly fetchFn: typeof fetch;
  private readonly baseUrl = 'https://maps.googleapis.com/maps/api/place';

  constructor(deps: POIServiceDependencies) {
    this.apiKey = deps.apiKey;
    this.fetchFn = deps.fetchFn ?? fetch;
  }

  /**
   * Search for nearby points of interest.
   */
  async searchNearby(params: POISearchParams): Promise<POIResult[]> {
    const { latitude, longitude, radius, category, limit = 20 } = params;

    // Convert radius from km to meters for Google Places API
    const radiusMeters = radius * 1000;

    // Build the Google Places Nearby Search URL
    const url = new URL(`${this.baseUrl}/nearbysearch/json`);
    url.searchParams.set('location', `${latitude},${longitude}`);
    url.searchParams.set('radius', radiusMeters.toString());
    url.searchParams.set('key', this.apiKey);

    // Apply category type filter
    if (category && CATEGORY_TO_GOOGLE_TYPES[category]) {
      const types = CATEGORY_TO_GOOGLE_TYPES[category]!;
      url.searchParams.set('type', types[0]!);
      // For entertainment with multiple types, use keyword as fallback
      if (types.length > 1) {
        url.searchParams.set('keyword', types.join('|'));
      }
    }

    const response = await this.fetchFn(url.toString());

    if (!response.ok) {
      throw new POIApiError(
        `Google Places API returned HTTP ${response.status}`,
        true,
      );
    }

    const data = (await response.json()) as GooglePlacesResponse;

    if (data.status === 'REQUEST_DENIED' || data.status === 'OVER_QUERY_LIMIT') {
      throw new POIApiError(
        data.error_message ?? `Google Places API error: ${data.status}`,
        data.status === 'OVER_QUERY_LIMIT',
      );
    }

    if (data.status === 'ZERO_RESULTS') {
      return [];
    }

    if (data.status !== 'OK') {
      throw new POIApiError(
        data.error_message ?? `Unexpected Google Places API status: ${data.status}`,
        true,
      );
    }

    // Map results to our POI format
    const results = data.results
      .map((place) => this.mapPlaceToResult(place, latitude, longitude, category))
      .filter((poi): poi is POIResult => poi !== null)
      // Sort by distance ascending
      .sort((a, b) => a.distanceKm - b.distanceKm);

    // Limit results
    const effectiveLimit = Math.min(limit, 20);
    return results.slice(0, effectiveLimit);
  }

  /**
   * Map a Google Place result to our POI format.
   */
  private mapPlaceToResult(
    place: GooglePlaceResult,
    centerLat: number,
    centerLng: number,
    requestedCategory?: string,
  ): POIResult | null {
    const distance = calculateDistance(
      centerLat,
      centerLng,
      place.geometry.location.lat,
      place.geometry.location.lng,
    );

    const category = requestedCategory ?? this.inferCategory(place.types ?? []);

    let openingHours: OpeningHours | null = null;
    if (place.opening_hours) {
      openingHours = {
        openNow: place.opening_hours.open_now ?? false,
        periods: place.opening_hours.periods,
        weekdayText: place.opening_hours.weekday_text,
      };
    }

    let photoUrl: string | undefined;
    if (place.photos && place.photos.length > 0) {
      const photoRef = place.photos[0]!.photo_reference;
      photoUrl = `${this.baseUrl}/photo?maxwidth=400&photo_reference=${photoRef}&key=${this.apiKey}`;
    }

    return {
      placeId: place.place_id,
      name: place.name,
      category,
      rating: place.rating ?? 0,
      distanceKm: Math.round(distance * 100) / 100, // Round to 2 decimal places
      openingHours,
      priceLevel: place.price_level ?? 0,
      location: place.geometry.location,
      photoUrl,
    };
  }

  /**
   * Infer a category from Google Place types.
   */
  private inferCategory(types: string[]): string {
    for (const [cat, googleTypes] of Object.entries(CATEGORY_TO_GOOGLE_TYPES)) {
      if (types.some((t) => googleTypes.includes(t))) {
        return cat;
      }
    }
    return 'other';
  }
}

// ─── Custom Error ────────────────────────────────────────────────────────────

export class POIApiError extends Error {
  public readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = 'POIApiError';
    this.retryable = retryable;
  }
}

// ─── Cache Key Utilities ─────────────────────────────────────────────────────

/**
 * Generate a Redis cache key for POI search results.
 * Format: poi:{lat}:{lng}:{radius}:{category}
 */
export function buildCacheKey(params: POISearchParams): string {
  const { latitude, longitude, radius, category } = params;
  // Round coordinates to 4 decimal places (~11m precision) for cache efficiency
  const lat = latitude.toFixed(4);
  const lng = longitude.toFixed(4);
  const cat = category ?? 'all';
  return `poi:${lat}:${lng}:${radius}:${cat}`;
}

/** Cache TTL: 24 hours in seconds */
export const POI_CACHE_TTL = 24 * 60 * 60;
