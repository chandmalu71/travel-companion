/**
 * Shared utility functions for date formatting, currency formatting, etc.
 */
/**
 * Formats a date string (ISO 8601) into a human-readable format.
 * Example: "2024-03-15" → "Mar 15, 2024"
 */
export declare function formatDate(dateStr: string, locale?: string): string;
/**
 * Formats a datetime string (ISO 8601) into a human-readable format with time.
 * Example: "2024-03-15T14:30:00Z" → "Mar 15, 2024, 2:30 PM"
 */
export declare function formatDateTime(dateTimeStr: string, locale?: string): string;
/**
 * Formats a time string from a datetime ISO 8601 string.
 * Example: "2024-03-15T14:30:00Z" → "2:30 PM"
 */
export declare function formatTime(dateTimeStr: string, locale?: string): string;
/**
 * Returns a relative time description (e.g., "in 3h 45m", "2 days ago").
 */
export declare function formatRelativeTime(dateTimeStr: string, now?: Date): string;
/**
 * Formats a monetary amount with currency symbol.
 * Example: formatCurrency(47.5, "USD") → "$47.50"
 */
export declare function formatCurrency(amount: number, currencyCode: string, locale?: string): string;
/**
 * Converts an amount from one currency to another given a rate.
 * Result is rounded to 2 decimal places.
 */
export declare function convertCurrency(amount: number, rate: number): number;
//# sourceMappingURL=index.d.ts.map