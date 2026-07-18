import { describe, it, expect, beforeAll, afterAll, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { registerMapRoutes } from './map.js';

// ─── Test Constants ──────────────────────────────────────────────────────────

const testUserId = 'user-123-uuid';
const otherUserId = 'other-789-uuid';
const testTripId = 'trip-456-uuid';

// ─── Mock Data Factories ─────────────────────────────────────────────────────

function createMockTrip(overrides: Record<string, unknown> = {}) {
  return {
    id: testTripId,
    owner_id: testUserId,
    name: 'Summer Vacation',
    start_date: '2025-07-01',
    end_date: '2025-07-15',
    budget: null,
    budget_currency: null,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
    ...overrides,
  };
}

function createMockFlightBooking(id: string) {
  return {
    id,
    user_id: testUserId,
    trip_id: testTripId,
    type: 'flight',
    source: 'manual',
    source_email_id: null,
    checked_in: false,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  };
}

function createMockFlightDetails(bookingId: string, overrides: Record<string, unknown> = {}) {
  return {
    booking_id: bookingId,
    airline: 'Delta',
    flight_number: 'DL123',
    departure_airport: 'JFK',
    arrival_airport: 'LAX',
    departure_time: new Date('2025-07-01T08:00:00Z'),
    arrival_time: new Date('2025-07-01T11:00:00Z'),
    departure_lat: '40.6413',
    departure_lng: '-73.7781',
    arrival_lat: '33.9425',
    arrival_lng: '-118.4081',
    checkin_window_opens: null,
    checkin_window_closes: null,
    ...overrides,
  };
}

function createMockHotelBooking(id: string) {
  return {
    id,
    user_id: testUserId,
    trip_id: testTripId,
    type: 'hotel',
    source: 'manual',
    source_email_id: null,
    checked_in: false,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  };
}

function createMockHotelDetails(bookingId: string, overrides: Record<string, unknown> = {}) {
  return {
    booking_id: bookingId,
    hotel_name: 'Grand Hotel',
    address: '123 Main St, Los Angeles, CA',
    checkin_date: '2025-07-01',
    checkout_date: '2025-07-05',
    latitude: '34.0522',
    longitude: '-118.2437',
    confirmation_number: 'CONF123',
    ...overrides,
  };
}

function createMockCarRentalBooking(id: string) {
  return {
    id,
    user_id: testUserId,
    trip_id: testTripId,
    type: 'car_rental',
    source: 'manual',
    source_email_id: null,
    checked_in: false,
    created_at: new Date('2025-01-01'),
    updated_at: new Date('2025-01-01'),
  };
}

function createMockCarRentalDetails(bookingId: string, overrides: Record<string, unknown> = {}) {
  return {
    booking_id: bookingId,
    company: 'Hertz',
    vehicle_type: 'SUV',
    pickup_location: 'LAX Airport',
    return_location: 'LAX Airport',
    pickup_time: new Date('2025-07-01T12:00:00Z'),
    return_time: new Date('2025-07-10T12:00:00Z'),
    pickup_lat: '33.9425',
    pickup_lng: '-118.4081',
    return_lat: '33.9425',
    return_lng: '-118.4081',
    confirmation_number: 'CAR456',
    ...overrides,
  };
}

function createMockFavorite(id: string, overrides: Record<string, unknown> = {}) {
  return {
    id,
    user_id: testUserId,
    trip_id: testTripId,
    name: 'Cool Restaurant',
    category: 'restaurants',
    place_id: 'place_abc',
    location_lat: '34.0195',
    location_lng: '-118.4912',
    rating: '4.5',
    notes: 'Great food!',
    added_by: testUserId,
    created_at: new Date('2025-01-01'),
    ...overrides,
  };
}

// ─── Mock DB Factory ─────────────────────────────────────────────────────────

interface MockDbState {
  trip: Record<string, unknown> | null;
  membership: Record<string, unknown> | null;
  bookings: Record<string, unknown>[];
  flightDetails: Record<string, unknown>[];
  hotelDetails: Record<string, unknown>[];
  carRentalDetails: Record<string, unknown>[];
  favorites: Record<string, unknown>[];
}

function createMockDb(state: MockDbState) {
  const db = {
    selectFrom: vi.fn((table: string) => {
      const chain: any = {};
      const self = () => chain;
      chain.selectAll = vi.fn(self);
      chain.select = vi.fn(self);
      chain.where = vi.fn((_col: string, _op: string, _val: unknown) => {
        return chain;
      });
      chain.orderBy = vi.fn(self);

      chain.execute = vi.fn(() => {
        switch (table) {
          case 'bookings':
            return state.bookings;
          case 'flight_details':
            return state.flightDetails;
          case 'hotel_details':
            return state.hotelDetails;
          case 'car_rental_details':
            return state.carRentalDetails;
          case 'favorites':
            return state.favorites;
          default:
            return [];
        }
      });

      chain.executeTakeFirst = vi.fn(() => {
        switch (table) {
          case 'trips':
            return state.trip;
          case 'trip_members':
            return state.membership;
          default:
            return undefined;
        }
      });

      return chain;
    }),
  } as unknown as Kysely<Database>;

  return db;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('Map Data Route - GET /api/trips/:tripId/map', () => {
  let app: FastifyInstance;

  async function buildTestApp(state: MockDbState) {
    const testApp = Fastify({ logger: false });

    // Mock auth middleware
    testApp.decorate('requireAuth', async (request: any) => {
      request.user = { userId: testUserId };
    });

    const db = createMockDb(state);
    await registerMapRoutes(testApp, { db });
    await testApp.ready();
    return testApp;
  }

  afterAll(async () => {
    if (app) await app.close();
  });

  it('should return 404 when trip does not exist', async () => {
    app = await buildTestApp({
      trip: null,
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(404);
    const body = response.json();
    expect(body.error).toBe('NOT_FOUND');
  });

  it('should return 403 when user does not have access', async () => {
    app = await buildTestApp({
      trip: createMockTrip({ owner_id: otherUserId }),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(403);
    const body = response.json();
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return empty markers for trip with no bookings or favorites', async () => {
    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.markers).toEqual([]);
    expect(body.missingLocations).toEqual([]);
  });

  it('should return flight departure and arrival markers with coordinates', async () => {
    const flightBooking = createMockFlightBooking('booking-flight-1');
    const flightDetail = createMockFlightDetails('booking-flight-1');

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [flightBooking],
      flightDetails: [flightDetail],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(2);
    expect(body.missingLocations).toHaveLength(0);

    const depMarker = body.markers.find((m: any) => m.type === 'flight_departure');
    expect(depMarker).toBeDefined();
    expect(depMarker.lat).toBe(40.6413);
    expect(depMarker.lng).toBe(-73.7781);
    expect(depMarker.label).toContain('JFK');
    expect(depMarker.metadata.airline).toBe('Delta');
    expect(depMarker.metadata.flightNumber).toBe('DL123');

    const arrMarker = body.markers.find((m: any) => m.type === 'flight_arrival');
    expect(arrMarker).toBeDefined();
    expect(arrMarker.lat).toBe(33.9425);
    expect(arrMarker.lng).toBe(-118.4081);
    expect(arrMarker.label).toContain('LAX');
  });

  it('should add to missingLocations when flight lacks coordinates', async () => {
    const flightBooking = createMockFlightBooking('booking-flight-2');
    const flightDetail = createMockFlightDetails('booking-flight-2', {
      departure_lat: null,
      departure_lng: null,
      arrival_lat: null,
      arrival_lng: null,
    });

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [flightBooking],
      flightDetails: [flightDetail],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(0);
    expect(body.missingLocations).toHaveLength(2);

    const depMissing = body.missingLocations.find((m: any) => m.type === 'flight_departure');
    expect(depMissing).toBeDefined();
    expect(depMissing.bookingId).toBe('booking-flight-2');
    expect(depMissing.reason).toContain('JFK');

    const arrMissing = body.missingLocations.find((m: any) => m.type === 'flight_arrival');
    expect(arrMissing).toBeDefined();
    expect(arrMissing.bookingId).toBe('booking-flight-2');
    expect(arrMissing.reason).toContain('LAX');
  });

  it('should return hotel marker with coordinates', async () => {
    const hotelBooking = createMockHotelBooking('booking-hotel-1');
    const hotelDetail = createMockHotelDetails('booking-hotel-1');

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [hotelBooking],
      flightDetails: [],
      hotelDetails: [hotelDetail],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(1);
    const marker = body.markers[0];
    expect(marker.type).toBe('hotel');
    expect(marker.label).toBe('Grand Hotel');
    expect(marker.lat).toBe(34.0522);
    expect(marker.lng).toBe(-118.2437);
    expect(marker.metadata.checkinDate).toBe('2025-07-01');
    expect(marker.metadata.checkoutDate).toBe('2025-07-05');
  });

  it('should add to missingLocations when hotel lacks coordinates', async () => {
    const hotelBooking = createMockHotelBooking('booking-hotel-2');
    const hotelDetail = createMockHotelDetails('booking-hotel-2', {
      latitude: null,
      longitude: null,
    });

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [hotelBooking],
      flightDetails: [],
      hotelDetails: [hotelDetail],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(0);
    expect(body.missingLocations).toHaveLength(1);
    expect(body.missingLocations[0].type).toBe('hotel');
    expect(body.missingLocations[0].reason).toContain('Grand Hotel');
  });

  it('should return car rental pickup and return markers with coordinates', async () => {
    const carBooking = createMockCarRentalBooking('booking-car-1');
    const carDetail = createMockCarRentalDetails('booking-car-1');

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [carBooking],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [carDetail],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(2);

    const pickupMarker = body.markers.find((m: any) => m.type === 'car_pickup');
    expect(pickupMarker).toBeDefined();
    expect(pickupMarker.label).toContain('Hertz');
    expect(pickupMarker.label).toContain('Pickup');
    expect(pickupMarker.lat).toBe(33.9425);
    expect(pickupMarker.lng).toBe(-118.4081);

    const returnMarker = body.markers.find((m: any) => m.type === 'car_return');
    expect(returnMarker).toBeDefined();
    expect(returnMarker.label).toContain('Hertz');
    expect(returnMarker.label).toContain('Return');
  });

  it('should add to missingLocations when car rental lacks coordinates', async () => {
    const carBooking = createMockCarRentalBooking('booking-car-2');
    const carDetail = createMockCarRentalDetails('booking-car-2', {
      pickup_lat: null,
      pickup_lng: null,
      return_lat: null,
      return_lng: null,
    });

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [carBooking],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [carDetail],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(0);
    expect(body.missingLocations).toHaveLength(2);

    const pickupMissing = body.missingLocations.find((m: any) => m.type === 'car_pickup');
    expect(pickupMissing).toBeDefined();
    expect(pickupMissing.reason).toContain('LAX Airport');

    const returnMissing = body.missingLocations.find((m: any) => m.type === 'car_return');
    expect(returnMissing).toBeDefined();
    expect(returnMissing.reason).toContain('LAX Airport');
  });

  it('should return favorite markers with coordinates', async () => {
    const fav = createMockFavorite('fav-1');

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [fav],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(1);
    const marker = body.markers[0];
    expect(marker.type).toBe('favorite');
    expect(marker.label).toBe('Cool Restaurant');
    expect(marker.lat).toBe(34.0195);
    expect(marker.lng).toBe(-118.4912);
    expect(marker.metadata.category).toBe('restaurants');
    expect(marker.metadata.rating).toBe(4.5);
  });

  it('should omit favorites without coordinates (no missingLocation entry)', async () => {
    const fav = createMockFavorite('fav-2', {
      location_lat: null,
      location_lng: null,
    });

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [fav],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    expect(body.markers).toHaveLength(0);
    expect(body.missingLocations).toHaveLength(0);
  });

  it('should filter markers by day when day query param is provided', async () => {
    const flightBooking = createMockFlightBooking('booking-flight-day');
    const flightDetail = createMockFlightDetails('booking-flight-day', {
      departure_time: new Date('2025-07-01T08:00:00Z'),
      arrival_time: new Date('2025-07-01T11:00:00Z'),
    });
    const hotelBooking = createMockHotelBooking('booking-hotel-day');
    const hotelDetail = createMockHotelDetails('booking-hotel-day', {
      checkin_date: '2025-07-01',
      checkout_date: '2025-07-05',
    });

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [flightBooking, hotelBooking],
      flightDetails: [flightDetail],
      hotelDetails: [hotelDetail],
      carRentalDetails: [],
      favorites: [],
    });

    // Request markers for 2025-07-03 (should include hotel but not flight)
    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map?day=2025-07-03`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Hotel should be included (day falls within checkin-checkout range)
    const hotelMarker = body.markers.find((m: any) => m.type === 'hotel');
    expect(hotelMarker).toBeDefined();

    // Flight markers should NOT be included (their date is 2025-07-01)
    const flightMarkers = body.markers.filter(
      (m: any) => m.type === 'flight_departure' || m.type === 'flight_arrival',
    );
    expect(flightMarkers).toHaveLength(0);
  });

  it('should include favorites without a date when filtering by day', async () => {
    const fav = createMockFavorite('fav-nodate');

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [fav],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map?day=2025-07-03`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Favorites without a date should always be shown
    expect(body.markers).toHaveLength(1);
    expect(body.markers[0].type).toBe('favorite');
  });

  it('should return 400 for invalid day format', async () => {
    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map?day=invalid-date`,
    });

    expect(response.statusCode).toBe(400);
    const body = response.json();
    expect(body.error).toBe('VALIDATION_ERROR');
  });

  it('should allow trip members to access map data', async () => {
    app = await buildTestApp({
      trip: createMockTrip({ owner_id: otherUserId }),
      membership: { id: 'member-1', trip_id: testTripId, user_id: testUserId, access_level: 'view' },
      bookings: [],
      flightDetails: [],
      hotelDetails: [],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.markers).toEqual([]);
    expect(body.missingLocations).toEqual([]);
  });

  it('should handle mixed bookings with and without coordinates', async () => {
    const flightBooking = createMockFlightBooking('booking-mixed-flight');
    const flightDetail = createMockFlightDetails('booking-mixed-flight', {
      departure_lat: '40.6413',
      departure_lng: '-73.7781',
      arrival_lat: null, // Missing arrival coordinates
      arrival_lng: null,
    });
    const hotelBooking = createMockHotelBooking('booking-mixed-hotel');
    const hotelDetail = createMockHotelDetails('booking-mixed-hotel'); // Has coordinates

    app = await buildTestApp({
      trip: createMockTrip(),
      membership: null,
      bookings: [flightBooking, hotelBooking],
      flightDetails: [flightDetail],
      hotelDetails: [hotelDetail],
      carRentalDetails: [],
      favorites: [],
    });

    const response = await app.inject({
      method: 'GET',
      url: `/api/trips/${testTripId}/map`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();

    // Should have: flight departure + hotel = 2 markers
    expect(body.markers).toHaveLength(2);
    expect(body.markers.find((m: any) => m.type === 'flight_departure')).toBeDefined();
    expect(body.markers.find((m: any) => m.type === 'hotel')).toBeDefined();

    // Should have: 1 missing (flight arrival)
    expect(body.missingLocations).toHaveLength(1);
    expect(body.missingLocations[0].type).toBe('flight_arrival');
  });
});
