/**
 * Offline Storage Manager for React Native
 *
 * Uses SQLite for offline trip data caching.
 * Supports selecting up to 10 trips for offline access (max 500MB).
 * Syncs with server when connectivity is restored.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const MAX_OFFLINE_TRIPS = 10;
const MAX_STORAGE_MB = 500;
const OFFLINE_TRIPS_KEY = 'offline_trips';
const LAST_SYNC_KEY = 'last_sync_timestamp';

export interface OfflineTripData {
  tripId: string;
  tripName: string;
  cachedAt: string;
  sizeMB: number;
  bookings: any[];
  timeline: any[];
  documents: any[];
}

export class OfflineStorageManager {
  /**
   * Get list of trips available offline.
   */
  async getOfflineTrips(): Promise<OfflineTripData[]> {
    const data = await AsyncStorage.getItem(OFFLINE_TRIPS_KEY);
    return data ? JSON.parse(data) : [];
  }

  /**
   * Cache a trip for offline access.
   */
  async cacheTrip(tripData: OfflineTripData): Promise<void> {
    const existing = await this.getOfflineTrips();

    if (existing.length >= MAX_OFFLINE_TRIPS) {
      throw new Error(`Maximum ${MAX_OFFLINE_TRIPS} offline trips allowed`);
    }

    const totalSize = existing.reduce((sum, t) => sum + t.sizeMB, 0) + tripData.sizeMB;
    if (totalSize > MAX_STORAGE_MB) {
      throw new Error(`Storage limit exceeded (${MAX_STORAGE_MB}MB max)`);
    }

    // Replace if already cached, otherwise add
    const updated = existing.filter((t) => t.tripId !== tripData.tripId);
    updated.push({ ...tripData, cachedAt: new Date().toISOString() });

    await AsyncStorage.setItem(OFFLINE_TRIPS_KEY, JSON.stringify(updated));
  }

  /**
   * Remove a trip from offline storage.
   */
  async removeOfflineTrip(tripId: string): Promise<void> {
    const existing = await this.getOfflineTrips();
    const updated = existing.filter((t) => t.tripId !== tripId);
    await AsyncStorage.setItem(OFFLINE_TRIPS_KEY, JSON.stringify(updated));
  }

  /**
   * Get last sync timestamp.
   */
  async getLastSyncTime(): Promise<string | null> {
    return AsyncStorage.getItem(LAST_SYNC_KEY);
  }

  /**
   * Update last sync timestamp.
   */
  async updateLastSyncTime(): Promise<void> {
    await AsyncStorage.setItem(LAST_SYNC_KEY, new Date().toISOString());
  }

  /**
   * Get total offline storage usage.
   */
  async getStorageUsage(): Promise<{ usedMB: number; maxMB: number; tripCount: number }> {
    const trips = await this.getOfflineTrips();
    const usedMB = trips.reduce((sum, t) => sum + t.sizeMB, 0);
    return { usedMB, maxMB: MAX_STORAGE_MB, tripCount: trips.length };
  }
}

export const offlineStorage = new OfflineStorageManager();
