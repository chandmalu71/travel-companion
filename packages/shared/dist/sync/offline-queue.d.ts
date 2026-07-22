import type { ChangeEntry } from './types';
/**
 * OfflineQueue manages local changes made while the device is offline.
 * Changes are queued and later dequeued for synchronization when connectivity is restored.
 *
 * Supports: Requirements 13.1, 13.3, 13.4
 */
export declare class OfflineQueue {
    private queue;
    /**
     * Add a local change to the queue.
     * While offline, users can add notes and favorites locally.
     */
    enqueue(change: ChangeEntry): void;
    /**
     * Get all queued changes for sync.
     * Returns a copy of the current queue contents.
     */
    dequeue(): ChangeEntry[];
    /**
     * Clear the queue after successful sync.
     */
    clear(): void;
    /**
     * Current number of pending changes in the queue.
     */
    get size(): number;
}
//# sourceMappingURL=offline-queue.d.ts.map