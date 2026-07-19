/**
 * Trip CRUD routes: create, list, get, update, delete, dashboard, booking assignment.
 * All routes are protected by auth middleware and scoped to the current user.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { tripCreationSchema, tripUpdateSchema } from '@travel-companion/shared';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';
import { calculateBookingStatus, type BookingWithDetails } from './bookings.js';

// ─── Request Interfaces ──────────────────────────────────────────────────────

interface CreateTripBody {
  name: string;
  start_date?: string;
  end_date?: string;
}

interface UpdateTripBody {
  name?: string;
  start_date?: string | null;
  end_date?: string | null;
}

interface TripParams {
  tripId: string;
}

interface AssignBookingBody {
  bookingId: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface TripRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register all trip CRUD routes on the Fastify instance.
 */
export async function registerTripRoutes(
  app: FastifyInstance,
  options: TripRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips ─────────────────────────────────────────────────────

  app.post(
    '/api/trips',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Body: CreateTripBody }>, reply: FastifyReply) => {
      const parseResult = tripCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Trip creation validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { name, start_date, end_date } = parseResult.data;
      const userId = request.user!.userId;

      try {
        const trip = await db
          .insertInto('trips')
          .values({
            owner_id: userId,
            name,
            start_date: start_date ?? null,
            end_date: end_date ?? null,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(201).send(trip);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the trip',
        });
      }
    },
  );

  // ─── GET /api/trips ──────────────────────────────────────────────────────

  app.get(
    '/api/trips',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = request.user!.userId;

      try {
        // Get trips where user is owner or a member
        const ownedTrips = await db
          .selectFrom('trips')
          .selectAll()
          .where('owner_id', '=', userId)
          .orderBy(sql`COALESCE(start_date, '9999-12-31')`, 'asc')
          .execute();

        const memberTripIds = await db
          .selectFrom('trip_members')
          .select('trip_id')
          .where('user_id', '=', userId)
          .execute();

        let sharedTrips: typeof ownedTrips = [];
        if (memberTripIds.length > 0) {
          const ids = memberTripIds.map((m) => m.trip_id);
          sharedTrips = await db
            .selectFrom('trips')
            .selectAll()
            .where('id', 'in', ids)
            .orderBy(sql`COALESCE(start_date, '9999-12-31')`, 'asc')
            .execute();
        }

        // Combine and sort: start_date ASC, NULLS LAST
        const allTrips = [...ownedTrips, ...sharedTrips].sort((a, b) => {
          const aDate = a.start_date ? String(a.start_date) : '9999-12-31';
          const bDate = b.start_date ? String(b.start_date) : '9999-12-31';
          return aDate.localeCompare(bDate);
        });

        return reply.status(200).send({ trips: allTrips });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to list trips');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while listing trips',
        });
      }
    },
  );

  // ─── GET /api/trips/:tripId ──────────────────────────────────────────────

  app.get(
    '/api/trips/:tripId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      try {
        const trip = await db
          .selectFrom('trips')
          .selectAll()
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        // Check access: owner or member
        if (trip.owner_id !== userId) {
          const membership = await db
            .selectFrom('trip_members')
            .select('id')
            .where('trip_id', '=', tripId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

          if (!membership) {
            return reply.status(403).send({
              statusCode: 403,
              error: 'FORBIDDEN',
              message: 'You do not have access to this trip',
            });
          }
        }

        return reply.status(200).send(trip);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to get trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while retrieving the trip',
        });
      }
    },
  );

  // ─── PUT /api/trips/:tripId ──────────────────────────────────────────────

  app.put(
    '/api/trips/:tripId',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Body: UpdateTripBody }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      const parseResult = tripUpdateSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Trip update validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      try {
        // Verify trip exists and user is the owner
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (trip.owner_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the trip owner can update this trip',
          });
        }

        // Build update object from validated data
        const data = parseResult.data;
        const updateFields: Record<string, unknown> = {
          updated_at: new Date(),
        };

        if (data.name !== undefined) {
          updateFields['name'] = data.name;
        }
        if (data.start_date !== undefined) {
          updateFields['start_date'] = data.start_date;
        }
        if (data.end_date !== undefined) {
          updateFields['end_date'] = data.end_date;
        }

        // Also validate cross-field: if only one date is provided in the body,
        // we must also check the existing trip date for consistency
        if (data.start_date !== undefined || data.end_date !== undefined) {
          const existingTrip = await db
            .selectFrom('trips')
            .select(['start_date', 'end_date'])
            .where('id', '=', tripId)
            .executeTakeFirstOrThrow();

          const effectiveStart = data.start_date !== undefined ? data.start_date : existingTrip.start_date;
          const effectiveEnd = data.end_date !== undefined ? data.end_date : existingTrip.end_date;

          if (effectiveStart && effectiveEnd && effectiveEnd < effectiveStart) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'VALIDATION_ERROR',
              message: 'End date must be on or after start date',
            });
          }
        }

        const updatedTrip = await db
          .updateTable('trips')
          .set(updateFields)
          .where('id', '=', tripId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(200).send(updatedTrip);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the trip',
        });
      }
    },
  );

  // ─── DELETE /api/trips/:tripId ───────────────────────────────────────────

  app.delete(
    '/api/trips/:tripId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify trip exists and user is the owner
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        if (trip.owner_id !== userId) {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only the trip owner can delete this trip',
          });
        }

        // Unassign bookings (SET NULL on trip_id) - don't delete them
        await db
          .updateTable('bookings')
          .set({ trip_id: null })
          .where('trip_id', '=', tripId)
          .execute();

        // Unassign favorites (SET NULL on trip_id) - don't delete them
        await db
          .updateTable('favorites')
          .set({ trip_id: null })
          .where('trip_id', '=', tripId)
          .execute();

        // Delete the trip (CASCADE will handle trip_members, timeline_events, etc.)
        await db
          .deleteFrom('trips')
          .where('id', '=', tripId)
          .execute();

        return reply.status(200).send({
          message: 'Trip deleted successfully',
          tripId,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the trip',
        });
      }
    },
  );

  // ─── GET /api/trips/:tripId/dashboard ────────────────────────────────────

  app.get(
    '/api/trips/:tripId/dashboard',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      try {
        // Fetch trip and verify access
        const trip = await db
          .selectFrom('trips')
          .selectAll()
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        // Check access: owner or member
        if (trip.owner_id !== userId) {
          const membership = await db
            .selectFrom('trip_members')
            .select('id')
            .where('trip_id', '=', tripId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

          if (!membership) {
            return reply.status(403).send({
              statusCode: 403,
              error: 'FORBIDDEN',
              message: 'You do not have access to this trip',
            });
          }
        }

        // Fetch all bookings for this trip
        const bookings = await db
          .selectFrom('bookings')
          .selectAll()
          .where('trip_id', '=', tripId)
          .execute();

        const bookingIds = bookings.map((b) => b.id);

        // Fetch type-specific details
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

        // Index details by booking_id
        const flightMap = new Map(flightDetails.map((fd) => [fd.booking_id, fd]));
        const hotelMap = new Map(hotelDetails.map((hd) => [hd.booking_id, hd]));
        const carRentalMap = new Map(carRentalDetails.map((cd) => [cd.booking_id, cd]));

        // Build bookings with status, sorted by earliest date ascending
        const now = new Date();
        const bookingsWithStatus: BookingWithDetails[] = bookings.map((booking) => {
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

        // Sort by earliest start date ascending
        bookingsWithStatus.sort((a, b) => {
          const aStart = getBookingEarliestDate(a);
          const bStart = getBookingEarliestDate(b);
          return aStart.getTime() - bStart.getTime();
        });

        // Fetch non-dismissed gap alerts for the trip
        const gapAlerts = await db
          .selectFrom('gap_alerts')
          .selectAll()
          .where('trip_id', '=', tripId)
          .where('dismissed', '=', false)
          .execute();

        // Weather summary placeholder (service not built yet)
        const weatherSummary = {
          available: false,
          message: 'Weather service not yet configured',
          destinations: [],
        };

        // Expense summary placeholder (service not built yet)
        const expenseSummary = {
          totalSpent: { amount: 0, currency: 'USD' },
          budget: trip.budget ? { amount: parseFloat(trip.budget), currency: trip.budget_currency ?? 'USD' } : null,
          budgetPercentage: null,
          byCategory: {},
        };

        return reply.status(200).send({
          trip,
          bookings: bookingsWithStatus,
          gapAlerts,
          weatherSummary,
          expenseSummary,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to load trip dashboard');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading the trip dashboard',
        });
      }
    },
  );

  // ─── POST /api/trips/:tripId/bookings ────────────────────────────────────

  app.post(
    '/api/trips/:tripId/bookings',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Body: AssignBookingBody }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;
      const body = request.body as AssignBookingBody;

      if (!body.bookingId || typeof body.bookingId !== 'string') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'bookingId is required and must be a string',
        });
      }

      try {
        // Verify trip exists
        const trip = await db
          .selectFrom('trips')
          .select(['id', 'owner_id'])
          .where('id', '=', tripId)
          .executeTakeFirst();

        if (!trip) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Trip not found',
          });
        }

        // Verify user has access to the trip (owner or edit collaborator)
        if (trip.owner_id !== userId) {
          const membership = await db
            .selectFrom('trip_members')
            .select(['id', 'access_level'])
            .where('trip_id', '=', tripId)
            .where('user_id', '=', userId)
            .executeTakeFirst();

          if (!membership || membership.access_level !== 'edit') {
            return reply.status(403).send({
              statusCode: 403,
              error: 'FORBIDDEN',
              message: 'You do not have edit access to this trip',
            });
          }
        }

        // Verify booking exists and belongs to the user
        const booking = await db
          .selectFrom('bookings')
          .select(['id', 'user_id'])
          .where('id', '=', body.bookingId)
          .where('user_id', '=', userId)
          .executeTakeFirst();

        if (!booking) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Booking not found or does not belong to you',
          });
        }

        // Assign the booking to the trip
        const updatedBooking = await db
          .updateTable('bookings')
          .set({ trip_id: tripId, updated_at: new Date() })
          .where('id', '=', body.bookingId)
          .returningAll()
          .executeTakeFirstOrThrow();

        return reply.status(200).send({
          message: 'Booking assigned to trip successfully',
          booking: updatedBooking,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to assign booking to trip');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while assigning the booking',
        });
      }
    },
  );

  // ─── GET /api/bookings/suggestions ───────────────────────────────────────

  app.get(
    '/api/bookings/suggestions',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Querystring: { bookingId?: string } }>, reply: FastifyReply) => {
      const userId = request.user!.userId;
      const { bookingId } = request.query;

      if (!bookingId) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'bookingId query parameter is required',
        });
      }

      try {
        // Fetch the booking
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

        // Get booking dates for overlap matching
        let bookingStart: string | null = null;
        let bookingEnd: string | null = null;
        let bookingDestination: string | null = null;

        if (booking.type === 'flight') {
          const fd = await db
            .selectFrom('flight_details')
            .selectAll()
            .where('booking_id', '=', bookingId)
            .executeTakeFirst();
          if (fd) {
            bookingStart = fd.departure_time ? new Date(fd.departure_time).toISOString().split('T')[0]! : null;
            bookingEnd = fd.arrival_time ? new Date(fd.arrival_time).toISOString().split('T')[0]! : null;
            bookingDestination = fd.arrival_airport ?? null;
          }
        } else if (booking.type === 'hotel') {
          const hd = await db
            .selectFrom('hotel_details')
            .selectAll()
            .where('booking_id', '=', bookingId)
            .executeTakeFirst();
          if (hd) {
            bookingStart = hd.checkin_date ?? null;
            bookingEnd = hd.checkout_date ?? null;
            bookingDestination = hd.address ?? null;
          }
        } else if (booking.type === 'car_rental') {
          const cd = await db
            .selectFrom('car_rental_details')
            .selectAll()
            .where('booking_id', '=', bookingId)
            .executeTakeFirst();
          if (cd) {
            bookingStart = cd.pickup_time ? new Date(cd.pickup_time).toISOString().split('T')[0]! : null;
            bookingEnd = cd.return_time ? new Date(cd.return_time).toISOString().split('T')[0]! : null;
            bookingDestination = cd.pickup_location ?? null;
          }
        }

        // Fetch all user trips to find matches
        const trips = await db
          .selectFrom('trips')
          .selectAll()
          .where('owner_id', '=', userId)
          .execute();

        // Find trips with overlapping dates or matching destination
        const suggestions = trips
          .filter((trip) => {
            // Check date overlap
            if (bookingStart && bookingEnd && trip.start_date && trip.end_date) {
              const hasOverlap = bookingStart <= trip.end_date && bookingEnd >= trip.start_date;
              if (hasOverlap) return true;
            }

            // Check destination match (simple substring match on trip name)
            if (bookingDestination && trip.name) {
              const normalizedDest = bookingDestination.toLowerCase();
              const normalizedName = trip.name.toLowerCase();
              if (normalizedName.includes(normalizedDest) || normalizedDest.includes(normalizedName)) {
                return true;
              }
            }

            return false;
          })
          .map((trip) => ({
            tripId: trip.id,
            tripName: trip.name,
            startDate: trip.start_date,
            endDate: trip.end_date,
            matchReason: getMatchReason(trip, bookingStart, bookingEnd, bookingDestination),
          }));

        return reply.status(200).send({ suggestions });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to get trip suggestions');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while getting suggestions',
        });
      }
    },
  );
}

// ─── Helper Functions ────────────────────────────────────────────────────────

/**
 * Get the earliest date for a booking (used for sorting).
 */
function getBookingEarliestDate(booking: BookingWithDetails): Date {
  if (booking.type === 'flight' && booking.flight_details) {
    const fd = booking.flight_details as { departure_time?: string | Date | null };
    if (fd.departure_time) return new Date(fd.departure_time);
  } else if (booking.type === 'hotel' && booking.hotel_details) {
    const hd = booking.hotel_details as { checkin_date?: string | null };
    if (hd.checkin_date) return new Date(hd.checkin_date + 'T00:00:00.000Z');
  } else if (booking.type === 'car_rental' && booking.car_rental_details) {
    const cd = booking.car_rental_details as { pickup_time?: string | Date | null };
    if (cd.pickup_time) return new Date(cd.pickup_time);
  }
  return new Date('9999-12-31T23:59:59.999Z');
}

/**
 * Determine why a trip was suggested for a booking.
 */
function getMatchReason(
  trip: { start_date: string | null; end_date: string | null; name: string },
  bookingStart: string | null,
  bookingEnd: string | null,
  bookingDestination: string | null,
): string {
  const reasons: string[] = [];

  if (bookingStart && bookingEnd && trip.start_date && trip.end_date) {
    const hasOverlap = bookingStart <= trip.end_date && bookingEnd >= trip.start_date;
    if (hasOverlap) reasons.push('overlapping_dates');
  }

  if (bookingDestination && trip.name) {
    const normalizedDest = bookingDestination.toLowerCase();
    const normalizedName = trip.name.toLowerCase();
    if (normalizedName.includes(normalizedDest) || normalizedDest.includes(normalizedName)) {
      reasons.push('matching_destination');
    }
  }

  return reasons.join(',') || 'unknown';
}
