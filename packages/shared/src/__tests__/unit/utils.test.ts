import { describe, it, expect } from 'vitest';

import { formatDate, formatDateTime, formatTime, formatRelativeTime, formatCurrency, convertCurrency } from '../../utils';

describe('formatDate', () => {
  it('formats a date string correctly', () => {
    const result = formatDate('2024-03-15');
    expect(result).toBe('Mar 15, 2024');
  });

  it('returns the original string for invalid dates', () => {
    const result = formatDate('not-a-date');
    expect(result).toBe('not-a-date');
  });
});

describe('formatDateTime', () => {
  it('formats a datetime string correctly', () => {
    const result = formatDateTime('2024-03-15T14:30:00Z');
    expect(result).toContain('Mar 15, 2024');
    expect(result).toContain('30');
  });

  it('returns the original string for invalid datetime', () => {
    const result = formatDateTime('invalid');
    expect(result).toBe('invalid');
  });
});

describe('formatTime', () => {
  it('formats a time from datetime string', () => {
    const result = formatTime('2024-03-15T14:30:00Z');
    expect(result).toContain('30');
  });

  it('returns the original string for invalid datetime', () => {
    const result = formatTime('invalid');
    expect(result).toBe('invalid');
  });
});

describe('formatRelativeTime', () => {
  it('formats future time', () => {
    const now = new Date('2024-03-15T12:00:00Z');
    const result = formatRelativeTime('2024-03-15T15:45:00Z', now);
    expect(result).toBe('in 3h 45m');
  });

  it('formats past time', () => {
    const now = new Date('2024-03-15T14:00:00Z');
    const result = formatRelativeTime('2024-03-15T12:00:00Z', now);
    expect(result).toBe('2h ago');
  });

  it('formats days', () => {
    const now = new Date('2024-03-15T12:00:00Z');
    const result = formatRelativeTime('2024-03-18T12:00:00Z', now);
    expect(result).toBe('in 3d');
  });

  it('returns original string for invalid dates', () => {
    const result = formatRelativeTime('invalid');
    expect(result).toBe('invalid');
  });
});

describe('formatCurrency', () => {
  it('formats USD correctly', () => {
    const result = formatCurrency(47.5, 'USD');
    expect(result).toBe('$47.50');
  });

  it('formats EUR correctly', () => {
    const result = formatCurrency(100, 'EUR');
    expect(result).toContain('100.00');
  });

  it('rounds to 2 decimal places', () => {
    const result = formatCurrency(10.999, 'USD');
    expect(result).toBe('$11.00');
  });

  it('handles zero amount', () => {
    const result = formatCurrency(0, 'USD');
    expect(result).toBe('$0.00');
  });

  it('falls back for unsupported currency codes', () => {
    const result = formatCurrency(100, 'INVALID');
    expect(result).toBe('100.00 INVALID');
  });
});

describe('convertCurrency', () => {
  it('converts correctly with a given rate', () => {
    expect(convertCurrency(100, 0.85)).toBe(85);
  });

  it('rounds to 2 decimal places', () => {
    expect(convertCurrency(33.33, 1.5)).toBe(50);
  });

  it('handles small amounts', () => {
    expect(convertCurrency(0.01, 1.0)).toBe(0.01);
  });

  it('handles rate that produces long decimals', () => {
    expect(convertCurrency(10, 0.333)).toBe(3.33);
  });
});
