import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { convertAmount } from '../../currency.js';

/**
 * Property 8: Currency Conversion Correctness
 *
 * For any positive amount, currency pair, and rate:
 * - conversion = amount × rate rounded to 2 decimal places
 * - result is always positive
 *
 * **Validates: Requirements 14.1**
 */

describe('Property 8: Currency Conversion Correctness', () => {
  it('conversion equals amount × rate rounded to 2 decimal places', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(999999), noNaN: true }),
        fc.float({ min: Math.fround(0.0001), max: Math.fround(10000), noNaN: true }),
        (amount, rate) => {
          fc.pre(amount > 0 && rate > 0 && isFinite(amount) && isFinite(rate));

          const result = convertAmount(amount, rate);
          const expected = Math.round(amount * rate * 100) / 100;

          expect(result).toBeCloseTo(expected, 2);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('result is always positive for positive inputs', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(1), max: Math.fround(999999), noNaN: true }),
        fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }),
        (amount, rate) => {
          fc.pre(amount > 0 && rate > 0 && isFinite(amount) && isFinite(rate));
          fc.pre(amount * rate >= 0.005); // ensure result rounds to > 0

          const result = convertAmount(amount, rate);
          expect(result).toBeGreaterThan(0);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('converting 1 unit at rate R gives R rounded to 2dp', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.0001), max: Math.fround(10000), noNaN: true }),
        (rate) => {
          fc.pre(rate > 0 && isFinite(rate));

          const result = convertAmount(1, rate);
          const expected = Math.round(rate * 100) / 100;
          expect(result).toBe(expected);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('conversion is commutative via inverse rate (within rounding tolerance)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(10), max: Math.fround(10000), noNaN: true }),
        fc.float({ min: Math.fround(0.5), max: Math.fround(5), noNaN: true }),
        (amount, rate) => {
          fc.pre(amount > 0 && rate > 0 && isFinite(amount) && isFinite(rate));

          const converted = convertAmount(amount, rate);
          const backConverted = convertAmount(converted, 1 / rate);

          // Due to double rounding, allow tolerance proportional to amount
          const tolerance = Math.max(0.02, amount * 0.005);
          expect(Math.abs(backConverted - amount)).toBeLessThanOrEqual(tolerance);
        },
      ),
      { numRuns: 500 },
    );
  });
});
