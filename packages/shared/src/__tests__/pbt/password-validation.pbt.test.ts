/**
 * Property-Based Test: Password Validation
 *
 * Feature: travel-companion, Property 1: Registration Input Validation
 *
 * For any string, the password validation function SHALL accept it if and only if
 * it has length between 8 and 128 characters AND contains at least one uppercase letter,
 * one lowercase letter, and one digit. All other strings SHALL be rejected.
 *
 * **Validates: Requirements 1.1, 1.8**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';

import { passwordSchema } from '../../validators';
import { LIMITS } from '../../constants';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Reference implementation for password validity. A password is valid iff:
 * - Length is between 8 and 128 characters (inclusive)
 * - Contains at least one uppercase letter [A-Z]
 * - Contains at least one lowercase letter [a-z]
 * - Contains at least one digit [0-9]
 */
function isValidPassword(s: string): boolean {
  return (
    s.length >= LIMITS.PASSWORD_MIN_LENGTH &&
    s.length <= LIMITS.PASSWORD_MAX_LENGTH &&
    /[A-Z]/.test(s) &&
    /[a-z]/.test(s) &&
    /\d/.test(s)
  );
}

/**
 * Checks if the Zod passwordSchema accepts a given string.
 */
function schemaAccepts(s: string): boolean {
  const result = passwordSchema.safeParse(s);
  return result.success;
}

// ─── Generators ──────────────────────────────────────────────────────────────

/** Single uppercase letter arbitrary */
const uppercaseChar = fc.stringMatching(/^[A-Z]$/).map((s) => s[0]);

/** Single lowercase letter arbitrary */
const lowercaseChar = fc.stringMatching(/^[a-z]$/).map((s) => s[0]);

/** Single digit arbitrary */
const digitChar = fc.stringMatching(/^[0-9]$/).map((s) => s[0]);

/** Printable ASCII character arbitrary */
const anyPrintable = fc.stringMatching(/^[\x20-\x7e]$/).map((s) => s[0]);

/**
 * Generates a valid password: length 8-128 with at least one uppercase, lowercase, and digit.
 * Strategy: generate required chars + filler, then combine them.
 */
const validPasswordArbitrary = fc
  .tuple(
    fc.integer({ min: LIMITS.PASSWORD_MIN_LENGTH, max: LIMITS.PASSWORD_MAX_LENGTH }),
    uppercaseChar,
    lowercaseChar,
    digitChar
  )
  .chain(([targetLength, upper, lower, digit]) => {
    const fillerLength = Math.max(0, targetLength - 3);
    return fc
      .array(anyPrintable, { minLength: fillerLength, maxLength: fillerLength })
      .map((fillerChars) => {
        // Combine required chars with filler
        const allChars = [upper, lower, digit, ...fillerChars];
        // Distribute required chars at positions throughout the string
        const result = [...fillerChars];
        const pos1 = 0;
        const pos2 = Math.floor(result.length / 2);
        const pos3 = result.length;
        result.splice(pos1, 0, upper);
        result.splice(pos2 + 1, 0, lower);
        result.splice(pos3 + 2, 0, digit);
        return result.join('');
      });
  });

/**
 * Generates a string that is too short (< 8 chars).
 */
const tooShortArbitrary = fc.string({
  minLength: 0,
  maxLength: LIMITS.PASSWORD_MIN_LENGTH - 1,
});

/**
 * Generates a string that is too long (> 128 chars).
 */
const tooLongArbitrary = fc.string({
  minLength: LIMITS.PASSWORD_MAX_LENGTH + 1,
  maxLength: LIMITS.PASSWORD_MAX_LENGTH + 50,
});

/**
 * Generates a string of valid length (8-128) but only lowercase letters (no uppercase, no digit).
 */
const onlyLowercaseArbitrary = fc.stringMatching(/^[a-z]{8,128}$/);

/**
 * Generates a string of valid length (8-128) but only uppercase letters (no lowercase, no digit).
 */
const onlyUppercaseArbitrary = fc.stringMatching(/^[A-Z]{8,128}$/);

/**
 * Generates a string of valid length (8-128) but only digits (no uppercase, no lowercase).
 */
const onlyDigitsArbitrary = fc.stringMatching(/^[0-9]{8,128}$/);

/**
 * Generates a string of valid length with lowercase + digits but no uppercase.
 */
const noUppercaseArbitrary = fc.stringMatching(/^[a-z0-9]{8,128}$/);

/**
 * Generates a string of valid length with uppercase + digits but no lowercase.
 */
const noLowercaseArbitrary = fc.stringMatching(/^[A-Z0-9]{8,128}$/);

/**
 * Generates a string of valid length with uppercase + lowercase but no digit.
 */
const noDigitArbitrary = fc.stringMatching(/^[A-Za-z]{8,128}$/);

// ─── Property Tests ──────────────────────────────────────────────────────────

describe('Property 1: Registration Input Validation (Password)', () => {
  it('should accept any string that meets ALL criteria (length 8-128, has upper, lower, digit)', () => {
    fc.assert(
      fc.property(validPasswordArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(true);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings that are too short (< 8 chars)', () => {
    fc.assert(
      fc.property(tooShortArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings that are too long (> 128 chars)', () => {
    fc.assert(
      fc.property(tooLongArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings with only lowercase letters (missing uppercase and digit)', () => {
    fc.assert(
      fc.property(onlyLowercaseArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings with only uppercase letters (missing lowercase and digit)', () => {
    fc.assert(
      fc.property(onlyUppercaseArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings with only digits (missing uppercase and lowercase)', () => {
    fc.assert(
      fc.property(onlyDigitsArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings of valid length with no uppercase letter', () => {
    fc.assert(
      fc.property(noUppercaseArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings of valid length with no lowercase letter', () => {
    fc.assert(
      fc.property(noLowercaseArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('should reject strings of valid length with no digit', () => {
    fc.assert(
      fc.property(noDigitArbitrary, (password) => {
        expect(schemaAccepts(password)).toBe(false);
      }),
      { numRuns: 1000 }
    );
  });

  it('schema accepts iff reference isValidPassword agrees (arbitrary strings)', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 200 }), (password) => {
        expect(schemaAccepts(password)).toBe(isValidPassword(password));
      }),
      { numRuns: 2000 }
    );
  });
});
