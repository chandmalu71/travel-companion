import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { applyFilters, type SearchResult, type AISearchRequest } from '../../ai-search.js';

/**
 * Feature: travel-companion, Property 7: Multi-Criteria Search Filtering
 *
 * For any set of search results and any combination of active filters
 * (category, price range, minimum rating, maximum distance), the filter
 * function SHALL return only results that satisfy ALL active filter criteria
 * simultaneously. The result set SHALL be a subset of the input set.
 *
 * **Validates: Requirements 6.5**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

const categoryGen = fc.constantFrom(
  'restaurants', 'museums', 'parks', 'landmarks', 'entertainment',
);

const moneyAmountGen = fc.record({
  amount: fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
  currency: fc.constantFrom('USD', 'EUR', 'GBP'),
});

const locationGen = fc.record({
  lat: fc.double({ min: -90, max: 90, noNaN: true, noDefaultInfinity: true }),
  lng: fc.double({ min: -180, max: 180, noNaN: true, noDefaultInfinity: true }),
});

const searchResultGen: fc.Arbitrary<SearchResult> = fc.record({
  name: fc.string({ minLength: 1, maxLength: 50 }),
  description: fc.string({ minLength: 0, maxLength: 200 }),
  category: categoryGen,
  rating: fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
  estimatedCost: moneyAmountGen,
  distanceKm: fc.option(
    fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    { nil: undefined },
  ),
  location: locationGen,
  matchScore: fc.double({ min: 0, max: 1, noNaN: true, noDefaultInfinity: true }),
});

const searchResultsGen = fc.array(searchResultGen, { minLength: 0, maxLength: 30 });

const filtersGen: fc.Arbitrary<AISearchRequest['filters']> = fc.record({
  category: fc.option(
    fc.uniqueArray(categoryGen, { minLength: 1, maxLength: 5 }),
    { nil: undefined },
  ),
  priceRange: fc.option(
    fc.tuple(
      fc.double({ min: 0, max: 250, noNaN: true, noDefaultInfinity: true }),
      fc.double({ min: 0, max: 500, noNaN: true, noDefaultInfinity: true }),
    ).map(([a, b]): [number, number] => a <= b ? [a, b] : [b, a]),
    { nil: undefined },
  ),
  minRating: fc.option(
    fc.double({ min: 0, max: 5, noNaN: true, noDefaultInfinity: true }),
    { nil: undefined },
  ),
  maxDistance: fc.option(
    fc.double({ min: 0, max: 100, noNaN: true, noDefaultInfinity: true }),
    { nil: undefined },
  ),
});

// ─── Helper: independently check if a result satisfies all filters ───────────

function satisfiesAllFilters(
  result: SearchResult,
  filters: AISearchRequest['filters'],
): boolean {
  if (!filters) return true;

  if (filters.category && filters.category.length > 0) {
    if (!filters.category.includes(result.category)) return false;
  }

  if (filters.priceRange) {
    const [min, max] = filters.priceRange;
    if (result.estimatedCost.amount < min || result.estimatedCost.amount > max) return false;
  }

  if (filters.minRating !== undefined) {
    if (result.rating < filters.minRating) return false;
  }

  if (filters.maxDistance !== undefined && result.distanceKm !== undefined) {
    if (result.distanceKm > filters.maxDistance) return false;
  }

  return true;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 7: Multi-Criteria Search Filtering', () => {
  it('every result in the output satisfies ALL active filter criteria', () => {
    fc.assert(
      fc.property(searchResultsGen, filtersGen, (results, filters) => {
        const filtered = applyFilters(results, filters);

        for (const result of filtered) {
          expect(satisfiesAllFilters(result, filters)).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('the output is a subset of the input (no new results created)', () => {
    fc.assert(
      fc.property(searchResultsGen, filtersGen, (results, filters) => {
        const filtered = applyFilters(results, filters);

        expect(filtered.length).toBeLessThanOrEqual(results.length);
        for (const item of filtered) {
          expect(results).toContain(item);
        }
      }),
      { numRuns: 500 },
    );
  });

  it('no result satisfying all filters is excluded from the output', () => {
    fc.assert(
      fc.property(searchResultsGen, filtersGen, (results, filters) => {
        const filtered = applyFilters(results, filters);

        // Every input result that satisfies all filters must be in the output
        for (const result of results) {
          if (satisfiesAllFilters(result, filters)) {
            expect(filtered).toContain(result);
          }
        }
      }),
      { numRuns: 500 },
    );
  });

  it('with no filters, all results are returned unchanged', () => {
    fc.assert(
      fc.property(searchResultsGen, (results) => {
        const filtered = applyFilters(results, undefined);
        expect(filtered).toEqual(results);
      }),
      { numRuns: 500 },
    );
  });

  it('with empty filter object, all results are returned', () => {
    fc.assert(
      fc.property(searchResultsGen, (results) => {
        const filtered = applyFilters(results, {});
        expect(filtered).toEqual(results);
      }),
      { numRuns: 500 },
    );
  });
});
