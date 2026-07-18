import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createServer, type Server as HttpServer } from 'node:http';
import { io as ioc, type Socket as ClientSocket } from 'socket.io-client';
import { CollaborationService, type CollaborationEvent, type ConflictNotification } from './collaboration.js';

/**
 * Helper to wait for a socket event with a timeout.
 */
function waitForEvent<T>(socket: ClientSocket, event: string, timeoutMs = 3000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for event: ${event}`)), timeoutMs);
    socket.once(event, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

/**
 * Helper to wait a bit for async operations.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('CollaborationService', () => {
  let httpServer: HttpServer;
  let service: CollaborationService;
  let clientA: ClientSocket;
  let clientB: ClientSocket;
  let port: number;

  beforeEach(async () => {
    // Create HTTP server and collaboration service without JWKS (test mode)
    httpServer = createServer();
    service = new CollaborationService();
    service.attach(httpServer);

    // Start server on a random port
    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        port = typeof addr === 'object' && addr ? addr.port : 0;
        resolve();
      });
    });
  });

  afterEach(async () => {
    // Clean up clients
    if (clientA?.connected) clientA.disconnect();
    if (clientB?.connected) clientB.disconnect();

    // Close service and server
    await service.close();
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  function createClient(auth: { userId: string; userName: string }): ClientSocket {
    return ioc(`http://localhost:${port}`, {
      auth,
      transports: ['websocket'],
      forceNew: true,
    });
  }

  async function connectClient(client: ClientSocket): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Connection timeout')), 3000);
      client.on('connect', () => {
        clearTimeout(timer);
        resolve();
      });
      client.on('connect_error', (err) => {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  describe('Authentication', () => {
    it('should reject connections without credentials', async () => {
      const client = ioc(`http://localhost:${port}`, {
        auth: {},
        transports: ['websocket'],
        forceNew: true,
      });

      // Without userId in auth, the connection should be rejected
      const error = await new Promise<Error>((resolve) => {
        client.on('connect_error', (err) => {
          resolve(err);
        });
      });

      expect(error.message).toContain('Authentication required');
      client.disconnect();
    });

    it('should accept connections with valid auth data', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);
      expect(clientA.connected).toBe(true);
    });
  });

  describe('Room Management', () => {
    it('should join a trip room and receive confirmation', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);

      const joinPromise = waitForEvent<{ tripId: string; room: string }>(clientA, 'joined_trip');
      clientA.emit('join_trip', 'trip-123');

      const result = await joinPromise;
      expect(result.tripId).toBe('trip-123');
      expect(result.room).toBe('trip:trip-123');
    });

    it('should notify others when a collaborator joins', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      clientB = createClient({ userId: 'user-2', userName: 'Bob' });

      await connectClient(clientA);
      await connectClient(clientB);

      // Alice joins first
      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      // Bob joins - Alice should be notified
      const notifyPromise = waitForEvent<{ userId: string; userName: string; tripId: string }>(
        clientA,
        'collaborator_joined',
      );
      clientB.emit('join_trip', 'trip-123');

      const notification = await notifyPromise;
      expect(notification.userId).toBe('user-2');
      expect(notification.userName).toBe('Bob');
      expect(notification.tripId).toBe('trip-123');
    });

    it('should leave a trip room and receive confirmation', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);

      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      const leavePromise = waitForEvent<{ tripId: string; room: string }>(clientA, 'left_trip');
      clientA.emit('leave_trip', 'trip-123');

      const result = await leavePromise;
      expect(result.tripId).toBe('trip-123');
      expect(result.room).toBe('trip:trip-123');
    });

    it('should notify others when a collaborator leaves', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      clientB = createClient({ userId: 'user-2', userName: 'Bob' });

      await connectClient(clientA);
      await connectClient(clientB);

      // Both join the trip
      clientA.emit('join_trip', 'trip-123');
      clientB.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');
      await waitForEvent(clientB, 'joined_trip');
      // Wait for collaborator_joined notification to propagate
      await sleep(100);

      // Bob leaves - Alice should be notified
      const notifyPromise = waitForEvent<{ userId: string; userName: string; tripId: string }>(
        clientA,
        'collaborator_left',
      );
      clientB.emit('leave_trip', 'trip-123');

      const notification = await notifyPromise;
      expect(notification.userId).toBe('user-2');
      expect(notification.userName).toBe('Bob');
      expect(notification.tripId).toBe('trip-123');
    });
  });

  describe('Event Broadcasting', () => {
    it('should broadcast item_added events to all users in a trip room', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      clientB = createClient({ userId: 'user-2', userName: 'Bob' });

      await connectClient(clientA);
      await connectClient(clientB);

      // Both join the trip
      clientA.emit('join_trip', 'trip-123');
      clientB.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');
      await waitForEvent(clientB, 'joined_trip');
      await sleep(100);

      // Broadcast an item_added event
      const eventPromiseA = waitForEvent<CollaborationEvent>(clientA, 'collaboration_event');
      const eventPromiseB = waitForEvent<CollaborationEvent>(clientB, 'collaboration_event');

      const event: CollaborationEvent = {
        type: 'item_added',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Eiffel Tower' },
        timestamp: '', // Will be overridden by server
      };

      service.broadcastEvent('trip-123', event);

      const [receivedA, receivedB] = await Promise.all([eventPromiseA, eventPromiseB]);

      expect(receivedA.type).toBe('item_added');
      expect(receivedA.entityId).toBe('fav-1');
      expect(receivedA.timestamp).toBeTruthy();
      expect(receivedB.type).toBe('item_added');
      expect(receivedB.entityId).toBe('fav-1');
    });

    it('should broadcast item_updated events', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);

      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      const eventPromise = waitForEvent<CollaborationEvent>(clientA, 'collaboration_event');

      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'timeline_event',
        entityId: 'event-1',
        data: { title: 'Updated Visit' },
        timestamp: '',
      });

      const received = await eventPromise;
      expect(received.type).toBe('item_updated');
      expect(received.entityType).toBe('timeline_event');
    });

    it('should broadcast item_removed events', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);

      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      const eventPromise = waitForEvent<CollaborationEvent>(clientA, 'collaboration_event');

      service.broadcastEvent('trip-123', {
        type: 'item_removed',
        userId: 'user-2',
        userName: 'Bob',
        entityType: 'favorite',
        entityId: 'fav-2',
        data: {},
        timestamp: '',
      });

      const received = await eventPromise;
      expect(received.type).toBe('item_removed');
      expect(received.entityId).toBe('fav-2');
    });

    it('should broadcast vote_cast events', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      await connectClient(clientA);

      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      const eventPromise = waitForEvent<CollaborationEvent>(clientA, 'collaboration_event');

      service.broadcastEvent('trip-123', {
        type: 'vote_cast',
        userId: 'user-2',
        userName: 'Bob',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { voteValue: 1 },
        timestamp: '',
      });

      const received = await eventPromise;
      expect(received.type).toBe('vote_cast');
      expect(received.data).toEqual({ voteValue: 1 });
    });
  });

  describe('Conflict Resolution (Last Write Wins)', () => {
    it('should use server timestamp for all events (last write wins)', () => {
      const oldTimestamp = '2020-01-01T00:00:00.000Z';
      const beforeBroadcast = new Date();

      const { event: resolved } = service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Updated' },
        timestamp: oldTimestamp,
      });

      const afterBroadcast = new Date();
      const resolvedTime = new Date(resolved.timestamp);

      // Server timestamp should be between before and after the call
      expect(resolvedTime.getTime()).toBeGreaterThanOrEqual(beforeBroadcast.getTime());
      expect(resolvedTime.getTime()).toBeLessThanOrEqual(afterBroadcast.getTime());
      // The client-provided timestamp should be overridden
      expect(resolved.timestamp).not.toBe(oldTimestamp);
    });

    it('should track entity versions', () => {
      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'First' },
        timestamp: '',
      });

      const version = service.getEntityVersion('favorite', 'fav-1');
      expect(version).toBeDefined();
      expect(version!.lastModifiedBy).toBe('user-1');
      expect(version!.lastModifiedByName).toBe('Alice');
    });

    it('should detect conflict when different user updates same entity', () => {
      // User 1 updates an entity
      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Alice version' },
        timestamp: '',
      });

      // User 2 updates the same entity (conflict!)
      const { overwriteNotification } = service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-2',
        userName: 'Bob',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Bob version' },
        timestamp: '',
      });

      expect(overwriteNotification).not.toBeNull();
      expect(overwriteNotification!.overwrittenBy).toBe('user-2');
      expect(overwriteNotification!.overwrittenByName).toBe('Bob');
      expect(overwriteNotification!.message).toContain('overwritten by Bob');
    });

    it('should NOT produce conflict when same user updates their own entity', () => {
      // User 1 updates an entity
      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'First' },
        timestamp: '',
      });

      // Same user updates again (no conflict)
      const { overwriteNotification } = service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Second' },
        timestamp: '',
      });

      expect(overwriteNotification).toBeNull();
    });

    it('should NOT produce conflict for item_added events', () => {
      const { overwriteNotification } = service.broadcastEvent('trip-123', {
        type: 'item_added',
        userId: 'user-2',
        userName: 'Bob',
        entityType: 'favorite',
        entityId: 'fav-new',
        data: { name: 'New Place' },
        timestamp: '',
      });

      expect(overwriteNotification).toBeNull();
    });

    it('should send overwrite notification to the overwritten user via socket', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      clientB = createClient({ userId: 'user-2', userName: 'Bob' });

      await connectClient(clientA);
      await connectClient(clientB);

      clientA.emit('join_trip', 'trip-123');
      clientB.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');
      await waitForEvent(clientB, 'joined_trip');
      await sleep(100);

      // Alice edits an item
      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-1',
        userName: 'Alice',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Alice version' },
        timestamp: '',
      });

      // Listen for overwrite notification on Alice's client
      const notificationPromise = waitForEvent<ConflictNotification>(clientA, 'overwrite_notification');

      // Bob overwrites Alice's change
      service.broadcastEvent('trip-123', {
        type: 'item_updated',
        userId: 'user-2',
        userName: 'Bob',
        entityType: 'favorite',
        entityId: 'fav-1',
        data: { name: 'Bob version' },
        timestamp: '',
      });

      const notification = await notificationPromise;
      expect(notification.type).toBe('overwrite_notification');
      expect(notification.overwrittenBy).toBe('user-2');
      expect(notification.overwrittenByName).toBe('Bob');
      expect(notification.message).toContain('overwritten by Bob');
    });
  });

  describe('Room Name Construction', () => {
    it('should construct room name as trip:{tripId}', () => {
      expect(service.getRoomName('abc-123')).toBe('trip:abc-123');
      expect(service.getRoomName('my-trip')).toBe('trip:my-trip');
    });
  });

  describe('Room Size', () => {
    it('should report room size correctly', async () => {
      clientA = createClient({ userId: 'user-1', userName: 'Alice' });
      clientB = createClient({ userId: 'user-2', userName: 'Bob' });

      await connectClient(clientA);
      await connectClient(clientB);

      clientA.emit('join_trip', 'trip-123');
      await waitForEvent(clientA, 'joined_trip');

      expect(service.getRoomSize('trip-123')).toBe(1);

      clientB.emit('join_trip', 'trip-123');
      await waitForEvent(clientB, 'joined_trip');
      await sleep(50);

      expect(service.getRoomSize('trip-123')).toBe(2);
    });
  });
});
