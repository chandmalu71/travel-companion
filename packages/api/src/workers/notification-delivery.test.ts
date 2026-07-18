/**
 * Tests for the Notification Delivery Worker.
 *
 * Tests cover:
 * - Polling for due notifications
 * - Delivery channel routing based on user preferences
 * - Retry logic with exponential backoff
 * - Marking notifications as delivered
 * - Worker lifecycle (start/stop)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  NotificationDeliveryWorker,
  DEFAULT_DELIVERY_CONFIG,
  type DeliveryChannels,
  type DeliveryResult,
} from './notification-delivery.js';

// ─── Mock Helpers ────────────────────────────────────────────────────────────

function createMockDb(options: {
  dueNotifications?: Record<string, unknown>[];
  preferences?: Record<string, unknown> | null;
} = {}) {
  const { dueNotifications = [], preferences = null } = options;

  const updateSetFn = vi.fn(() => ({
    where: vi.fn(() => ({
      execute: vi.fn(() => Promise.resolve()),
    })),
  }));

  const db = {
    selectFrom: vi.fn((table: string) => {
      if (table === 'scheduled_notifications') {
        return {
          selectAll: vi.fn(() => ({
            where: vi.fn(() => ({
              where: vi.fn(() => ({
                execute: vi.fn(() => Promise.resolve(dueNotifications)),
              })),
            })),
          })),
        };
      }
      if (table === 'notification_preferences') {
        return {
          selectAll: vi.fn(() => ({
            where: vi.fn(() => ({
              executeTakeFirst: vi.fn(() => Promise.resolve(preferences)),
            })),
          })),
        };
      }
      return {
        selectAll: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: vi.fn(() => Promise.resolve([])),
            executeTakeFirst: vi.fn(() => Promise.resolve(null)),
          })),
        })),
      };
    }),
    updateTable: vi.fn(() => ({
      set: updateSetFn,
    })),
    _updateSetFn: updateSetFn,
  };

  return db;
}

function createMockChannels(overrides: Partial<DeliveryChannels> = {}): DeliveryChannels {
  return {
    sendFCM: vi.fn(() => Promise.resolve({ success: true, channel: 'fcm' } as DeliveryResult)),
    sendAPNs: vi.fn(() => Promise.resolve({ success: true, channel: 'apns' } as DeliveryResult)),
    sendSES: vi.fn(() => Promise.resolve({ success: true, channel: 'ses' } as DeliveryResult)),
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NotificationDeliveryWorker', () => {
  describe('processDueNotifications', () => {
    it('should return 0 when no due notifications exist', async () => {
      const db = createMockDb({ dueNotifications: [] });
      const channels = createMockChannels();
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      const count = await worker.processDueNotifications();
      expect(count).toBe(0);
      expect(channels.sendFCM).not.toHaveBeenCalled();
    });

    it('should process due notifications and mark as delivered', async () => {
      const notification = {
        id: 'notif-1',
        user_id: 'user-abc',
        booking_id: 'booking-123',
        type: 'flight_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-123', bookingType: 'flight' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: true, email_enabled: false },
      });
      const channels = createMockChannels();
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      const count = await worker.processDueNotifications();
      expect(count).toBe(1);
      expect(channels.sendFCM).toHaveBeenCalledWith('user-abc', notification.payload);
      expect(channels.sendAPNs).toHaveBeenCalledWith('user-abc', notification.payload);
    });

    it('should deliver via email when emailEnabled is true', async () => {
      const notification = {
        id: 'notif-2',
        user_id: 'user-xyz',
        booking_id: 'booking-456',
        type: 'hotel_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-456', bookingType: 'hotel' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: true, email_enabled: true },
      });
      const channels = createMockChannels();
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      await worker.processDueNotifications();
      expect(channels.sendFCM).toHaveBeenCalled();
      expect(channels.sendSES).toHaveBeenCalled();
    });

    it('should fall back to email when push is disabled', async () => {
      const notification = {
        id: 'notif-3',
        user_id: 'user-nopush',
        booking_id: 'booking-789',
        type: 'car_rental_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-789', bookingType: 'car_rental' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: false, email_enabled: false },
      });
      const channels = createMockChannels();
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      await worker.processDueNotifications();
      // Push disabled, but email should still be attempted as fallback
      expect(channels.sendFCM).not.toHaveBeenCalled();
      expect(channels.sendSES).toHaveBeenCalled();
    });

    it('should use default preferences when none exist', async () => {
      const notification = {
        id: 'notif-4',
        user_id: 'user-noprefs',
        booking_id: 'booking-111',
        type: 'flight_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-111' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: null, // No preferences stored
      });
      const channels = createMockChannels();
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      await worker.processDueNotifications();
      // Default: push_enabled=true, email_enabled=false
      expect(channels.sendFCM).toHaveBeenCalled();
      expect(channels.sendSES).not.toHaveBeenCalled();
    });
  });

  describe('retry logic', () => {
    it('should retry up to maxRetries on failure', async () => {
      const notification = {
        id: 'notif-retry',
        user_id: 'user-retry',
        booking_id: 'booking-retry',
        type: 'flight_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-retry' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: true, email_enabled: false },
      });

      let fcmCallCount = 0;
      const channels = createMockChannels({
        sendFCM: vi.fn(() => {
          fcmCallCount++;
          return Promise.resolve({ success: false, channel: 'fcm', error: 'Service unavailable' });
        }),
      });

      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      const count = await worker.processDueNotifications();
      expect(fcmCallCount).toBe(3);
      // Fails on push, then falls back to email (push disabled doesn't apply; but here
      // push is enabled and fails, so email fallback doesn't kick in because emailEnabled=false)
      expect(count).toBe(0);
    });

    it('should succeed on retry after initial failure', async () => {
      const notification = {
        id: 'notif-retry-ok',
        user_id: 'user-retry-ok',
        booking_id: 'booking-retry-ok',
        type: 'flight_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-retry-ok' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: true, email_enabled: false },
      });

      let fcmCallCount = 0;
      const channels = createMockChannels({
        sendFCM: vi.fn(() => {
          fcmCallCount++;
          if (fcmCallCount < 3) {
            return Promise.resolve({ success: false, channel: 'fcm', error: 'Temporary failure' });
          }
          return Promise.resolve({ success: true, channel: 'fcm' });
        }),
      });

      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 3, baseBackoffMs: 10 },
        channels,
      );

      const count = await worker.processDueNotifications();
      expect(fcmCallCount).toBe(3);
      expect(count).toBe(1);
    });

    it('should handle exceptions in delivery channel', async () => {
      const notification = {
        id: 'notif-error',
        user_id: 'user-error',
        booking_id: 'booking-error',
        type: 'flight_reminder',
        fire_at: new Date(Date.now() - 60000),
        payload: { bookingId: 'booking-error' },
        delivered: false,
        delivered_at: null,
        created_at: new Date(),
      };

      const db = createMockDb({
        dueNotifications: [notification],
        preferences: { push_enabled: true, email_enabled: true },
      });

      const channels = createMockChannels({
        sendFCM: vi.fn(() => Promise.reject(new Error('Network error'))),
        sendSES: vi.fn(() => Promise.resolve({ success: true, channel: 'ses' } as DeliveryResult)),
      });

      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 1000, maxRetries: 2, baseBackoffMs: 10 },
        channels,
      );

      const count = await worker.processDueNotifications();
      // FCM fails but SES succeeds
      expect(count).toBe(1);
      expect(channels.sendSES).toHaveBeenCalled();
    });
  });

  describe('lifecycle', () => {
    it('should create worker with default config', () => {
      const db = createMockDb();
      const worker = new NotificationDeliveryWorker(db as never);
      expect(worker).toBeInstanceOf(NotificationDeliveryWorker);
    });

    it('should stop gracefully without error', () => {
      const db = createMockDb();
      const worker = new NotificationDeliveryWorker(db as never);
      expect(() => worker.stop()).not.toThrow();
    });

    it('should stop a running worker', () => {
      const db = createMockDb({ dueNotifications: [] });
      const worker = new NotificationDeliveryWorker(
        db as never,
        { pollIntervalMs: 100, maxRetries: 3, baseBackoffMs: 10 },
      );
      worker.start();
      worker.stop();
      // Should not throw and should be stopped
      expect(() => worker.stop()).not.toThrow();
    });
  });

  describe('DEFAULT_DELIVERY_CONFIG', () => {
    it('should have sensible defaults', () => {
      expect(DEFAULT_DELIVERY_CONFIG.pollIntervalMs).toBe(60_000);
      expect(DEFAULT_DELIVERY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_DELIVERY_CONFIG.baseBackoffMs).toBe(1000);
    });
  });
});
