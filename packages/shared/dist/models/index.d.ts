/**
 * Core TypeScript interfaces for the Travel Companion application.
 * These interfaces represent the data models used across all packages.
 */
export interface User {
    id: string;
    email: string;
    cognito_sub: string;
    display_name: string;
    avatar_url: string | null;
    email_verified: boolean;
    created_at: string;
    updated_at: string;
}
export interface Trip {
    id: string;
    owner_id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    budget: number | null;
    budget_currency: string | null;
    created_at: string;
    updated_at: string;
}
export type BookingType = 'flight' | 'hotel' | 'car_rental';
export type BookingSource = 'email' | 'manual';
export type BookingStatus = 'upcoming' | 'in-progress' | 'completed';
export interface Booking {
    id: string;
    user_id: string;
    trip_id: string | null;
    type: BookingType;
    source: BookingSource;
    source_email_id: string | null;
    checked_in: boolean;
    created_at: string;
    updated_at: string;
}
export interface FlightDetails {
    booking_id: string;
    airline: string | null;
    flight_number: string | null;
    departure_airport: string | null;
    arrival_airport: string | null;
    departure_time: string | null;
    arrival_time: string | null;
    departure_lat: number | null;
    departure_lng: number | null;
    arrival_lat: number | null;
    arrival_lng: number | null;
    checkin_window_opens: string | null;
    checkin_window_closes: string | null;
}
export interface HotelDetails {
    booking_id: string;
    hotel_name: string | null;
    address: string | null;
    checkin_date: string | null;
    checkout_date: string | null;
    lat: number | null;
    lng: number | null;
    confirmation_number: string | null;
}
export interface CarRentalDetails {
    booking_id: string;
    company: string | null;
    vehicle_type: string | null;
    pickup_location: string | null;
    return_location: string | null;
    pickup_time: string | null;
    return_time: string | null;
    pickup_lat: number | null;
    pickup_lng: number | null;
    return_lat: number | null;
    return_lng: number | null;
    confirmation_number: string | null;
}
export interface Favorite {
    id: string;
    user_id: string;
    trip_id: string | null;
    name: string;
    category: string | null;
    place_id: string | null;
    location_lat: number | null;
    location_lng: number | null;
    rating: number | null;
    notes: string | null;
    added_by: string | null;
    created_at: string;
}
export interface Expense {
    id: string;
    user_id: string;
    trip_id: string | null;
    booking_id: string | null;
    amount: number;
    currency: string;
    converted_amount: number | null;
    converted_currency: string | null;
    date: string;
    category: ExpenseCategory;
    merchant_name: string | null;
    notes: string | null;
    receipt_document_id: string | null;
    is_shared: boolean;
    created_at: string;
    updated_at: string;
}
export type ExpenseCategory = 'accommodation' | 'transportation' | 'food_dining' | 'shopping' | 'tours_activities' | 'entertainment' | 'other';
export type DocumentCategory = 'boarding_pass' | 'confirmation' | 'voucher' | 'visa' | 'insurance';
export interface Document {
    id: string;
    user_id: string;
    trip_id: string | null;
    booking_id: string | null;
    category: DocumentCategory;
    file_name: string;
    file_size: number;
    mime_type: string;
    s3_key: string;
    created_at: string;
}
export type TimelineEventType = 'booking' | 'favorite' | 'custom';
export interface TimelineEvent {
    id: string;
    trip_id: string;
    title: string;
    event_time: string | null;
    all_day: boolean;
    location: string | null;
    notes: string | null;
    event_type: TimelineEventType;
    added_by: string | null;
    created_at: string;
    updated_at: string;
}
//# sourceMappingURL=index.d.ts.map