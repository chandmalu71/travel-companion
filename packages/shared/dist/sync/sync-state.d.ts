import type { ConflictEntry } from './types';
/**
 * SyncState tracks the current synchronization status for the client.
 * Displays online/offline indicator, pending changes count, conflicts, and last sync timestamp.
 *
 * Supports: Requirements 13.2, 13.5, 13.6
 */
export declare class SyncState {
    lastSyncTimestamp: string | null;
    isOnline: boolean;
    pendingChanges: number;
    conflicts: ConflictEntry[];
    /**
     * Update the online/offline status.
     * When offline, the application should display a visible offline indicator (Req 13.2).
     */
    setOnline(online: boolean): void;
    /**
     * Update the last sync timestamp after a successful sync (Req 13.6).
     */
    setLastSyncTimestamp(timestamp: string): void;
    /**
     * Update the count of pending local changes awaiting sync.
     */
    setPendingChanges(count: number): void;
    /**
     * Add a conflict detected during synchronization.
     * Conflicts notify the user that their local change was overwritten (Req 13.5).
     */
    addConflict(conflict: ConflictEntry): void;
    /**
     * Dismiss a specific conflict by entity type and ID.
     */
    dismissConflict(entityType: string, entityId: string): void;
    /**
     * Clear all conflicts.
     */
    clearConflicts(): void;
    /**
     * Whether there are unresolved conflicts requiring user attention.
     */
    get hasConflicts(): boolean;
}
//# sourceMappingURL=sync-state.d.ts.map