/**
 * Property-Based Test: Trip Date Range Validation
 *
 * Feature: travel-companion, Property 5: Trip Date Range Validation
 *
 * For any pair of dates (start, end), the trip date validator SHALL accept the pair
 * if and only if end >= start. Additionally, when either date is omitted, the
 * validator SHALL accept regardless.
 *
 * **Validates: Requirements 4.6, 8.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { tripCreationSchema } from '../../validators';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Checks whether the tripCreationSchema accepts the given input.
 */
function schemaAccepts(input: {
  name: string;
  start_date?: string;
  end_date?: string;
}): boolean {
  const result = tripCreationSchema.safeParse(input);
  return result.success;
}

// ─── Generators ──────────────────────────────────────────────────────────────

/** Valid trip name (always passes name validation so we isolate date logic) */
const validTripName = fc.string({ minLength: 1, maxLength: 50 });

/**
 * Generates a valid ISO date string (YYYY-MM-DD) within a reasonable range.
 * We generate year, month, day separately to ensure we always get valid dates.
 */
const isoDateArbitrary = fc
  .tuple(
    fc.integer({ min: 2000, max: 2100 }), // year
    fc.integer({ min: 1, max: 12 }), // month
    fc.integer({ min: 1, max: 28 }) // day (1-28 always valid for any month)
  )
  .map(([year, month, day]) => {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  });

/**
 * Generates an ordered pair of ISO date strings where start <= end.
 * We generate two dates and sort them.
 */
const orderedDatePair = fc.tuple(isoDateArbitrary, isoDateArbitrary).map(([d1, d2]) => {
  return d1 <= d2 ? [d1, d2] : [d2, d1];
});

/**
 * Generates an inverted pair of ISO date strings where end < start.
 * We generate two distinct dates and return them in reversed order.
 */
const invertedDatePair = fc
  .tuple(isoDateArbitrary, isoDateArbitrary)
  .filter(([d1, d2]) => d1 !== d2)
  .map(([d1, d2]) => {
    // Return [larger, smaller] so start > end
    return d1 > d2 ? [d1, d2] : [d2, d1];
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 5: Trip Date Range Validation', () => {
  it('should accept any date pair where end >= start', () => {
    fc.assert(
      fc.property(validTripName, orderedDatePair, (name, [startDate, endDate]) => {
        const input = {
          name,
          start_date: startDate,
          end_date: endDate,
        };

        expect(schemaAccepts(input)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject any date pair where end < start', () => {
    fc.assert(
      fc.property(validTripName, invertedDatePair, (name, [startDate, endDate]) => {
        const input = {
          name,
          start_date: startDate,
          end_date: endDate,
        };

        expect(schemaAccepts(input)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should accept when start_date is omitted regardless of end_date', () => {
    fc.assert(
      fc.property(validTripName, isoDateArbitrary, (name, endDate) => {
        const input = {
          name,
          end_date: endDate,
        };

        expect(schemaAccepts(input)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('should accept when end_date is omitted regardless of start_date', () => {
    fc.assert(
      fc.property(validTripName, isoDateArbitrary, (name, startDate) => {
        const input = {
          name,
          start_date: startDate,
        };

        expect(schemaAccepts(input)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('should accept when both dates are omitted', () => {
    fc.assert(
      fc.property(validTripName, (name) => {
        const input = { name };

        expect(schemaAccepts(input)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('should accept same day (end == start)', () => {
    fc.assert(
      fc.property(validTripName, isoDateArbitrary, (name, date) => {
        const input = {
          name,
          start_date: date,
          end_date: date,
        };

        expect(schemaAccepts(input)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });
});
