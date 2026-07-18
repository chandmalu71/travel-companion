import { describe, it, expect } from 'vitest';

import {
  registrationSchema,
  loginSchema,
  tripCreationSchema,
  bookingCreationSchema,
  expenseCreationSchema,
  passwordSchema,
} from '../../validators';

describe('passwordSchema', () => {
  it('accepts a valid password', () => {
    const result = passwordSchema.safeParse('ValidPass1');
    expect(result.success).toBe(true);
  });

  it('rejects passwords shorter than 8 characters', () => {
    const result = passwordSchema.safeParse('Aa1bbbb');
    expect(result.success).toBe(false);
  });

  it('rejects passwords longer than 128 characters', () => {
    const longPassword = 'Aa1' + 'x'.repeat(126);
    const result = passwordSchema.safeParse(longPassword);
    expect(result.success).toBe(false);
  });

  it('rejects passwords without uppercase', () => {
    const result = passwordSchema.safeParse('lowercase1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without lowercase', () => {
    const result = passwordSchema.safeParse('UPPERCASE1');
    expect(result.success).toBe(false);
  });

  it('rejects passwords without a digit', () => {
    const result = passwordSchema.safeParse('NoDigitHere');
    expect(result.success).toBe(false);
  });

  it('accepts password at exactly 8 characters', () => {
    const result = passwordSchema.safeParse('Abcdefg1');
    expect(result.success).toBe(true);
  });

  it('accepts password at exactly 128 characters', () => {
    const password = 'Aa1' + 'x'.repeat(125);
    const result = passwordSchema.safeParse(password);
    expect(result.success).toBe(true);
  });
});

describe('registrationSchema', () => {
  it('accepts valid registration input', () => {
    const result = registrationSchema.safeParse({
      email: 'user@example.com',
      password: 'ValidPass1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid email', () => {
    const result = registrationSchema.safeParse({
      email: 'not-an-email',
      password: 'ValidPass1',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid password', () => {
    const result = registrationSchema.safeParse({
      email: 'user@example.com',
      password: 'weak',
    });
    expect(result.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('accepts valid login input', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: 'anypassword',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty password', () => {
    const result = loginSchema.safeParse({
      email: 'user@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'invalid',
      password: 'somepassword',
    });
    expect(result.success).toBe(false);
  });
});

describe('tripCreationSchema', () => {
  it('accepts valid trip with name only', () => {
    const result = tripCreationSchema.safeParse({ name: 'Summer Vacation' });
    expect(result.success).toBe(true);
  });

  it('accepts valid trip with dates', () => {
    const result = tripCreationSchema.safeParse({
      name: 'Beach Trip',
      start_date: '2024-06-01',
      end_date: '2024-06-15',
    });
    expect(result.success).toBe(true);
  });

  it('accepts trip where start_date equals end_date', () => {
    const result = tripCreationSchema.safeParse({
      name: 'Day Trip',
      start_date: '2024-06-01',
      end_date: '2024-06-01',
    });
    expect(result.success).toBe(true);
  });

  it('rejects trip where end_date is before start_date', () => {
    const result = tripCreationSchema.safeParse({
      name: 'Invalid Trip',
      start_date: '2024-06-15',
      end_date: '2024-06-01',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty trip name', () => {
    const result = tripCreationSchema.safeParse({ name: '' });
    expect(result.success).toBe(false);
  });

  it('rejects trip name over 100 characters', () => {
    const result = tripCreationSchema.safeParse({ name: 'x'.repeat(101) });
    expect(result.success).toBe(false);
  });
});

describe('bookingCreationSchema', () => {
  it('accepts a valid flight booking', () => {
    const result = bookingCreationSchema.safeParse({
      type: 'flight',
      flight_details: {
        airline: 'Delta',
        flight_number: 'DL123',
        departure_airport: 'JFK',
        arrival_airport: 'LAX',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid hotel booking', () => {
    const result = bookingCreationSchema.safeParse({
      type: 'hotel',
      hotel_details: {
        hotel_name: 'Grand Hotel',
        checkin_date: '2024-06-01',
        checkout_date: '2024-06-05',
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts a valid car rental booking', () => {
    const result = bookingCreationSchema.safeParse({
      type: 'car_rental',
      car_rental_details: {
        company: 'Hertz',
        pickup_location: 'LAX Airport',
        return_location: 'LAX Airport',
      },
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid booking type', () => {
    const result = bookingCreationSchema.safeParse({
      type: 'train',
    });
    expect(result.success).toBe(false);
  });
});

describe('expenseCreationSchema', () => {
  it('accepts a valid expense', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 49.99,
      currency: 'USD',
      date: '2024-06-01',
      category: 'food_dining',
    });
    expect(result.success).toBe(true);
  });

  it('accepts minimum amount (0.01)', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 0.01,
      currency: 'EUR',
      date: '2024-06-01',
      category: 'transportation',
    });
    expect(result.success).toBe(true);
  });

  it('accepts maximum amount (999,999,999.99)', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 999_999_999.99,
      currency: 'USD',
      date: '2024-06-01',
      category: 'accommodation',
    });
    expect(result.success).toBe(true);
  });

  it('rejects amount below minimum', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 0,
      currency: 'USD',
      date: '2024-06-01',
      category: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('rejects amount above maximum', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 1_000_000_000,
      currency: 'USD',
      date: '2024-06-01',
      category: 'other',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid category', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 10,
      currency: 'USD',
      date: '2024-06-01',
      category: 'invalid_category',
    });
    expect(result.success).toBe(false);
  });

  it('rejects notes exceeding 500 characters', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 10,
      currency: 'USD',
      date: '2024-06-01',
      category: 'other',
      notes: 'x'.repeat(501),
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid currency code length', () => {
    const result = expenseCreationSchema.safeParse({
      amount: 10,
      currency: 'US',
      date: '2024-06-01',
      category: 'other',
    });
    expect(result.success).toBe(false);
  });
});
