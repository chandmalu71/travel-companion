import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { hasTimeOverlap } from '../../gap-detector.js';

/**
 * Property 14: Scheduling Conflict Detection
 *
 * For any set of events with start/end times on the same day,
 * a conflict is identified iff two events have overlapping time intervals:
 *   event1.start < event2.end AND event2.start < event1.end
 *
 * **Validates: Requirements 22.3**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a time on a fixed day (2025-06-15) as a Date */
const timeOnDay = fc
  .tuple(
    fc.integer({ min: 0, max: 23 }),
    fc.integer({ min: 0, max: 59 }),
  )
  .map(([hour, minute]) => new Date(`2025-06-15T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`));

/** Generate a time interval (start, end) where end > start */
const timeInterval = fc
  .tuple(
    fc.integer({ min: 0, max: 1380 }), // minutes from midnight (0-23*60)
    fc.integer({ min: 1, max: 480 }), // duration in minutes (1-8 hours)
  )
  .map(([startMinutes, duration]) => {
    const start = new Date('2025-06-15T00:00:00Z');
    start.setMinutes(start.getMinutes() + startMinutes);
    const end = new Date(start);
    end.setMinutes(end.getMinutes() + duration);
    return { start, end };
  });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 14: Scheduling Conflict Detection', () => {
  it('detects overlap iff start1 < end2 AND start2 < end1', () => {
    fc.assert(
      fc.property(timeInterval, timeInterval, (interval1, interval2) => {
        const result = hasTimeOverlap(
          interval1.start,
          interval1.end,
          interval2.start,
          interval2.end,
        );

        const expected =
          interval1.start < interval2.end && interval2.start < interval1.end;

        expect(result).toBe(expected);
      }),
      { numRuns: 1000 },
    );
  });

  it('an event always overlaps with itself', () => {
    fc.assert(
      fc.property(timeInterval, (interval) => {
        const result = hasTimeOverlap(
          interval.start,
          interval.end,
          interval.start,
          interval.end,
        );
        expect(result).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('non-overlapping adjacent intervals do not conflict', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600 }),
        fc.integer({ min: 60, max: 240 }),
        fc.integer({ min: 60, max: 240 }),
        (startMinutes, duration1, duration2) => {
          const start1 = new Date('2025-06-15T00:00:00Z');
          start1.setMinutes(start1.getMinutes() + startMinutes);
          const end1 = new Date(start1);
          end1.setMinutes(end1.getMinutes() + duration1);

          // Second interval starts exactly when first ends (adjacent, no overlap)
          const start2 = new Date(end1);
          const end2 = new Date(start2);
          end2.setMinutes(end2.getMinutes() + duration2);

          const result = hasTimeOverlap(start1, end1, start2, end2);
          expect(result).toBe(false);
        },
      ),
      { numRuns: 500 },
    );
  });

  it('overlap is symmetric', () => {
    fc.assert(
      fc.property(timeInterval, timeInterval, (interval1, interval2) => {
        const forward = hasTimeOverlap(
          interval1.start,
          interval1.end,
          interval2.start,
          interval2.end,
        );
        const reverse = hasTimeOverlap(
          interval2.start,
          interval2.end,
          interval1.start,
          interval1.end,
        );

        expect(forward).toBe(reverse);
      }),
      { numRuns: 500 },
    );
  });

  it('a contained interval always overlaps', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 600 }),
        fc.integer({ min: 120, max: 480 }),
        fc.integer({ min: 10, max: 60 }),
        fc.integer({ min: 10, max: 60 }),
        (startMinutes, outerDuration, innerOffset, innerDuration) => {
          fc.pre(innerOffset + innerDuration < outerDuration);

          const outerStart = new Date('2025-06-15T00:00:00Z');
          outerStart.setMinutes(outerStart.getMinutes() + startMinutes);
          const outerEnd = new Date(outerStart);
          outerEnd.setMinutes(outerEnd.getMinutes() + outerDuration);

          const innerStart = new Date(outerStart);
          innerStart.setMinutes(innerStart.getMinutes() + innerOffset);
          const innerEnd = new Date(innerStart);
          innerEnd.setMinutes(innerEnd.getMinutes() + innerDuration);

          const result = hasTimeOverlap(outerStart, outerEnd, innerStart, innerEnd);
          expect(result).toBe(true);
        },
      ),
      { numRuns: 500 },
    );
  });
});
