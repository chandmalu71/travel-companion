/**
 * Booking CRUD routes: create, list, get, update, delete.
 * Supports flight, hotel, and car rental bookings with type-specific detail tables.
 * Booking status (upcoming, in-progress, completed) is computed dynamically.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { bookingCreationSchema } from '@travel-companion/shared';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type BookingStatus = 'upcoming' | 'in-progress' | 'completed';

export interface BookingWithDetails {
  id: string;
  user_id: string;
  trip_id: string | null;
  type: 'flight' | 'hotel' | 'car_rental';
  source: 'email' | 'manual';
  source_email_id: string | null;
  checked_in: boolean;
  created_at: Date;
  updated_at: Date;
  status: BookingStatus;
  flight_details?: Record<string, unknown> | null;
  hotel_details?: Record<string, unknown> | null;
  car_rental_details?: Record<string, unknown> | null;
}

interface BookingQueryParams {
  status?: 'upcoming' | 'in-progress' | 'completed';
  trip_id?: string;
}

// ─── Status Calculation ──────────────────────────────────────────────────────

/**
 * Calculate booking status based on current time vs start/end datetimes.
 * - "upcoming": now < start datetime
 * - "in-progress": start datetime <= now <= end datetime
 * - "completed": now > end datetime
 *
 * Start/end logic per type:
 * - Flight: departure_time / arrival_time
 * - Hotel: checkin_date / checkout_date
 * - Car rental: pickup_time / return_time
 */
export function calculateBookingStatus(
  booking: {
    type: 'flight' | 'hotel' | 'car_rental';
    flight_details?: { departure_time?: string | Date | null; arrival_time?: string | Date | null } | null;
    hotel_details?: { checkin_date?: string | null; checkout_date?: string | null } | null;
    car_rental_details?: { pickup_time?: string | Date | null; return_time?: string | Date | null } | null;
  },
  now: Date = new Date(),
): BookingStatus {
  let startTime: Date | null = null;
  let endTime: Date | null = null;

  switch (booking.type) {
    case 'flight':
      if (booking.flight_details?.departure_time) {
        startTime = new Date(booking.flight_details.departure_time);
      }
      if (booking.flight_details?.arrival_time) {
        endTime = new Date(booking.flight_details.arrival_time);
      }
      break;
    case 'hotel':
      if (booking.hotel_details?.checkin_date) {
        // For hotel, checkin_date is a date string (no time), treat as start of day
        startTime = new Date(booking.hotel_details.checkin_date + 'T00:00:00.000Z');
      }
      if (booking.hotel_details?.checkout_date) {
        // checkout_date is end of day
        endTime = new Date(booking.hotel_details.checkout_date + 'T23:59:59.999Z');
      }
      break;
    case 'car_rental':
      if (booking.car_rental_details?.pickup_time) {
        startTime = new Date(booking.car_rental_details.pickup_time);
      }
      if (booking.car_rental_details?.return_time) {
        endTime = new Date(booking.car_rental_details.return_time);
      }
      break;
  }

  // If we don't have both dates, default to upcoming
  if (!startTime || !endTime) {
    if (startTime && !endTime) {
      // Has start but no end: upcoming if before start, in-progress otherwise
      return now < startTime ? 'upcoming' : 'in-progress';
    }
    if (!startTime && endTime) {
      // Has end but no start: completed if past end, in-progress otherwise
      return now > endTime ? 'completed' : 'in-progress';
    }
    return 'upcoming';
  }

  if (now < startTime) {
    return 'upcoming';
  }
  if (now > endTime) {
    return 'completed';
  }
  return 'in-progress';
}

/**
 * Get the earliest start time for a booking (used for sorting).
 */
function getBookingStartTime(booking: {
  type: string;
  flight_details?: { departure_time?: string | Date | null } | null;
  hotel_details?: { checkin_date?: string | null } | null;
  car_rental_details?: { pickup_time?: string | Date | null } | null;
}): Date {
  switch (booking.type) {
    case 'flight':
      if (booking.flight_details?.departure_time) {
        return new Date(booking.flight_details.departure_time);
      }
      break;
    case 'hotel':
      if (booking.hotel_details?.checkin_date) {
        return new Date(booking.hotel_details.checkin_date + 'T00:00:00.000Z');
      }
      break;
    case 'car_rental':
      if (booking.car_rental_details?.pickup_time) {
        return new Date(booking.car_rental_details.pickup_time);
      }
      break;
  }
  // Default to far future for bookings without dates (sort last)
  return new Date('9999-12-31T23:59:59.999Z');
}

// ─── Route Registration ──────────────────────────────────────────────────────

export interface BookingRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register all booking CRUD routes on the Fastify instance.
 */
export async function registerBookingRoutes(
  app: FastifyInstance,
  options: BookingRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/bookings ──────────────────────────────────────────────────

  app.post(
    '/api/bookings',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = bookingCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Booking validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { type, trip_id, flight_details, hotel_details, car_rental_details } = parseResult.data;
      const userId = request.user!.userId;

      try {
        // Use a transaction to insert booking + type-specific details atomically
        const result = await db.transaction().execute(async (trx) => {
          // Insert the main booking record
          const booking = await trx
            .insertInto('bookings')
            .values({
              user_id: userId,
              trip_id: trip_id ?? null,
              type,
              source: 'manual',
              source_email_id: null,
            })
            .returning(['id', 'user_id', 'trip_id', 'type', 'source', 'source_email_id', 'checked_in', 'created_at', 'updated_at'])
            .executeTakeFirstOrThrow();

          // Insert type-specific details
          let details: Record<string, unknown> | null = null;

          if (type === 'flight' && flight_details) {
            const flightRow = await trx
              .insertInto('flight_details')
              .values({
                booking_id: booking.id,
                airline: flight_details.airline ?? null,
                flight_number: flight_details.flight_number ?? null,
                departure_airport: flight_details.departure_airport ?? null,
                arrival_airport: flight_details.arrival_airport ?? null,
                departure_time: flight_details.departure_time ? new Date(flight_details.departure_time) : null,
                arrival_time: flight_details.arrival_time ? new Date(flight_details.arrival_time) : null,
                departure_lat: null,
                departure_lng: null,
                arrival_lat: null,
                arrival_lng: null,
                checkin_window_opens: null,
                checkin_window_closes: null,
              })
              .returning(['booking_id', 'airline', 'flight_number', 'departure_airport', 'arrival_airport', 'departure_time', 'arrival_time'])
              .executeTakeFirstOrThrow();
            details = flightRow as unknown as Record<string, unknown>;
          } else if (type === 'hotel' && hotel_details) {
            const hotelRow = await trx
              .insertInto('hotel_details')
              .values({
                booking_id: booking.id,
                hotel_name: hotel_details.hotel_name ?? null,
                address: hotel_details.address ?? null,
                checkin_date: hotel_details.checkin_date ?? null,
                checkout_date: hotel_details.checkout_date ?? null,
                latitude: null,
                longitude: null,
                confirmation_number: hotel_details.confirmation_number ?? null,
              })
              .returning(['booking_id', 'hotel_name', 'address', 'checkin_date', 'checkout_date', 'confirmation_number'])
              .executeTakeFirstOrThrow();
            details = hotelRow as unknown as Record<string, unknown>;
          } else if (type === 'car_rental' && car_rental_details) {
            const carRow = await trx
              .insertInto('car_rental_details')
              .values({
                booking_id: booking.id,
                company: car_rental_details.company ?? null,
                vehicle_type: car_rental_details.vehicle_type ?? null,
                pickup_location: car_rental_details.pickup_location ?? null,
                return_location: car_rental_details.return_location ?? null,
                pickup_time: car_rental_details.pickup_time ? new Date(car_rental_details.pickup_time) : null,
                return_time: car_rental_details.return_time ? new Date(car_rental_details.return_time) : null,
                pickup_lat: null,
                pickup_lng: null,
                return_lat: null,
                return_lng: null,
                confirmation_number: car_rental_details.confirmation_number ?? null,
              })
              .returning(['booking_id', 'company', 'vehicle_type', 'pickup_location', 'return_location', 'pickup_time', 'return_time', 'confirmation_number'])
              .executeTakeFirstOrThrow();
            details = carRow as unknown as Record<string, unknown>;
          }

          return { booking, details };
        });

        const detailsForStatus = {
          flight_details: type === 'flight' ? result.details : null,
          hotel_details: type === 'hotel' ? result.details : null,
          car_rental_details: type === 'car_rental' ? result.details : null,
        };

        const status = calculateBookingStatus({ type, ...detailsForStatus });

        const response: BookingWithDetails = {
          ...result.booking,
          status,
          flight_details: type === 'flight' ? result.details : undefined,
          hotel_details: type === 'hotel' ? result.details : undefined,
          car_rental_details: type === 'car_rental' ? result.details : undefined,
        };

        return reply.status(201).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create booking');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the booking',
        });
      }
    },
  );

  // ─── GET /api/bookings ───────────────────────────────────────────────────

  app.get(
    '/api/bookings',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Querystring: BookingQueryParams }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { status: statusFilter, trip_id } = request.query;

      try {
        // Fetch all bookings for the user
        let query = db
          .selectFrom('bookings')
          .selectAll()
          .where('user_id', '=', userId);

        if (trip_id) {
          query = query.where('trip_id', '=', trip_id);
        }

        const bookings = await query.execute();

        // Fetch details for each booking type
        const bookingIds = bookings.map((b) => b.id);

        const [flightDetails, hotelDetails, carRentalDetails] = await Promise.all([
          bookingIds.length > 0
            ? db.selectFrom('flight_details').selectAll().where('booking_id', 'in', bookingIds).execute()
            : [],
          bookingIds.length > 0
            ? db.selectFrom('hotel_details').selectAll().where('booking_id', 'in', bookingIds).execute()
            : [],
          bookingIds.length > 0
            ? db.selectFrom('car_rental_details').selectAll().where('booking_id', 'in', bookingIds).execute()
            : [],
        ]);

        // Index details by booking_id for O(1) lookup
        const flightMap = new Map(flightDetails.map((fd) => [fd.booking_id, fd]));
        const hotelMap = new Map(hotelDetails.map((hd) => [hd.booking_id, hd]));
        const carRentalMap = new Map(carRentalDetails.map((cd) => [cd.booking_id, cd]));

        // Build response with computed status
        const now = new Date();
        let results: BookingWithDetails[] = bookings.map((booking) => {
          const fd = booking.type === 'flight' ? flightMap.get(booking.id) : null;
          const hd = booking.type === 'hotel' ? hotelMap.get(booking.id) : null;
          const cd = booking.type === 'car_rental' ? carRentalMap.get(booking.id) : null;

          const status = calculateBookingStatus(
            {
              type: booking.type,
              flight_details: fd ? { departure_time: fd.departure_time, arrival_time: fd.arrival_time } : null,
              hotel_details: hd ? { checkin_date: hd.checkin_date, checkout_date: hd.checkout_date } : null,
              car_rental_details: cd ? { pickup_time: cd.pickup_time, return_time: cd.return_time } : null,
            },
            now,
          );

          return {
            id: booking.id,
            user_id: booking.user_id,
            trip_id: booking.trip_id,
            type: booking.type,
            source: booking.source,
            source_email_id: booking.source_email_id,
            checked_in: booking.checked_in,
            created_at: booking.created_at,
            updated_at: booking.updated_at,
            status,
            flight_details: fd ? (fd as unknown as Record<string, unknown>) : undefined,
            hotel_details: hd ? (hd as unknown as Record<string, unknown>) : undefined,
            car_rental_details: cd ? (cd as unknown as Record<string, unknown>) : undefined,
          };
        });

        // Filter by status if requested (computed in app layer, not SQL)
        if (statusFilter) {
          results = results.filter((b) => b.status === statusFilter);
        }

        // Sort by earliest date ascending
        results.sort((a, b) => {
          const aTime = getBookingStartTime(a as unknown as Parameters<typeof getBookingStartTime>[0]);
          const bTime = getBookingStartTime(b as unknown as Parameters<typeof getBookingStartTime>[0]);
          return aTime.getTime() - bTime.getTime();
        });

        return reply.status(200).send({ bookings: results });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list bookings');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing bookings',
        });
      }
    },
  );

  // ─── GET /api/bookings/:bookingId ────────────────────────────────────────

  app.get(
    '/api/bookings/:bookingId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { bookingId } = request.params;

      try {
        const booking = await db
          .selectFrom('bookings')
          .selectAll()
          .where('id', '=', bookingId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!booking) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Booking not found',
          });
        }

        // Fetch type-specific details
        let details: Record<string, unknown> | null = null;
        if (booking.type === 'flight') {
          const fd = await db.selectFrom('flight_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = fd ? (fd as unknown as Record<string, unknown>) : null;
        } else if (booking.type === 'hotel') {
          const hd = await db.selectFrom('hotel_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = hd ? (hd as unknown as Record<string, unknown>) : null;
        } else if (booking.type === 'car_rental') {
          const cd = await db.selectFrom('car_rental_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = cd ? (cd as unknown as Record<string, unknown>) : null;
        }

        const status = calculateBookingStatus({
          type: booking.type,
          flight_details: booking.type === 'flight' ? details as { departure_time?: string | Date | null; arrival_time?: string | Date | null } | null : null,
          hotel_details: booking.type === 'hotel' ? details as { checkin_date?: string | null; checkout_date?: string | null } | null : null,
          car_rental_details: booking.type === 'car_rental' ? details as { pickup_time?: string | Date | null; return_time?: string | Date | null } | null : null,
        });

        const response: BookingWithDetails = {
          id: booking.id,
          user_id: booking.user_id,
          trip_id: booking.trip_id,
          type: booking.type,
          source: booking.source,
          source_email_id: booking.source_email_id,
          checked_in: booking.checked_in,
          created_at: booking.created_at,
          updated_at: booking.updated_at,
          status,
          flight_details: booking.type === 'flight' ? details : undefined,
          hotel_details: booking.type === 'hotel' ? details : undefined,
          car_rental_details: booking.type === 'car_rental' ? details : undefined,
        };

        return reply.status(200).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to get booking');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while fetching the booking',
        });
      }
    },
  );

  // ─── PUT /api/bookings/:bookingId ────────────────────────────────────────

  app.put(
    '/api/bookings/:bookingId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { bookingId } = request.params;
      const body = request.body as Record<string, unknown>;

      try {
        // Verify the booking exists and belongs to the user
        const existing = await db
          .selectFrom('bookings')
          .select(['id', 'type', 'user_id'])
          .where('id', '=', bookingId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!existing) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Booking not found',
          });
        }

        // Update top-level booking fields if provided
        const bookingUpdates: Record<string, unknown> = {};
        if (body.trip_id !== undefined) {
          bookingUpdates.trip_id = body.trip_id;
        }
        if (body.checked_in !== undefined) {
          bookingUpdates.checked_in = body.checked_in;
        }

        if (Object.keys(bookingUpdates).length > 0) {
          bookingUpdates.updated_at = new Date();
          await db
            .updateTable('bookings')
            .set(bookingUpdates)
            .where('id', '=', bookingId)
            .execute();
        }

        // Update type-specific details
        if (existing.type === 'flight' && body.flight_details) {
          const fd = body.flight_details as Record<string, unknown>;
          const flightUpdates: Record<string, unknown> = {};
          if (fd.airline !== undefined) flightUpdates.airline = fd.airline;
          if (fd.flight_number !== undefined) flightUpdates.flight_number = fd.flight_number;
          if (fd.departure_airport !== undefined) flightUpdates.departure_airport = fd.departure_airport;
          if (fd.arrival_airport !== undefined) flightUpdates.arrival_airport = fd.arrival_airport;
          if (fd.departure_time !== undefined) flightUpdates.departure_time = fd.departure_time ? new Date(fd.departure_time as string) : null;
          if (fd.arrival_time !== undefined) flightUpdates.arrival_time = fd.arrival_time ? new Date(fd.arrival_time as string) : null;

          if (Object.keys(flightUpdates).length > 0) {
            await db
              .updateTable('flight_details')
              .set(flightUpdates)
              .where('booking_id', '=', bookingId)
              .execute();
          }
        } else if (existing.type === 'hotel' && body.hotel_details) {
          const hd = body.hotel_details as Record<string, unknown>;
          const hotelUpdates: Record<string, unknown> = {};
          if (hd.hotel_name !== undefined) hotelUpdates.hotel_name = hd.hotel_name;
          if (hd.address !== undefined) hotelUpdates.address = hd.address;
          if (hd.checkin_date !== undefined) hotelUpdates.checkin_date = hd.checkin_date;
          if (hd.checkout_date !== undefined) hotelUpdates.checkout_date = hd.checkout_date;
          if (hd.confirmation_number !== undefined) hotelUpdates.confirmation_number = hd.confirmation_number;

          if (Object.keys(hotelUpdates).length > 0) {
            await db
              .updateTable('hotel_details')
              .set(hotelUpdates)
              .where('booking_id', '=', bookingId)
              .execute();
          }
        } else if (existing.type === 'car_rental' && body.car_rental_details) {
          const cd = body.car_rental_details as Record<string, unknown>;
          const carUpdates: Record<string, unknown> = {};
          if (cd.company !== undefined) carUpdates.company = cd.company;
          if (cd.vehicle_type !== undefined) carUpdates.vehicle_type = cd.vehicle_type;
          if (cd.pickup_location !== undefined) carUpdates.pickup_location = cd.pickup_location;
          if (cd.return_location !== undefined) carUpdates.return_location = cd.return_location;
          if (cd.pickup_time !== undefined) carUpdates.pickup_time = cd.pickup_time ? new Date(cd.pickup_time as string) : null;
          if (cd.return_time !== undefined) carUpdates.return_time = cd.return_time ? new Date(cd.return_time as string) : null;
          if (cd.confirmation_number !== undefined) carUpdates.confirmation_number = cd.confirmation_number;

          if (Object.keys(carUpdates).length > 0) {
            await db
              .updateTable('car_rental_details')
              .set(carUpdates)
              .where('booking_id', '=', bookingId)
              .execute();
          }
        }

        // Fetch the updated booking to return
        const updatedBooking = await db
          .selectFrom('bookings')
          .selectAll()
          .where('id', '=', bookingId)
          .executeTakeFirstOrThrow();

        let details: Record<string, unknown> | null = null;
        if (updatedBooking.type === 'flight') {
          const fd = await db.selectFrom('flight_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = fd ? (fd as unknown as Record<string, unknown>) : null;
        } else if (updatedBooking.type === 'hotel') {
          const hd = await db.selectFrom('hotel_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = hd ? (hd as unknown as Record<string, unknown>) : null;
        } else if (updatedBooking.type === 'car_rental') {
          const cd = await db.selectFrom('car_rental_details').selectAll().where('booking_id', '=', bookingId).executeTakeFirst();
          details = cd ? (cd as unknown as Record<string, unknown>) : null;
        }

        const status = calculateBookingStatus({
          type: updatedBooking.type,
          flight_details: updatedBooking.type === 'flight' ? details as { departure_time?: string | Date | null; arrival_time?: string | Date | null } | null : null,
          hotel_details: updatedBooking.type === 'hotel' ? details as { checkin_date?: string | null; checkout_date?: string | null } | null : null,
          car_rental_details: updatedBooking.type === 'car_rental' ? details as { pickup_time?: string | Date | null; return_time?: string | Date | null } | null : null,
        });

        const response: BookingWithDetails = {
          id: updatedBooking.id,
          user_id: updatedBooking.user_id,
          trip_id: updatedBooking.trip_id,
          type: updatedBooking.type,
          source: updatedBooking.source,
          source_email_id: updatedBooking.source_email_id,
          checked_in: updatedBooking.checked_in,
          created_at: updatedBooking.created_at,
          updated_at: updatedBooking.updated_at,
          status,
          flight_details: updatedBooking.type === 'flight' ? details : undefined,
          hotel_details: updatedBooking.type === 'hotel' ? details : undefined,
          car_rental_details: updatedBooking.type === 'car_rental' ? details : undefined,
        };

        return reply.status(200).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update booking');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the booking',
        });
      }
    },
  );

  // ─── DELETE /api/bookings/:bookingId ─────────────────────────────────────

  app.delete(
    '/api/bookings/:bookingId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { bookingId } = request.params;

      try {
        // Delete the booking (cascades to detail table via ON DELETE CASCADE)
        const result = await db
          .deleteFrom('bookings')
          .where('id', '=', bookingId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (result.numDeletedRows === 0n) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Booking not found',
          });
        }

        return reply.status(204).send();
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete booking');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the booking',
        });
      }
    },
  );
}
