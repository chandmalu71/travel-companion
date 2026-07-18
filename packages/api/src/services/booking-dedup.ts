/**
 * Booking Deduplication Service
 *
 * Checks whether an extracted booking already exists in the database
 * to prevent duplicate entries when processing emails.
 *
 * Deduplication rules:
 * - Flights: same flight number AND same departure date
 * - Hotels: same hotel name AND same check-in AND check-out dates
 * - Car rentals: same company AND same pickup date AND same return date
 *
 * Implements Requirements: 2.6, 2.8, 2.9
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type ExtractedBooking, type FlightFields, type HotelFields, type CarRentalFields } from './email-parser.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeduplicationResult {
  isDuplicate: boolean;
  existingBookingId?: string;
}

export interface CreateBookingResult {
  bookingId: string;
  partial: boolean;
  missingFields: string[];
}

// ─── Service ─────────────────────────────────────────────────────────────────

/**
 * Check if an extracted booking already exists for the given user.
 *
 * @param db - Kysely database instance
 * @param extracted - The booking extracted from an email
 * @param userId - The ID of the user who owns the booking
 * @returns DeduplicationResult indicating if a duplicate was found
 */
export async function checkDuplicate(
  db: Kysely<Database>,
  extracted: ExtractedBooking,
  userId: string,
): Promise<DeduplicationResult> {
  switch (extracted.type) {
    case 'flight':
      return checkFlightDuplicate(db, extracted.fields as Partial<FlightFields>, userId);
    case 'hotel':
      return checkHotelDuplicate(db, extracted.fields as Partial<HotelFields>, userId);
    case 'car_rental':
      return checkCarRentalDuplicate(db, extracted.fields as Partial<CarRentalFields>, userId);
  }
}

/**
 * Check for duplicate flights by matching flight number AND departure date.
 */
async function checkFlightDuplicate(
  db: Kysely<Database>,
  fields: Partial<FlightFields>,
  userId: string,
): Promise<DeduplicationResult> {
  const { flightNumber, departureTime } = fields;

  // Cannot deduplicate without both flight number and departure time
  if (!flightNumber || !departureTime) {
    return { isDuplicate: false };
  }

  // Extract date portion from departure time for comparison
  const departureDate = extractDatePortion(departureTime);
  if (!departureDate) {
    return { isDuplicate: false };
  }

  const result = await db
    .selectFrom('bookings')
    .innerJoin('flight_details', 'flight_details.booking_id', 'bookings.id')
    .select('bookings.id')
    .where('bookings.user_id', '=', userId)
    .where('bookings.type', '=', 'flight')
    .where('flight_details.flight_number', '=', flightNumber)
    .where((eb) =>
      eb('flight_details.departure_time', '>=', new Date(`${departureDate}T00:00:00.000Z`))
        .$call((qb) =>
          qb.where('flight_details.departure_time', '<', new Date(`${departureDate}T23:59:59.999Z`)),
        ),
    )
    .executeTakeFirst();

  if (result) {
    return { isDuplicate: true, existingBookingId: result.id };
  }

  return { isDuplicate: false };
}

/**
 * Check for duplicate hotels by matching hotel name AND check-in AND check-out dates.
 */
async function checkHotelDuplicate(
  db: Kysely<Database>,
  fields: Partial<HotelFields>,
  userId: string,
): Promise<DeduplicationResult> {
  const { hotelName, checkInDate, checkOutDate } = fields;

  // Cannot deduplicate without all three fields
  if (!hotelName || !checkInDate || !checkOutDate) {
    return { isDuplicate: false };
  }

  // Normalize dates to YYYY-MM-DD format
  const normalizedCheckIn = extractDatePortion(checkInDate);
  const normalizedCheckOut = extractDatePortion(checkOutDate);

  if (!normalizedCheckIn || !normalizedCheckOut) {
    return { isDuplicate: false };
  }

  const result = await db
    .selectFrom('bookings')
    .innerJoin('hotel_details', 'hotel_details.booking_id', 'bookings.id')
    .select('bookings.id')
    .where('bookings.user_id', '=', userId)
    .where('bookings.type', '=', 'hotel')
    .where('hotel_details.hotel_name', '=', hotelName)
    .where('hotel_details.checkin_date', '=', normalizedCheckIn)
    .where('hotel_details.checkout_date', '=', normalizedCheckOut)
    .executeTakeFirst();

  if (result) {
    return { isDuplicate: true, existingBookingId: result.id };
  }

  return { isDuplicate: false };
}

/**
 * Check for duplicate car rentals by matching company AND pickup date AND return date.
 */
async function checkCarRentalDuplicate(
  db: Kysely<Database>,
  fields: Partial<CarRentalFields>,
  userId: string,
): Promise<DeduplicationResult> {
  const { company, pickupDate, returnDate } = fields;

  // Cannot deduplicate without all three fields
  if (!company || !pickupDate || !returnDate) {
    return { isDuplicate: false };
  }

  // Extract date portions for comparison
  const pickupDatePortion = extractDatePortion(pickupDate);
  const returnDatePortion = extractDatePortion(returnDate);

  if (!pickupDatePortion || !returnDatePortion) {
    return { isDuplicate: false };
  }

  const result = await db
    .selectFrom('bookings')
    .innerJoin('car_rental_details', 'car_rental_details.booking_id', 'bookings.id')
    .select('bookings.id')
    .where('bookings.user_id', '=', userId)
    .where('bookings.type', '=', 'car_rental')
    .where('car_rental_details.company', '=', company)
    .where((eb) =>
      eb('car_rental_details.pickup_time', '>=', new Date(`${pickupDatePortion}T00:00:00.000Z`))
        .$call((qb) =>
          qb.where('car_rental_details.pickup_time', '<', new Date(`${pickupDatePortion}T23:59:59.999Z`)),
        ),
    )
    .where((eb) =>
      eb('car_rental_details.return_time', '>=', new Date(`${returnDatePortion}T00:00:00.000Z`))
        .$call((qb) =>
          qb.where('car_rental_details.return_time', '<', new Date(`${returnDatePortion}T23:59:59.999Z`)),
        ),
    )
    .executeTakeFirst();

  if (result) {
    return { isDuplicate: true, existingBookingId: result.id };
  }

  return { isDuplicate: false };
}

/**
 * Create a booking from an extracted email, marking it as partial if fields are missing.
 *
 * @param db - Kysely database instance
 * @param extracted - The booking extracted from an email
 * @param userId - The ID of the user who owns the booking
 * @returns CreateBookingResult with the new booking ID and partial status
 */
export async function createBookingFromExtracted(
  db: Kysely<Database>,
  extracted: ExtractedBooking,
  userId: string,
): Promise<CreateBookingResult> {
  const isPartial = extracted.missingFields.length > 0;

  // Create the main booking record
  const booking = await db
    .insertInto('bookings')
    .values({
      user_id: userId,
      type: extracted.type,
      source: 'email',
      source_email_id: extracted.sourceEmailId,
      checked_in: false,
    })
    .returning('id')
    .executeTakeFirstOrThrow();

  // Insert type-specific details
  switch (extracted.type) {
    case 'flight':
      await insertFlightDetails(db, booking.id, extracted.fields as Partial<FlightFields>);
      break;
    case 'hotel':
      await insertHotelDetails(db, booking.id, extracted.fields as Partial<HotelFields>);
      break;
    case 'car_rental':
      await insertCarRentalDetails(db, booking.id, extracted.fields as Partial<CarRentalFields>);
      break;
  }

  return {
    bookingId: booking.id,
    partial: isPartial,
    missingFields: extracted.missingFields,
  };
}

// ─── Detail Insert Helpers ───────────────────────────────────────────────────

async function insertFlightDetails(
  db: Kysely<Database>,
  bookingId: string,
  fields: Partial<FlightFields>,
): Promise<void> {
  await db
    .insertInto('flight_details')
    .values({
      booking_id: bookingId,
      airline: fields.airline ?? null,
      flight_number: fields.flightNumber ?? null,
      departure_airport: fields.departureAirport ?? null,
      arrival_airport: fields.arrivalAirport ?? null,
      departure_time: fields.departureTime ? new Date(fields.departureTime) : null,
      arrival_time: fields.arrivalTime ? new Date(fields.arrivalTime) : null,
    })
    .execute();
}

async function insertHotelDetails(
  db: Kysely<Database>,
  bookingId: string,
  fields: Partial<HotelFields>,
): Promise<void> {
  await db
    .insertInto('hotel_details')
    .values({
      booking_id: bookingId,
      hotel_name: fields.hotelName ?? null,
      checkin_date: fields.checkInDate ? extractDatePortion(fields.checkInDate) ?? null : null,
      checkout_date: fields.checkOutDate ? extractDatePortion(fields.checkOutDate) ?? null : null,
      address: fields.address ?? null,
    })
    .execute();
}

async function insertCarRentalDetails(
  db: Kysely<Database>,
  bookingId: string,
  fields: Partial<CarRentalFields>,
): Promise<void> {
  await db
    .insertInto('car_rental_details')
    .values({
      booking_id: bookingId,
      company: fields.company ?? null,
      pickup_time: fields.pickupDate ? new Date(fields.pickupDate) : null,
      return_time: fields.returnDate ? new Date(fields.returnDate) : null,
    })
    .execute();
}

// ─── Utility Functions ───────────────────────────────────────────────────────

/**
 * Extract date portion (YYYY-MM-DD) from various date string formats.
 * Handles:
 * - ISO 8601 dates: "2024-01-15", "2024-01-15T08:30:00Z"
 * - Named dates: "January 15, 2024", "Jan 15, 2024"
 * - Slash dates: "01/15/2024"
 */
export function extractDatePortion(dateStr: string): string | null {
  // Try ISO format first: YYYY-MM-DD or YYYY-MM-DDTHH:mm:ss
  const isoMatch = /^(\d{4}-\d{2}-\d{2})/.exec(dateStr);
  if (isoMatch) {
    return isoMatch[1]!;
  }

  // Try named month format: "January 15, 2024" or "Jan 15, 2024"
  const monthMap: Record<string, string> = {
    january: '01', jan: '01',
    february: '02', feb: '02',
    march: '03', mar: '03',
    april: '04', apr: '04',
    may: '05',
    june: '06', jun: '06',
    july: '07', jul: '07',
    august: '08', aug: '08',
    september: '09', sep: '09',
    october: '10', oct: '10',
    november: '11', nov: '11',
    december: '12', dec: '12',
  };

  const namedMatch = /^(Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)\s+(\d{1,2}),?\s+(\d{4})/i.exec(dateStr);
  if (namedMatch) {
    const month = monthMap[namedMatch[1]!.toLowerCase()];
    const day = namedMatch[2]!.padStart(2, '0');
    const year = namedMatch[3]!;
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // Try slash format: MM/DD/YYYY
  const slashMatch = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(dateStr);
  if (slashMatch) {
    const month = slashMatch[1]!.padStart(2, '0');
    const day = slashMatch[2]!.padStart(2, '0');
    const year = slashMatch[3]!;
    return `${year}-${month}-${day}`;
  }

  // Try parsing with Date constructor as last resort
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }

  return null;
}

/**
 * Process an extracted booking: check for duplicates, then create if new.
 * Returns the dedup result and optionally the create result.
 *
 * @param db - Kysely database instance
 * @param extracted - The booking extracted from an email
 * @param userId - The ID of the user who owns the booking
 */
export async function processExtractedBooking(
  db: Kysely<Database>,
  extracted: ExtractedBooking,
  userId: string,
): Promise<{
  dedupResult: DeduplicationResult;
  createResult?: CreateBookingResult;
}> {
  // Step 1: Check for duplicates
  const dedupResult = await checkDuplicate(db, extracted, userId);

  if (dedupResult.isDuplicate) {
    return { dedupResult };
  }

  // Step 2: Create the new booking
  const createResult = await createBookingFromExtracted(db, extracted, userId);

  return { dedupResult, createResult };
}
