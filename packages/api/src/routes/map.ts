/**
 * Map data endpoint: GET /api/trips/:tripId/map
 * Returns all geocoded locations for a trip as map markers, plus a list
 * of bookings that could not be plotted due to missing location data.
 *
 * Supports day filtering via query param `?day=YYYY-MM-DD`.
 * All routes are protected by auth middleware.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Response Interfaces ─────────────────────────────────────────────────────

export type MarkerType =
  | 'flight_departure'
  | 'flight_arrival'
  | 'hotel'
  | 'car_pickup'
  | 'car_return'
  | 'favorite';

export interface MapMarker {
  id: string;
  type: MarkerType;
  label: string;
  lat: number;
  lng: number;
  metadata: Record<string, unknown>;
  date?: string; // YYYY-MM-DD for day filtering
}

export interface MissingLocation {
  bookingId: string;
  type: string;
  reason: string;
}

export interface MapDataResponse {
  markers: MapMarker[];
  missingLocations: MissingLocation[];
}

// ─── Request Types ───────────────────────────────────────────────────────────

interface MapParams {
  tripId: string;
}

interface MapQuerystring {
  day?: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface MapRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register map data route on the Fastify instance.
 */
export async function registerMapRoutes(
  app: FastifyInstance,
  options: MapRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/trips/:tripId/map ──────────────────────────────────────────

  app.get(
    '/api/trips/:tripId/map',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{ Params: MapParams; Querystring: MapQuerystring }>,
      reply: FastifyReply,
    ) => {
      const { tripId } = request.params;
      const { day } = request.query;
      const userId = request.user!.userId;

      // Validate day format if provided
      if (day && !/^\d{4}-\d{2}-\d{2}$/.test(day)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Invalid day format. Expected YYYY-MM-DD.',
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

        const markers: MapMarker[] = [];
        const missingLocations: MissingLocation[] = [];

        // ─── Fetch bookings and their details ────────────────────────────

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

        // Index by booking_id
        const flightMap = new Map(flightDetails.map((fd) => [fd.booking_id, fd]));
        const hotelMap = new Map(hotelDetails.map((hd) => [hd.booking_id, hd]));
        const carRentalMap = new Map(carRentalDetails.map((cd) => [cd.booking_id, cd]));

        // ─── Process flight bookings ─────────────────────────────────────

        for (const booking of bookings) {
          if (booking.type === 'flight') {
            const fd = flightMap.get(booking.id);
            if (!fd) continue;

            const departureDate = fd.departure_time
              ? new Date(fd.departure_time).toISOString().split('T')[0]
              : undefined;
            const arrivalDate = fd.arrival_time
              ? new Date(fd.arrival_time).toISOString().split('T')[0]
              : undefined;

            const depLat = fd.departure_lat ? parseFloat(fd.departure_lat) : null;
            const depLng = fd.departure_lng ? parseFloat(fd.departure_lng) : null;
            const arrLat = fd.arrival_lat ? parseFloat(fd.arrival_lat) : null;
            const arrLng = fd.arrival_lng ? parseFloat(fd.arrival_lng) : null;

            // Departure marker
            if (depLat != null && depLng != null && !isNaN(depLat) && !isNaN(depLng)) {
              const marker: MapMarker = {
                id: `${booking.id}_departure`,
                type: 'flight_departure',
                label: fd.departure_airport
                  ? `${fd.airline ?? 'Flight'} ${fd.flight_number ?? ''} - ${fd.departure_airport}`.trim()
                  : `${fd.airline ?? 'Flight'} ${fd.flight_number ?? ''} departure`.trim(),
                lat: depLat,
                lng: depLng,
                metadata: {
                  bookingId: booking.id,
                  airline: fd.airline,
                  flightNumber: fd.flight_number,
                  airport: fd.departure_airport,
                  departureTime: fd.departure_time,
                },
                date: departureDate,
              };
              markers.push(marker);
            } else {
              missingLocations.push({
                bookingId: booking.id,
                type: 'flight_departure',
                reason: `No coordinates for departure airport${fd.departure_airport ? ` (${fd.departure_airport})` : ''}`,
              });
            }

            // Arrival marker
            if (arrLat != null && arrLng != null && !isNaN(arrLat) && !isNaN(arrLng)) {
              const marker: MapMarker = {
                id: `${booking.id}_arrival`,
                type: 'flight_arrival',
                label: fd.arrival_airport
                  ? `${fd.airline ?? 'Flight'} ${fd.flight_number ?? ''} - ${fd.arrival_airport}`.trim()
                  : `${fd.airline ?? 'Flight'} ${fd.flight_number ?? ''} arrival`.trim(),
                lat: arrLat,
                lng: arrLng,
                metadata: {
                  bookingId: booking.id,
                  airline: fd.airline,
                  flightNumber: fd.flight_number,
                  airport: fd.arrival_airport,
                  arrivalTime: fd.arrival_time,
                },
                date: arrivalDate,
              };
              markers.push(marker);
            } else {
              missingLocations.push({
                bookingId: booking.id,
                type: 'flight_arrival',
                reason: `No coordinates for arrival airport${fd.arrival_airport ? ` (${fd.arrival_airport})` : ''}`,
              });
            }
          } else if (booking.type === 'hotel') {
            const hd = hotelMap.get(booking.id);
            if (!hd) continue;

            const lat = hd.latitude ? parseFloat(hd.latitude) : null;
            const lng = hd.longitude ? parseFloat(hd.longitude) : null;

            // For hotels, the date is the check-in date
            const hotelDate = hd.checkin_date ?? undefined;

            if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
              const marker: MapMarker = {
                id: `${booking.id}_hotel`,
                type: 'hotel',
                label: hd.hotel_name ?? 'Hotel',
                lat,
                lng,
                metadata: {
                  bookingId: booking.id,
                  hotelName: hd.hotel_name,
                  address: hd.address,
                  checkinDate: hd.checkin_date,
                  checkoutDate: hd.checkout_date,
                },
                date: hotelDate,
              };
              markers.push(marker);
            } else {
              missingLocations.push({
                bookingId: booking.id,
                type: 'hotel',
                reason: `No address set for hotel${hd.hotel_name ? ` "${hd.hotel_name}"` : ''}`,
              });
            }
          } else if (booking.type === 'car_rental') {
            const cd = carRentalMap.get(booking.id);
            if (!cd) continue;

            const pickupDate = cd.pickup_time
              ? new Date(cd.pickup_time).toISOString().split('T')[0]
              : undefined;
            const returnDate = cd.return_time
              ? new Date(cd.return_time).toISOString().split('T')[0]
              : undefined;

            const pickupLat = cd.pickup_lat ? parseFloat(cd.pickup_lat) : null;
            const pickupLng = cd.pickup_lng ? parseFloat(cd.pickup_lng) : null;
            const returnLat = cd.return_lat ? parseFloat(cd.return_lat) : null;
            const returnLng = cd.return_lng ? parseFloat(cd.return_lng) : null;

            // Pickup marker
            if (pickupLat != null && pickupLng != null && !isNaN(pickupLat) && !isNaN(pickupLng)) {
              const marker: MapMarker = {
                id: `${booking.id}_pickup`,
                type: 'car_pickup',
                label: cd.company
                  ? `${cd.company} - Pickup`
                  : 'Car Rental Pickup',
                lat: pickupLat,
                lng: pickupLng,
                metadata: {
                  bookingId: booking.id,
                  company: cd.company,
                  pickupLocation: cd.pickup_location,
                  pickupTime: cd.pickup_time,
                },
                date: pickupDate,
              };
              markers.push(marker);
            } else {
              missingLocations.push({
                bookingId: booking.id,
                type: 'car_pickup',
                reason: `No coordinates for pickup location${cd.pickup_location ? ` (${cd.pickup_location})` : ''}`,
              });
            }

            // Return marker
            if (returnLat != null && returnLng != null && !isNaN(returnLat) && !isNaN(returnLng)) {
              const marker: MapMarker = {
                id: `${booking.id}_return`,
                type: 'car_return',
                label: cd.company
                  ? `${cd.company} - Return`
                  : 'Car Rental Return',
                lat: returnLat,
                lng: returnLng,
                metadata: {
                  bookingId: booking.id,
                  company: cd.company,
                  returnLocation: cd.return_location,
                  returnTime: cd.return_time,
                },
                date: returnDate,
              };
              markers.push(marker);
            } else {
              missingLocations.push({
                bookingId: booking.id,
                type: 'car_return',
                reason: `No coordinates for return location${cd.return_location ? ` (${cd.return_location})` : ''}`,
              });
            }
          }
        }

        // ─── Fetch favorites for the trip ────────────────────────────────

        const favorites = await db
          .selectFrom('favorites')
          .selectAll()
          .where('trip_id', '=', tripId)
          .execute();

        for (const fav of favorites) {
          const lat = fav.location_lat ? parseFloat(fav.location_lat) : null;
          const lng = fav.location_lng ? parseFloat(fav.location_lng) : null;

          if (lat != null && lng != null && !isNaN(lat) && !isNaN(lng)) {
            const marker: MapMarker = {
              id: `fav_${fav.id}`,
              type: 'favorite',
              label: fav.name,
              lat,
              lng,
              metadata: {
                favoriteId: fav.id,
                category: fav.category,
                rating: fav.rating ? parseFloat(fav.rating) : null,
                notes: fav.notes,
              },
            };
            markers.push(marker);
          }
          // Favorites without coordinates are silently omitted (not flagged as missing)
        }

        // ─── Apply day filter if requested ───────────────────────────────

        let filteredMarkers = markers;
        if (day) {
          filteredMarkers = markers.filter((marker) => {
            // Favorites without a date are always included (they're not day-specific)
            if (marker.type === 'favorite' && !marker.date) {
              return true;
            }
            // For hotel markers, include if the day falls within checkin-checkout range
            if (marker.type === 'hotel') {
              const checkinDate = marker.metadata.checkinDate as string | undefined;
              const checkoutDate = marker.metadata.checkoutDate as string | undefined;
              if (checkinDate && checkoutDate) {
                return day >= checkinDate && day <= checkoutDate;
              }
              // If we only have checkin date, match exactly
              return marker.date === day;
            }
            // For all other markers, match by date
            return marker.date === day;
          });
        }

        const response: MapDataResponse = {
          markers: filteredMarkers,
          missingLocations,
        };

        return reply.status(200).send(response);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to load map data');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while loading map data',
        });
      }
    },
  );
}
