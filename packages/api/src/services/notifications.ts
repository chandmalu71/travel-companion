import { Kysely } from 'kysely';
import type { Database } from '../db/types.js';

/**
 * Default notification offsets.
 */
const DEFAULT_FLIGHT_OFFSET_MINUTES = 1440; // 24 hours
const DEFAULT_HOTEL_REMINDER_TIME = '08:00'; // 8:00 AM local on check-in day
const DEFAULT_CAR_OFFSET_MINUTES = 120; // 2 hours

/** Maximum delay (in minutes) for scheduling past-due reminders */
const PAST_DUE_DELAY_MINUTES = 5;

export interface NotificationPreferences {
  flightReminderOffset: number; // minutes before departure
  hotelReminderTime: string; // HH:mm format, local time on check-in day
  carReminderOffset: number; // minutes before pickup
  pushEnabled: boolean;
  emailEnabled: boolean;
}

export interface BookingDetails {
  type: 'flight' | 'hotel' | 'car_rental';
  /** ISO 8601 datetime for flight departure or car pickup */
  eventTime?: string | Date | null;
  /** ISO 8601 date string (YYYY-MM-DD) for hotel check-in */
  checkinDate?: string | null;
}

export interface ScheduledNotificationResult {
  id: string;
  fireAt: Date;
  type: string;
}

/**
 * Notification scheduling engine.
 *
 * Handles calculating reminder times based on booking type and user preferences,
 * storing scheduled notifications, and managing reschedule/cancel operations.
 */
export class NotificationScheduler {
  constructor(private readonly db: Kysely<Database>) {}

  /**
   * Get user notification preferences or return defaults.
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
    const prefs = await this.db
      .selectFrom('notification_preferences')
      .selectAll()
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!prefs) {
      return {
        flightReminderOffset: DEFAULT_FLIGHT_OFFSET_MINUTES,
        hotelReminderTime: DEFAULT_HOTEL_REMINDER_TIME,
        carReminderOffset: DEFAULT_CAR_OFFSET_MINUTES,
        pushEnabled: true,
        emailEnabled: false,
      };
    }

    return {
      flightReminderOffset: prefs.flight_reminder_offset,
      hotelReminderTime: prefs.hotel_reminder_time,
      carReminderOffset: prefs.car_reminder_offset,
      pushEnabled: prefs.push_enabled,
      emailEnabled: prefs.email_enabled,
    };
  }

  /**
   * Schedule a booking reminder notification.
   *
   * Calculates fire_at based on booking type and user preferences:
   * - Flights: event time minus user offset (default 24h)
   * - Hotels: 8:00 AM on check-in day (or user-configured time)
   * - Car rentals: event time minus user offset (default 2h)
   *
   * If fire_at is in the past, schedules within 5 minutes of now.
   */
  async scheduleBookingReminder(
    userId: string,
    booking: { id: string; type: 'flight' | 'hotel' | 'car_rental' },
    bookingDetails: BookingDetails,
  ): Promise<ScheduledNotificationResult | null> {
    const prefs = await this.getUserNotificationPreferences(userId);
    const fireAt = this.calculateFireAt(bookingDetails, prefs);

    if (!fireAt) {
      return null;
    }

    const adjustedFireAt = this.adjustForPastDue(fireAt);

    const notificationType = `${booking.type}_reminder`;

    const result = await this.db
      .insertInto('scheduled_notifications')
      .values({
        user_id: userId,
        booking_id: booking.id,
        type: notificationType,
        fire_at: adjustedFireAt,
        payload: {
          bookingId: booking.id,
          bookingType: booking.type,
          userId,
        },
      })
      .returning(['id', 'fire_at', 'type'])
      .executeTakeFirstOrThrow();

    return {
      id: result.id,
      fireAt: result.fire_at,
      type: result.type,
    };
  }

  /**
   * Reschedule a booking reminder: deletes old notification and creates a new one.
   */
  async rescheduleBookingReminder(
    bookingId: string,
    newBookingDetails: BookingDetails,
  ): Promise<ScheduledNotificationResult | null> {
    // Find the existing notification to get the user_id
    const existing = await this.db
      .selectFrom('scheduled_notifications')
      .select(['user_id', 'booking_id', 'type'])
      .where('booking_id', '=', bookingId)
      .where('delivered', '=', false)
      .executeTakeFirst();

    if (!existing) {
      return null;
    }

    // Delete old notification(s) for this booking
    await this.db
      .deleteFrom('scheduled_notifications')
      .where('booking_id', '=', bookingId)
      .where('delivered', '=', false)
      .execute();

    // Determine booking type from existing notification type or from details
    const bookingType = newBookingDetails.type;

    // Create new notification
    return this.scheduleBookingReminder(
      existing.user_id,
      { id: bookingId, type: bookingType },
      newBookingDetails,
    );
  }

  /**
   * Cancel all pending notifications for a booking.
   */
  async cancelBookingReminder(bookingId: string): Promise<number> {
    const result = await this.db
      .deleteFrom('scheduled_notifications')
      .where('booking_id', '=', bookingId)
      .where('delivered', '=', false)
      .executeTakeFirst();

    return Number(result.numDeletedRows ?? 0);
  }

  /**
   * Calculate the fire_at time based on booking type and user preferences.
   */
  private calculateFireAt(
    details: BookingDetails,
    prefs: NotificationPreferences,
  ): Date | null {
    switch (details.type) {
      case 'flight': {
        if (!details.eventTime) return null;
        const departureTime = new Date(details.eventTime);
        if (isNaN(departureTime.getTime())) return null;
        return new Date(departureTime.getTime() - prefs.flightReminderOffset * 60 * 1000);
      }
      case 'hotel': {
        if (!details.checkinDate) return null;
        // Parse HH:mm from user preference
        const [hours, minutes] = prefs.hotelReminderTime.split(':').map(Number);
        if (hours === undefined || minutes === undefined) return null;
        // Build date at local reminder time on check-in day
        const fireAt = new Date(`${details.checkinDate}T${prefs.hotelReminderTime}:00`);
        if (isNaN(fireAt.getTime())) return null;
        return fireAt;
      }
      case 'car_rental': {
        if (!details.eventTime) return null;
        const pickupTime = new Date(details.eventTime);
        if (isNaN(pickupTime.getTime())) return null;
        return new Date(pickupTime.getTime() - prefs.carReminderOffset * 60 * 1000);
      }
      default:
        return null;
    }
  }

  /**
   * If fire_at has already passed, schedule within 5 minutes of now.
   */
  private adjustForPastDue(fireAt: Date): Date {
    const now = new Date();
    if (fireAt.getTime() < now.getTime()) {
      return new Date(now.getTime() + PAST_DUE_DELAY_MINUTES * 60 * 1000);
    }
    return fireAt;
  }
}
