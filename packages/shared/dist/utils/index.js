/**
 * Shared utility functions for date formatting, currency formatting, etc.
 */
// ─── Date Formatting ─────────────────────────────────────────────────────────
/**
 * Formats a date string (ISO 8601) into a human-readable format.
 * Example: "2024-03-15" → "Mar 15, 2024"
 */
export function formatDate(dateStr, locale = 'en-US') {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) {
        return dateStr;
    }
    return date.toLocaleDateString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
}
/**
 * Formats a datetime string (ISO 8601) into a human-readable format with time.
 * Example: "2024-03-15T14:30:00Z" → "Mar 15, 2024, 2:30 PM"
 */
export function formatDateTime(dateTimeStr, locale = 'en-US') {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) {
        return dateTimeStr;
    }
    return date.toLocaleString(locale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
    });
}
/**
 * Formats a time string from a datetime ISO 8601 string.
 * Example: "2024-03-15T14:30:00Z" → "2:30 PM"
 */
export function formatTime(dateTimeStr, locale = 'en-US') {
    const date = new Date(dateTimeStr);
    if (isNaN(date.getTime())) {
        return dateTimeStr;
    }
    return date.toLocaleTimeString(locale, {
        hour: 'numeric',
        minute: '2-digit',
    });
}
/**
 * Returns a relative time description (e.g., "in 3h 45m", "2 days ago").
 */
export function formatRelativeTime(dateTimeStr, now = new Date()) {
    const target = new Date(dateTimeStr);
    if (isNaN(target.getTime())) {
        return dateTimeStr;
    }
    const diffMs = target.getTime() - now.getTime();
    const absDiffMs = Math.abs(diffMs);
    const isFuture = diffMs > 0;
    const minutes = Math.floor(absDiffMs / (1000 * 60));
    const hours = Math.floor(absDiffMs / (1000 * 60 * 60));
    const days = Math.floor(absDiffMs / (1000 * 60 * 60 * 24));
    let timeStr;
    if (days > 0) {
        timeStr = `${days}d`;
    }
    else if (hours > 0) {
        const remainingMinutes = minutes - hours * 60;
        timeStr = remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
    else {
        timeStr = `${minutes}m`;
    }
    return isFuture ? `in ${timeStr}` : `${timeStr} ago`;
}
// ─── Currency Formatting ─────────────────────────────────────────────────────
/**
 * Formats a monetary amount with currency symbol.
 * Example: formatCurrency(47.5, "USD") → "$47.50"
 */
export function formatCurrency(amount, currencyCode, locale = 'en-US') {
    try {
        return new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyCode,
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        }).format(amount);
    }
    catch {
        // Fallback for unsupported currency codes
        return `${amount.toFixed(2)} ${currencyCode}`;
    }
}
/**
 * Converts an amount from one currency to another given a rate.
 * Result is rounded to 2 decimal places.
 */
export function convertCurrency(amount, rate) {
    return Math.round(amount * rate * 100) / 100;
}
//# sourceMappingURL=index.js.map