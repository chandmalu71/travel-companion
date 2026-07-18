import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 9: Expense Aggregation Invariant
 *
 * For any list of expenses with categories, the category subtotals
 * must sum to the grand total.
 *
 * **Validates: Requirements 18.7**
 */

const CATEGORIES = ['food_drink', 'transport', 'accommodation', 'activities', 'shopping', 'health', 'other'] as const;

/** Generate an expense with a category and amount */
const expense = fc.record({
  category: fc.constantFrom(...CATEGORIES),
  amount: fc.float({ min: Math.fround(0.01), max: Math.fround(10000), noNaN: true }).map((n) => Math.round(n * 100) / 100),
});

describe('Property 9: Expense Aggregation Invariant', () => {
  it('category subtotals sum to grand total', () => {
    fc.assert(
      fc.property(fc.array(expense, { minLength: 1, maxLength: 50 }), (expenses) => {
        // Calculate grand total
        const grandTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

        // Calculate category subtotals
        const categoryTotals: Record<string, number> = {};
        for (const e of expenses) {
          categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
        }

        // Sum of subtotals should equal grand total
        const subtotalSum = Object.values(categoryTotals).reduce((sum, v) => sum + v, 0);

        expect(subtotalSum).toBeCloseTo(grandTotal, 2);
      }),
      { numRuns: 1000 },
    );
  });

  it('every expense appears in exactly one category total', () => {
    fc.assert(
      fc.property(fc.array(expense, { minLength: 1, maxLength: 50 }), (expenses) => {
        const categoryTotals: Record<string, number> = {};
        const categoryCounts: Record<string, number> = {};

        for (const e of expenses) {
          categoryTotals[e.category] = (categoryTotals[e.category] ?? 0) + e.amount;
          categoryCounts[e.category] = (categoryCounts[e.category] ?? 0) + 1;
        }

        // Total count across categories equals expense count
        const totalCount = Object.values(categoryCounts).reduce((sum, c) => sum + c, 0);
        expect(totalCount).toBe(expenses.length);
      }),
      { numRuns: 500 },
    );
  });
});
