/**
 * Shared constants used across all packages in the Travel Companion application.
 */
// ─── Expense Categories ──────────────────────────────────────────────────────
export const EXPENSE_CATEGORIES = [
    'accommodation',
    'transportation',
    'food_dining',
    'shopping',
    'tours_activities',
    'entertainment',
    'other',
];
// ─── Booking Types ───────────────────────────────────────────────────────────
export const BOOKING_TYPES = ['flight', 'hotel', 'car_rental'];
// ─── Booking Sources ─────────────────────────────────────────────────────────
export const BOOKING_SOURCES = ['email', 'manual'];
// ─── Access Levels ───────────────────────────────────────────────────────────
export const ACCESS_LEVELS = ['view', 'edit'];
// ─── Notification Types ──────────────────────────────────────────────────────
export const NOTIFICATION_TYPES = [
    'flight_reminder',
    'hotel_checkin',
    'car_pickup',
    'checkin_window',
    'weather_alert',
    'budget_threshold',
    'budget_exceeded',
    'gap_detected',
];
// ─── Document Categories ─────────────────────────────────────────────────────
export const DOCUMENT_CATEGORIES = [
    'boarding_pass',
    'confirmation',
    'voucher',
    'visa',
    'insurance',
];
// ─── Timeline Event Types ────────────────────────────────────────────────────
export const TIMELINE_EVENT_TYPES = ['booking', 'favorite', 'custom'];
// ─── Validation Limits ───────────────────────────────────────────────────────
export const LIMITS = {
    PASSWORD_MIN_LENGTH: 8,
    PASSWORD_MAX_LENGTH: 128,
    TRIP_NAME_MIN_LENGTH: 1,
    TRIP_NAME_MAX_LENGTH: 100,
    EXPENSE_AMOUNT_MIN: 0.01,
    EXPENSE_AMOUNT_MAX: 999_999_999.99,
    EXPENSE_NOTES_MAX_LENGTH: 500,
    FAVORITE_NOTES_MAX_LENGTH: 1000,
    TIMELINE_TITLE_MAX_LENGTH: 100,
    TIMELINE_NOTES_MAX_LENGTH: 500,
    MAX_FAVORITES_PER_USER: 500,
    MAX_DOCUMENTS_PER_TRIP: 100,
    MAX_DOCUMENT_SIZE_BYTES: 25 * 1024 * 1024, // 25MB
    MAX_RECEIPT_SIZE_BYTES: 10 * 1024 * 1024, // 10MB
    MAX_SHARE_RECIPIENTS: 20,
    MAX_OFFLINE_TRIPS: 10,
    MAX_OFFLINE_STORAGE_BYTES: 500 * 1024 * 1024, // 500MB
    SEARCH_QUERY_MIN_LENGTH: 2,
    SEARCH_QUERY_MAX_LENGTH: 500,
    POI_RADIUS_MIN_KM: 1,
    POI_RADIUS_MAX_KM: 50,
    POI_RADIUS_DEFAULT_KM: 5,
    POI_MAX_RESULTS: 20,
    COLLECTION_NAME_MAX_LENGTH: 50,
    SHARE_LINK_EXPIRY_DAYS: 30,
    CAPTION_MAX_LENGTH: 500,
    ALLERGY_CUSTOM_MAX_LENGTH: 50,
};
//# sourceMappingURL=index.js.map