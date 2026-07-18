import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { calculateBookingStatus } from '../../bookings.js';

/**
 * Feature: travel-companion, Property 4: Booking Status Calculation
 *
 * For any booking with a start datetime and end datetime, and any current datetime,
 * the status function SHALL return "upcoming" if current < start, "in-progress" if
 * start <= current <= end, and "completed" if current > end.
 *
 * **Validates: Requirements 3.3**
 */

/**
 * Helper: generate a pair of dates where start <= end.
 */
const startEndDatePair = fc
  .tuple(fc.date(), fc.date())
  .map(([a, b]) => (a <= b ? { start: a, end: b } : { start: b, end: a }));

/**
 * Helper: build a flight booking object for the calculateBookingStatus function.
 */
function makeFlightBooking(start: Date, end: Date) {
  return {
    type: 'flight' as const,
    flight_details: {
      departure_time: start,
      arrival_time: end,
    },
  };
}

describe('Property 4: Booking Status Calculation', () => {
  it('status is "upcoming" iff now < departure_time (flight)', () => {
    fc.assert(
      fc.property(startEndDatePair, fc.date(), ({ start, end }, current) => {
        // Only test valid cases where current < start
        fc.pre(current.getTime() < start.getTime());

        const status = calculateBookingStatus(makeFlightBooking(start, end), current);
        expect(status).toBe('upcoming');
      }),
      { numRuns: 1000 },
    );
  });

  it('status is "in-progress" iff departure_time <= now <= arrival_time (flight)', () => {
    fc.assert(
      fc.property(startEndDatePair, fc.date(), ({ start, end }, current) => {
        // Only test valid cases where start <= current <= end
        fc.pre(current.getTime() >= start.getTime() && current.getTime() <= end.getTime());

        const status = calculateBookingStatus(makeFlightBooking(start, end), current);
        expect(status).toBe('in-progress');
      }),
      { numRuns: 1000 },
    );
  });

  it('status is "completed" iff now > arrival_time (flight)', () => {
    fc.assert(
      fc.property(startEndDatePair, fc.date(), ({ start, end }, current) => {
        // Only test valid cases where current > end
        fc.pre(current.getTime() > end.getTime());

        const status = calculateBookingStatus(makeFlightBooking(start, end), current);
        expect(status).toBe('completed');
      }),
      { numRuns: 1000 },
    );
  });

  it('the three states partition the timeline for any booking with valid start/end', () => {
    fc.assert(
      fc.property(startEndDatePair, fc.date(), ({ start, end }, current) => {
        const status = calculateBookingStatus(makeFlightBooking(start, end), current);

        // The status must be exactly one of the three valid values
        expect(['upcoming', 'in-progress', 'completed']).toContain(status);

        // Verify it matches the expected partition
        if (current.getTime() < start.getTime()) {
          expect(status).toBe('upcoming');
        } else if (current.getTime() > end.getTime()) {
          expect(status).toBe('completed');
        } else {
          expect(status).toBe('in-progress');
        }
      }),
      { numRuns: 1000 },
    );
  });

  it('boundary: now == start → "in-progress", now == end → "in-progress"', () => {
    fc.assert(
      fc.property(startEndDatePair, ({ start, end }) => {
        // Test boundary: current exactly equals start
        const statusAtStart = calculateBookingStatus(makeFlightBooking(start, end), new Date(start.getTime()));
        expect(statusAtStart).toBe('in-progress');

        // Test boundary: current exactly equals end
        const statusAtEnd = calculateBookingStatus(makeFlightBooking(start, end), new Date(end.getTime()));
        expect(statusAtEnd).toBe('in-progress');
      }),
      { numRuns: 1000 },
    );
  });
});
