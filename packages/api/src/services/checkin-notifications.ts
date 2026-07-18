/**
 * Check-in Notification Service
 *
 * Schedules check-in reminder notifications when the check-in window opens
 * (typically 24h before departure). Includes direct link to initiate check-in.
 * On check-in complete: marks flight as "Checked In", prompts boarding pass upload.
 *
 * Implements Requirements: 19.5, 19.6, 19.7, 19.11
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { extractIataCode } from './checkin.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CheckinNotification {
  id: string;
  bookingId: string;
  userId: string;
  flightNumber: string;
  airline: string;
  departureTime: Date;
  checkinWindowOpens: Date;
  notificationFireAt: Date;
  status: 'scheduled' | 'sent' | 'cancelled';
}

export interface CheckinNotificationPayload {
  type: 'checkin_reminder';
  bookingId: string;
  flightNumber: string;
  airline: string;
  departureTime: string;
  checkinUrl: string;
  message: string;
  actions: Array<{ label: string; action: string; url?: string }>;
}

// ─── Airline check-in window hours ───────────────────────────────────────────

const AIRLINE_WINDOW_HOURS: Record<string, number> = {
  DL: 24, UA: 24, AA: 24, WN: 24, BA: 24,
  LH: 23, AF: 30, EK: 48,
};

const DEFAULT_WINDOW_HOURS = 24;

// ─── Service ─────────────────────────────────────────────────────────────────

export class CheckinNotificationService {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Schedule check-in notification for a flight booking.
   * Called when a flight booking is created or updated.
   */
  async scheduleCheckinNotification(
    bookingId: string,
    userId: string,
  ): Promise<CheckinNotification | null> {
    // Get flight details
    const flight = await this.db
      .selectFrom('flight_details')
      .select(['flight_number', 'airline', 'departure_time'])
      .where('booking_id', '=', bookingId)
      .executeTakeFirst();

    if (!flight || !flight.departure_time) {
      return null;
    }

    const departureTime = new Date(flight.departure_time);
    const iataCode = extractIataCode(flight.flight_number ?? '');
    const windowHours = AIRLINE_WINDOW_HOURS[iataCode] ?? DEFAULT_WINDOW_HOURS;

    // Check-in window opens windowHours before departure
    const checkinWindowOpens = new Date(
      departureTime.getTime() - windowHours * 60 * 60 * 1000,
    );

    // Schedule notification at window open time
    // If already past, schedule within 5 minutes
    const now = new Date();
    let fireAt: Date;

    if (checkinWindowOpens <= now) {
      // Window already open or past — schedule immediately (within 5 min)
      fireAt = new Date(now.getTime() + 5 * 60 * 1000);
    } else {
      fireAt = checkinWindowOpens;
    }

    // If departure is already past, don't schedule
    if (departureTime <= now) {
      return null;
    }

    // Cancel any existing check-in notification for this booking
    await this.cancelExistingNotification(bookingId);

    // Create scheduled notification
    const notification = await this.db
      .insertInto('scheduled_notifications')
      .values({
        user_id: userId,
        booking_id: bookingId,
        type: 'checkin_reminder',
        fire_at: fireAt,
        payload: JSON.stringify({
          type: 'checkin_reminder',
          bookingId,
          flightNumber: flight.flight_number ?? '',
          airline: flight.airline ?? '',
          departureTime: departureTime.toISOString(),
          checkinUrl: `travel-companion://checkin/${bookingId}`,
          message: `Check-in is now available for ${flight.airline ?? ''} ${flight.flight_number ?? ''}. Tap to check in before your flight.`,
          actions: [
            { label: 'Check In Now', action: 'open_checkin', url: `travel-companion://checkin/${bookingId}` },
            { label: 'Remind Later', action: 'snooze' },
          ],
        } satisfies CheckinNotificationPayload),
        status: 'scheduled',
      })
      .returning(['id', 'fire_at', 'status'])
      .executeTakeFirstOrThrow();

    return {
      id: notification.id,
      bookingId,
      userId,
      flightNumber: flight.flight_number ?? '',
      airline: flight.airline ?? '',
      departureTime,
      checkinWindowOpens,
      notificationFireAt: new Date(notification.fire_at),
      status: 'scheduled',
    };
  }

  /**
   * Handle check-in completion.
   * Marks flight as checked in, cancels reminder, prompts boarding pass upload.
   */
  async onCheckinComplete(
    bookingId: string,
    userId: string,
  ): Promise<{ success: boolean; boardingPassPrompt: string }> {
    // Mark booking as checked in
    await this.db
      .updateTable('bookings')
      .set({ checked_in: true, updated_at: new Date() })
      .where('id', '=', bookingId)
      .where('user_id', '=', userId)
      .execute();

    // Cancel any pending check-in notification
    await this.cancelExistingNotification(bookingId);

    // Create activity feed entry
    await this.db
      .insertInto('activity_feed')
      .values({
        trip_id: await this.getTripIdForBooking(bookingId),
        user_id: userId,
        action: 'checked_in',
        entity_type: 'booking',
        entity_id: bookingId,
      })
      .execute();

    return {
      success: true,
      boardingPassPrompt: 'You\'re checked in! Upload your boarding pass to keep it easily accessible during your trip.',
    };
  }

  /**
   * Reschedule check-in notification when flight time changes.
   */
  async rescheduleForTimeChange(bookingId: string, userId: string): Promise<void> {
    // Cancel existing and create new
    await this.cancelExistingNotification(bookingId);
    await this.scheduleCheckinNotification(bookingId, userId);
  }

  /**
   * Cancel existing check-in notification for a booking.
   */
  private async cancelExistingNotification(bookingId: string): Promise<void> {
    await this.db
      .updateTable('scheduled_notifications')
      .set({ status: 'cancelled', updated_at: new Date() })
      .where('booking_id', '=', bookingId)
      .where('type', '=', 'checkin_reminder')
      .where('status', '=', 'scheduled')
      .execute();
  }

  /**
   * Get the trip ID associated with a booking.
   */
  private async getTripIdForBooking(bookingId: string): Promise<string | null> {
    const booking = await this.db
      .selectFrom('bookings')
      .select('trip_id')
      .where('id', '=', bookingId)
      .executeTakeFirst();

    return booking?.trip_id ?? null;
  }

  /**
   * Get all pending check-in notifications that are due to fire.
   * Used by the notification delivery worker.
   */
  async getDueNotifications(): Promise<Array<{
    id: string;
    userId: string;
    payload: string;
  }>> {
    const now = new Date();

    const notifications = await this.db
      .selectFrom('scheduled_notifications')
      .select(['id', 'user_id', 'payload'])
      .where('type', '=', 'checkin_reminder')
      .where('status', '=', 'scheduled')
      .where('fire_at', '<=', now)
      .execute();

    return notifications.map((n) => ({
      id: n.id,
      userId: n.user_id,
      payload: n.payload as string,
    }));
  }

  /**
   * Mark a notification as sent after delivery.
   */
  async markAsSent(notificationId: string): Promise<void> {
    await this.db
      .updateTable('scheduled_notifications')
      .set({ status: 'sent', updated_at: new Date() })
      .where('id', '=', notificationId)
      .execute();
  }
}
