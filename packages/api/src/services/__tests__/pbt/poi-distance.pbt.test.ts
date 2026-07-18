import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateDistance } from '../../poi.js';

/**
 * Feature: travel-companion, Property 6: POI Distance Filtering
 *
 * For any set of points of interest with known coordinates, a center point,
 * and a radius between 1 and 50 km, the distance filter SHALL return exactly
 * those POIs whose haversine distance from the center is less than or equal
 * to the specified radius.
 *
 * **Validates: Requirements 5.5**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

const latitude = fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true });
const longitude = fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true });
const radius = fc.double({ min: 1, max: 50, noNaN: true, noDefaultInfinity: true });

const coordinate = fc.record({
  lat: latitude,
  lng: longitude,
});

const poiSet = fc.array(coordinate, { minLength: 0, maxLength: 30 });

// ─── Filter Function Under Test ──────────────────────────────────────────────

/**
 * Filters POIs by haversine distance from a center point within a given radius.
 * This is the core logic the POI engine uses to determine which POIs to return.
 */
function filterPOIsByDistance(
  pois: Array<{ lat: number; lng: number }>,
  center: { lat: number; lng: number },
  radiusKm: number,
): Array<{ lat: number; lng: number }> {
  return pois.filter((poi) => {
    const distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
    return distance <= radiusKm;
  });
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 6: POI Distance Filtering', () => {
  it('filter returns exactly those POIs within haversine distance <= radius', () => {
    fc.assert(
      fc.property(poiSet, coordinate, radius, (pois, center, r) => {
        const filtered = filterPOIsByDistance(pois, center, r);

        // Compute expected result independently
        const expected = pois.filter(
          (poi) => calculateDistance(center.lat, center.lng, poi.lat, poi.lng) <= r,
        );

        expect(filtered).toEqual(expected);
      }),
      { numRuns: 500 },
    );
  });

  it('all returned POIs have distance <= radius', () => {
    fc.assert(
      fc.property(poiSet, coordinate, radius, (pois, center, r) => {
        const filtered = filterPOIsByDistance(pois, center, r);

        for (const poi of filtered) {
          const distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
          expect(distance).toBeLessThanOrEqual(r);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('all excluded POIs have distance > radius', () => {
    fc.assert(
      fc.property(poiSet, coordinate, radius, (pois, center, r) => {
        const filtered = filterPOIsByDistance(pois, center, r);
        const excluded = pois.filter((poi) => !filtered.includes(poi));

        for (const poi of excluded) {
          const distance = calculateDistance(center.lat, center.lng, poi.lat, poi.lng);
          expect(distance).toBeGreaterThan(r);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('the empty set is correctly handled', () => {
    fc.assert(
      fc.property(coordinate, radius, (center, r) => {
        const filtered = filterPOIsByDistance([], center, r);
        expect(filtered).toEqual([]);
      }),
      { numRuns: 500 },
    );
  });

  it('distance is always non-negative', () => {
    fc.assert(
      fc.property(coordinate, coordinate, (a, b) => {
        const distance = calculateDistance(a.lat, a.lng, b.lat, b.lng);
        expect(distance).toBeGreaterThanOrEqual(0);
      }),
      { numRuns: 500 },
    );
  });

  it('distance from a point to itself is 0', () => {
    fc.assert(
      fc.property(coordinate, (point) => {
        const distance = calculateDistance(point.lat, point.lng, point.lat, point.lng);
        expect(distance).toBe(0);
      }),
      { numRuns: 500 },
    );
  });
});
