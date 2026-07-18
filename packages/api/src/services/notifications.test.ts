import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { NotificationScheduler } from './notifications.js';

/**
 * Creates a mock Kysely database that tracks queries and returns configurable results.
 */
function createMockDb() {
  let selectResult: unknown = undefined;
  let insertResult: unknown = undefined;
  let deleteResult: unknown = { numDeletedRows: BigInt(1) };

  const mockChain = {
    // SELECT chain
    selectFrom: vi.fn().mockReturnThis(),
    selectAll: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    executeTakeFirst: vi.fn(async () => selectResult),
    executeTakeFirstOrThrow: vi.fn(async () => insertResult),
    execute: vi.fn(async () => []),
    // INSERT chain
    insertInto: vi.fn().mockReturnThis(),
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    // DELETE chain
    deleteFrom: vi.fn().mockReturnThis(),
  };

  // Make where chainable and callable multiple times
  mockChain.where = vi.fn().mockImplementation(() => mockChain);
  mockChain.selectFrom = vi.fn().mockImplementation(() => mockChain);
  mockChain.insertInto = vi.fn().mockImplementation(() => mockChain);
  mockChain.deleteFrom = vi.fn().mockImplementation(() => mockChain);
  mockChain.selectAll = vi.fn().mockImplementation(() => mockChain);
  mockChain.select = vi.fn().mockImplementation(() => mockChain);
  mockChain.values = vi.fn().mockImplementation(() => mockChain);
  mockChain.returning = vi.fn().mockImplementation(() => mockChain);

  return {
    mock: mockChain as unknown as ReturnType<typeof createMockDb>['mock'],
    setSelectResult: (result: unknown) => {
      selectResult = result;
      mockChain.executeTakeFirst = vi.fn(async () => selectResult);
    },
    setInsertResult: (result: unknown) => {
      insertResult = result;
      mockChain.executeTakeFirstOrThrow = vi.fn(async () => insertResult);
    },
    setDeleteResult: (result: unknown) => {
      deleteResult = result;
      mockChain.executeTakeFirst = vi.fn(async () => deleteResult);
    },
  };
}

describe('NotificationScheduler', () => {
  let mockDb: ReturnType<typeof createMockDb>;
  let scheduler: NotificationScheduler;

  beforeEach(() => {
    mockDb = createMockDb();
    scheduler = new NotificationScheduler(mockDb.mock as any);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2025-06-01T12:00:00Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('getUserNotificationPreferences', () => {
    it('returns default preferences when no record exists', async () => {
      mockDb.setSelectResult(undefined);

      const prefs = await scheduler.getUserNotificationPreferences('user-1');

      expect(prefs).toEqual({
        flightReminderOffset: 1440, // 24 hours in minutes
        hotelReminderTime: '08:00',
        carReminderOffset: 120, // 2 hours in minutes
        pushEnabled: true,
        emailEnabled: false,
      });
    });

    it('returns stored preferences when record exists', async () => {
      mockDb.setSelectResult({
        user_id: 'user-1',
        flight_reminder_offset: 720, // 12 hours
        hotel_reminder_time: '09:30',
        car_reminder_offset: 60, // 1 hour
        push_enabled: true,
        email_enabled: true,
      });

      const prefs = await scheduler.getUserNotificationPreferences('user-1');

      expect(prefs).toEqual({
        flightReminderOffset: 720,
        hotelReminderTime: '09:30',
        carReminderOffset: 60,
        pushEnabled: true,
        emailEnabled: true,
      });
    });
  });

  describe('scheduleBookingReminder', () => {
    it('schedules flight reminder 24h before departure by default', async () => {
      // No user prefs (defaults apply)
      mockDb.setSelectResult(undefined);

      const departureTime = '2025-06-10T14:00:00Z';
      const expectedFireAt = new Date('2025-06-09T14:00:00Z'); // 24h before

      mockDb.setInsertResult({
        id: 'notif-1',
        fire_at: expectedFireAt,
        type: 'flight_reminder',
      });

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-1', type: 'flight' },
        { type: 'flight', eventTime: departureTime },
      );

      expect(result).toEqual({
        id: 'notif-1',
        fireAt: expectedFireAt,
        type: 'flight_reminder',
      });

      // Verify the values call included correct fire_at
      expect(mockDb.mock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          booking_id: 'booking-1',
          type: 'flight_reminder',
          fire_at: expectedFireAt,
        }),
      );
    });

    it('schedules hotel reminder at 8:00 AM on check-in day by default', async () => {
      mockDb.setSelectResult(undefined); // defaults

      const checkinDate = '2025-06-15';
      const expectedFireAt = new Date('2025-06-15T08:00:00');

      mockDb.setInsertResult({
        id: 'notif-2',
        fire_at: expectedFireAt,
        type: 'hotel_reminder',
      });

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-2', type: 'hotel' },
        { type: 'hotel', checkinDate },
      );

      expect(result).toEqual({
        id: 'notif-2',
        fireAt: expectedFireAt,
        type: 'hotel_reminder',
      });

      expect(mockDb.mock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'hotel_reminder',
          fire_at: expectedFireAt,
        }),
      );
    });

    it('schedules car rental reminder 2h before pickup by default', async () => {
      mockDb.setSelectResult(undefined); // defaults

      const pickupTime = '2025-06-10T10:00:00Z';
      const expectedFireAt = new Date('2025-06-10T08:00:00Z'); // 2h before

      mockDb.setInsertResult({
        id: 'notif-3',
        fire_at: expectedFireAt,
        type: 'car_rental_reminder',
      });

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-3', type: 'car_rental' },
        { type: 'car_rental', eventTime: pickupTime },
      );

      expect(result).toEqual({
        id: 'notif-3',
        fireAt: expectedFireAt,
        type: 'car_rental_reminder',
      });

      expect(mockDb.mock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'car_rental_reminder',
          fire_at: expectedFireAt,
        }),
      );
    });

    it('schedules within 5 minutes when fire_at is in the past', async () => {
      mockDb.setSelectResult(undefined); // defaults

      // Departure in 30 minutes — reminder at 24h before would be in the past
      const departureTime = '2025-06-01T12:30:00Z';
      // fire_at would be 2025-05-31T12:30:00Z (24h before) which is past
      // Should be adjusted to now + 5 minutes = 2025-06-01T12:05:00Z
      const expectedFireAt = new Date('2025-06-01T12:05:00Z');

      mockDb.setInsertResult({
        id: 'notif-4',
        fire_at: expectedFireAt,
        type: 'flight_reminder',
      });

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-4', type: 'flight' },
        { type: 'flight', eventTime: departureTime },
      );

      expect(result).not.toBeNull();

      // Verify fire_at was adjusted to 5 min from now
      expect(mockDb.mock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          fire_at: expectedFireAt,
        }),
      );
    });

    it('uses custom user offset when available', async () => {
      // User has 12h (720 min) flight reminder offset
      mockDb.setSelectResult({
        user_id: 'user-1',
        flight_reminder_offset: 720,
        hotel_reminder_time: '08:00',
        car_reminder_offset: 120,
        push_enabled: true,
        email_enabled: false,
      });

      const departureTime = '2025-06-10T14:00:00Z';
      const expectedFireAt = new Date('2025-06-10T02:00:00Z'); // 12h before

      mockDb.setInsertResult({
        id: 'notif-5',
        fire_at: expectedFireAt,
        type: 'flight_reminder',
      });

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-5', type: 'flight' },
        { type: 'flight', eventTime: departureTime },
      );

      expect(result).toEqual({
        id: 'notif-5',
        fireAt: expectedFireAt,
        type: 'flight_reminder',
      });

      expect(mockDb.mock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          fire_at: expectedFireAt,
        }),
      );
    });

    it('returns null when no event time is provided for flight', async () => {
      mockDb.setSelectResult(undefined);

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-6', type: 'flight' },
        { type: 'flight', eventTime: null },
      );

      expect(result).toBeNull();
    });

    it('returns null when no checkin date is provided for hotel', async () => {
      mockDb.setSelectResult(undefined);

      const result = await scheduler.scheduleBookingReminder(
        'user-1',
        { id: 'booking-7', type: 'hotel' },
        { type: 'hotel', checkinDate: null },
      );

      expect(result).toBeNull();
    });
  });

  describe('rescheduleBookingReminder', () => {
    it('deletes old notification and creates new one', async () => {
      // First call (select existing) returns existing notification
      let callCount = 0;
      (mockDb.mock as any).executeTakeFirst = vi.fn(async () => {
        callCount++;
        if (callCount === 1) {
          // First: find existing notification
          return { user_id: 'user-1', booking_id: 'booking-1', type: 'flight_reminder' };
        }
        // Later calls: no preferences found (use defaults)
        return undefined;
      });

      const newDepartureTime = '2025-06-12T16:00:00Z';
      const expectedFireAt = new Date('2025-06-11T16:00:00Z'); // 24h before

      mockDb.setInsertResult({
        id: 'notif-new',
        fire_at: expectedFireAt,
        type: 'flight_reminder',
      });

      const result = await scheduler.rescheduleBookingReminder('booking-1', {
        type: 'flight',
        eventTime: newDepartureTime,
      });

      expect(result).toEqual({
        id: 'notif-new',
        fireAt: expectedFireAt,
        type: 'flight_reminder',
      });

      // Verify delete was called
      expect(mockDb.mock.deleteFrom).toHaveBeenCalled();
    });

    it('returns null when no existing notification found', async () => {
      mockDb.setSelectResult(undefined);

      const result = await scheduler.rescheduleBookingReminder('booking-nonexistent', {
        type: 'flight',
        eventTime: '2025-06-12T16:00:00Z',
      });

      expect(result).toBeNull();
    });
  });

  describe('cancelBookingReminder', () => {
    it('deletes pending notifications for a booking', async () => {
      // setDeleteResult sets what executeTakeFirst returns in delete context
      (mockDb.mock as any).executeTakeFirst = vi.fn(async () => ({
        numDeletedRows: BigInt(2),
      }));

      const count = await scheduler.cancelBookingReminder('booking-1');

      expect(count).toBe(2);
      expect(mockDb.mock.deleteFrom).toHaveBeenCalled();
    });

    it('returns 0 when no notifications to cancel', async () => {
      (mockDb.mock as any).executeTakeFirst = vi.fn(async () => ({
        numDeletedRows: BigInt(0),
      }));

      const count = await scheduler.cancelBookingReminder('booking-nonexistent');

      expect(count).toBe(0);
    });
  });
});
