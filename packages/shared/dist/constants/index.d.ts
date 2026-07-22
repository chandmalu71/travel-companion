/**
 * Shared constants used across all packages in the Travel Companion application.
 */
export declare const EXPENSE_CATEGORIES: readonly ["accommodation", "transportation", "food_dining", "shopping", "tours_activities", "entertainment", "other"];
export type ExpenseCategoryValue = (typeof EXPENSE_CATEGORIES)[number];
export declare const BOOKING_TYPES: readonly ["flight", "hotel", "car_rental"];
export type BookingTypeValue = (typeof BOOKING_TYPES)[number];
export declare const BOOKING_SOURCES: readonly ["email", "manual"];
export type BookingSourceValue = (typeof BOOKING_SOURCES)[number];
export declare const ACCESS_LEVELS: readonly ["view", "edit"];
export type AccessLevelValue = (typeof ACCESS_LEVELS)[number];
export declare const NOTIFICATION_TYPES: readonly ["flight_reminder", "hotel_checkin", "car_pickup", "checkin_window", "weather_alert", "budget_threshold", "budget_exceeded", "gap_detected"];
export type NotificationTypeValue = (typeof NOTIFICATION_TYPES)[number];
export declare const DOCUMENT_CATEGORIES: readonly ["boarding_pass", "confirmation", "voucher", "visa", "insurance"];
export type DocumentCategoryValue = (typeof DOCUMENT_CATEGORIES)[number];
export declare const TIMELINE_EVENT_TYPES: readonly ["booking", "favorite", "custom"];
export type TimelineEventTypeValue = (typeof TIMELINE_EVENT_TYPES)[number];
export declare const LIMITS: {
    readonly PASSWORD_MIN_LENGTH: 8;
    readonly PASSWORD_MAX_LENGTH: 128;
    readonly TRIP_NAME_MIN_LENGTH: 1;
    readonly TRIP_NAME_MAX_LENGTH: 100;
    readonly EXPENSE_AMOUNT_MIN: 0.01;
    readonly EXPENSE_AMOUNT_MAX: 999999999.99;
    readonly EXPENSE_NOTES_MAX_LENGTH: 500;
    readonly FAVORITE_NOTES_MAX_LENGTH: 1000;
    readonly TIMELINE_TITLE_MAX_LENGTH: 100;
    readonly TIMELINE_NOTES_MAX_LENGTH: 500;
    readonly MAX_FAVORITES_PER_USER: 500;
    readonly MAX_DOCUMENTS_PER_TRIP: 100;
    readonly MAX_DOCUMENT_SIZE_BYTES: number;
    readonly MAX_RECEIPT_SIZE_BYTES: number;
    readonly MAX_SHARE_RECIPIENTS: 20;
    readonly MAX_OFFLINE_TRIPS: 10;
    readonly MAX_OFFLINE_STORAGE_BYTES: number;
    readonly SEARCH_QUERY_MIN_LENGTH: 2;
    readonly SEARCH_QUERY_MAX_LENGTH: 500;
    readonly POI_RADIUS_MIN_KM: 1;
    readonly POI_RADIUS_MAX_KM: 50;
    readonly POI_RADIUS_DEFAULT_KM: 5;
    readonly POI_MAX_RESULTS: 20;
    readonly COLLECTION_NAME_MAX_LENGTH: 50;
    readonly SHARE_LINK_EXPIRY_DAYS: 30;
    readonly CAPTION_MAX_LENGTH: 500;
    readonly ALLERGY_CUSTOM_MAX_LENGTH: 50;
};
//# sourceMappingURL=index.d.ts.map