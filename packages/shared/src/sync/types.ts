/**
 * Sync protocol types for offline queue management and conflict resolution.
 * These types define the client-server sync protocol as specified in the design document.
 */

/**
 * Represents a single local change to be synced with the server.
 */
export interface ChangeEntry {
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  data: Record<string, unknown>;
  localTimestamp: string; // ISO 8601
}

/**
 * Represents a conflict detected during synchronization.
 * When the same entity is modified both locally and on the server,
 * the server resolves by last-write-wins and notifies the user.
 */
export interface ConflictEntry {
  entityType: string;
  entityId: string;
  localVersion: Record<string, unknown>;
  serverVersion: Record<string, unknown>;
  resolvedVersion: Record<string, unknown>; // most recent wins
}

/**
 * Payload sent from the client to the server during sync.
 */
export interface SyncPayload {
  lastSyncTimestamp: string; // ISO 8601
  localChanges: ChangeEntry[];
}

/**
 * Response from the server after processing a sync request.
 */
export interface SyncResponse {
  serverChanges: ChangeEntry[];
  conflicts: ConflictEntry[];
  newSyncTimestamp: string; // ISO 8601
}
