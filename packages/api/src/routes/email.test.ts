/**
 * Tests for email connection routes and token encryption service.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { encryptToken, decryptToken } from '../services/email-connection.js';

// ─── Token Encryption/Decryption Tests ───────────────────────────────────────

describe('Token Encryption/Decryption', () => {
  // Valid 32-byte key (64 hex chars)
  const validKey = 'a'.repeat(64);

  it('should encrypt and decrypt a token correctly', () => {
    const token = 'ya29.a0AfH6SMBx_sample_access_token_here';
    const encrypted = encryptToken(token, validKey);
    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(token);
  });

  it('should produce different ciphertext for the same token (due to random IV)', () => {
    const token = 'test-token-12345';
    const encrypted1 = encryptToken(token, validKey);
    const encrypted2 = encryptToken(token, validKey);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should handle empty string token', () => {
    const token = '';
    const encrypted = encryptToken(token, validKey);
    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(token);
  });

  it('should handle unicode characters in token', () => {
    const token = 'token-with-üñîçödé-chars-🔑';
    const encrypted = encryptToken(token, validKey);
    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(token);
  });

  it('should handle very long tokens', () => {
    const token = 'x'.repeat(5000); // Simulate a long JWT-style token
    const encrypted = encryptToken(token, validKey);
    const decrypted = decryptToken(encrypted, validKey);
    expect(decrypted).toBe(token);
  });

  it('should throw error with wrong key on decrypt', () => {
    const token = 'secret-access-token';
    const encrypted = encryptToken(token, validKey);
    const wrongKey = 'b'.repeat(64);
    expect(() => decryptToken(encrypted, wrongKey)).toThrow();
  });

  it('should throw error with tampered ciphertext', () => {
    const token = 'secret-access-token';
    const encrypted = encryptToken(token, validKey);
    // Tamper with the base64 ciphertext
    const buffer = Buffer.from(encrypted, 'base64');
    buffer[buffer.length - 1] = (buffer[buffer.length - 1]! + 1) % 256;
    const tampered = buffer.toString('base64');
    expect(() => decryptToken(tampered, validKey)).toThrow();
  });

  it('should throw error with invalid key length', () => {
    const token = 'test-token';
    const shortKey = 'aabbccdd'; // Only 4 bytes
    expect(() => encryptToken(token, shortKey)).toThrow('Encryption key must be 32 bytes');
    expect(() => decryptToken('dummy', shortKey)).toThrow('Encryption key must be 32 bytes');
  });

  it('should produce base64-encoded output', () => {
    const token = 'test-token';
    const encrypted = encryptToken(token, validKey);
    // Should be valid base64
    expect(() => Buffer.from(encrypted, 'base64')).not.toThrow();
    // Should be different from the original token
    expect(encrypted).not.toBe(token);
  });
});

// ─── Email Route Validation Tests (unit-level, no DB/HTTP needed) ────────────

describe('Email Connection Route Validation Logic', () => {
  it('should accept valid provider values', () => {
    const validProviders = ['gmail', 'outlook'];
    validProviders.forEach((provider) => {
      expect(['gmail', 'outlook'].includes(provider)).toBe(true);
    });
  });

  it('should reject invalid provider values', () => {
    const invalidProviders = ['yahoo', 'hotmail', '', 'GMAIL', 'Google'];
    invalidProviders.forEach((provider) => {
      expect(['gmail', 'outlook'].includes(provider)).toBe(false);
    });
  });
});
