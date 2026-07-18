/**
 * Email Parser Service Tests
 *
 * Tests booking confirmation detection and field extraction
 * using mocked AWS Comprehend responses and sample email texts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  EmailParserService,
  stripHtml,
  extractAirportCodes,
  extractDateTimes,
  extractAllDates,
  extractDateNearKeyword,
  extractAddress,
  getRequiredFields,
  type EmailContent,
} from './email-parser.js';

// Mock the AWS SDK
vi.mock('@aws-sdk/client-comprehend', () => {
  return {
    ComprehendClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
    ClassifyDocumentCommand: vi.fn(),
    DetectEntitiesCommand: vi.fn(),
  };
});

// ─── Sample Email Texts ──────────────────────────────────────────────────────

const DELTA_FLIGHT_EMAIL = `
Subject: Your Flight Confirmation - Delta Air Lines

Booking Confirmation

Dear John Smith,

Your flight reservation has been confirmed.

Flight: DL1234
Airline: Delta
From: JFK (New York)
To: LAX (Los Angeles)

Departure: January 15, 2024 at 8:30 AM
Arrival: January 15, 2024 at 11:45 AM

Confirmation Number: ABC123
Passenger: John Smith
Seat: 14A

Thank you for choosing Delta Air Lines.
`;

const HILTON_HOTEL_EMAIL = `
Subject: Reservation Confirmation - Hilton Garden Inn

Dear Guest,

Your hotel reservation is confirmed.

Hotel: Hilton Garden Inn Downtown
Address: 123 Main Street, New York, NY 10001

Check-in: February 20, 2024
Check-out: February 23, 2024

Room Type: King Suite
Confirmation Number: H987654

We look forward to your stay!
`;

const HERTZ_CAR_RENTAL_EMAIL = `
Subject: Your Hertz Reservation Confirmation

Dear Customer,

Your car rental reservation has been confirmed.

Company: Hertz
Vehicle: Midsize Sedan

Pick-up: March 10, 2024
Location: Los Angeles International Airport (LAX)

Return: March 15, 2024
Location: San Francisco International Airport (SFO)

Confirmation: R456789

Thank you for choosing Hertz.
`;

const NON_BOOKING_EMAIL = `
Subject: Weekly Newsletter

Hi there,

Here's your weekly update on the latest travel deals and tips.
We hope you enjoyed your recent trip!

Best regards,
Travel News Team
`;

// ─── Helper ──────────────────────────────────────────────────────────────────

function createEmail(text: string, id = 'email-123'): EmailContent {
  return {
    id,
    from: 'noreply@airline.com',
    subject: 'Booking Confirmation',
    textBody: text,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('EmailParserService', () => {
  let service: EmailParserService;

  beforeEach(() => {
    service = new EmailParserService({ region: 'us-east-1' });
  });

  describe('parseWithRegexFallback', () => {
    it('should extract flight details from Delta confirmation email', () => {
      const result = service.parseWithRegexFallback(createEmail(DELTA_FLIGHT_EMAIL));

      expect(result).not.toBeNull();
      expect(result!.type).toBe('flight');
      expect(result!.sourceEmailId).toBe('email-123');
      expect(result!.confidence).toBeGreaterThan(0);

      const fields = result!.fields as Record<string, string>;
      expect(fields.airline).toBe('Delta');
      expect(fields.flightNumber).toBe('DL1234');
      expect(fields.departureAirport).toBe('JFK');
      expect(fields.arrivalAirport).toBe('LAX');
    });

    it('should extract hotel details from Hilton confirmation email', () => {
      const result = service.parseWithRegexFallback(createEmail(HILTON_HOTEL_EMAIL));

      expect(result).not.toBeNull();
      expect(result!.type).toBe('hotel');
      expect(result!.confidence).toBeGreaterThan(0);

      const fields = result!.fields as Record<string, string>;
      expect(fields.hotelName).toContain('Hilton');
      expect(fields.checkInDate).toContain('February 20');
      expect(fields.checkOutDate).toContain('February 23');
    });

    it('should extract car rental details from Hertz confirmation email', () => {
      const result = service.parseWithRegexFallback(createEmail(HERTZ_CAR_RENTAL_EMAIL));

      expect(result).not.toBeNull();
      expect(result!.type).toBe('car_rental');
      expect(result!.confidence).toBeGreaterThan(0);

      const fields = result!.fields as Record<string, string>;
      expect(fields.company).toBe('Hertz');
      expect(fields.pickupDate).toContain('March 10');
      expect(fields.returnDate).toContain('March 15');
    });

    it('should return null for non-booking emails', () => {
      const result = service.parseWithRegexFallback(createEmail(NON_BOOKING_EMAIL));
      expect(result).toBeNull();
    });

    it('should flag missing fields when extraction is incomplete', () => {
      const partialEmail = `
        Flight Confirmation
        Your flight DL5678 has been booked.
        Airline: Delta
        Departure: January 20, 2024
      `;
      const result = service.parseWithRegexFallback(createEmail(partialEmail));

      expect(result).not.toBeNull();
      expect(result!.type).toBe('flight');
      expect(result!.missingFields.length).toBeGreaterThan(0);
      expect(result!.confidence).toBeLessThan(1);
    });

    it('should calculate confidence based on extracted vs required fields', () => {
      const result = service.parseWithRegexFallback(createEmail(DELTA_FLIGHT_EMAIL));
      expect(result).not.toBeNull();
      // Confidence should be between 0 and 1
      expect(result!.confidence).toBeGreaterThanOrEqual(0);
      expect(result!.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('classifyEmail', () => {
    it('should classify flight confirmation email correctly', async () => {
      const result = await service.classifyEmail(DELTA_FLIGHT_EMAIL);
      expect(result.isBookingConfirmation).toBe(true);
      expect(result.bookingType).toBe('flight');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should classify hotel confirmation email correctly', async () => {
      const result = await service.classifyEmail(HILTON_HOTEL_EMAIL);
      expect(result.isBookingConfirmation).toBe(true);
      expect(result.bookingType).toBe('hotel');
    });

    it('should classify car rental confirmation email correctly', async () => {
      const result = await service.classifyEmail(HERTZ_CAR_RENTAL_EMAIL);
      expect(result.isBookingConfirmation).toBe(true);
      expect(result.bookingType).toBe('car_rental');
    });

    it('should reject non-booking email', async () => {
      const result = await service.classifyEmail(NON_BOOKING_EMAIL);
      expect(result.isBookingConfirmation).toBe(false);
      expect(result.bookingType).toBeNull();
    });
  });
});

// ─── Helper Function Tests ───────────────────────────────────────────────────

describe('stripHtml', () => {
  it('should remove HTML tags', () => {
    const html = '<p>Hello <strong>World</strong></p>';
    expect(stripHtml(html)).toBe('Hello World');
  });

  it('should remove style and script tags with content', () => {
    const html = '<style>body{color:red}</style><p>Hello</p><script>alert("x")</script>';
    expect(stripHtml(html)).toBe('Hello');
  });

  it('should decode HTML entities', () => {
    const html = '&amp; &lt;test&gt; &nbsp;';
    expect(stripHtml(html)).toBe('& <test>');
  });
});

describe('extractAirportCodes', () => {
  it('should extract airport codes from context', () => {
    const text = 'Departing from JFK to LAX';
    const codes = extractAirportCodes(text);
    expect(codes).toContain('JFK');
    expect(codes).toContain('LAX');
  });

  it('should extract codes in parentheses', () => {
    const text = 'New York (JFK) to Los Angeles (LAX)';
    const codes = extractAirportCodes(text);
    expect(codes).toContain('JFK');
    expect(codes).toContain('LAX');
  });

  it('should not include common English words', () => {
    const text = 'THE flight from JFK AND arrives at LAX FOR you';
    const codes = extractAirportCodes(text);
    expect(codes).not.toContain('THE');
    expect(codes).not.toContain('AND');
    expect(codes).not.toContain('FOR');
  });
});

describe('extractDateTimes', () => {
  it('should extract named dates with times', () => {
    const text = 'Departure: January 15, 2024 at 8:30 AM';
    const results = extractDateTimes(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toContain('January 15, 2024');
    expect(results[0]).toContain('8:30');
  });

  it('should extract ISO format dates', () => {
    const text = 'Date: 2024-01-15T10:30';
    const results = extractDateTimes(text);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toContain('2024-01-15');
  });

  it('should extract multiple dates', () => {
    const text = 'Depart: January 15, 2024 at 8:30 AM Arrive: January 15, 2024 at 11:45 AM';
    const results = extractDateTimes(text);
    expect(results.length).toBe(2);
  });
});

describe('extractAllDates', () => {
  it('should extract named month dates', () => {
    const text = 'Check-in: February 20, 2024 Check-out: February 23, 2024';
    const results = extractAllDates(text);
    expect(results.length).toBe(2);
    expect(results[0]).toContain('February 20');
    expect(results[1]).toContain('February 23');
  });

  it('should extract ISO dates', () => {
    const text = 'Start: 2024-03-10 End: 2024-03-15';
    const results = extractAllDates(text);
    expect(results).toContain('2024-03-10');
    expect(results).toContain('2024-03-15');
  });
});

describe('extractDateNearKeyword', () => {
  it('should find date near check-in keyword', () => {
    const text = 'Check-in: February 20, 2024';
    const result = extractDateNearKeyword(text, ['check-in']);
    expect(result).toContain('February 20, 2024');
  });

  it('should find ISO date near keyword', () => {
    const text = 'Pick-up date: 2024-03-10';
    const result = extractDateNearKeyword(text, ['pick-up']);
    expect(result).toBe('2024-03-10');
  });

  it('should return undefined when no date is near keyword', () => {
    const text = 'No dates here for pickup';
    const result = extractDateNearKeyword(text, ['check-in']);
    expect(result).toBeUndefined();
  });
});

describe('extractAddress', () => {
  it('should extract a US address pattern', () => {
    const text = 'Located at 123 Main Street, New York, NY 10001';
    const result = extractAddress(text);
    expect(result).toBeDefined();
    expect(result).toContain('123 Main Street');
  });

  it('should extract address after keyword', () => {
    const text = 'Address: 456 Oak Avenue, Suite 200, Chicago, IL 60601';
    const result = extractAddress(text);
    expect(result).toBeDefined();
    expect(result).toContain('456 Oak Avenue');
  });
});

describe('getRequiredFields', () => {
  it('should return correct fields for flights', () => {
    const fields = getRequiredFields('flight');
    expect(fields).toContain('airline');
    expect(fields).toContain('flightNumber');
    expect(fields).toContain('departureTime');
    expect(fields).toContain('arrivalTime');
    expect(fields).toContain('departureAirport');
    expect(fields).toContain('arrivalAirport');
  });

  it('should return correct fields for hotels', () => {
    const fields = getRequiredFields('hotel');
    expect(fields).toContain('hotelName');
    expect(fields).toContain('checkInDate');
    expect(fields).toContain('checkOutDate');
    expect(fields).toContain('address');
  });

  it('should return correct fields for car rentals', () => {
    const fields = getRequiredFields('car_rental');
    expect(fields).toContain('company');
    expect(fields).toContain('pickupDate');
    expect(fields).toContain('returnDate');
    expect(fields).toContain('pickupLocation');
    expect(fields).toContain('returnLocation');
  });
});
