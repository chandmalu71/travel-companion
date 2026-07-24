/**
 * Zod validation schemas for the Travel Companion application.
 * These schemas are reused on both client and server for consistent validation.
 */

import { z } from 'zod/v4';

import { LIMITS, EXPENSE_CATEGORIES, BOOKING_TYPES } from '../constants';

// ─── Password Validation ─────────────────────────────────────────────────────

/**
 * Validates password meets requirements:
 * - 8-128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export const passwordSchema = z
  .string()
  .min(LIMITS.PASSWORD_MIN_LENGTH, `Password must be at least ${LIMITS.PASSWORD_MIN_LENGTH} characters`)
  .max(LIMITS.PASSWORD_MAX_LENGTH, `Password must be at most ${LIMITS.PASSWORD_MAX_LENGTH} characters`)
  .refine((val) => /[A-Z]/.test(val), 'Password must contain at least one uppercase letter')
  .refine((val) => /[a-z]/.test(val), 'Password must contain at least one lowercase letter')
  .refine((val) => /\d/.test(val), 'Password must contain at least one digit');

// ─── Registration Schema ─────────────────────────────────────────────────────

export const registrationSchema = z.object({
  email: z.email('Invalid email address'),
  password: passwordSchema,
});

export type RegistrationInput = z.infer<typeof registrationSchema>;

// ─── Login Schema ────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: z.email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;

// ─── Trip Creation Schema ────────────────────────────────────────────────────

export const tripCreationSchema = z
  .object({
    name: z
      .string()
      .min(LIMITS.TRIP_NAME_MIN_LENGTH, 'Trip name is required')
      .max(LIMITS.TRIP_NAME_MAX_LENGTH, `Trip name must be at most ${LIMITS.TRIP_NAME_MAX_LENGTH} characters`),
    destination: z.string().max(200, 'Destination must be at most 200 characters').optional(),
    start_date: z.iso.date().optional(),
    end_date: z.iso.date().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
      }
      return true;
    },
    { message: 'End date must be on or after start date' }
  );

export type TripCreationInput = z.infer<typeof tripCreationSchema>;

// ─── Trip Update Schema ──────────────────────────────────────────────────────

export const tripUpdateSchema = z
  .object({
    name: z
      .string()
      .min(LIMITS.TRIP_NAME_MIN_LENGTH, 'Trip name is required')
      .max(LIMITS.TRIP_NAME_MAX_LENGTH, `Trip name must be at most ${LIMITS.TRIP_NAME_MAX_LENGTH} characters`)
      .optional(),
    destination: z.string().max(200, 'Destination must be at most 200 characters').nullable().optional(),
    start_date: z.iso.date().nullable().optional(),
    end_date: z.iso.date().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.start_date && data.end_date) {
        return data.end_date >= data.start_date;
      }
      return true;
    },
    { message: 'End date must be on or after start date' }
  );

export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;

// ─── Booking Creation Schema ─────────────────────────────────────────────────

export const flightDetailsSchema = z.object({
  airline: z.string().optional(),
  flight_number: z.string().optional(),
  departure_airport: z.string().optional(),
  arrival_airport: z.string().optional(),
  departure_time: z.iso.datetime().optional(),
  arrival_time: z.iso.datetime().optional(),
});

export const hotelDetailsSchema = z.object({
  hotel_name: z.string().optional(),
  address: z.string().optional(),
  checkin_date: z.iso.date().optional(),
  checkout_date: z.iso.date().optional(),
  confirmation_number: z.string().optional(),
});

export const carRentalDetailsSchema = z.object({
  company: z.string().optional(),
  vehicle_type: z.string().optional(),
  pickup_location: z.string().optional(),
  return_location: z.string().optional(),
  pickup_time: z.iso.datetime().optional(),
  return_time: z.iso.datetime().optional(),
  confirmation_number: z.string().optional(),
});

export const bookingCreationSchema = z.object({
  type: z.enum(BOOKING_TYPES),
  trip_id: z.string().uuid().optional(),
  flight_details: flightDetailsSchema.optional(),
  hotel_details: hotelDetailsSchema.optional(),
  car_rental_details: carRentalDetailsSchema.optional(),
});

export type BookingCreationInput = z.infer<typeof bookingCreationSchema>;

// ─── Favorite Creation Schema ────────────────────────────────────────────────

export const favoriteCreationSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name must be at most 200 characters'),
  trip_id: z.string().uuid().nullable(),
  category: z.string().max(50).optional(),
  place_id: z.string().optional(),
  location_lat: z.number().min(-90).max(90).optional(),
  location_lng: z.number().min(-180).max(180).optional(),
  rating: z.number().min(1).max(5).optional(),
  notes: z
    .string()
    .max(LIMITS.FAVORITE_NOTES_MAX_LENGTH, `Notes must be at most ${LIMITS.FAVORITE_NOTES_MAX_LENGTH} characters`)
    .optional(),
});

export type FavoriteCreationInput = z.infer<typeof favoriteCreationSchema>;

// ─── Favorite Update Schema ──────────────────────────────────────────────────

export const favoriteUpdateSchema = z.object({
  notes: z
    .string()
    .max(LIMITS.FAVORITE_NOTES_MAX_LENGTH, `Notes must be at most ${LIMITS.FAVORITE_NOTES_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
  trip_id: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(200).optional(),
  category: z.string().max(50).nullable().optional(),
  rating: z.number().min(1).max(5).nullable().optional(),
});

export type FavoriteUpdateInput = z.infer<typeof favoriteUpdateSchema>;

// ─── Collection Creation Schema ──────────────────────────────────────────────

export const collectionCreationSchema = z.object({
  name: z
    .string()
    .min(1, 'Collection name is required')
    .max(LIMITS.COLLECTION_NAME_MAX_LENGTH, `Collection name must be at most ${LIMITS.COLLECTION_NAME_MAX_LENGTH} characters`),
});

export type CollectionCreationInput = z.infer<typeof collectionCreationSchema>;

// ─── Collection Update Schema ────────────────────────────────────────────────

export const collectionUpdateSchema = z.object({
  name: z
    .string()
    .min(1, 'Collection name is required')
    .max(LIMITS.COLLECTION_NAME_MAX_LENGTH, `Collection name must be at most ${LIMITS.COLLECTION_NAME_MAX_LENGTH} characters`),
});

export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;

// ─── Expense Creation Schema ─────────────────────────────────────────────────

export const expenseCreationSchema = z.object({
  trip_id: z.string().uuid().optional(),
  amount: z
    .number()
    .min(LIMITS.EXPENSE_AMOUNT_MIN, `Amount must be at least ${LIMITS.EXPENSE_AMOUNT_MIN}`)
    .max(LIMITS.EXPENSE_AMOUNT_MAX, `Amount must be at most ${LIMITS.EXPENSE_AMOUNT_MAX}`),
  currency: z.string().length(3, 'Currency must be a 3-letter ISO 4217 code'),
  date: z.iso.date(),
  category: z.enum(EXPENSE_CATEGORIES),
  merchant_name: z.string().optional(),
  notes: z
    .string()
    .max(LIMITS.EXPENSE_NOTES_MAX_LENGTH, `Notes must be at most ${LIMITS.EXPENSE_NOTES_MAX_LENGTH} characters`)
    .optional(),
  booking_id: z.string().uuid().optional(),
});

export type ExpenseCreationInput = z.infer<typeof expenseCreationSchema>;

// ─── Timeline Event Creation Schema ──────────────────────────────────────────

export const timelineEventCreationSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(LIMITS.TIMELINE_TITLE_MAX_LENGTH, `Title must be at most ${LIMITS.TIMELINE_TITLE_MAX_LENGTH} characters`),
  event_time: z.iso.datetime().optional(),
  all_day: z.boolean().optional().default(false),
  location: z.string().optional(),
  notes: z
    .string()
    .max(LIMITS.TIMELINE_NOTES_MAX_LENGTH, `Notes must be at most ${LIMITS.TIMELINE_NOTES_MAX_LENGTH} characters`)
    .optional(),
}).refine(
  (data) => {
    // event_time is required unless all_day is true
    if (!data.all_day && !data.event_time) {
      return false;
    }
    return true;
  },
  { message: 'Event time is required unless the event is marked as all-day' }
);

export type TimelineEventCreationInput = z.infer<typeof timelineEventCreationSchema>;

// ─── Timeline Event Update Schema ────────────────────────────────────────────

export const timelineEventUpdateSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required')
    .max(LIMITS.TIMELINE_TITLE_MAX_LENGTH, `Title must be at most ${LIMITS.TIMELINE_TITLE_MAX_LENGTH} characters`)
    .optional(),
  event_time: z.iso.datetime().nullable().optional(),
  all_day: z.boolean().optional(),
  location: z.string().nullable().optional(),
  notes: z
    .string()
    .max(LIMITS.TIMELINE_NOTES_MAX_LENGTH, `Notes must be at most ${LIMITS.TIMELINE_NOTES_MAX_LENGTH} characters`)
    .nullable()
    .optional(),
});

export type TimelineEventUpdateInput = z.infer<typeof timelineEventUpdateSchema>;

// ─── Vote Creation Schema ────────────────────────────────────────────────────

export const voteCreationSchema = z.object({
  entity_type: z.enum(['favorite', 'timeline_event']),
  entity_id: z.string().uuid('entity_id must be a valid UUID'),
  vote_value: z.union([z.literal(-1), z.literal(1)]),
});

export type VoteCreationInput = z.infer<typeof voteCreationSchema>;
