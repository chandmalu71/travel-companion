/**
 * Gap Detection Service
 *
 * Analyzes trip itineraries to identify planning gaps:
 * - Missing accommodation (nights without hotel bookings)
 * - Missing transportation (locations >50km apart without connecting transport)
 * - Scheduling conflicts (overlapping time ranges on same day)
 * - Unplanned arrival (flight/car arrives with no subsequent activity)
 *
 * Implements Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type GapType =
  | 'missing_accommodation'
  | 'missing_transportation'
  | 'scheduling_conflict'
  | 'unplanned_arrival';

export interface Gap {
  id: string;
  tripId: string;
  type: GapType;
  date: string; // YYYY-MM-DD
  message: string;
  suggestedAction: string;
  severity: 'high' | 'medium' | 'low';
  dismissed: boolean;
  relatedBookingIds: string[];
}

export interface GapDetectionResult {
  tripId: string;
  gaps: Gap[];
  analyzedAt: string;
}

export interface TripBooking {
  id: string;
  type: 'flight' | 'hotel' | 'car_rental';
  startTime: Date;
  endTime: Date;
  startLocation?: { lat: number; lng: number; name: string };
  endLocation?: { lat: number; lng: number; name: string };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class GapDetectorService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Analyze a trip for planning gaps.
   * Skips analysis for trips without dates set.
   */
  async analyzeTrip(tripId: string): Promise<GapDetectionResult> {
    const trip = await this.db
      .selectFrom('trips')
      .select(['id', 'start_date', 'end_date'])
      .where('id', '=', tripId)
      .executeTakeFirst();

    if (!trip || !trip.start_date || !trip.end_date) {
      return {
        tripId,
        gaps: [],
        analyzedAt: new Date().toISOString(),
      };
    }

    const bookings = await this.getTripBookings(tripId);
    const dismissedGapIds = await this.getDismissedGapIds(tripId);

    const gaps: Gap[] = [];

    // Check for accommodation gaps
    const accommodationGaps = this.detectAccommodationGaps(
      tripId,
      trip.start_date,
      trip.end_date,
      bookings,
    );
    gaps.push(...accommodationGaps);

    // Check for transportation gaps
    const transportGaps = this.detectTransportationGaps(tripId, bookings);
    gaps.push(...transportGaps);

    // Check for scheduling conflicts
    const conflictGaps = this.detectSchedulingConflicts(tripId, bookings);
    gaps.push(...conflictGaps);

    // Check for unplanned arrivals
    const arrivalGaps = this.detectUnplannedArrivals(tripId, bookings);
    gaps.push(...arrivalGaps);

    // Mark previously dismissed gaps
    for (const gap of gaps) {
      if (dismissedGapIds.has(gap.id)) {
        gap.dismissed = true;
      }
    }

    return {
      tripId,
      gaps: gaps.filter((g) => !g.dismissed),
      analyzedAt: new Date().toISOString(),
    };
  }

  /**
   * Dismiss a gap alert. Dismissed gaps don't reappear unless underlying data changes.
   */
  async dismissGap(tripId: string, gapId: string): Promise<void> {
    await this.db
      .insertInto('gap_alerts')
      .values({
        trip_id: tripId,
        gap_id: gapId,
        dismissed: true,
        dismissed_at: new Date(),
      })
      .onConflict((oc) =>
        oc.columns(['trip_id', 'gap_id']).doUpdateSet({
          dismissed: true,
          dismissed_at: new Date(),
        }),
      )
      .execute();
  }

  // ─── Detection Methods ───────────────────────────────────────────────────

  /**
   * Detect nights within trip dates not covered by hotel bookings.
   */
  detectAccommodationGaps(
    tripId: string,
    startDate: string,
    endDate: string,
    bookings: TripBooking[],
  ): Gap[] {
    const gaps: Gap[] = [];
    const hotelBookings = bookings.filter((b) => b.type === 'hotel');

    const start = new Date(startDate);
    const end = new Date(endDate);

    // For each night in the trip range
    const current = new Date(start);
    while (current < end) {
      const nightDate = current.toISOString().slice(0, 10);
      const nextDay = new Date(current);
      nextDay.setDate(nextDay.getDate() + 1);

      // Check if any hotel covers this night
      const isCovered = hotelBookings.some((hotel) => {
        const checkIn = new Date(hotel.startTime).toISOString().slice(0, 10);
        const checkOut = new Date(hotel.endTime).toISOString().slice(0, 10);
        return nightDate >= checkIn && nightDate < checkOut;
      });

      if (!isCovered) {
        gaps.push({
          id: `acc-${tripId}-${nightDate}`,
          tripId,
          type: 'missing_accommodation',
          date: nightDate,
          message: `No accommodation booked for the night of ${nightDate}`,
          suggestedAction: 'Book a hotel or confirm you have other arrangements',
          severity: 'high',
          dismissed: false,
          relatedBookingIds: [],
        });
      }

      current.setDate(current.getDate() + 1);
    }

    return gaps;
  }

  /**
   * Detect consecutive-day bookings at different locations (>50km apart)
   * without connecting transport.
   */
  detectTransportationGaps(tripId: string, bookings: TripBooking[]): Gap[] {
    const gaps: Gap[] = [];

    // Sort bookings by start time
    const sorted = [...bookings].sort(
      (a, b) => a.startTime.getTime() - b.startTime.getTime(),
    );

    for (let i = 0; i < sorted.length - 1; i++) {
      const current = sorted[i]!;
      const next = sorted[i + 1]!;

      // Skip if no location data
      if (!current.endLocation || !next.startLocation) continue;

      // Check if they're on consecutive days
      const currentEnd = new Date(current.endTime);
      const nextStart = new Date(next.startTime);
      const daysBetween = Math.ceil(
        (nextStart.getTime() - currentEnd.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysBetween > 1) continue; // Not consecutive

      // Calculate distance between locations
      const distance = haversineDistance(
        current.endLocation.lat,
        current.endLocation.lng,
        next.startLocation.lat,
        next.startLocation.lng,
      );

      // If >50km apart and no connecting transport
      if (distance > 50) {
        const hasTransport = sorted.some(
          (b) =>
            (b.type === 'flight' || b.type === 'car_rental') &&
            b.startTime >= currentEnd &&
            b.endTime <= nextStart,
        );

        if (!hasTransport) {
          const date = currentEnd.toISOString().slice(0, 10);
          gaps.push({
            id: `trans-${tripId}-${current.id}-${next.id}`,
            tripId,
            type: 'missing_transportation',
            date,
            message: `No transport between ${current.endLocation.name} and ${next.startLocation.name} (${Math.round(distance)}km apart)`,
            suggestedAction: 'Book a flight, car rental, or other transport',
            severity: 'medium',
            dismissed: false,
            relatedBookingIds: [current.id, next.id],
          });
        }
      }
    }

    return gaps;
  }

  /**
   * Detect overlapping time ranges on the same day.
   */
  detectSchedulingConflicts(tripId: string, bookings: TripBooking[]): Gap[] {
    const gaps: Gap[] = [];

    // Group by day
    const byDay = new Map<string, TripBooking[]>();
    for (const booking of bookings) {
      const day = booking.startTime.toISOString().slice(0, 10);
      const existing = byDay.get(day) ?? [];
      existing.push(booking);
      byDay.set(day, existing);
    }

    // Check overlaps within each day
    for (const [day, dayBookings] of byDay) {
      for (let i = 0; i < dayBookings.length; i++) {
        for (let j = i + 1; j < dayBookings.length; j++) {
          const a = dayBookings[i]!;
          const b = dayBookings[j]!;

          if (hasTimeOverlap(a.startTime, a.endTime, b.startTime, b.endTime)) {
            gaps.push({
              id: `conflict-${tripId}-${a.id}-${b.id}`,
              tripId,
              type: 'scheduling_conflict',
              date: day,
              message: `Scheduling conflict: overlapping bookings on ${day}`,
              suggestedAction: 'Adjust one of the conflicting bookings',
              severity: 'high',
              dismissed: false,
              relatedBookingIds: [a.id, b.id],
            });
          }
        }
      }
    }

    return gaps;
  }

  /**
   * Detect arrivals with no subsequent activity that day.
   */
  detectUnplannedArrivals(tripId: string, bookings: TripBooking[]): Gap[] {
    const gaps: Gap[] = [];

    const arrivalBookings = bookings.filter(
      (b) => b.type === 'flight' || b.type === 'car_rental',
    );

    for (const arrival of arrivalBookings) {
      const arrivalDay = arrival.endTime.toISOString().slice(0, 10);
      const arrivalTime = arrival.endTime;

      // Check if there's any activity after arrival on the same day
      const hasSubsequent = bookings.some((b) => {
        if (b.id === arrival.id) return false;
        const bDay = b.startTime.toISOString().slice(0, 10);
        return bDay === arrivalDay && b.startTime > arrivalTime;
      });

      if (!hasSubsequent) {
        gaps.push({
          id: `arrival-${tripId}-${arrival.id}`,
          tripId,
          type: 'unplanned_arrival',
          date: arrivalDay,
          message: `No planned activity after arriving on ${arrivalDay}`,
          suggestedAction: 'Plan activities or confirm you have free time intentionally',
          severity: 'low',
          dismissed: false,
          relatedBookingIds: [arrival.id],
        });
      }
    }

    return gaps;
  }

  // ─── Data Access ─────────────────────────────────────────────────────────

  private async getTripBookings(tripId: string): Promise<TripBooking[]> {
    const bookings = await this.db
      .selectFrom('bookings')
      .selectAll()
      .where('trip_id', '=', tripId)
      .execute();

    const result: TripBooking[] = [];

    for (const booking of bookings) {
      let startTime: Date;
      let endTime: Date;

      if (booking.type === 'flight') {
        const details = await this.db
          .selectFrom('flight_details')
          .selectAll()
          .where('booking_id', '=', booking.id)
          .executeTakeFirst();

        if (details?.departure_time && details?.arrival_time) {
          startTime = new Date(details.departure_time);
          endTime = new Date(details.arrival_time);
          result.push({ id: booking.id, type: 'flight', startTime, endTime });
        }
      } else if (booking.type === 'hotel') {
        const details = await this.db
          .selectFrom('hotel_details')
          .selectAll()
          .where('booking_id', '=', booking.id)
          .executeTakeFirst();

        if (details?.checkin_date && details?.checkout_date) {
          startTime = new Date(details.checkin_date);
          endTime = new Date(details.checkout_date);
          result.push({ id: booking.id, type: 'hotel', startTime, endTime });
        }
      } else if (booking.type === 'car_rental') {
        const details = await this.db
          .selectFrom('car_rental_details')
          .selectAll()
          .where('booking_id', '=', booking.id)
          .executeTakeFirst();

        if (details?.pickup_time && details?.return_time) {
          startTime = new Date(details.pickup_time);
          endTime = new Date(details.return_time);
          result.push({ id: booking.id, type: 'car_rental', startTime, endTime });
        }
      }
    }

    return result;
  }

  private async getDismissedGapIds(tripId: string): Promise<Set<string>> {
    const dismissed = await this.db
      .selectFrom('gap_alerts')
      .select('gap_id')
      .where('trip_id', '=', tripId)
      .where('dismissed', '=', true)
      .execute();

    return new Set(dismissed.map((d) => d.gap_id));
  }
}

// ─── Utility Functions (exported for property tests) ─────────────────────────

/**
 * Check if two time intervals overlap.
 * Overlap exists when: start1 < end2 AND start2 < end1
 */
export function hasTimeOverlap(
  start1: Date,
  end1: Date,
  start2: Date,
  end2: Date,
): boolean {
  return start1 < end2 && start2 < end1;
}

/**
 * Calculate haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Check if a night (date string YYYY-MM-DD) is covered by any hotel booking.
 * A hotel covers the night of check-in through the night before check-out.
 */
export function isNightCovered(
  nightDate: string,
  hotelBookings: Array<{ checkIn: string; checkOut: string }>,
): boolean {
  return hotelBookings.some(
    (hotel) => nightDate >= hotel.checkIn && nightDate < hotel.checkOut,
  );
}
