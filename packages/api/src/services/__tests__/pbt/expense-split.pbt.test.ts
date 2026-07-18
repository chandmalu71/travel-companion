import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { splitEqually, calculateNetBalances } from '../../../routes/expense-groups.js';

/**
 * Property 11: Equal Expense Split Conservation
 *
 * For any positive amount and group size (N >= 2), equal split member
 * amounts sum to original (within 1 cent). For percentage splits,
 * percentages sum to 100.
 *
 * **Validates: Requirements 21.2, 21.7**
 */

describe('Property 11: Equal Expense Split Conservation', () => {
  it('equal split amounts sum to original total (within 1 cent)', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        (totalAmount, groupSize) => {
          fc.pre(totalAmount > 0 && isFinite(totalAmount));
          const rounded = Math.round(totalAmount * 100) / 100;

          const memberIds = Array.from({ length: groupSize }, (_, i) => `user-${i}`);
          const splits = splitEqually(rounded, memberIds);

          const sum = splits.reduce((acc, s) => acc + s.amount, 0);
          expect(Math.abs(sum - rounded)).toBeLessThanOrEqual(0.01);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('each split amount differs by at most 1 cent from average', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        (totalAmount, groupSize) => {
          fc.pre(totalAmount > 0 && isFinite(totalAmount));
          const rounded = Math.round(totalAmount * 100) / 100;

          const memberIds = Array.from({ length: groupSize }, (_, i) => `user-${i}`);
          const splits = splitEqually(rounded, memberIds);
          const average = rounded / groupSize;

          for (const split of splits) {
            expect(Math.abs(split.amount - average)).toBeLessThanOrEqual(0.01);
          }
        },
      ),
      { numRuns: 1000 },
    );
  });

  it('all members receive a split', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(0.01), max: Math.fround(100000), noNaN: true }),
        fc.integer({ min: 2, max: 20 }),
        (totalAmount, groupSize) => {
          fc.pre(totalAmount > 0 && isFinite(totalAmount));
          const rounded = Math.round(totalAmount * 100) / 100;

          const memberIds = Array.from({ length: groupSize }, (_, i) => `user-${i}`);
          const splits = splitEqually(rounded, memberIds);

          expect(splits.length).toBe(groupSize);
          const splitUserIds = splits.map((s) => s.userId);
          for (const id of memberIds) {
            expect(splitUserIds).toContain(id);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

/**
 * Property 12: Group Balance Zero-Sum
 *
 * For any group with sets of shared expenses and splits, the sum of all
 * net balances across all members equals zero.
 *
 * **Validates: Requirements 21.5**
 */

describe('Property 12: Group Balance Zero-Sum', () => {
  it('sum of all net balances equals zero', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 8 }),
        fc.array(
          fc.record({
            payerIndex: fc.integer({ min: 0, max: 7 }),
            amount: fc.float({ min: Math.fround(0.01), max: Math.fround(1000), noNaN: true }).map((n) => Math.round(n * 100) / 100),
          }),
          { minLength: 1, maxLength: 15 },
        ),
        (groupSize, expenses) => {
          const members = Array.from({ length: groupSize }, (_, i) => ({
            user_id: `user-${i}`,
            display_name: `User ${i}`,
          }));

          // Generate splits (equal split for each expense)
          const splits: Array<{
            user_id: string;
            amount: number;
            payer_id: string;
            converted_amount: number | null;
          }> = [];

          for (const expense of expenses) {
            const payerIndex = expense.payerIndex % groupSize;
            const payerId = `user-${payerIndex}`;
            const perPerson = Math.round((expense.amount / groupSize) * 100) / 100;

            for (let i = 0; i < groupSize; i++) {
              splits.push({
                user_id: `user-${i}`,
                amount: perPerson,
                payer_id: payerId,
                converted_amount: expense.amount,
              });
            }
          }

          const balances = calculateNetBalances(members, splits);
          const totalNetBalance = balances.reduce((sum, b) => sum + b.netBalance, 0);

          // Sum of net balances should be zero (within floating point tolerance)
          expect(Math.abs(totalNetBalance)).toBeLessThan(0.02);
        },
      ),
      { numRuns: 500 },
    );
  });
});
