/**
 * Home Location Routes
 *
 * Manages user's primary and native home locations.
 *
 * Routes:
 * - GET /api/home-locations — Get user's home locations
 * - PUT /api/home-locations/:type — Set/update a home location (type: primary|native)
 * - DELETE /api/home-locations/:type — Remove a home location
 *
 * Implements Requirement 31
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HomeLocationType = 'primary' | 'native';
export type TransportMode = 'drive' | 'taxi' | 'public_transport' | 'train' | 'drop_off';

interface SetHomeLocationBody {
  city: string;
  country: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  nearestAirports?: string[]; // IATA codes
  transportMode?: TransportMode;
}

export interface HomeLocationResponse {
  type: HomeLocationType;
  city: string;
  country: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  nearestAirports: string[];
  transportMode: TransportMode | null;
}

interface HomeLocationRoutesOptions {
  db: Kysely<Database>;
}

// ─── Transport time estimates (minutes) ──────────────────────────────────────

const TRANSPORT_ESTIMATES: Record<TransportMode, number> = {
  drive: 45,          // Average drive to airport
  taxi: 50,           // Taxi (slightly longer — pickup wait)
  public_transport: 75, // Bus/metro
  train: 60,          // Airport express train
  drop_off: 40,       // Someone drives you (no parking)
};

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerHomeLocationRoutes(
  app: FastifyInstance,
  options: HomeLocationRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/home-locations ───────────────────────────────────────

  app.get(
    '/api/home-locations',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;

      const locations = await db
        .selectFrom('home_locations')
        .selectAll()
        .where('user_id', '=', userId)
        .execute();

      const result: HomeLocationResponse[] = locations.map((loc) => ({
        type: loc.type as HomeLocationType,
        city: loc.city,
        country: loc.country,
        address: loc.address,
        latitude: loc.latitude ? Number(loc.latitude) : null,
        longitude: loc.longitude ? Number(loc.longitude) : null,
        timezone: loc.timezone,
        nearestAirports: loc.nearest_airports ? JSON.parse(loc.nearest_airports) : [],
        transportMode: loc.transport_mode as TransportMode | null,
      }));

      return reply.send({
        statusCode: 200,
        data: {
          locations: result,
          hasHome: result.some((l) => l.type === 'primary'),
          hasNativeHome: result.some((l) => l.type === 'native'),
        },
      });
    },
  );

  // ─── PUT /api/home-locations/:type ─────────────────────────────────

  app.put(
    '/api/home-locations/:type',
    async (
      request: FastifyRequest<{ Params: { type: string }; Body: SetHomeLocationBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { type } = request.params;
      const body = request.body;

      if (type !== 'primary' && type !== 'native') {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'type must be "primary" or "native"',
        });
      }

      if (!body.city || !body.country) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'city and country are required',
        });
      }

      if (body.transportMode && !Object.keys(TRANSPORT_ESTIMATES).includes(body.transportMode)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `transportMode must be one of: ${Object.keys(TRANSPORT_ESTIMATES).join(', ')}`,
        });
      }

      // Upsert (insert or update)
      const values = {
        user_id: userId,
        type,
        city: body.city,
        country: body.country,
        address: body.address ?? null,
        latitude: body.latitude ?? null,
        longitude: body.longitude ?? null,
        timezone: body.timezone ?? null,
        nearest_airports: body.nearestAirports ? JSON.stringify(body.nearestAirports) : null,
        transport_mode: body.transportMode ?? null,
        updated_at: new Date(),
      };

      await db
        .insertInto('home_locations')
        .values(values)
        .onConflict((oc) =>
          oc.columns(['user_id', 'type']).doUpdateSet({
            city: body.city,
            country: body.country,
            address: body.address ?? null,
            latitude: body.latitude ?? null,
            longitude: body.longitude ?? null,
            timezone: body.timezone ?? null,
            nearest_airports: body.nearestAirports ? JSON.stringify(body.nearestAirports) : null,
            transport_mode: body.transportMode ?? null,
            updated_at: new Date(),
          }),
        )
        .execute();

      return reply.send({
        statusCode: 200,
        message: `${type} home location saved`,
        data: { type, city: body.city, country: body.country },
      });
    },
  );

  // ─── DELETE /api/home-locations/:type ──────────────────────────────

  app.delete(
    '/api/home-locations/:type',
    async (request: FastifyRequest<{ Params: { type: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { type } = request.params;

      await db
        .deleteFrom('home_locations')
        .where('user_id', '=', userId)
        .where('type', '=', type)
        .execute();

      return reply.send({ statusCode: 200, message: `${type} home location removed` });
    },
  );

  // ─── GET /api/home-locations/leave-by/:bookingId ───────────────────
  // Calculate personalized "leave home by" time for a flight

  app.get(
    '/api/home-locations/leave-by/:bookingId',
    async (request: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { bookingId } = request.params;

      // Get user's primary home
      const home = await db
        .selectFrom('home_locations')
        .selectAll()
        .where('user_id', '=', userId)
        .where('type', '=', 'primary')
        .executeTakeFirst();

      if (!home) {
        return reply.send({
          statusCode: 200,
          data: { leaveBy: null, reason: 'No home location set' },
        });
      }

      // Get flight details
      const flight = await db
        .selectFrom('flight_details')
        .select(['departure_time', 'departure_airport'])
        .where('booking_id', '=', bookingId)
        .executeTakeFirst();

      if (!flight || !flight.departure_time) {
        return reply.send({
          statusCode: 200,
          data: { leaveBy: null, reason: 'No departure time found' },
        });
      }

      const departureTime = new Date(flight.departure_time);
      const transportMode = (home.transport_mode as TransportMode) ?? 'taxi';
      const travelMinutes = TRANSPORT_ESTIMATES[transportMode] ?? 50;

      // Determine if international (different country)
      const isInternational = true; // TODO: compare departure airport country with home country
      const airportBufferMinutes = isInternational ? 180 : 120; // 3h intl, 2h domestic

      const totalMinutesBefore = travelMinutes + airportBufferMinutes;
      const leaveBy = new Date(departureTime.getTime() - totalMinutesBefore * 60 * 1000);

      return reply.send({
        statusCode: 200,
        data: {
          leaveBy: leaveBy.toISOString(),
          departureTime: departureTime.toISOString(),
          transportMode,
          travelMinutes,
          airportBufferMinutes,
          totalMinutesBefore,
          breakdown: `${travelMinutes}min travel (${transportMode}) + ${airportBufferMinutes}min airport buffer`,
        },
      });
    },
  );
}

export { TRANSPORT_ESTIMATES };
