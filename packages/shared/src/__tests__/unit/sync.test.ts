import { describe, it, expect, beforeEach } from 'vitest';
import {
  OfflineQueue,
  SyncState,
  OfflineTripSelector,
  type ChangeEntry,
  type ConflictEntry,
} from '../../sync';

describe('OfflineQueue', () => {
  let queue: OfflineQueue;

  beforeEach(() => {
    queue = new OfflineQueue();
  });

  it('should start with size 0', () => {
    expect(queue.size).toBe(0);
  });

  it('should enqueue a change entry', () => {
    const change: ChangeEntry = {
      entityType: 'favorite',
      entityId: 'fav-1',
      operation: 'create',
      data: { name: 'Eiffel Tower' },
      localTimestamp: '2024-01-15T10:00:00Z',
    };

    queue.enqueue(change);
    expect(queue.size).toBe(1);
  });

  it('should dequeue all entries as a copy', () => {
    const change1: ChangeEntry = {
      entityType: 'favorite',
      entityId: 'fav-1',
      operation: 'create',
      data: { name: 'Eiffel Tower' },
      localTimestamp: '2024-01-15T10:00:00Z',
    };
    const change2: ChangeEntry = {
      entityType: 'note',
      entityId: 'note-1',
      operation: 'update',
      data: { text: 'Updated note' },
      localTimestamp: '2024-01-15T10:05:00Z',
    };

    queue.enqueue(change1);
    queue.enqueue(change2);

    const entries = queue.dequeue();
    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual(change1);
    expect(entries[1]).toEqual(change2);
    // Dequeue should not modify the queue
    expect(queue.size).toBe(2);
  });

  it('should clear all entries', () => {
    queue.enqueue({
      entityType: 'favorite',
      entityId: 'fav-1',
      operation: 'create',
      data: {},
      localTimestamp: '2024-01-15T10:00:00Z',
    });
    queue.enqueue({
      entityType: 'note',
      entityId: 'note-1',
      operation: 'create',
      data: {},
      localTimestamp: '2024-01-15T10:01:00Z',
    });

    queue.clear();
    expect(queue.size).toBe(0);
    expect(queue.dequeue()).toEqual([]);
  });

  it('should support all operation types', () => {
    const operations: Array<'create' | 'update' | 'delete'> = ['create', 'update', 'delete'];

    for (const op of operations) {
      queue.enqueue({
        entityType: 'favorite',
        entityId: `fav-${op}`,
        operation: op,
        data: {},
        localTimestamp: '2024-01-15T10:00:00Z',
      });
    }

    expect(queue.size).toBe(3);
    const entries = queue.dequeue();
    expect(entries.map((e) => e.operation)).toEqual(['create', 'update', 'delete']);
  });
});

describe('SyncState', () => {
  let state: SyncState;

  beforeEach(() => {
    state = new SyncState();
  });

  it('should initialize with default values', () => {
    expect(state.lastSyncTimestamp).toBeNull();
    expect(state.isOnline).toBe(true);
    expect(state.pendingChanges).toBe(0);
    expect(state.conflicts).toEqual([]);
    expect(state.hasConflicts).toBe(false);
  });

  it('should update online status', () => {
    state.setOnline(false);
    expect(state.isOnline).toBe(false);

    state.setOnline(true);
    expect(state.isOnline).toBe(true);
  });

  it('should track last sync timestamp', () => {
    const timestamp = '2024-01-15T12:00:00Z';
    state.setLastSyncTimestamp(timestamp);
    expect(state.lastSyncTimestamp).toBe(timestamp);
  });

  it('should track pending changes count', () => {
    state.setPendingChanges(5);
    expect(state.pendingChanges).toBe(5);

    state.setPendingChanges(0);
    expect(state.pendingChanges).toBe(0);
  });

  it('should add and track conflicts', () => {
    const conflict: ConflictEntry = {
      entityType: 'favorite',
      entityId: 'fav-1',
      localVersion: { name: 'Local Name' },
      serverVersion: { name: 'Server Name' },
      resolvedVersion: { name: 'Server Name' },
    };

    state.addConflict(conflict);
    expect(state.hasConflicts).toBe(true);
    expect(state.conflicts).toHaveLength(1);
    expect(state.conflicts[0]).toEqual(conflict);
  });

  it('should dismiss a specific conflict', () => {
    state.addConflict({
      entityType: 'favorite',
      entityId: 'fav-1',
      localVersion: {},
      serverVersion: {},
      resolvedVersion: {},
    });
    state.addConflict({
      entityType: 'note',
      entityId: 'note-1',
      localVersion: {},
      serverVersion: {},
      resolvedVersion: {},
    });

    state.dismissConflict('favorite', 'fav-1');
    expect(state.conflicts).toHaveLength(1);
    expect(state.conflicts[0].entityType).toBe('note');
  });

  it('should clear all conflicts', () => {
    state.addConflict({
      entityType: 'favorite',
      entityId: 'fav-1',
      localVersion: {},
      serverVersion: {},
      resolvedVersion: {},
    });
    state.addConflict({
      entityType: 'note',
      entityId: 'note-1',
      localVersion: {},
      serverVersion: {},
      resolvedVersion: {},
    });

    state.clearConflicts();
    expect(state.hasConflicts).toBe(false);
    expect(state.conflicts).toEqual([]);
  });
});

describe('OfflineTripSelector', () => {
  let selector: OfflineTripSelector;

  beforeEach(() => {
    selector = new OfflineTripSelector();
  });

  it('should start with no trips selected', () => {
    expect(selector.selectedTrips).toEqual([]);
    expect(selector.count).toBe(0);
    expect(selector.totalStorageBytes).toBe(0);
  });

  it('should add a trip for offline access', () => {
    const result = selector.addTrip('trip-1', 1000);
    expect(result).toBe(true);
    expect(selector.count).toBe(1);
    expect(selector.isAvailableOffline('trip-1')).toBe(true);
  });

  it('should not add duplicate trips', () => {
    selector.addTrip('trip-1', 1000);
    const result = selector.addTrip('trip-1', 2000);
    expect(result).toBe(true); // Returns true since already selected
    expect(selector.count).toBe(1);
    expect(selector.totalStorageBytes).toBe(1000); // Storage unchanged
  });

  it('should enforce max 10 trips limit', () => {
    for (let i = 0; i < 10; i++) {
      selector.addTrip(`trip-${i}`, 100);
    }
    expect(selector.count).toBe(10);

    const result = selector.addTrip('trip-11', 100);
    expect(result).toBe(false);
    expect(selector.count).toBe(10);
  });

  it('should enforce max 500MB storage limit', () => {
    // Add a trip taking nearly all storage
    selector.addTrip('trip-large', 500 * 1024 * 1024 - 100);

    // This should fail as it exceeds the limit
    const result = selector.addTrip('trip-overflow', 200);
    expect(result).toBe(false);
  });

  it('should remove a trip', () => {
    selector.addTrip('trip-1', 1000);
    const result = selector.removeTrip('trip-1');

    expect(result).toBe(true);
    expect(selector.isAvailableOffline('trip-1')).toBe(false);
    expect(selector.count).toBe(0);
    expect(selector.totalStorageBytes).toBe(0);
  });

  it('should return false when removing a non-existent trip', () => {
    const result = selector.removeTrip('non-existent');
    expect(result).toBe(false);
  });

  it('should track total storage across trips', () => {
    selector.addTrip('trip-1', 1000);
    selector.addTrip('trip-2', 2000);
    selector.addTrip('trip-3', 3000);

    expect(selector.totalStorageBytes).toBe(6000);
  });

  it('should update trip storage', () => {
    selector.addTrip('trip-1', 1000);
    const result = selector.updateTripStorage('trip-1', 2000);

    expect(result).toBe(true);
    expect(selector.totalStorageBytes).toBe(2000);
  });

  it('should reject storage update that would exceed limit', () => {
    selector.addTrip('trip-1', 100);
    selector.addTrip('trip-2', 500 * 1024 * 1024 - 200);

    const result = selector.updateTripStorage('trip-1', 500 * 1024 * 1024);
    expect(result).toBe(false);
    expect(selector.totalStorageBytes).toBe(500 * 1024 * 1024 - 100);
  });

  it('should return false when updating non-existent trip', () => {
    const result = selector.updateTripStorage('non-existent', 1000);
    expect(result).toBe(false);
  });

  it('should allow adding trip with default 0 storage', () => {
    const result = selector.addTrip('trip-1');
    expect(result).toBe(true);
    expect(selector.totalStorageBytes).toBe(0);
  });
});
