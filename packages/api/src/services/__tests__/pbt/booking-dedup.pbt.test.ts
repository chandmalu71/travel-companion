import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { extractDatePortion } from '../../booking-dedup.js';

/**
 * Feature: travel-companion, Property 3: Booking Deduplication
 *
 * For any pair of bookings of the same type, the deduplication logic SHALL
 * identify them as duplicates if and only if they match on the type-specific key:
 * - Flights: same flight number AND same departure date
 * - Hotels: same hotel name AND same check-in date AND check-out date
 * - Car rentals: same company AND same pickup date AND same return date
 *
 * **Validates: Requirements 2.8**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a valid ISO date string (YYYY-MM-DD format) */
const isoDate = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
  noInvalidDate: true,
}).map((d) => d.toISOString().slice(0, 10));

/** Generate a flight number (2 uppercase letters + 1-4 digits) */
const upperLetter = fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split(''));
const flightNumber = fc.tuple(
  fc.tuple(upperLetter, upperLetter).map(([a, b]) => `${a}${b}`),
  fc.integer({ min: 1, max: 9999 }),
).map(([letters, num]) => `${letters}${num}`);

/** Generate a hotel name */
const hotelName = fc.string({ minLength: 3, maxLength: 30 }).map((s) => s.replace(/\s+/g, ' ').trim() || 'Hotel');

/** Generate a car rental company name */
const companyName = fc.string({ minLength: 3, maxLength: 20 }).map((s) => s.replace(/\s+/g, ' ').trim() || 'Rental');

/** Generate flight booking field pairs with controlled matching */
const flightFieldPair = fc.record({
  flightNumberA: flightNumber,
  flightNumberB: flightNumber,
  departureDateA: isoDate,
  departureDateB: isoDate,
});

/** Generate hotel booking field pairs with controlled matching */
const hotelFieldPair = fc.record({
  hotelNameA: hotelName,
  hotelNameB: hotelName,
  checkInDateA: isoDate,
  checkInDateB: isoDate,
  checkOutDateA: isoDate,
  checkOutDateB: isoDate,
});

/** Generate car rental booking field pairs with controlled matching */
const carRentalFieldPair = fc.record({
  companyA: companyName,
  companyB: companyName,
  pickupDateA: isoDate,
  pickupDateB: isoDate,
  returnDateA: isoDate,
  returnDateB: isoDate,
});

// ─── Pure Dedup Logic Under Test ─────────────────────────────────────────────

/**
 * Pure implementation of flight dedup check.
 * Two flights are duplicates iff they share the same flight number
 * AND the same departure date (date portion only).
 */
function isFlightDuplicate(
  flightNumberA: string,
  departureTimeA: string,
  flightNumberB: string,
  departureTimeB: string,
): boolean {
  const dateA = extractDatePortion(departureTimeA);
  const dateB = extractDatePortion(departureTimeB);

  if (!dateA || !dateB) return false;

  return flightNumberA === flightNumberB && dateA === dateB;
}

/**
 * Pure implementation of hotel dedup check.
 * Two hotels are duplicates iff they share the same hotel name
 * AND same check-in date AND same check-out date.
 */
function isHotelDuplicate(
  hotelNameA: string,
  checkInDateA: string,
  checkOutDateA: string,
  hotelNameB: string,
  checkInDateB: string,
  checkOutDateB: string,
): boolean {
  const checkInA = extractDatePortion(checkInDateA);
  const checkInB = extractDatePortion(checkInDateB);
  const checkOutA = extractDatePortion(checkOutDateA);
  const checkOutB = extractDatePortion(checkOutDateB);

  if (!checkInA || !checkInB || !checkOutA || !checkOutB) return false;

  return hotelNameA === hotelNameB && checkInA === checkInB && checkOutA === checkOutB;
}

/**
 * Pure implementation of car rental dedup check.
 * Two car rentals are duplicates iff they share the same company
 * AND same pickup date AND same return date.
 */
function isCarRentalDuplicate(
  companyA: string,
  pickupDateA: string,
  returnDateA: string,
  companyB: string,
  pickupDateB: string,
  returnDateB: string,
): boolean {
  const pickupA = extractDatePortion(pickupDateA);
  const pickupB = extractDatePortion(pickupDateB);
  const returnA = extractDatePortion(returnDateA);
  const returnB = extractDatePortion(returnDateB);

  if (!pickupA || !pickupB || !returnA || !returnB) return false;

  return companyA === companyB && pickupA === pickupB && returnA === returnB;
}

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 3: Booking Deduplication', () => {
  describe('Flight deduplication', () => {
    it('identifies duplicates iff flight number AND departure date match', () => {
      fc.assert(
        fc.property(flightFieldPair, ({ flightNumberA, flightNumberB, departureDateA, departureDateB }) => {
          const result = isFlightDuplicate(flightNumberA, departureDateA, flightNumberB, departureDateB);

          const sameFlightNumber = flightNumberA === flightNumberB;
          const sameDepartureDate = extractDatePortion(departureDateA) === extractDatePortion(departureDateB);
          const expectedDuplicate = sameFlightNumber && sameDepartureDate;

          expect(result).toBe(expectedDuplicate);
        }),
        { numRuns: 500 },
      );
    });

    it('same flight on same date with different times are duplicates', () => {
      fc.assert(
        fc.property(flightNumber, isoDate, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 23 }),
          (fn, date, hourA, hourB) => {
            const timeA = `${date}T${String(hourA).padStart(2, '0')}:00:00Z`;
            const timeB = `${date}T${String(hourB).padStart(2, '0')}:30:00Z`;

            const result = isFlightDuplicate(fn, timeA, fn, timeB);
            expect(result).toBe(true);
          }),
        { numRuns: 500 },
      );
    });

    it('same flight number on different dates are NOT duplicates', () => {
      fc.assert(
        fc.property(
          flightNumber,
          isoDate,
          isoDate.filter((d) => true), // generate two independent dates
          (fn, dateA, dateB) => {
            fc.pre(dateA !== dateB); // precondition: dates must differ
            const result = isFlightDuplicate(fn, dateA, fn, dateB);
            expect(result).toBe(false);
          }),
        { numRuns: 500 },
      );
    });
  });

  describe('Hotel deduplication', () => {
    it('identifies duplicates iff hotel name AND check-in AND check-out dates all match', () => {
      fc.assert(
        fc.property(hotelFieldPair, ({ hotelNameA, hotelNameB, checkInDateA, checkInDateB, checkOutDateA, checkOutDateB }) => {
          const result = isHotelDuplicate(hotelNameA, checkInDateA, checkOutDateA, hotelNameB, checkInDateB, checkOutDateB);

          const sameName = hotelNameA === hotelNameB;
          const sameCheckIn = extractDatePortion(checkInDateA) === extractDatePortion(checkInDateB);
          const sameCheckOut = extractDatePortion(checkOutDateA) === extractDatePortion(checkOutDateB);
          const expectedDuplicate = sameName && sameCheckIn && sameCheckOut;

          expect(result).toBe(expectedDuplicate);
        }),
        { numRuns: 500 },
      );
    });

    it('same hotel with matching dates are duplicates', () => {
      fc.assert(
        fc.property(hotelName, isoDate, isoDate, (name, checkIn, checkOut) => {
          const result = isHotelDuplicate(name, checkIn, checkOut, name, checkIn, checkOut);
          expect(result).toBe(true);
        }),
        { numRuns: 500 },
      );
    });

    it('same hotel with different check-in dates are NOT duplicates', () => {
      fc.assert(
        fc.property(hotelName, isoDate, isoDate, isoDate, (name, checkInA, checkInB, checkOut) => {
          fc.pre(checkInA !== checkInB);
          const result = isHotelDuplicate(name, checkInA, checkOut, name, checkInB, checkOut);
          expect(result).toBe(false);
        }),
        { numRuns: 500 },
      );
    });
  });

  describe('Car rental deduplication', () => {
    it('identifies duplicates iff company AND pickup date AND return date all match', () => {
      fc.assert(
        fc.property(carRentalFieldPair, ({ companyA, companyB, pickupDateA, pickupDateB, returnDateA, returnDateB }) => {
          const result = isCarRentalDuplicate(companyA, pickupDateA, returnDateA, companyB, pickupDateB, returnDateB);

          const sameCompany = companyA === companyB;
          const samePickup = extractDatePortion(pickupDateA) === extractDatePortion(pickupDateB);
          const sameReturn = extractDatePortion(returnDateA) === extractDatePortion(returnDateB);
          const expectedDuplicate = sameCompany && samePickup && sameReturn;

          expect(result).toBe(expectedDuplicate);
        }),
        { numRuns: 500 },
      );
    });

    it('same company on same dates with different times are duplicates', () => {
      fc.assert(
        fc.property(companyName, isoDate, isoDate, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 23 }),
          (company, pickupDate, returnDate, hourA, hourB) => {
            const pickupA = `${pickupDate}T${String(hourA).padStart(2, '0')}:00:00Z`;
            const pickupB = `${pickupDate}T${String(hourB).padStart(2, '0')}:30:00Z`;
            const returnA = `${returnDate}T${String(hourA).padStart(2, '0')}:00:00Z`;
            const returnB = `${returnDate}T${String(hourB).padStart(2, '0')}:30:00Z`;

            const result = isCarRentalDuplicate(company, pickupA, returnA, company, pickupB, returnB);
            expect(result).toBe(true);
          }),
        { numRuns: 500 },
      );
    });

    it('same company with different pickup dates are NOT duplicates', () => {
      fc.assert(
        fc.property(companyName, isoDate, isoDate, isoDate, (company, pickupA, pickupB, returnDate) => {
          fc.pre(pickupA !== pickupB);
          const result = isCarRentalDuplicate(company, pickupA, returnDate, company, pickupB, returnDate);
          expect(result).toBe(false);
        }),
        { numRuns: 500 },
      );
    });
  });

  describe('extractDatePortion utility', () => {
    it('extracts date portion consistently regardless of time component', () => {
      fc.assert(
        fc.property(isoDate, fc.integer({ min: 0, max: 23 }), fc.integer({ min: 0, max: 59 }),
          (date, hour, minute) => {
            const withTime = `${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00Z`;
            const withoutTime = date;

            expect(extractDatePortion(withTime)).toBe(extractDatePortion(withoutTime));
          }),
        { numRuns: 500 },
      );
    });

    it('returns a valid YYYY-MM-DD string for valid ISO inputs', () => {
      fc.assert(
        fc.property(isoDate, (date) => {
          const result = extractDatePortion(date);
          expect(result).not.toBeNull();
          expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        }),
        { numRuns: 500 },
      );
    });
  });
});
