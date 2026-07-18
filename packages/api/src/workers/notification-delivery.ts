/**
 * Notification Delivery Worker
 *
 * Background worker that polls the `scheduled_notifications` table every 60 seconds
 * for due notifications (fire_at <= now AND delivered = false).
 *
 * For each due notification:
 * 1. Retrieves user notification preferences (push/email enabled)
 * 2. Attempts delivery via FCM (Android + Web push), APNs (iOS), SES (email fallback)
 * 3. Marks notification as delivered on success
 * 4. On failure: retries up to 3 times with exponential backoff
 */

import { type Kysely } from 'kysely';
import { type Database, type ScheduledNotification } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DeliveryResult {
  success: boolean;
  channel: 'fcm' | 'apns' | 'ses';
  error?: string;
}

export interface NotificationDeliveryConfig {
  /** Polling interval in milliseconds (default: 60000 = 1 minute) */
  pollIntervalMs: number;
  /** Maximum retry attempts per notification (default: 3) */
  maxRetries: number;
  /** Base backoff delay in milliseconds (default: 1000) */
  baseBackoffMs: number;
}

export const DEFAULT_DELIVERY_CONFIG: NotificationDeliveryConfig = {
  pollIntervalMs: 60_000,
  maxRetries: 3,
  baseBackoffMs: 1000,
};

// ─── Delivery Channel Interfaces ─────────────────────────────────────────────

export interface DeliveryChannels {
  /** Send push notification via FCM (Android + Web) */
  sendFCM(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult>;
  /** Send push notification via APNs (iOS) */
  sendAPNs(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult>;
  /** Send email notification via SES (fallback) */
  sendSES(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult>;
}

/**
 * Default (mock) delivery channels for development.
 * In production, these would integrate with actual FCM, APNs, and SES SDKs.
 */
export const defaultDeliveryChannels: DeliveryChannels = {
  async sendFCM(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult> {
    console.log(`[NotificationDelivery] FCM push to user ${userId}:`, payload);
    return { success: true, channel: 'fcm' };
  },
  async sendAPNs(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult> {
    console.log(`[NotificationDelivery] APNs push to user ${userId}:`, payload);
    return { success: true, channel: 'apns' };
  },
  async sendSES(userId: string, payload: Record<string, unknown>): Promise<DeliveryResult> {
    console.log(`[NotificationDelivery] SES email to user ${userId}:`, payload);
    return { success: true, channel: 'ses' };
  },
};

// ─── Notification Delivery Worker ────────────────────────────────────────────

export class NotificationDeliveryWorker {
  private running = false;
  private pollTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly config: NotificationDeliveryConfig;
  private readonly db: Kysely<Database>;
  private readonly channels: DeliveryChannels;

  constructor(
    db: Kysely<Database>,
    config: Partial<NotificationDeliveryConfig> = {},
    channels: DeliveryChannels = defaultDeliveryChannels,
  ) {
    this.db = db;
    this.config = { ...DEFAULT_DELIVERY_CONFIG, ...config };
    this.channels = channels;
  }

  /**
   * Start the polling loop.
   */
  start(): void {
    if (this.running) return;
    this.running = true;
    console.log('[NotificationDelivery] Starting delivery worker...');
    this.poll();
  }

  /**
   * Stop the worker gracefully.
   */
  stop(): void {
    console.log('[NotificationDelivery] Stopping delivery worker...');
    this.running = false;
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll for due notifications and schedule next poll.
   */
  private poll(): void {
    if (!this.running) return;

    this.processDueNotifications()
      .catch((error) => {
        console.error('[NotificationDelivery] Error processing notifications:', error);
      })
      .finally(() => {
        if (this.running) {
          this.pollTimer = setTimeout(() => this.poll(), this.config.pollIntervalMs);
        }
      });
  }

  /**
   * Find and process all due notifications.
   */
  async processDueNotifications(): Promise<number> {
    const now = new Date();

    const dueNotifications = await this.db
      .selectFrom('scheduled_notifications')
      .selectAll()
      .where('fire_at', '<=', now)
      .where('delivered', '=', false)
      .execute();

    if (dueNotifications.length === 0) {
      return 0;
    }

    console.log(`[NotificationDelivery] Found ${dueNotifications.length} due notification(s)`);

    let deliveredCount = 0;

    for (const notification of dueNotifications) {
      const success = await this.deliverNotification(notification);
      if (success) {
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  /**
   * Deliver a single notification with retry logic.
   */
  async deliverNotification(notification: ScheduledNotification): Promise<boolean> {
    // Get user notification preferences
    const prefs = await this.db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('user_id', '=', notification.user_id)
      .executeTakeFirst();

    const pushEnabled = prefs?.push_enabled ?? true;
    const emailEnabled = prefs?.email_enabled ?? false;

    const payload = (notification.payload ?? {}) as Record<string, unknown>;

    let delivered = false;

    // Attempt push delivery (FCM + APNs) if push is enabled
    if (pushEnabled) {
      delivered = await this.attemptDeliveryWithRetry(
        () => this.channels.sendFCM(notification.user_id, payload),
        'FCM',
        notification.id,
      );

      // Also attempt APNs (iOS)
      if (delivered) {
        // Fire-and-forget APNs - best effort for iOS users
        await this.channels.sendAPNs(notification.user_id, payload).catch((err) => {
          console.warn(`[NotificationDelivery] APNs delivery failed for ${notification.id}:`, err);
        });
      }
    }

    // Attempt email delivery if email is enabled (or as fallback if push failed)
    if (emailEnabled || (!pushEnabled && !delivered)) {
      const emailDelivered = await this.attemptDeliveryWithRetry(
        () => this.channels.sendSES(notification.user_id, payload),
        'SES',
        notification.id,
      );
      delivered = delivered || emailDelivered;
    }

    // Mark as delivered if any channel succeeded
    if (delivered) {
      await this.markAsDelivered(notification.id);
    }

    return delivered;
  }

  /**
   * Attempt delivery with exponential backoff retry.
   */
  private async attemptDeliveryWithRetry(
    deliverFn: () => Promise<DeliveryResult>,
    channelName: string,
    notificationId: string,
  ): Promise<boolean> {
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        const result = await deliverFn();
        if (result.success) {
          return true;
        }
        console.warn(
          `[NotificationDelivery] ${channelName} delivery failed for ${notificationId} (attempt ${attempt + 1}/${this.config.maxRetries}): ${result.error}`,
        );
      } catch (error) {
        console.warn(
          `[NotificationDelivery] ${channelName} delivery error for ${notificationId} (attempt ${attempt + 1}/${this.config.maxRetries}):`,
          error,
        );
      }

      // Exponential backoff before retry (skip wait on last attempt)
      if (attempt < this.config.maxRetries - 1) {
        const backoffMs = this.config.baseBackoffMs * Math.pow(2, attempt);
        await this.sleep(backoffMs);
      }
    }

    console.error(
      `[NotificationDelivery] ${channelName} delivery failed after ${this.config.maxRetries} attempts for notification ${notificationId}`,
    );
    return false;
  }

  /**
   * Mark a notification as delivered in the database.
   */
  private async markAsDelivered(notificationId: string): Promise<void> {
    await this.db
      .updateTable('scheduled_notifications')
      .set({
        delivered: true,
        delivered_at: new Date(),
      })
      .where('id', '=', notificationId)
      .execute();
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
