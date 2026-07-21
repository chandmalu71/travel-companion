/**
 * Booking Ingestion Service
 *
 * Handles the full flow when a booking email is forwarded to trips@neyya.ai:
 * 1. Identify user by "From" email
 * 2. Extract booking details
 * 3. Deduplicate against existing bookings
 * 4. Match to existing trip (by date overlap → destination → create new)
 * 5. Notify user for confirmation
 *
 * For unregistered users:
 * - Store booking for 60 days
 * - Send invitation email with booking summary
 * - Support claim-by-verification for users with different email
 *
 * Implements Requirement 26
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { type ExtractedBooking } from './email-parser.js';
import { checkDuplicate, createBookingFromExtracted } from './booking-dedup.js';
import { randomUUID } from 'node:crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IngestionResult {
  status: 'added_to_trip' | 'new_trip_created' | 'duplicate_discarded' | 'pending_user_signup' | 'error';
  tripId?: string;
  tripName?: string;
  bookingId?: string;
  message: string;
}

export interface UnclaimedBooking {
  id: string;
  email: string;
  bookingType: string;
  destination: string | null;
  startDate: string | null;
  endDate: string | null;
  rawData: string; // JSON of extracted fields
  createdAt: Date;
  expiresAt: Date;
  claimed: boolean;
  claimToken: string | null;
}

export interface TripMatchResult {
  type: 'date_overlap' | 'destination_match' | 'new_trip';
  tripId: string;
  tripName: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const UNCLAIMED_EXPIRY_DAYS = 60;
const FORWARDING_ADDRESS = 'trips@neyya.ai';

// ─── Service ─────────────────────────────────────────────────────────────────

export class BookingIngestionService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Main ingestion entry point.
   * Called when an email is received at trips@neyya.ai.
   */
  async processForwardedBooking(
    fromEmail: string,
    extracted: ExtractedBooking,
  ): Promise<IngestionResult> {
    const normalizedEmail = fromEmail.trim().toLowerCase();

    // Step 1: Look up user by primary email
    const user = await this.db
      .selectFrom('users')
      .select(['id', 'email', 'display_name'])
      .where('email', '=', normalizedEmail)
      .executeTakeFirst();

    if (user) {
      // Existing user — process normally
      return this.processForExistingUser(user.id, extracted);
    }

    // Step 2: Check email aliases (verified only)
    const alias = await this.db
      .selectFrom('user_email_aliases' as any)
      .select(['user_id'])
      .where('email', '=', normalizedEmail)
      .where('is_verified', '=', true)
      .executeTakeFirst();

    if (alias) {
      // Matched via alias — process for the alias owner
      return this.processForExistingUser((alias as any).user_id, extracted);
    }

    // Step 3: Unknown user — store and invite
    return this.storeUnclaimedBooking(normalizedEmail, extracted);
  }

  /**
   * Process a booking for an existing registered user.
   */
  private async processForExistingUser(
    userId: string,
    extracted: ExtractedBooking,
  ): Promise<IngestionResult> {
    // Step 2: Check for duplicates
    const dedupResult = await checkDuplicate(this.db, extracted, userId);
    if (dedupResult.isDuplicate) {
      return {
        status: 'duplicate_discarded',
        bookingId: dedupResult.existingBookingId,
        message: 'This booking already exists in your account.',
      };
    }

    // Step 3: Find matching trip
    const tripMatch = await this.findMatchingTrip(userId, extracted);

    // Step 4: Create the booking
    const createResult = await createBookingFromExtracted(this.db, extracted, userId);

    // Step 5: Assign to trip
    await this.db
      .updateTable('bookings')
      .set({ trip_id: tripMatch.tripId })
      .where('id', '=', createResult.bookingId)
      .execute();

    return {
      status: tripMatch.type === 'new_trip' ? 'new_trip_created' : 'added_to_trip',
      tripId: tripMatch.tripId,
      tripName: tripMatch.tripName,
      bookingId: createResult.bookingId,
      message: tripMatch.type === 'new_trip'
        ? `Created new trip "${tripMatch.tripName}" and added your booking.`
        : `Added booking to trip "${tripMatch.tripName}".`,
    };
  }

  /**
   * Find a matching trip for a booking using priority order:
   * 1. Shared trips matching by date overlap
   * 2. Shared trips matching by destination
   * 3. User's own trips matching by date/destination
   * 4. Create new trip (ask user to confirm)
   */
  async findMatchingTrip(
    userId: string,
    extracted: ExtractedBooking,
  ): Promise<TripMatchResult> {
    const bookingStart = extractStartDate(extracted);
    const bookingEnd = extractEndDate(extracted);
    const destination = extractDestination(extracted);

    // Priority 1 & 2: Check shared trips first
    const sharedTripIds = await this.db
      .selectFrom('trip_members')
      .select('trip_id')
      .where('user_id', '=', userId)
      .execute();

    if (sharedTripIds.length > 0) {
      const sharedTrips = await this.db
        .selectFrom('trips')
        .select(['id', 'name', 'start_date', 'end_date'])
        .where('id', 'in', sharedTripIds.map((t) => t.trip_id))
        .execute();

      // Check date overlap on shared trips
      if (bookingStart) {
        for (const trip of sharedTrips) {
          if (trip.start_date && trip.end_date) {
            const tripStart = new Date(trip.start_date);
            const tripEnd = new Date(trip.end_date);
            const bStart = new Date(bookingStart);
            const buffer = 24 * 60 * 60 * 1000;
            if (bStart >= new Date(tripStart.getTime() - buffer) &&
                bStart <= new Date(tripEnd.getTime() + buffer)) {
              return { type: 'date_overlap', tripId: trip.id, tripName: trip.name };
            }
          }
        }
      }

      // Check destination on shared trips
      if (destination) {
        const destLower = destination.toLowerCase();
        for (const trip of sharedTrips) {
          const tripName = (trip.name ?? '').toLowerCase();
          if (tripName.includes(destLower) || destLower.includes(tripName)) {
            return { type: 'destination_match', tripId: trip.id, tripName: trip.name };
          }
        }
      }
    }

    // Priority 3: User's own trips
    const ownTrips = await this.db
      .selectFrom('trips')
      .select(['id', 'name', 'start_date', 'end_date'])
      .where('owner_id', '=', userId)
      .execute();

    // Priority 3 continued: Date overlap on own trips
    if (bookingStart) {
      for (const trip of ownTrips) {
        if (trip.start_date && trip.end_date) {
          const tripStart = new Date(trip.start_date);
          const tripEnd = new Date(trip.end_date);
          const bStart = new Date(bookingStart);
          const bEnd = bookingEnd ? new Date(bookingEnd) : bStart;

          // Check overlap: booking dates fall within trip range (with 1-day buffer)
          const buffer = 24 * 60 * 60 * 1000; // 1 day
          if (bStart >= new Date(tripStart.getTime() - buffer) &&
              bStart <= new Date(tripEnd.getTime() + buffer)) {
            return { type: 'date_overlap', tripId: trip.id, tripName: trip.name };
          }
          if (bEnd >= new Date(tripStart.getTime() - buffer) &&
              bEnd <= new Date(tripEnd.getTime() + buffer)) {
            return { type: 'date_overlap', tripId: trip.id, tripName: trip.name };
          }
        }
      }
    }

    // Priority 3 continued: Destination match on own trips
    if (destination) {
      const destLower = destination.toLowerCase();
      for (const trip of ownTrips) {
        const tripName = (trip.name ?? '').toLowerCase();
        if (tripName.includes(destLower) || destLower.includes(tripName)) {
          return { type: 'destination_match', tripId: trip.id, tripName: trip.name };
        }
      }
    }

    // Priority 4: Create new trip
    const tripName = generateTripName(destination, bookingStart);
    const newTrip = await this.db
      .insertInto('trips')
      .values({
        owner_id: userId,
        name: tripName,
        start_date: bookingStart ?? null,
        end_date: bookingEnd ?? bookingStart ?? null,
      })
      .returning(['id', 'name'])
      .executeTakeFirstOrThrow();

    return { type: 'new_trip', tripId: newTrip.id, tripName: newTrip.name };
  }

  /**
   * Store a booking for an unregistered user.
   * Data is held for 60 days.
   */
  private async storeUnclaimedBooking(
    email: string,
    extracted: ExtractedBooking,
  ): Promise<IngestionResult> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + UNCLAIMED_EXPIRY_DAYS);

    const claimToken = randomUUID();
    const destination = extractDestination(extracted);
    const startDate = extractStartDate(extracted);
    const endDate = extractEndDate(extracted);

    await this.db
      .insertInto('unclaimed_bookings')
      .values({
        email,
        booking_type: extracted.type,
        destination: destination ?? null,
        start_date: startDate ?? null,
        end_date: endDate ?? null,
        raw_data: JSON.stringify(extracted),
        expires_at: expiresAt,
        claimed: false,
        claim_token: claimToken,
      })
      .execute();

    // Queue invitation email
    await this.queueInvitationEmail(email, extracted, claimToken, expiresAt);

    return {
      status: 'pending_user_signup',
      message: `Booking stored. Invitation email sent to ${email}. Data held for 60 days.`,
    };
  }

  /**
   * Claim unclaimed bookings when a user signs up or logs in.
   */
  async claimBookingsForUser(
    userId: string,
    email: string,
  ): Promise<number> {
    // Find all unclaimed bookings for this email
    const unclaimed = await this.db
      .selectFrom('unclaimed_bookings')
      .selectAll()
      .where('email', '=', email.toLowerCase())
      .where('claimed', '=', false)
      .where('expires_at', '>', new Date())
      .execute();

    let claimedCount = 0;

    for (const booking of unclaimed) {
      try {
        const extracted = JSON.parse(booking.raw_data) as ExtractedBooking;
        const result = await this.processForExistingUser(userId, extracted);

        if (result.status !== 'error') {
          // Mark as claimed
          await this.db
            .updateTable('unclaimed_bookings')
            .set({ claimed: true })
            .where('id', '=', booking.id)
            .execute();
          claimedCount++;
        }
      } catch {
        // Skip failed ones
      }
    }

    return claimedCount;
  }

  /**
   * Claim a booking using a verification token (for different-email users).
   */
  async claimByToken(
    userId: string,
    claimToken: string,
  ): Promise<IngestionResult> {
    const booking = await this.db
      .selectFrom('unclaimed_bookings')
      .selectAll()
      .where('claim_token', '=', claimToken)
      .where('claimed', '=', false)
      .where('expires_at', '>', new Date())
      .executeTakeFirst();

    if (!booking) {
      return { status: 'error', message: 'Invalid or expired claim token.' };
    }

    const extracted = JSON.parse(booking.raw_data) as ExtractedBooking;
    const result = await this.processForExistingUser(userId, extracted);

    if (result.status !== 'error') {
      await this.db
        .updateTable('unclaimed_bookings')
        .set({ claimed: true })
        .where('id', '=', booking.id)
        .execute();
    }

    return result;
  }

  /**
   * Clean up expired unclaimed bookings (called by a scheduled job).
   */
  async cleanupExpired(): Promise<number> {
    const result = await this.db
      .deleteFrom('unclaimed_bookings')
      .where('expires_at', '<', new Date())
      .execute();

    return Number(result[0]?.numDeletedRows ?? 0);
  }

  /**
   * Queue an invitation email for an unregistered user.
   */
  private async queueInvitationEmail(
    email: string,
    extracted: ExtractedBooking,
    claimToken: string,
    expiresAt: Date,
  ): Promise<void> {
    const destination = extractDestination(extracted) ?? 'your destination';
    const startDate = extractStartDate(extracted) ?? '';
    const bookingType = extracted.type === 'flight' ? 'flight' :
      extracted.type === 'hotel' ? 'hotel reservation' : 'car rental';

    const signupUrl = `https://neyya.ai/register?claim=${claimToken}`;
    const loginUrl = `https://neyya.ai/login?claim=${claimToken}`;

    // In production, this would send via SES or queue to SQS
    console.log(`[BookingIngestion] Invitation email queued for ${email}:`);
    console.log(`  Booking: ${bookingType} to ${destination} on ${startDate}`);
    console.log(`  Signup URL: ${signupUrl}`);
    console.log(`  Login URL: ${loginUrl}`);
    console.log(`  Expires: ${expiresAt.toISOString()} (60 days)`);

    // Store the pending email notification
    await this.db
      .insertInto('scheduled_notifications')
      .values({
        user_id: 'system', // system-generated
        type: 'invitation_email',
        status: 'scheduled',
        fire_at: new Date(), // send immediately
        payload: JSON.stringify({
          to: email,
          subject: `Your ${bookingType} to ${destination} is waiting on Neyya`,
          body: {
            bookingType,
            destination,
            startDate,
            signupUrl,
            loginUrl,
            expiresAt: expiresAt.toISOString(),
            expiryDays: UNCLAIMED_EXPIRY_DAYS,
          },
        }),
      })
      .execute();
  }
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Extract start date from a booking (varies by type).
 */
function extractStartDate(extracted: ExtractedBooking): string | null {
  const fields = extracted.fields as Record<string, string | undefined>;

  if (extracted.type === 'flight') {
    return fields['departureTime']?.slice(0, 10) ?? null;
  }
  if (extracted.type === 'hotel') {
    return fields['checkInDate']?.slice(0, 10) ?? null;
  }
  if (extracted.type === 'car_rental') {
    return fields['pickupDate']?.slice(0, 10) ?? null;
  }
  return null;
}

/**
 * Extract end date from a booking.
 */
function extractEndDate(extracted: ExtractedBooking): string | null {
  const fields = extracted.fields as Record<string, string | undefined>;

  if (extracted.type === 'flight') {
    return fields['arrivalTime']?.slice(0, 10) ?? fields['departureTime']?.slice(0, 10) ?? null;
  }
  if (extracted.type === 'hotel') {
    return fields['checkOutDate']?.slice(0, 10) ?? null;
  }
  if (extracted.type === 'car_rental') {
    return fields['returnDate']?.slice(0, 10) ?? null;
  }
  return null;
}

/**
 * Extract destination from a booking.
 */
function extractDestination(extracted: ExtractedBooking): string | null {
  const fields = extracted.fields as Record<string, string | undefined>;

  if (extracted.type === 'flight') {
    return fields['arrivalAirport'] ?? null;
  }
  if (extracted.type === 'hotel') {
    return fields['hotelName'] ?? fields['address'] ?? null;
  }
  if (extracted.type === 'car_rental') {
    return fields['pickupLocation'] ?? null;
  }
  return null;
}

/**
 * Generate a trip name from destination and date.
 * E.g., "Paris, Aug 2026" or "Trip - Aug 2026"
 */
function generateTripName(destination: string | null, startDate: string | null): string {
  const datePart = startDate
    ? new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : '';

  if (destination && datePart) {
    return `${destination}, ${datePart}`;
  }
  if (destination) {
    return destination;
  }
  if (datePart) {
    return `Trip — ${datePart}`;
  }
  return `New Trip — ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

export { FORWARDING_ADDRESS, UNCLAIMED_EXPIRY_DAYS };
