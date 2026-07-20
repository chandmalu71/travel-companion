/**
 * Trip Timeline Route — Returns enriched bookings with type-specific details
 * for rich timeline display.
 *
 * GET /api/trips/:tripId/timeline-enriched
 *
 * Returns bookings with their flight_details, hotel_details, or car_rental_details
 * joined, plus calculated fields (duration, leave-home-by, etc.)
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

export interface EnrichedTimelineItem {
  id: string;
  type: 'flight' | 'hotel' | 'car_rental';
  source: string;
  checkedIn: boolean;
  createdAt: string;
  // Source attachment
  sourceAttachment?: {
    id: string;
    sourceType: string;
    mimeType?: string;
    emailSubject?: string;
    emailFrom?: string;
    emailDate?: string;
  };
  // Flight-specific
  airline?: string;
  flightNumber?: string;
  departureAirport?: string;
  arrivalAirport?: string;
  departureTime?: string;
  arrivalTime?: string;
  flightDurationMinutes?: number;
  leaveHomeBy?: string;
  checkinOpens?: string;
  // Hotel-specific
  hotelName?: string;
  address?: string;
  checkinDate?: string;
  checkoutDate?: string;
  numberOfNights?: number;
  checkinTime?: string; // "15:00" default
  checkoutTime?: string; // "11:00" default
  // Car-specific
  company?: string;
  pickupTime?: string;
  returnTime?: string;
  pickupLocation?: string;
  returnLocation?: string;
  rentalDays?: number;
  // Computed
  status: 'upcoming' | 'active' | 'completed';
  sortDate: string; // For chronological sorting
}

export interface TripTimelineOptions {
  db: Kysely<Database>;
}

export async function registerTripTimelineRoute(
  app: FastifyInstance,
  options: TripTimelineOptions,
): Promise<void> {
  const { db } = options;

  app.get(
    '/api/trips/:tripId/timeline-enriched',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = (request as any).userId as string;
      const now = new Date();

      // Get all bookings for this trip
      const bookings = await db
        .selectFrom('bookings')
        .selectAll()
        .where('trip_id', '=', tripId)
        .execute();

      const items: EnrichedTimelineItem[] = [];

      // Fetch source attachments for all bookings in this trip
      const bookingIds = bookings.map(b => b.id);
      const sourceAttachments = bookingIds.length > 0
        ? await db
            .selectFrom('source_attachments')
            .selectAll()
            .where('entity_type', '=', 'booking')
            .where('entity_id', 'in', bookingIds)
            .execute()
            .catch(() => [] as any[])
        : [];
      const attachmentByBooking = new Map<string, any>();
      for (const sa of sourceAttachments) {
        attachmentByBooking.set(sa.entity_id, sa);
      }

      for (const booking of bookings) {
        const sa = attachmentByBooking.get(booking.id);
        const sourceAttachment = sa ? {
          id: sa.id,
          sourceType: sa.source_type,
          mimeType: sa.mime_type ?? undefined,
          emailSubject: sa.email_subject ?? undefined,
          emailFrom: sa.email_from ?? undefined,
          emailDate: sa.email_date ? new Date(sa.email_date).toISOString() : undefined,
        } : undefined;
        if (booking.type === 'flight') {
          const details = await db
            .selectFrom('flight_details')
            .selectAll()
            .where('booking_id', '=', booking.id)
            .executeTakeFirst();

          const depTime = details?.departure_time ? new Date(details.departure_time) : null;
          const arrTime = details?.arrival_time ? new Date(details.arrival_time) : null;

          // Calculate flight duration
          let durationMin: number | undefined;
          if (depTime && arrTime) {
            durationMin = Math.round((arrTime.getTime() - depTime.getTime()) / 60000);
          }

          // Calculate "leave home by" (3h before for international)
          let leaveBy: string | undefined;
          if (depTime) {
            const leaveDate = new Date(depTime.getTime() - 3 * 60 * 60 * 1000);
            leaveBy = leaveDate.toISOString();
          }

          // Check-in opens 24h before
          let checkinOpens: string | undefined;
          if (depTime) {
            const opens = new Date(depTime.getTime() - 24 * 60 * 60 * 1000);
            checkinOpens = opens.toISOString();
          }

          // Status
          let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
          if (arrTime && now > arrTime) status = 'completed';
          else if (depTime && now >= depTime && arrTime && now <= arrTime) status = 'active';

          items.push({
            id: booking.id,
            type: 'flight',
            source: booking.source,
            sourceAttachment,
            checkedIn: booking.checked_in ?? false,
            createdAt: new Date(booking.created_at).toISOString(),
            airline: details?.airline ?? undefined,
            flightNumber: details?.flight_number ?? undefined,
            departureAirport: details?.departure_airport ?? undefined,
            arrivalAirport: details?.arrival_airport ?? undefined,
            departureTime: depTime?.toISOString(),
            arrivalTime: arrTime?.toISOString(),
            flightDurationMinutes: durationMin,
            leaveHomeBy: leaveBy,
            checkinOpens,
            status,
            sortDate: depTime?.toISOString() ?? new Date(booking.created_at).toISOString(),
          });

        } else if (booking.type === 'hotel') {
          const details = await db
            .selectFrom('hotel_details')
            .selectAll()
            .where('booking_id', '=', booking.id)
            .executeTakeFirst();

          const checkin = details?.checkin_date ? new Date(details.checkin_date) : null;
          const checkout = details?.checkout_date ? new Date(details.checkout_date) : null;

          let nights: number | undefined;
          if (checkin && checkout) {
            nights = Math.round((checkout.getTime() - checkin.getTime()) / (24 * 60 * 60 * 1000));
          }

          let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
          if (checkout && now > checkout) status = 'completed';
          else if (checkin && now >= checkin && checkout && now <= checkout) status = 'active';

          items.push({
            id: booking.id,
            type: 'hotel',
            source: booking.source,
            sourceAttachment,
            checkedIn: booking.checked_in ?? false,
            createdAt: new Date(booking.created_at).toISOString(),
            hotelName: details?.hotel_name ?? undefined,
            address: details?.address ?? undefined,
            checkinDate: checkin?.toISOString()?.slice(0, 10),
            checkoutDate: checkout?.toISOString()?.slice(0, 10),
            numberOfNights: nights,
            checkinTime: '15:00',
            checkoutTime: '11:00',
            status,
            sortDate: checkin?.toISOString() ?? new Date(booking.created_at).toISOString(),
          });

        } else if (booking.type === 'car_rental') {
          const details = await db
            .selectFrom('car_rental_details')
            .selectAll()
            .where('booking_id', '=', booking.id)
            .executeTakeFirst();

          const pickup = details?.pickup_time ? new Date(details.pickup_time) : null;
          const returnTime = details?.return_time ? new Date(details.return_time) : null;

          let days: number | undefined;
          if (pickup && returnTime) {
            days = Math.ceil((returnTime.getTime() - pickup.getTime()) / (24 * 60 * 60 * 1000));
          }

          let status: 'upcoming' | 'active' | 'completed' = 'upcoming';
          if (returnTime && now > returnTime) status = 'completed';
          else if (pickup && now >= pickup && returnTime && now <= returnTime) status = 'active';

          items.push({
            id: booking.id,
            type: 'car_rental',
            source: booking.source,
            sourceAttachment,
            checkedIn: booking.checked_in ?? false,
            createdAt: new Date(booking.created_at).toISOString(),
            company: details?.company ?? undefined,
            pickupTime: pickup?.toISOString(),
            returnTime: returnTime?.toISOString(),
            rentalDays: days,
            status,
            sortDate: pickup?.toISOString() ?? new Date(booking.created_at).toISOString(),
          });
        }
      }

      // Sort by date
      items.sort((a, b) => a.sortDate.localeCompare(b.sortDate));

      return reply.send({ statusCode: 200, data: items });
    },
  );
}
