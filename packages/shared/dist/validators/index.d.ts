/**
 * Zod validation schemas for the Travel Companion application.
 * These schemas are reused on both client and server for consistent validation.
 */
import { z } from 'zod/v4';
/**
 * Validates password meets requirements:
 * - 8-128 characters
 * - At least one uppercase letter
 * - At least one lowercase letter
 * - At least one digit
 */
export declare const passwordSchema: z.ZodString;
export declare const registrationSchema: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type RegistrationInput = z.infer<typeof registrationSchema>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodEmail;
    password: z.ZodString;
}, z.core.$strip>;
export type LoginInput = z.infer<typeof loginSchema>;
export declare const tripCreationSchema: z.ZodObject<{
    name: z.ZodString;
    start_date: z.ZodOptional<z.ZodISODate>;
    end_date: z.ZodOptional<z.ZodISODate>;
}, z.core.$strip>;
export type TripCreationInput = z.infer<typeof tripCreationSchema>;
export declare const tripUpdateSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    start_date: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
    end_date: z.ZodOptional<z.ZodNullable<z.ZodISODate>>;
}, z.core.$strip>;
export type TripUpdateInput = z.infer<typeof tripUpdateSchema>;
export declare const flightDetailsSchema: z.ZodObject<{
    airline: z.ZodOptional<z.ZodString>;
    flight_number: z.ZodOptional<z.ZodString>;
    departure_airport: z.ZodOptional<z.ZodString>;
    arrival_airport: z.ZodOptional<z.ZodString>;
    departure_time: z.ZodOptional<z.ZodISODateTime>;
    arrival_time: z.ZodOptional<z.ZodISODateTime>;
}, z.core.$strip>;
export declare const hotelDetailsSchema: z.ZodObject<{
    hotel_name: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    checkin_date: z.ZodOptional<z.ZodISODate>;
    checkout_date: z.ZodOptional<z.ZodISODate>;
    confirmation_number: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const carRentalDetailsSchema: z.ZodObject<{
    company: z.ZodOptional<z.ZodString>;
    vehicle_type: z.ZodOptional<z.ZodString>;
    pickup_location: z.ZodOptional<z.ZodString>;
    return_location: z.ZodOptional<z.ZodString>;
    pickup_time: z.ZodOptional<z.ZodISODateTime>;
    return_time: z.ZodOptional<z.ZodISODateTime>;
    confirmation_number: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export declare const bookingCreationSchema: z.ZodObject<{
    type: z.ZodEnum<{
        flight: "flight";
        hotel: "hotel";
        car_rental: "car_rental";
    }>;
    trip_id: z.ZodOptional<z.ZodString>;
    flight_details: z.ZodOptional<z.ZodObject<{
        airline: z.ZodOptional<z.ZodString>;
        flight_number: z.ZodOptional<z.ZodString>;
        departure_airport: z.ZodOptional<z.ZodString>;
        arrival_airport: z.ZodOptional<z.ZodString>;
        departure_time: z.ZodOptional<z.ZodISODateTime>;
        arrival_time: z.ZodOptional<z.ZodISODateTime>;
    }, z.core.$strip>>;
    hotel_details: z.ZodOptional<z.ZodObject<{
        hotel_name: z.ZodOptional<z.ZodString>;
        address: z.ZodOptional<z.ZodString>;
        checkin_date: z.ZodOptional<z.ZodISODate>;
        checkout_date: z.ZodOptional<z.ZodISODate>;
        confirmation_number: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    car_rental_details: z.ZodOptional<z.ZodObject<{
        company: z.ZodOptional<z.ZodString>;
        vehicle_type: z.ZodOptional<z.ZodString>;
        pickup_location: z.ZodOptional<z.ZodString>;
        return_location: z.ZodOptional<z.ZodString>;
        pickup_time: z.ZodOptional<z.ZodISODateTime>;
        return_time: z.ZodOptional<z.ZodISODateTime>;
        confirmation_number: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export type BookingCreationInput = z.infer<typeof bookingCreationSchema>;
export declare const favoriteCreationSchema: z.ZodObject<{
    name: z.ZodString;
    trip_id: z.ZodNullable<z.ZodString>;
    category: z.ZodOptional<z.ZodString>;
    place_id: z.ZodOptional<z.ZodString>;
    location_lat: z.ZodOptional<z.ZodNumber>;
    location_lng: z.ZodOptional<z.ZodNumber>;
    rating: z.ZodOptional<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type FavoriteCreationInput = z.infer<typeof favoriteCreationSchema>;
export declare const favoriteUpdateSchema: z.ZodObject<{
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    trip_id: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    name: z.ZodOptional<z.ZodString>;
    category: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    rating: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
}, z.core.$strip>;
export type FavoriteUpdateInput = z.infer<typeof favoriteUpdateSchema>;
export declare const collectionCreationSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type CollectionCreationInput = z.infer<typeof collectionCreationSchema>;
export declare const collectionUpdateSchema: z.ZodObject<{
    name: z.ZodString;
}, z.core.$strip>;
export type CollectionUpdateInput = z.infer<typeof collectionUpdateSchema>;
export declare const expenseCreationSchema: z.ZodObject<{
    trip_id: z.ZodOptional<z.ZodString>;
    amount: z.ZodNumber;
    currency: z.ZodString;
    date: z.ZodISODate;
    category: z.ZodEnum<{
        accommodation: "accommodation";
        transportation: "transportation";
        food_dining: "food_dining";
        shopping: "shopping";
        tours_activities: "tours_activities";
        entertainment: "entertainment";
        other: "other";
    }>;
    merchant_name: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    booking_id: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type ExpenseCreationInput = z.infer<typeof expenseCreationSchema>;
export declare const timelineEventCreationSchema: z.ZodObject<{
    title: z.ZodString;
    event_time: z.ZodOptional<z.ZodISODateTime>;
    all_day: z.ZodDefault<z.ZodOptional<z.ZodBoolean>>;
    location: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
export type TimelineEventCreationInput = z.infer<typeof timelineEventCreationSchema>;
export declare const timelineEventUpdateSchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    event_time: z.ZodOptional<z.ZodNullable<z.ZodISODateTime>>;
    all_day: z.ZodOptional<z.ZodBoolean>;
    location: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    notes: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export type TimelineEventUpdateInput = z.infer<typeof timelineEventUpdateSchema>;
export declare const voteCreationSchema: z.ZodObject<{
    entity_type: z.ZodEnum<{
        favorite: "favorite";
        timeline_event: "timeline_event";
    }>;
    entity_id: z.ZodString;
    vote_value: z.ZodUnion<readonly [z.ZodLiteral<-1>, z.ZodLiteral<1>]>;
}, z.core.$strip>;
export type VoteCreationInput = z.infer<typeof voteCreationSchema>;
//# sourceMappingURL=index.d.ts.map