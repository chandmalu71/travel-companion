/**
 * OfflineQueue manages local changes made while the device is offline.
 * Changes are queued and later dequeued for synchronization when connectivity is restored.
 *
 * Supports: Requirements 13.1, 13.3, 13.4
 */
export class OfflineQueue {
    queue = [];
    /**
     * Add a local change to the queue.
     * While offline, users can add notes and favorites locally.
     */
    enqueue(change) {
        this.queue.push(change);
    }
    /**
     * Get all queued changes for sync.
     * Returns a copy of the current queue contents.
     */
    dequeue() {
        return [...this.queue];
    }
    /**
     * Clear the queue after successful sync.
     */
    clear() {
        this.queue = [];
    }
    /**
     * Current number of pending changes in the queue.
     */
    get size() {
        return this.queue.length;
    }
}
//# sourceMappingURL=offline-queue.js.map