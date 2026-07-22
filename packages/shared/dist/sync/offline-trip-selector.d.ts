/**
 * OfflineTripSelector manages which trips are available for offline access.
 * Users can select up to 10 trips, with a total storage cap of 500MB.
 *
 * Supports: Requirements 13.1, 13.7
 */
export declare class OfflineTripSelector {
    private trips;
    /**
     * Maximum number of trips that can be selected for offline access.
     */
    static readonly MAX_TRIPS: 10;
    /**
     * Maximum total offline storage in bytes (500MB).
     */
    static readonly MAX_STORAGE_BYTES: number;
    /**
     * Add a trip for offline access.
     * @param tripId - The trip identifier
     * @param storageBytes - Estimated storage required for this trip's data
     * @returns true if the trip was added, false if limits would be exceeded
     */
    addTrip(tripId: string, storageBytes?: number): boolean;
    /**
     * Remove a trip from offline access.
     * @param tripId - The trip identifier to remove
     * @returns true if the trip was removed, false if it wasn't selected
     */
    removeTrip(tripId: string): boolean;
    /**
     * Check if a specific trip is available offline.
     */
    isAvailableOffline(tripId: string): boolean;
    /**
     * Get all currently selected trip IDs.
     */
    get selectedTrips(): string[];
    /**
     * Get the total storage used by all offline trips in bytes.
     */
    get totalStorageBytes(): number;
    /**
     * Get the number of currently selected trips.
     */
    get count(): number;
    /**
     * Update the estimated storage for a specific trip.
     */
    updateTripStorage(tripId: string, storageBytes: number): boolean;
}
//# sourceMappingURL=offline-trip-selector.d.ts.map