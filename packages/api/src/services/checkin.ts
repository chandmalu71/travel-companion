/**
 * Flight Check-in Service
 *
 * Manages check-in status, constructs airline-specific check-in URLs,
 * and provides check-in window timing information.
 *
 * Supported airlines: Delta, United, AA, Southwest, BA, Lufthansa, Air France, Emirates
 * For unsupported airlines: returns generic check-in page URL.
 *
 * Implements Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckinStatus {
  bookingId: string;
  airline: string;
  flightNumber: string;
  departureTime: string;
  checkinWindowOpen: string; // ISO datetime when check-in opens
  checkinWindowClose: string; // ISO datetime when check-in closes (departure)
  checkinUrl: string;
  isOpen: boolean;
  isClosed: boolean;
  isCheckedIn: boolean;
  timeUntilOpen?: string; // human readable
  timeRemaining?: string; // human readable
}

export interface CheckinCompleteResult {
  success: boolean;
  bookingId: string;
  status: 'checked_in' | 'already_checked_in' | 'window_closed' | 'error';
  message: string;
}

// ─── Airline Check-in URL Templates ──────────────────────────────────────────

interface AirlineCheckinConfig {
  name: string;
  iataCode: string;
  checkinUrl: string;
  windowHours: number; // hours before departure when check-in opens
  supportsDeepLink: boolean;
}

const AIRLINE_CONFIGS: Record<string, AirlineCheckinConfig> = {
  DL: {
    name: 'Delta Air Lines',
    iataCode: 'DL',
    checkinUrl: 'https://www.delta.com/flight-search/check-in',
    windowHours: 24,
    supportsDeepLink: true,
  },
  UA: {
    name: 'United Airlines',
    iataCode: 'UA',
    checkinUrl: 'https://www.united.com/en/us/checkin',
    windowHours: 24,
    supportsDeepLink: true,
  },
  AA: {
    name: 'American Airlines',
    iataCode: 'AA',
    checkinUrl: 'https://www.aa.com/checkin',
    windowHours: 24,
    supportsDeepLink: true,
  },
  WN: {
    name: 'Southwest Airlines',
    iataCode: 'WN',
    checkinUrl: 'https://www.southwest.com/air/check-in/',
    windowHours: 24,
    supportsDeepLink: true,
  },
  BA: {
    name: 'British Airways',
    iataCode: 'BA',
    checkinUrl: 'https://www.britishairways.com/travel/olcilandingpagealileo/public/en_gb',
    windowHours: 24,
    supportsDeepLink: false,
  },
  LH: {
    name: 'Lufthansa',
    iataCode: 'LH',
    checkinUrl: 'https://www.lufthansa.com/us/en/online-check-in',
    windowHours: 23,
    supportsDeepLink: false,
  },
  AF: {
    name: 'Air France',
    iataCode: 'AF',
    checkinUrl: 'https://www.airfrance.com/en/check-in',
    windowHours: 30,
    supportsDeepLink: false,
  },
  EK: {
    name: 'Emirates',
    iataCode: 'EK',
    checkinUrl: 'https://www.emirates.com/english/manage-booking/online-check-in/',
    windowHours: 48,
    supportsDeepLink: false,
  },
};

const GENERIC_CHECKIN_URL = 'https://www.google.com/search?q={airline}+online+check+in';

// ─── Service ─────────────────────────────────────────────────────────────────

export class CheckinService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Get check-in status for a flight booking.
   */
  async getCheckinStatus(bookingId: string, userId: string): Promise<CheckinStatus | null> {
    const booking = await this.db
      .selectFrom('bookings')
      .select(['id', 'type', 'checked_in'])
      .where('id', '=', bookingId)
      .where('user_id', '=', userId)
      .where('type', '=', 'flight')
      .executeTakeFirst();

    if (!booking) return null;

    const flight = await this.db
      .selectFrom('flight_details')
      .select(['airline', 'flight_number', 'departure_time', 'confirmation_number'])
      .where('booking_id', '=', bookingId)
      .executeTakeFirst();

    if (!flight || !flight.departure_time) return null;

    const airline = flight.airline ?? '';
    const flightNumber = flight.flight_number ?? '';
    const departureTime = new Date(flight.departure_time);
    const iataCode = extractIataCode(flightNumber);
    const airlineConfig = AIRLINE_CONFIGS[iataCode];

    const windowHours = airlineConfig?.windowHours ?? 24;
    const checkinWindowOpen = new Date(
      departureTime.getTime() - windowHours * 60 * 60 * 1000,
    );
    const checkinWindowClose = departureTime;

    const now = new Date();
    const isOpen = now >= checkinWindowOpen && now < checkinWindowClose;
    const isClosed = now >= checkinWindowClose;

    const checkinUrl = buildCheckinUrl(
      iataCode,
      flight.confirmation_number ?? '',
      '',
    );

    return {
      bookingId,
      airline,
      flightNumber,
      departureTime: departureTime.toISOString(),
      checkinWindowOpen: checkinWindowOpen.toISOString(),
      checkinWindowClose: checkinWindowClose.toISOString(),
      checkinUrl,
      isOpen,
      isClosed,
      isCheckedIn: booking.checked_in ?? false,
      timeUntilOpen: !isOpen && !isClosed
        ? formatDuration(checkinWindowOpen.getTime() - now.getTime())
        : undefined,
      timeRemaining: isOpen
        ? formatDuration(checkinWindowClose.getTime() - now.getTime())
        : undefined,
    };
  }

  /**
   * Mark a flight as checked in.
   */
  async completeCheckin(
    bookingId: string,
    userId: string,
  ): Promise<CheckinCompleteResult> {
    const status = await this.getCheckinStatus(bookingId, userId);

    if (!status) {
      return {
        success: false,
        bookingId,
        status: 'error',
        message: 'Flight booking not found',
      };
    }

    if (status.isCheckedIn) {
      return {
        success: true,
        bookingId,
        status: 'already_checked_in',
        message: 'Already checked in for this flight',
      };
    }

    if (status.isClosed && !status.isOpen) {
      // Allow completion if check-in was in progress
      return {
        success: false,
        bookingId,
        status: 'window_closed',
        message: 'Check-in window has closed',
      };
    }

    // Mark as checked in
    await this.db
      .updateTable('bookings')
      .set({ checked_in: true, updated_at: new Date() })
      .where('id', '=', bookingId)
      .where('user_id', '=', userId)
      .execute();

    return {
      success: true,
      bookingId,
      status: 'checked_in',
      message: 'Successfully checked in! Upload your boarding pass to keep it accessible.',
    };
  }
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Extract the IATA airline code from a flight number.
 * E.g., "DL1234" → "DL", "UA567" → "UA"
 */
export function extractIataCode(flightNumber: string): string {
  const match = /^([A-Z]{2})\d/.exec(flightNumber.toUpperCase());
  return match?.[1] ?? '';
}

/**
 * Build the check-in URL for an airline.
 * For supported airlines, uses their specific URL.
 * For unsupported airlines, returns a generic search URL.
 */
export function buildCheckinUrl(
  iataCode: string,
  confirmationNumber: string,
  lastName: string,
): string {
  const config = AIRLINE_CONFIGS[iataCode];

  if (!config) {
    return GENERIC_CHECKIN_URL.replace('{airline}', iataCode || 'airline');
  }

  if (config.supportsDeepLink && confirmationNumber) {
    // Build deep link with parameters
    const params = new URLSearchParams();
    if (confirmationNumber) params.set('confirmationNumber', confirmationNumber);
    if (lastName) params.set('lastName', lastName);
    return `${config.checkinUrl}?${params.toString()}`;
  }

  return config.checkinUrl;
}

/**
 * Format a duration in milliseconds to human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms <= 0) return '0 minutes';

  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

/**
 * Get the list of supported airline IATA codes.
 */
export function getSupportedAirlines(): Array<{ iataCode: string; name: string }> {
  return Object.values(AIRLINE_CONFIGS).map((c) => ({
    iataCode: c.iataCode,
    name: c.name,
  }));
}
