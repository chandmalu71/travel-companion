import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { isNightCovered } from '../../gap-detector.js';

/**
 * Property 13: Accommodation Gap Detection
 *
 * For any trip date range and set of hotel bookings, the detector reports
 * a gap for each night not covered by any booking's check-in to check-out range.
 *
 * A hotel covers nights from check-in date (inclusive) to check-out date (exclusive).
 *
 * **Validates: Requirements 22.1**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid date string YYYY-MM-DD in a reasonable range */
const dateStr = fc
  .integer({ min: 0, max: 365 })
  .map((offset) => {
    const d = new Date('2025-01-01');
    d.setDate(d.getDate() + offset);
    return d.toISOString().slice(0, 10);
  });

/** Generate a hotel booking (check-in, check-out where check-out > check-in) */
const hotelBooking = fc
  .tuple(
    fc.integer({ min: 0, max: 350 }),
    fc.integer({ min: 1, max: 14 }), // stay duration 1-14 nights
  )
  .map(([startOffset, duration]) => {
    const checkIn = new Date('2025-01-01');
    checkIn.setDate(checkIn.getDate() + startOffset);
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + duration);
    return {
      checkIn: checkIn.toISOString().slice(0, 10),
      checkOut: checkOut.toISOString().slice(0, 10),
    };
  });

/** Generate a list of hotel bookings */
const hotelBookings = fc.array(hotelBooking, { minLength: 0, maxLength: 10 });

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 13: Accommodation Gap Detection', () => {
  it('reports a gap for nights not covered by any hotel booking', () => {
    fc.assert(
      fc.property(dateStr, hotelBookings, (nightDate, bookings) => {
        const covered = isNightCovered(nightDate, bookings);

        // Manually check: is this night covered by any booking?
        const manuallyCovered = bookings.some(
          (b) => nightDate >= b.checkIn && nightDate < b.checkOut,
        );

        expect(covered).toBe(manuallyCovered);
      }),
      { numRuns: 1000 },
    );
  });

  it('check-in night is always covered', () => {
    fc.assert(
      fc.property(hotelBooking, (booking) => {
        const covered = isNightCovered(booking.checkIn, [booking]);
        expect(covered).toBe(true);
      }),
      { numRuns: 500 },
    );
  });

  it('check-out night is never covered (guest leaves that day)', () => {
    fc.assert(
      fc.property(hotelBooking, (booking) => {
        const covered = isNightCovered(booking.checkOut, [booking]);
        expect(covered).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('with no bookings, no night is covered', () => {
    fc.assert(
      fc.property(dateStr, (nightDate) => {
        const covered = isNightCovered(nightDate, []);
        expect(covered).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('overlapping bookings still cover all their nights', () => {
    fc.assert(
      fc.property(
        fc.tuple(hotelBooking, hotelBooking),
        ([booking1, booking2]) => {
          const bookings = [booking1, booking2];

          // Every night within either booking's range should be covered
          const allNights = getAllNightsInRange(booking1.checkIn, booking1.checkOut);
          for (const night of allNights) {
            expect(isNightCovered(night, bookings)).toBe(true);
          }
        },
      ),
      { numRuns: 500 },
    );
  });
});

// ─── Helper ──────────────────────────────────────────────────────────────────

function getAllNightsInRange(checkIn: string, checkOut: string): string[] {
  const nights: string[] = [];
  const current = new Date(checkIn);
  const end = new Date(checkOut);

  while (current < end) {
    nights.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }

  return nights;
}
