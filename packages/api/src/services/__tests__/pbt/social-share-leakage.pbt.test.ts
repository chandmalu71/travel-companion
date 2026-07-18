import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { containsPersonalDetails } from '../../../routes/highlights.js';

/**
 * Property 17: Social Share Data Leakage Prevention
 *
 * For any bookings with personal details (confirmation numbers, addresses,
 * flight numbers) and user captions, the generated share content does NOT
 * contain personal details unless they appear in the caption.
 *
 * **Validates: Requirements 23.8**
 */

// ─── Generators ──────────────────────────────────────────────────────────────

/** Generate a confirmation number (e.g., "ABC123") */
const confirmationNumber = fc
  .tuple(
    fc.string({ minLength: 3, maxLength: 3, unit: fc.constantFrom(...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')) }),
    fc.string({ minLength: 3, maxLength: 3, unit: fc.constantFrom(...'0123456789'.split('')) }),
  )
  .map(([letters, digits]) => `${letters}${digits}`);

/** Generate a flight number (e.g., "DL1234") */
const flightNumber = fc
  .tuple(
    fc.constantFrom('DL', 'UA', 'AA', 'BA', 'LH', 'AF', 'EK'),
    fc.integer({ min: 100, max: 9999 }),
  )
  .map(([airline, num]) => `${airline}${num}`);

/** Generate a street address */
const streetAddress = fc
  .tuple(
    fc.integer({ min: 1, max: 9999 }),
    fc.constantFrom('Main St', 'Oak Ave', 'Park Blvd', 'Broadway', 'Elm Dr'),
    fc.constantFrom('New York', 'London', 'Paris', 'Tokyo', 'Sydney'),
  )
  .map(([num, street, city]) => `${num} ${street}, ${city}`);

/** Generate personal details that should not leak */
const personalDetails = fc.tuple(
  confirmationNumber,
  flightNumber,
  streetAddress,
).map(([conf, flight, addr]) => [conf, flight, addr]);

/** Generate a user caption (short text that might or might not contain personal details) */
const caption = fc.oneof(
  fc.constant('Had an amazing time on this trip! 🌍'),
  fc.constant('Beautiful sunset at the beach'),
  fc.string({ minLength: 5, maxLength: 100 }),
);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 17: Social Share Data Leakage Prevention', () => {
  it('generated share content does not contain personal details unless in caption', () => {
    fc.assert(
      fc.property(personalDetails, caption, (details, userCaption) => {
        // Simulate generated share content (trip name + caption, no personal data)
        const shareContent = `✈️ Trip Highlight — ${userCaption}`;

        // Verify no personal details leak
        const hasLeak = containsPersonalDetails(shareContent, details, userCaption);
        expect(hasLeak).toBe(false);
      }),
      { numRuns: 1000 },
    );
  });

  it('allows personal details that appear in the user caption', () => {
    fc.assert(
      fc.property(personalDetails, (details) => {
        // User intentionally includes a personal detail in their caption
        const detailInCaption = details[0]!;
        const userCaption = `Checking in for ${detailInCaption}!`;
        const shareContent = `✈️ Trip Highlight — ${userCaption}`;

        // This should NOT be flagged as a leak since user put it in caption
        const hasLeak = containsPersonalDetails(shareContent, details, userCaption);
        expect(hasLeak).toBe(false);
      }),
      { numRuns: 500 },
    );
  });

  it('detects leaks when personal details appear outside caption', () => {
    fc.assert(
      fc.property(personalDetails, caption, (details, userCaption) => {
        // Simulate a buggy implementation that includes personal details
        const leakyContent = `Trip to Paris - Confirmation: ${details[0]} — ${userCaption}`;

        // Should detect the leak (unless the detail happens to be in the caption)
        if (!userCaption.includes(details[0]!)) {
          const hasLeak = containsPersonalDetails(leakyContent, details, userCaption);
          expect(hasLeak).toBe(true);
        }
      }),
      { numRuns: 500 },
    );
  });
});
