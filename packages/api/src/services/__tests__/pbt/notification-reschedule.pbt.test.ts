import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

/**
 * Feature: travel-companion, Property 15: Notification Rescheduling
 *
 * For any booking time change (eventTime) and user reminder offset (15–4320 minutes),
 * the rescheduled fire_at SHALL equal eventTime - offset when that time is in the
 * future, or now + 5 minutes when eventTime - offset would be in the past.
 *
 * **Validates: Requirements 10.5, 10.7**
 */

// ─── Pure Logic Under Test ───────────────────────────────────────────────────

/** Maximum delay (in minutes) for scheduling past-due reminders */
const PAST_DUE_DELAY_MINUTES = 5;

/**
 * Pure calculation of notification fire_at time.
 * Extracted from NotificationScheduler for property testing.
 *
 * @param eventTime - The booking event time (e.g., flight departure)
 * @param offsetMinutes - User's reminder offset in minutes (15–4320)
 * @param now - The current reference time
 * @returns The calculated fire_at Date
 */
function calculateFireAt(eventTime: Date, offsetMinutes: number, now: Date): Date {
  const fireAt = new Date(eventTime.getTime() - offsetMinutes * 60 * 1000);
  if (fireAt.getTime() < now.getTime()) {
    return new Date(now.getTime() + PAST_DUE_DELAY_MINUTES * 60 * 1000);
  }
  return fireAt;
}

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generates valid dates within a reasonable range (2024–2026) */
const dateInRange = fc
  .date({
    min: new Date('2024-01-01T00:00:00Z'),
    max: new Date('2026-12-31T23:59:59Z'),
    noInvalidDate: true,
  })
  .filter((d) => !isNaN(d.getTime()));

/** Reminder offset in minutes: 15 min to 4320 min (3 days) */
const offsetMinutes = fc.integer({ min: 15, max: 4320 });

/**
 * Generates a triplet (eventTime, offset, now) where eventTime - offset >= now
 * (i.e., the fire_at is NOT in the past).
 */
const futureFireAtScenario = fc
  .tuple(dateInRange, offsetMinutes, dateInRange)
  .filter(([eventTime, offset, now]) => {
    const fireAt = eventTime.getTime() - offset * 60 * 1000;
    return fireAt >= now.getTime();
  });

/**
 * Generates a triplet (eventTime, offset, now) where eventTime - offset < now
 * (i.e., the fire_at IS in the past).
 */
const pastFireAtScenario = fc
  .tuple(dateInRange, offsetMinutes, dateInRange)
  .filter(([eventTime, offset, now]) => {
    const fireAt = eventTime.getTime() - offset * 60 * 1000;
    return fireAt < now.getTime();
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 15: Notification Rescheduling', () => {
  it('when fire_at is not in the past: result equals eventTime - offset exactly', () => {
    fc.assert(
      fc.property(futureFireAtScenario, ([eventTime, offset, now]) => {
        const result = calculateFireAt(eventTime, offset, now);
        const expected = new Date(eventTime.getTime() - offset * 60 * 1000);

        expect(result.getTime()).toBe(expected.getTime());
      }),
      { numRuns: 500 },
    );
  });

  it('when fire_at would be in the past: result equals now + 5 minutes', () => {
    fc.assert(
      fc.property(pastFireAtScenario, ([eventTime, offset, now]) => {
        const result = calculateFireAt(eventTime, offset, now);
        const expected = new Date(now.getTime() + PAST_DUE_DELAY_MINUTES * 60 * 1000);

        expect(result.getTime()).toBe(expected.getTime());
      }),
      { numRuns: 500 },
    );
  });

  it('result is always >= now (fire_at is never in the past)', () => {
    fc.assert(
      fc.property(
        dateInRange,
        offsetMinutes,
        dateInRange,
        (eventTime, offset, now) => {
          const result = calculateFireAt(eventTime, offset, now);

          expect(result.getTime()).toBeGreaterThanOrEqual(now.getTime());
        },
      ),
      { numRuns: 500 },
    );
  });

  it('for non-past-due cases: fire_at <= eventTime (offset is always subtracted)', () => {
    fc.assert(
      fc.property(futureFireAtScenario, ([eventTime, offset, now]) => {
        const result = calculateFireAt(eventTime, offset, now);

        expect(result.getTime()).toBeLessThanOrEqual(eventTime.getTime());
      }),
      { numRuns: 500 },
    );
  });
});
