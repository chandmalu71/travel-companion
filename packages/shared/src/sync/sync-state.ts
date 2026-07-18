import type { ConflictEntry } from './types';

/**
 * SyncState tracks the current synchronization status for the client.
 * Displays online/offline indicator, pending changes count, conflicts, and last sync timestamp.
 *
 * Supports: Requirements 13.2, 13.5, 13.6
 */
export class SyncState {
  lastSyncTimestamp: string | null = null;
  isOnline: boolean = true;
  pendingChanges: number = 0;
  conflicts: ConflictEntry[] = [];

  /**
   * Update the online/offline status.
   * When offline, the application should display a visible offline indicator (Req 13.2).
   */
  setOnline(online: boolean): void {
    this.isOnline = online;
  }

  /**
   * Update the last sync timestamp after a successful sync (Req 13.6).
   */
  setLastSyncTimestamp(timestamp: string): void {
    this.lastSyncTimestamp = timestamp;
  }

  /**
   * Update the count of pending local changes awaiting sync.
   */
  setPendingChanges(count: number): void {
    this.pendingChanges = count;
  }

  /**
   * Add a conflict detected during synchronization.
   * Conflicts notify the user that their local change was overwritten (Req 13.5).
   */
  addConflict(conflict: ConflictEntry): void {
    this.conflicts.push(conflict);
  }

  /**
   * Dismiss a specific conflict by entity type and ID.
   */
  dismissConflict(entityType: string, entityId: string): void {
    this.conflicts = this.conflicts.filter(
      (c) => !(c.entityType === entityType && c.entityId === entityId),
    );
  }

  /**
   * Clear all conflicts.
   */
  clearConflicts(): void {
    this.conflicts = [];
  }

  /**
   * Whether there are unresolved conflicts requiring user attention.
   */
  get hasConflicts(): boolean {
    return this.conflicts.length > 0;
  }
}
