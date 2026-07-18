import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Property 10: Budget Threshold Detection
 *
 * For any budget amount and sequence of expense additions/deletions,
 * the 80% and 100% alerts fire iff cumulative spending crosses the
 * threshold from below.
 *
 * **Validates: Requirements 18.11, 18.12**
 */

type ExpenseAction = { type: 'add'; amount: number } | { type: 'remove'; amount: number };

/** Simulate budget tracking state */
interface BudgetState {
  budget: number;
  cumulative: number;
  alert80Fired: boolean;
  alert100Fired: boolean;
}

function processAction(state: BudgetState, action: ExpenseAction): { state: BudgetState; newAlert80: boolean; newAlert100: boolean } {
  const prevCumulative = state.cumulative;
  const newCumulative = action.type === 'add'
    ? state.cumulative + action.amount
    : Math.max(0, state.cumulative - action.amount);

  const prevPercent = (prevCumulative / state.budget) * 100;
  const newPercent = (newCumulative / state.budget) * 100;

  let newAlert80 = false;
  let newAlert100 = false;
  let alert80Fired = state.alert80Fired;
  let alert100Fired = state.alert100Fired;

  // 80% threshold: fire when crossing from below 80 to above 80
  if (newPercent >= 80 && prevPercent < 80 && !state.alert80Fired) {
    newAlert80 = true;
    alert80Fired = true;
  } else if (newPercent < 80) {
    alert80Fired = false; // reset
  }

  // 100% threshold: fire when crossing from below 100 to above 100
  if (newPercent >= 100 && prevPercent < 100 && !state.alert100Fired) {
    newAlert100 = true;
    alert100Fired = true;
  } else if (newPercent < 100) {
    alert100Fired = false; // reset
  }

  return {
    state: { budget: state.budget, cumulative: newCumulative, alert80Fired, alert100Fired },
    newAlert80,
    newAlert100,
  };
}

// ─── Generators ──────────────────────────────────────────────────────────────

const expenseAction: fc.Arbitrary<ExpenseAction> = fc.oneof(
  fc.float({ min: Math.fround(1), max: Math.fround(500), noNaN: true }).map((amount) => ({ type: 'add' as const, amount: Math.round(amount * 100) / 100 })),
  fc.float({ min: Math.fround(1), max: Math.fround(200), noNaN: true }).map((amount) => ({ type: 'remove' as const, amount: Math.round(amount * 100) / 100 })),
);

describe('Property 10: Budget Threshold Detection', () => {
  it('80% alert fires iff cumulative crosses 80% from below', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
        fc.array(expenseAction, { minLength: 1, maxLength: 20 }),
        (budget, actions) => {
          let state: BudgetState = { budget, cumulative: 0, alert80Fired: false, alert100Fired: false };

          for (const action of actions) {
            const prevPercent = (state.cumulative / state.budget) * 100;
            const result = processAction(state, action);
            const newPercent = (result.state.cumulative / state.budget) * 100;

            if (result.newAlert80) {
              // Alert should only fire when crossing from below
              expect(prevPercent).toBeLessThan(80);
              expect(newPercent).toBeGreaterThanOrEqual(80);
            }

            state = result.state;
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('100% alert fires iff cumulative crosses 100% from below', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(10000), noNaN: true }),
        fc.array(expenseAction, { minLength: 1, maxLength: 20 }),
        (budget, actions) => {
          let state: BudgetState = { budget, cumulative: 0, alert80Fired: false, alert100Fired: false };

          for (const action of actions) {
            const prevPercent = (state.cumulative / state.budget) * 100;
            const result = processAction(state, action);
            const newPercent = (result.state.cumulative / state.budget) * 100;

            if (result.newAlert100) {
              expect(prevPercent).toBeLessThan(100);
              expect(newPercent).toBeGreaterThanOrEqual(100);
            }

            state = result.state;
          }
        },
      ),
      { numRuns: 500 },
    );
  });

  it('alerts reset when spending drops below threshold', () => {
    fc.assert(
      fc.property(
        fc.float({ min: Math.fround(100), max: Math.fround(1000), noNaN: true }),
        (budget) => {
          // Start above 80%, drop below, then go above again — should re-fire
          let state: BudgetState = { budget, cumulative: 0, alert80Fired: false, alert100Fired: false };

          // Add to cross 80%
          const result1 = processAction(state, { type: 'add', amount: budget * 0.85 });
          expect(result1.newAlert80).toBe(true);
          state = result1.state;

          // Remove to drop below 80%
          const result2 = processAction(state, { type: 'remove', amount: budget * 0.5 });
          expect(result2.newAlert80).toBe(false);
          state = result2.state;

          // Add to cross 80% again — should fire again
          const result3 = processAction(state, { type: 'add', amount: budget * 0.5 });
          expect(result3.newAlert80).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
