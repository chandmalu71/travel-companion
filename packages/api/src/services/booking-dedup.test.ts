/**
 * Booking Deduplication Service Tests
 *
 * Tests duplicate detection logic for flights, hotels, and car rentals,
 * and booking creation with partial field handling.
 *
 * Implements Requirements: 2.6, 2.8, 2.9
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  checkDuplicate,
  createBookingFromExtracted,
  processExtractedBooking,
  extractDatePortion,
  type DeduplicationResult,
} from './booking-dedup.js';
import { type ExtractedBooking } from './email-parser.js';

// ─── Mock Database ───────────────────────────────────────────────────────────

function createMockQueryBuilder(result: unknown = undefined) {
  const builder: Record<string, unknown> = {};
  builder.selectFrom = vi.fn().mockReturnValue(builder);
  builder.innerJoin = vi.fn().mockReturnValue(builder);
  builder.select = vi.fn().mockReturnValue(builder);
  builder.where = vi.fn().mockImplementation((arg) => {
    // Support callback-style where clauses
    if (typeof arg === 'function') {
      // Create a mini expression builder for the callback
      const eb = vi.fn().mockReturnValue({
        $call: vi.fn().mockReturnValue(builder),
      });
      arg(eb);
    }
    return builder;
  });
  builder.executeTakeFirst = vi.fn().mockResolvedValue(result);
  builder.insertInto = vi.fn().mockReturnValue(builder);
  builder.values = vi.fn().mockReturnValue(builder);
  builder.returning = vi.fn().mockReturnValue(builder);
  builder.executeTakeFirstOrThrow = vi.fn().mockResolvedValue({ id: 'new-booking-id' });
  builder.execute = vi.fn().mockResolvedValue([]);
  return builder;
}

function createMockDb(queryResult: unknown = undefined) {
  const builder = createMockQueryBuilder(queryResult);
  return {
    selectFrom: builder.selectFrom,
    insertInto: builder.insertInto,
    // Proxy all builder methods
    _builder: builder,
  } as unknown as ReturnType<typeof import('kysely').Kysely<import('../db/types.js').Database>['prototype']>;
}

// ─── Test Data ───────────────────────────────────────────────────────────────

const FLIGHT_BOOKING: ExtractedBooking = {
  type: 'flight',
  confidence: 0.95,
  fields: {
    airline: 'Delta',
    flightNumber: 'DL1234',
    departureTime: '2024-01-15T08:30:00Z',
    arrivalTime: '2024-01-15T11:45:00Z',
    departureAirport: 'JFK',
    arrivalAirport: 'LAX',
  },
  missingFields: [],
  sourceEmailId: 'email-001',
};

const HOTEL_BOOKING: ExtractedBooking = {
  type: 'hotel',
  confidence: 0.9,
  fields: {
    hotelName: 'Hilton Garden Inn',
    checkInDate: '2024-02-20',
    checkOutDate: '2024-02-23',
    address: '123 Main St',
  },
  missingFields: [],
  sourceEmailId: 'email-002',
};

const CAR_RENTAL_BOOKING: ExtractedBooking = {
  type: 'car_rental',
  confidence: 0.85,
  fields: {
    company: 'Hertz',
    pickupDate: '2024-03-01T10:00:00Z',
    returnDate: '2024-03-05T10:00:00Z',
    pickupLocation: 'LAX Airport',
    returnLocation: 'LAX Airport',
  },
  missingFields: [],
  sourceEmailId: 'email-003',
};

const PARTIAL_FLIGHT_BOOKING: ExtractedBooking = {
  type: 'flight',
  confidence: 0.5,
  fields: {
    airline: 'United',
    flightNumber: 'UA567',
  },
  missingFields: ['departureTime', 'arrivalTime', 'departureAirport', 'arrivalAirport'],
  sourceEmailId: 'email-004',
};

const USER_ID = 'user-123';

// ─── extractDatePortion Tests ────────────────────────────────────────────────

describe('extractDatePortion', () => {
  it('should extract date from ISO format', () => {
    expect(extractDatePortion('2024-01-15')).toBe('2024-01-15');
    expect(extractDatePortion('2024-01-15T08:30:00Z')).toBe('2024-01-15');
    expect(extractDatePortion('2024-12-31T23:59:59.999Z')).toBe('2024-12-31');
  });

  it('should extract date from named month format', () => {
    expect(extractDatePortion('January 15, 2024')).toBe('2024-01-15');
    expect(extractDatePortion('Jan 15, 2024')).toBe('2024-01-15');
    expect(extractDatePortion('February 1, 2024')).toBe('2024-02-01');
    expect(extractDatePortion('December 31, 2024')).toBe('2024-12-31');
  });

  it('should extract date from slash format', () => {
    expect(extractDatePortion('01/15/2024')).toBe('2024-01-15');
    expect(extractDatePortion('12/31/2024')).toBe('2024-12-31');
    expect(extractDatePortion('1/5/2024')).toBe('2024-01-05');
  });

  it('should return null for invalid date strings', () => {
    expect(extractDatePortion('')).toBe(null);
    expect(extractDatePortion('not a date')).toBe(null);
  });
});

// ─── checkDuplicate Tests ────────────────────────────────────────────────────

describe('checkDuplicate', () => {
  describe('flight deduplication', () => {
    it('should return isDuplicate: true when matching flight exists', async () => {
      const mockDb = createMockDb({ id: 'existing-booking-1' });
      const result = await checkDuplicate(mockDb as any, FLIGHT_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingBookingId).toBe('existing-booking-1');
    });

    it('should return isDuplicate: false when no matching flight exists', async () => {
      const mockDb = createMockDb(undefined);
      const result = await checkDuplicate(mockDb as any, FLIGHT_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(false);
      expect(result.existingBookingId).toBeUndefined();
    });

    it('should return isDuplicate: false when flight number is missing', async () => {
      const booking: ExtractedBooking = {
        ...FLIGHT_BOOKING,
        fields: { airline: 'Delta', departureTime: '2024-01-15T08:30:00Z' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when departure time is missing', async () => {
      const booking: ExtractedBooking = {
        ...FLIGHT_BOOKING,
        fields: { airline: 'Delta', flightNumber: 'DL1234' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('hotel deduplication', () => {
    it('should return isDuplicate: true when matching hotel exists', async () => {
      const mockDb = createMockDb({ id: 'existing-hotel-1' });
      const result = await checkDuplicate(mockDb as any, HOTEL_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingBookingId).toBe('existing-hotel-1');
    });

    it('should return isDuplicate: false when no matching hotel exists', async () => {
      const mockDb = createMockDb(undefined);
      const result = await checkDuplicate(mockDb as any, HOTEL_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when hotel name is missing', async () => {
      const booking: ExtractedBooking = {
        ...HOTEL_BOOKING,
        fields: { checkInDate: '2024-02-20', checkOutDate: '2024-02-23' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when check-in date is missing', async () => {
      const booking: ExtractedBooking = {
        ...HOTEL_BOOKING,
        fields: { hotelName: 'Hilton', checkOutDate: '2024-02-23' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when check-out date is missing', async () => {
      const booking: ExtractedBooking = {
        ...HOTEL_BOOKING,
        fields: { hotelName: 'Hilton', checkInDate: '2024-02-20' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });
  });

  describe('car rental deduplication', () => {
    it('should return isDuplicate: true when matching car rental exists', async () => {
      const mockDb = createMockDb({ id: 'existing-car-1' });
      const result = await checkDuplicate(mockDb as any, CAR_RENTAL_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(true);
      expect(result.existingBookingId).toBe('existing-car-1');
    });

    it('should return isDuplicate: false when no matching car rental exists', async () => {
      const mockDb = createMockDb(undefined);
      const result = await checkDuplicate(mockDb as any, CAR_RENTAL_BOOKING, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when company is missing', async () => {
      const booking: ExtractedBooking = {
        ...CAR_RENTAL_BOOKING,
        fields: { pickupDate: '2024-03-01', returnDate: '2024-03-05' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when pickup date is missing', async () => {
      const booking: ExtractedBooking = {
        ...CAR_RENTAL_BOOKING,
        fields: { company: 'Hertz', returnDate: '2024-03-05' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });

    it('should return isDuplicate: false when return date is missing', async () => {
      const booking: ExtractedBooking = {
        ...CAR_RENTAL_BOOKING,
        fields: { company: 'Hertz', pickupDate: '2024-03-01' },
      };
      const mockDb = createMockDb();
      const result = await checkDuplicate(mockDb as any, booking, USER_ID);
      expect(result.isDuplicate).toBe(false);
    });
  });
});

// ─── createBookingFromExtracted Tests ────────────────────────────────────────

describe('createBookingFromExtracted', () => {
  it('should create a full booking with partial: false when no missing fields', async () => {
    const mockDb = createMockDb();
    const result = await createBookingFromExtracted(mockDb as any, FLIGHT_BOOKING, USER_ID);
    expect(result.bookingId).toBe('new-booking-id');
    expect(result.partial).toBe(false);
    expect(result.missingFields).toEqual([]);
  });

  it('should create a partial booking when fields are missing', async () => {
    const mockDb = createMockDb();
    const result = await createBookingFromExtracted(mockDb as any, PARTIAL_FLIGHT_BOOKING, USER_ID);
    expect(result.bookingId).toBe('new-booking-id');
    expect(result.partial).toBe(true);
    expect(result.missingFields).toEqual([
      'departureTime',
      'arrivalTime',
      'departureAirport',
      'arrivalAirport',
    ]);
  });

  it('should create a hotel booking', async () => {
    const mockDb = createMockDb();
    const result = await createBookingFromExtracted(mockDb as any, HOTEL_BOOKING, USER_ID);
    expect(result.bookingId).toBe('new-booking-id');
    expect(result.partial).toBe(false);
  });

  it('should create a car rental booking', async () => {
    const mockDb = createMockDb();
    const result = await createBookingFromExtracted(mockDb as any, CAR_RENTAL_BOOKING, USER_ID);
    expect(result.bookingId).toBe('new-booking-id');
    expect(result.partial).toBe(false);
  });
});

// ─── processExtractedBooking Tests ───────────────────────────────────────────

describe('processExtractedBooking', () => {
  it('should skip creation when duplicate is found', async () => {
    const mockDb = createMockDb({ id: 'existing-booking-1' });
    const result = await processExtractedBooking(mockDb as any, FLIGHT_BOOKING, USER_ID);
    expect(result.dedupResult.isDuplicate).toBe(true);
    expect(result.dedupResult.existingBookingId).toBe('existing-booking-1');
    expect(result.createResult).toBeUndefined();
  });

  it('should create booking when no duplicate exists', async () => {
    // We need a mock that returns undefined for select (no duplicate) but works for insert
    const builder = createMockQueryBuilder(undefined);
    const mockDb = {
      selectFrom: builder.selectFrom,
      insertInto: builder.insertInto,
    };

    const result = await processExtractedBooking(mockDb as any, FLIGHT_BOOKING, USER_ID);
    expect(result.dedupResult.isDuplicate).toBe(false);
    expect(result.createResult).toBeDefined();
    expect(result.createResult!.bookingId).toBe('new-booking-id');
    expect(result.createResult!.partial).toBe(false);
  });

  it('should create partial booking when fields are missing and no duplicate', async () => {
    const builder = createMockQueryBuilder(undefined);
    const mockDb = {
      selectFrom: builder.selectFrom,
      insertInto: builder.insertInto,
    };

    const result = await processExtractedBooking(mockDb as any, PARTIAL_FLIGHT_BOOKING, USER_ID);
    expect(result.dedupResult.isDuplicate).toBe(false);
    expect(result.createResult).toBeDefined();
    expect(result.createResult!.partial).toBe(true);
    expect(result.createResult!.missingFields.length).toBeGreaterThan(0);
  });
});
