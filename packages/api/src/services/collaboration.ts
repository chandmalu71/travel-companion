/**
 * Real-time collaboration service using Socket.io.
 *
 * Provides room-based architecture (one room per trip) for broadcasting
 * collaboration events and handling conflict resolution with last-write-wins
 * strategy (server-received timestamp wins).
 *
 * Requirements: 11.5, 12.1, 12.2, 12.3
 */

import { Server as SocketIOServer, type Socket } from 'socket.io';
import type { Server as HttpServer } from 'node:http';
import { jwtVerify, type JWTVerifyGetKey } from 'jose';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CollaborationEventType = 'item_added' | 'item_updated' | 'item_removed' | 'vote_cast';

export interface CollaborationEvent {
  type: CollaborationEventType;
  userId: string;
  userName: string;
  entityType: string;
  entityId: string;
  data: Record<string, unknown>;
  timestamp: string;
}

export interface ConflictNotification {
  type: 'overwrite_notification';
  entityType: string;
  entityId: string;
  overwrittenBy: string;
  overwrittenByName: string;
  timestamp: string;
  message: string;
}

export interface EntityVersion {
  entityType: string;
  entityId: string;
  lastModifiedBy: string;
  lastModifiedByName: string;
  timestamp: string;
}

export interface CollaborationServiceOptions {
  /** JWKS verification function (from jose) */
  jwks?: JWTVerifyGetKey;
  /** Maximum overwrite notification delay in ms (default: 30000 = 30s) */
  notificationDeadlineMs?: number;
}

// ─── Collaboration Service ───────────────────────────────────────────────────

export class CollaborationService {
  private io: SocketIOServer | null = null;
  private entityVersions = new Map<string, EntityVersion>();
  private options: CollaborationServiceOptions;

  constructor(options: CollaborationServiceOptions = {}) {
    this.options = {
      notificationDeadlineMs: 30000,
      ...options,
    };
  }

  /**
   * Attach Socket.io server to an HTTP server instance.
   */
  attach(httpServer: HttpServer): SocketIOServer {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
      path: '/socket.io',
    });

    // Authentication middleware for WebSocket connections
    this.io.use(async (socket, next) => {
      try {
        if (this.options.jwks) {
          // Production mode: verify JWT token
          const token = socket.handshake.auth?.token ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');

          if (!token) {
            return next(new Error('Authentication required'));
          }

          const { payload } = await jwtVerify(token, this.options.jwks);
          const userId = payload.sub;
          const email = (payload as Record<string, unknown>).email as string ?? '';

          if (!userId) {
            return next(new Error('Invalid token: missing user identifier'));
          }

          socket.data.userId = userId;
          socket.data.email = email;
          socket.data.userName = email || userId;
        } else {
          // Development/testing mode without JWKS: extract user info from handshake auth
          const userId = socket.handshake.auth?.userId;
          const userName = socket.handshake.auth?.userName;

          if (!userId) {
            return next(new Error('Authentication required'));
          }

          socket.data.userId = userId;
          socket.data.userName = userName ?? 'Anonymous';
        }

        next();
      } catch {
        next(new Error('Authentication failed'));
      }
    });

    // Connection handler
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });

    return this.io;
  }

  /**
   * Get the Socket.io server instance.
   */
  getIO(): SocketIOServer | null {
    return this.io;
  }

  /**
   * Handle a new socket connection.
   */
  private handleConnection(socket: Socket): void {
    const userId = socket.data.userId as string;
    const userName = socket.data.userName as string;

    // Join a trip room
    socket.on('join_trip', (tripId: string) => {
      const room = this.getRoomName(tripId);
      socket.join(room);
      socket.emit('joined_trip', { tripId, room });

      // Notify others in the room
      socket.to(room).emit('collaborator_joined', {
        userId,
        userName,
        tripId,
        timestamp: new Date().toISOString(),
      });
    });

    // Leave a trip room
    socket.on('leave_trip', (tripId: string) => {
      const room = this.getRoomName(tripId);
      socket.leave(room);
      socket.emit('left_trip', { tripId, room });

      // Notify others in the room
      socket.to(room).emit('collaborator_left', {
        userId,
        userName,
        tripId,
        timestamp: new Date().toISOString(),
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      // Socket.io automatically removes the socket from all rooms on disconnect
    });
  }

  /**
   * Broadcast a collaboration event to all users in a trip room.
   * Implements last-write-wins conflict resolution.
   *
   * Returns the resolved event timestamp and any overwrite notification needed.
   */
  broadcastEvent(
    tripId: string,
    event: CollaborationEvent,
  ): { event: CollaborationEvent; overwriteNotification: ConflictNotification | null } {
    const serverTimestamp = new Date().toISOString();
    const resolvedEvent: CollaborationEvent = {
      ...event,
      timestamp: serverTimestamp,
    };

    const entityKey = `${event.entityType}:${event.entityId}`;
    let overwriteNotification: ConflictNotification | null = null;

    // Check for conflict (last-write-wins)
    if (event.type === 'item_updated') {
      const existingVersion = this.entityVersions.get(entityKey);

      if (existingVersion && existingVersion.lastModifiedBy !== event.userId) {
        // Another user's change is being overwritten
        overwriteNotification = {
          type: 'overwrite_notification',
          entityType: event.entityType,
          entityId: event.entityId,
          overwrittenBy: event.userId,
          overwrittenByName: event.userName,
          timestamp: serverTimestamp,
          message: `Your changes to this ${event.entityType} were overwritten by ${event.userName}`,
        };

        // Send notification to the overwritten user within the deadline
        this.sendOverwriteNotification(tripId, existingVersion.lastModifiedBy, overwriteNotification);
      }
    }

    // Update entity version tracking
    this.entityVersions.set(entityKey, {
      entityType: event.entityType,
      entityId: event.entityId,
      lastModifiedBy: event.userId,
      lastModifiedByName: event.userName,
      timestamp: serverTimestamp,
    });

    // Broadcast to all users in the trip room
    if (this.io) {
      const room = this.getRoomName(tripId);
      this.io.to(room).emit('collaboration_event', resolvedEvent);
    }

    return { event: resolvedEvent, overwriteNotification };
  }

  /**
   * Send an overwrite notification to a specific user in the trip room.
   * Must be delivered within 30 seconds per requirements.
   */
  private sendOverwriteNotification(
    tripId: string,
    targetUserId: string,
    notification: ConflictNotification,
  ): void {
    if (!this.io) return;

    const room = this.getRoomName(tripId);
    const sockets = this.io.sockets.adapter.rooms.get(room);

    if (!sockets) return;

    // Find and notify the overwritten user's socket(s)
    for (const socketId of sockets) {
      const socket = this.io.sockets.sockets.get(socketId);
      if (socket && socket.data.userId === targetUserId) {
        socket.emit('overwrite_notification', notification);
      }
    }
  }

  /**
   * Get the room name for a trip.
   */
  getRoomName(tripId: string): string {
    return `trip:${tripId}`;
  }

  /**
   * Get current entity version info (for testing/inspection).
   */
  getEntityVersion(entityType: string, entityId: string): EntityVersion | undefined {
    return this.entityVersions.get(`${entityType}:${entityId}`);
  }

  /**
   * Clear entity version tracking (useful for testing).
   */
  clearEntityVersions(): void {
    this.entityVersions.clear();
  }

  /**
   * Get the number of connected clients in a trip room.
   */
  getRoomSize(tripId: string): number {
    if (!this.io) return 0;
    const room = this.getRoomName(tripId);
    const sockets = this.io.sockets.adapter.rooms.get(room);
    return sockets?.size ?? 0;
  }

  /**
   * Shut down the Socket.io server.
   */
  async close(): Promise<void> {
    if (this.io) {
      this.io.close();
      this.io = null;
    }
    this.entityVersions.clear();
  }
}
