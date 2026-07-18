/**
 * Timeline event routes: GET timeline, POST/PUT/DELETE custom events.
 * Combines custom events, bookings, and favorites into a unified timeline view.
 * Supports detailed (day-by-day with time slots) and overview (count, titles, time range) views.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { timelineEventCreationSchema, timelineEventUpdateSchema } from '@travel-companion/shared';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface TripParams {
  tripId: string;
}

interface EventParams {
  tripId: string;
  eventId: string;
}

interface TimelineQueryParams {
  view?: 'detailed' | 'overview';
}

interface TimelineEventResponse {
  id: string;
  trip_id: string;
  title: string;
  event_time: string | null;
  all_day: boolean;
  location: string | null;
  notes: string | null;
  event_type: 'booking' | 'favorite' | 'custom';
  reference_id: string | null;
  added_by: string | null;
  created_at: string;
  updated_at: string;
}

interface DayDetailedView {
  date: string;
  events: TimelineEventResponse[];
}

interface DayOverviewView {
  date: string;
  count: number;
  titles: string[];
  time_range: { earliest: string | null; latest: string | null };
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface TimelineRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register all timeline event routes on the Fastify instance.
 */
export async function registerTimelineRoutes(
  app: FastifyInstance,
  options: TimelineRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/timeline ─────────────────────────────────────

  app.get(
    '/api/trips/:tripId/timeline',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: TripParams; Querystring: TimelineQueryParams }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;
      const view = request.query.view ?? 'detailed';

      if (view !== 'detailed' && view !== 'overview') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: "View must be 'detailed' or 'overview'",
        });
      }

      try {
        // Verify trip exists and user has access
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

        // Fetch custom timeline events from the database
        const customEvents = await db
          .selectFrom('timeline_events')
          .selectAll()
          .where('trip_id', '=', tripId)
          .execute();

        // Fetch bookings for this trip to generate booking events
        const bookings = await db
          .selectFrom('bookings')
          .selectAll()
          .where('trip_id', '=', tripId)
          .execute();

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

        // Fetch favorites associated with this trip
        const favorites = await db
          .selectFrom('favorites')
          .selectAll()
          .where('trip_id', '=', tripId)
          .execute();

        // Build unified timeline event list
        const allEvents: TimelineEventResponse[] = [];

        // Add custom events
        for (const event of customEvents) {
          allEvents.push({
            id: event.id,
            trip_id: event.trip_id,
            title: event.title,
            event_time: event.event_time ? new Date(event.event_time).toISOString() : null,
            all_day: event.all_day,
            location: event.location,
            notes: event.notes,
            event_type: event.event_type,
            reference_id: event.reference_id,
            added_by: event.added_by,
            created_at: new Date(event.created_at).toISOString(),
            updated_at: new Date(event.updated_at).toISOString(),
          });
        }

        // Generate events from flight bookings (departure + arrival)
        for (const fd of flightDetails) {
          const booking = bookings.find((b) => b.id === fd.booking_id);
          if (!booking) continue;

          if (fd.departure_time) {
            allEvents.push({
              id: `booking-dep-${fd.booking_id}`,
              trip_id: tripId,
              title: `Flight ${fd.flight_number || ''} departure${fd.departure_airport ? ` from ${fd.departure_airport}` : ''}`.trim(),
              event_time: new Date(fd.departure_time).toISOString(),
              all_day: false,
              location: fd.departure_airport,
              notes: fd.airline ? `Airline: ${fd.airline}` : null,
              event_type: 'booking',
              reference_id: fd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }

          if (fd.arrival_time) {
            allEvents.push({
              id: `booking-arr-${fd.booking_id}`,
              trip_id: tripId,
              title: `Flight ${fd.flight_number || ''} arrival${fd.arrival_airport ? ` at ${fd.arrival_airport}` : ''}`.trim(),
              event_time: new Date(fd.arrival_time).toISOString(),
              all_day: false,
              location: fd.arrival_airport,
              notes: fd.airline ? `Airline: ${fd.airline}` : null,
              event_type: 'booking',
              reference_id: fd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }
        }

        // Generate events from hotel bookings (check-in + check-out)
        for (const hd of hotelDetails) {
          const booking = bookings.find((b) => b.id === hd.booking_id);
          if (!booking) continue;

          if (hd.checkin_date) {
            allEvents.push({
              id: `booking-cin-${hd.booking_id}`,
              trip_id: tripId,
              title: `Check-in: ${hd.hotel_name || 'Hotel'}`,
              event_time: new Date(hd.checkin_date + 'T14:00:00.000Z').toISOString(),
              all_day: false,
              location: hd.address,
              notes: null,
              event_type: 'booking',
              reference_id: hd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }

          if (hd.checkout_date) {
            allEvents.push({
              id: `booking-cout-${hd.booking_id}`,
              trip_id: tripId,
              title: `Check-out: ${hd.hotel_name || 'Hotel'}`,
              event_time: new Date(hd.checkout_date + 'T11:00:00.000Z').toISOString(),
              all_day: false,
              location: hd.address,
              notes: null,
              event_type: 'booking',
              reference_id: hd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }
        }

        // Generate events from car rental bookings (pickup + return)
        for (const cd of carRentalDetails) {
          const booking = bookings.find((b) => b.id === cd.booking_id);
          if (!booking) continue;

          if (cd.pickup_time) {
            allEvents.push({
              id: `booking-pickup-${cd.booking_id}`,
              trip_id: tripId,
              title: `Car pickup: ${cd.company || 'Rental'}`,
              event_time: new Date(cd.pickup_time).toISOString(),
              all_day: false,
              location: cd.pickup_location,
              notes: cd.vehicle_type ? `Vehicle: ${cd.vehicle_type}` : null,
              event_type: 'booking',
              reference_id: cd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }

          if (cd.return_time) {
            allEvents.push({
              id: `booking-return-${cd.booking_id}`,
              trip_id: tripId,
              title: `Car return: ${cd.company || 'Rental'}`,
              event_time: new Date(cd.return_time).toISOString(),
              all_day: false,
              location: cd.return_location,
              notes: cd.vehicle_type ? `Vehicle: ${cd.vehicle_type}` : null,
              event_type: 'booking',
              reference_id: cd.booking_id,
              added_by: booking.user_id,
              created_at: new Date(booking.created_at).toISOString(),
              updated_at: new Date(booking.updated_at).toISOString(),
            });
          }
        }

        // Generate events from favorites (all-day, no specific time)
        for (const fav of favorites) {
          allEvents.push({
            id: `fav-${fav.id}`,
            trip_id: tripId,
            title: fav.name,
            event_time: null,
            all_day: true,
            location: fav.location_lat && fav.location_lng
              ? `${fav.location_lat}, ${fav.location_lng}`
              : null,
            notes: fav.notes,
            event_type: 'favorite',
            reference_id: fav.id,
            added_by: fav.added_by,
            created_at: new Date(fav.created_at).toISOString(),
            updated_at: new Date(fav.created_at).toISOString(),
          });
        }

        // Group events by day (YYYY-MM-DD)
        const eventsByDay = new Map<string, TimelineEventResponse[]>();

        for (const event of allEvents) {
          let day: string;
          if (event.event_time) {
            day = event.event_time.split('T')[0]!;
          } else if (event.all_day && trip.start_date) {
            // All-day events without a time go to the trip start date
            day = trip.start_date;
          } else {
            // Events without a date default to 'unscheduled'
            day = 'unscheduled';
          }

          if (!eventsByDay.has(day)) {
            eventsByDay.set(day, []);
          }
          eventsByDay.get(day)!.push(event);
        }

        // Sort events within each day: all-day first, then by time chronologically
        for (const [, events] of eventsByDay) {
          events.sort((a, b) => {
            // All-day events sort to the top
            if (a.all_day && !b.all_day) return -1;
            if (!a.all_day && b.all_day) return 1;
            // Sort by event_time
            if (a.event_time && b.event_time) {
              return new Date(a.event_time).getTime() - new Date(b.event_time).getTime();
            }
            if (a.event_time && !b.event_time) return 1;
            if (!a.event_time && b.event_time) return -1;
            return 0;
          });
        }

        // Sort days chronologically (unscheduled at end)
        const sortedDays = [...eventsByDay.keys()].sort((a, b) => {
          if (a === 'unscheduled') return 1;
          if (b === 'unscheduled') return -1;
          return a.localeCompare(b);
        });

        if (view === 'detailed') {
          const days: DayDetailedView[] = sortedDays.map((day) => ({
            date: day,
            events: eventsByDay.get(day)!,
          }));

          return reply.status(200).send({ view: 'detailed', days });
        } else {
          const days: DayOverviewView[] = sortedDays.map((day) => {
            const events = eventsByDay.get(day)!;
            const timedEvents = events.filter((e) => e.event_time);
            const times = timedEvents.map((e) => new Date(e.event_time!).getTime());

            return {
              date: day,
              count: events.length,
              titles: events.map((e) => e.title),
              time_range: {
                earliest: times.length > 0 ? new Date(Math.min(...times)).toISOString() : null,
                latest: times.length > 0 ? new Date(Math.max(...times)).toISOString() : null,
              },
            };
          });

          return reply.status(200).send({ view: 'overview', days });
        }
      } catch (error: unknown) {
        request.log.error(error, 'Failed to load timeline');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading the timeline',
        });
      }
    },
  );

  // ─── POST /api/trips/:tripId/events ──────────────────────────────────────

  app.post(
    '/api/trips/:tripId/events',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: TripParams }>, reply: FastifyReply) => {
      const { tripId } = request.params;
      const userId = request.user!.userId;

      const parseResult = timelineEventCreationSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Timeline event validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { title, event_time, all_day, location, notes } = parseResult.data;

      try {
        // Verify trip exists and user has access
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

        // Check access: owner or edit-level member
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

        // Validate event_time is within trip date range (if trip has dates set)
        if (event_time && trip.start_date && trip.end_date) {
          const eventDate = event_time.split('T')[0]!;
          if (eventDate < trip.start_date || eventDate > trip.end_date) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'VALIDATION_ERROR',
              message: 'Event time must fall within the trip date range',
            });
          }
        }

        // Create the timeline event
        const newEvent = await db
          .insertInto('timeline_events')
          .values({
            trip_id: tripId,
            title,
            event_time: event_time ? new Date(event_time) : null,
            all_day: all_day ?? false,
            location: location ?? null,
            notes: notes ?? null,
            event_type: 'custom',
            reference_id: null,
            added_by: userId,
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        const response: TimelineEventResponse = {
          id: newEvent.id,
          trip_id: newEvent.trip_id,
          title: newEvent.title,
          event_time: newEvent.event_time ? new Date(newEvent.event_time).toISOString() : null,
          all_day: newEvent.all_day,
          location: newEvent.location,
          notes: newEvent.notes,
          event_type: newEvent.event_type,
          reference_id: newEvent.reference_id,
          added_by: newEvent.added_by,
          created_at: new Date(newEvent.created_at).toISOString(),
          updated_at: new Date(newEvent.updated_at).toISOString(),
        };

        return reply.status(201).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create timeline event');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while creating the timeline event',
        });
      }
    },
  );

  // ─── PUT /api/trips/:tripId/events/:eventId ──────────────────────────────

  app.put(
    '/api/trips/:tripId/events/:eventId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: EventParams }>, reply: FastifyReply) => {
      const { tripId, eventId } = request.params;
      const userId = request.user!.userId;

      const parseResult = timelineEventUpdateSchema.safeParse(request.body);

      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Timeline event update validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      try {
        // Verify trip exists and user has access
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

        // Check access: owner or edit-level member
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

        // Fetch the existing event
        const existingEvent = await db
          .selectFrom('timeline_events')
          .selectAll()
          .where('id', '=', eventId)
          .where('trip_id', '=', tripId)
          .executeTakeFirst();

        if (!existingEvent) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Timeline event not found',
          });
        }

        // Only custom events can be edited
        if (existingEvent.event_type !== 'custom') {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only custom events can be edited',
          });
        }

        const data = parseResult.data;

        // If event_time is being changed, validate against trip date range
        if (data.event_time && trip.start_date && trip.end_date) {
          const eventDate = data.event_time.split('T')[0]!;
          if (eventDate < trip.start_date || eventDate > trip.end_date) {
            return reply.status(400).send({
              statusCode: 400,
              error: 'VALIDATION_ERROR',
              message: 'Event time must fall within the trip date range',
            });
          }
        }

        // Build update object
        const updateFields: Record<string, unknown> = {
          updated_at: new Date(),
        };

        if (data.title !== undefined) updateFields.title = data.title;
        if (data.event_time !== undefined) {
          updateFields.event_time = data.event_time ? new Date(data.event_time) : null;
        }
        if (data.all_day !== undefined) updateFields.all_day = data.all_day;
        if (data.location !== undefined) updateFields.location = data.location;
        if (data.notes !== undefined) updateFields.notes = data.notes;

        const updatedEvent = await db
          .updateTable('timeline_events')
          .set(updateFields)
          .where('id', '=', eventId)
          .where('trip_id', '=', tripId)
          .returningAll()
          .executeTakeFirstOrThrow();

        const response: TimelineEventResponse = {
          id: updatedEvent.id,
          trip_id: updatedEvent.trip_id,
          title: updatedEvent.title,
          event_time: updatedEvent.event_time ? new Date(updatedEvent.event_time).toISOString() : null,
          all_day: updatedEvent.all_day,
          location: updatedEvent.location,
          notes: updatedEvent.notes,
          event_type: updatedEvent.event_type,
          reference_id: updatedEvent.reference_id,
          added_by: updatedEvent.added_by,
          created_at: new Date(updatedEvent.created_at).toISOString(),
          updated_at: new Date(updatedEvent.updated_at).toISOString(),
        };

        return reply.status(200).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update timeline event');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating the timeline event',
        });
      }
    },
  );

  // ─── DELETE /api/trips/:tripId/events/:eventId ───────────────────────────

  app.delete(
    '/api/trips/:tripId/events/:eventId',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Params: EventParams }>, reply: FastifyReply) => {
      const { tripId, eventId } = request.params;
      const userId = request.user!.userId;

      try {
        // Verify trip exists and user has access
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

        // Check access: owner or edit-level member
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

        // Fetch the event to check type
        const existingEvent = await db
          .selectFrom('timeline_events')
          .select(['id', 'event_type'])
          .where('id', '=', eventId)
          .where('trip_id', '=', tripId)
          .executeTakeFirst();

        if (!existingEvent) {
          return reply.status(404).send({
            statusCode: 404,
            error: 'NOT_FOUND',
            message: 'Timeline event not found',
          });
        }

        // Only custom events can be deleted
        if (existingEvent.event_type !== 'custom') {
          return reply.status(403).send({
            statusCode: 403,
            error: 'FORBIDDEN',
            message: 'Only custom events can be deleted',
          });
        }

        await db
          .deleteFrom('timeline_events')
          .where('id', '=', eventId)
          .where('trip_id', '=', tripId)
          .execute();

        return reply.status(204).send();
      } catch (error: unknown) {
        request.log.error(error, 'Failed to delete timeline event');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while deleting the timeline event',
        });
      }
    },
  );
}
