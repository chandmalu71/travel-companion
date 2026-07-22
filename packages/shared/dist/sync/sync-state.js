/**
 * SyncState tracks the current synchronization status for the client.
 * Displays online/offline indicator, pending changes count, conflicts, and last sync timestamp.
 *
 * Supports: Requirements 13.2, 13.5, 13.6
 */
export class SyncState {
    lastSyncTimestamp = null;
    isOnline = true;
    pendingChanges = 0;
    conflicts = [];
    /**
     * Update the online/offline status.
     * When offline, the application should display a visible offline indicator (Req 13.2).
     */
    setOnline(online) {
        this.isOnline = online;
    }
    /**
     * Update the last sync timestamp after a successful sync (Req 13.6).
     */
    setLastSyncTimestamp(timestamp) {
        this.lastSyncTimestamp = timestamp;
    }
    /**
     * Update the count of pending local changes awaiting sync.
     */
    setPendingChanges(count) {
        this.pendingChanges = count;
    }
    /**
     * Add a conflict detected during synchronization.
     * Conflicts notify the user that their local change was overwritten (Req 13.5).
     */
    addConflict(conflict) {
        this.conflicts.push(conflict);
    }
    /**
     * Dismiss a specific conflict by entity type and ID.
     */
    dismissConflict(entityType, entityId) {
        this.conflicts = this.conflicts.filter((c) => !(c.entityType === entityType && c.entityId === entityId));
    }
    /**
     * Clear all conflicts.
     */
    clearConflicts() {
        this.conflicts = [];
    }
    /**
     * Whether there are unresolved conflicts requiring user attention.
     */
    get hasConflicts() {
        return this.conflicts.length > 0;
    }
}
//# sourceMappingURL=sync-state.js.map