import { LIMITS } from '../constants';
/**
 * OfflineTripSelector manages which trips are available for offline access.
 * Users can select up to 10 trips, with a total storage cap of 500MB.
 *
 * Supports: Requirements 13.1, 13.7
 */
export class OfflineTripSelector {
    trips = new Map(); // tripId -> storageBytes
    /**
     * Maximum number of trips that can be selected for offline access.
     */
    static MAX_TRIPS = LIMITS.MAX_OFFLINE_TRIPS;
    /**
     * Maximum total offline storage in bytes (500MB).
     */
    static MAX_STORAGE_BYTES = LIMITS.MAX_OFFLINE_STORAGE_BYTES;
    /**
     * Add a trip for offline access.
     * @param tripId - The trip identifier
     * @param storageBytes - Estimated storage required for this trip's data
     * @returns true if the trip was added, false if limits would be exceeded
     */
    addTrip(tripId, storageBytes = 0) {
        if (this.trips.has(tripId)) {
            return true; // Already selected
        }
        if (this.trips.size >= OfflineTripSelector.MAX_TRIPS) {
            return false; // Max 10 trips
        }
        if (this.totalStorageBytes + storageBytes > OfflineTripSelector.MAX_STORAGE_BYTES) {
            return false; // Would exceed 500MB
        }
        this.trips.set(tripId, storageBytes);
        return true;
    }
    /**
     * Remove a trip from offline access.
     * @param tripId - The trip identifier to remove
     * @returns true if the trip was removed, false if it wasn't selected
     */
    removeTrip(tripId) {
        return this.trips.delete(tripId);
    }
    /**
     * Check if a specific trip is available offline.
     */
    isAvailableOffline(tripId) {
        return this.trips.has(tripId);
    }
    /**
     * Get all currently selected trip IDs.
     */
    get selectedTrips() {
        return Array.from(this.trips.keys());
    }
    /**
     * Get the total storage used by all offline trips in bytes.
     */
    get totalStorageBytes() {
        let total = 0;
        for (const bytes of this.trips.values()) {
            total += bytes;
        }
        return total;
    }
    /**
     * Get the number of currently selected trips.
     */
    get count() {
        return this.trips.size;
    }
    /**
     * Update the estimated storage for a specific trip.
     */
    updateTripStorage(tripId, storageBytes) {
        if (!this.trips.has(tripId)) {
            return false;
        }
        const currentBytes = this.trips.get(tripId);
        const newTotal = this.totalStorageBytes - currentBytes + storageBytes;
        if (newTotal > OfflineTripSelector.MAX_STORAGE_BYTES) {
            return false; // Would exceed storage limit
        }
        this.trips.set(tripId, storageBytes);
        return true;
    }
}
//# sourceMappingURL=offline-trip-selector.js.map