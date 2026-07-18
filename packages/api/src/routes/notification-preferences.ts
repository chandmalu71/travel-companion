/**
 * Notification Preferences Routes
 *
 * Allows users to customize their notification settings including:
 * - Reminder offsets for flights and car rentals (15 min - 72h / 4320 min)
 * - Hotel reminder time (HH:mm format)
 * - Push and email notification toggles
 *
 * Route: PUT /api/users/:userId/notification-preferences
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NotificationPreferencesBody {
  flightReminderOffset?: number;
  hotelReminderTime?: string;
  carReminderOffset?: number;
  pushEnabled?: boolean;
  emailEnabled?: boolean;
}

export interface NotificationPreferencesParams {
  userId: string;
}

// ─── Validation ──────────────────────────────────────────────────────────────

const MIN_OFFSET_MINUTES = 15;
const MAX_OFFSET_MINUTES = 4320; // 72 hours

const HH_MM_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ValidationError {
  field: string;
  message: string;
}

export function validateNotificationPreferences(
  body: NotificationPreferencesBody,
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (body.flightReminderOffset !== undefined) {
    if (
      typeof body.flightReminderOffset !== 'number' ||
      !Number.isInteger(body.flightReminderOffset) ||
      body.flightReminderOffset < MIN_OFFSET_MINUTES ||
      body.flightReminderOffset > MAX_OFFSET_MINUTES
    ) {
      errors.push({
        field: 'flightReminderOffset',
        message: `Must be an integer between ${MIN_OFFSET_MINUTES} and ${MAX_OFFSET_MINUTES} minutes`,
      });
    }
  }

  if (body.hotelReminderTime !== undefined) {
    if (typeof body.hotelReminderTime !== 'string' || !HH_MM_REGEX.test(body.hotelReminderTime)) {
      errors.push({
        field: 'hotelReminderTime',
        message: 'Must be in HH:mm format (00:00 - 23:59)',
      });
    }
  }

  if (body.carReminderOffset !== undefined) {
    if (
      typeof body.carReminderOffset !== 'number' ||
      !Number.isInteger(body.carReminderOffset) ||
      body.carReminderOffset < MIN_OFFSET_MINUTES ||
      body.carReminderOffset > MAX_OFFSET_MINUTES
    ) {
      errors.push({
        field: 'carReminderOffset',
        message: `Must be an integer between ${MIN_OFFSET_MINUTES} and ${MAX_OFFSET_MINUTES} minutes`,
      });
    }
  }

  if (body.pushEnabled !== undefined) {
    if (typeof body.pushEnabled !== 'boolean') {
      errors.push({
        field: 'pushEnabled',
        message: 'Must be a boolean',
      });
    }
  }

  if (body.emailEnabled !== undefined) {
    if (typeof body.emailEnabled !== 'boolean') {
      errors.push({
        field: 'emailEnabled',
        message: 'Must be a boolean',
      });
    }
  }

  return errors;
}

// ─── Route Registration ──────────────────────────────────────────────────────

export interface NotificationPreferencesRoutesOptions {
  db: Kysely<Database>;
}

/**
 * Register notification preferences routes on the Fastify instance.
 */
export async function registerNotificationPreferencesRoutes(
  app: FastifyInstance,
  options: NotificationPreferencesRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── PUT /api/users/:userId/notification-preferences ───────────────────

  app.put(
    '/api/users/:userId/notification-preferences',
    { preHandler: [app.requireAuth] },
    async (
      request: FastifyRequest<{
        Params: NotificationPreferencesParams;
        Body: NotificationPreferencesBody;
      }>,
      reply: FastifyReply,
    ) => {
      const { userId } = request.params;
      const authenticatedUserId = request.user!.userId;

      // Verify userId matches authenticated user
      if (userId !== authenticatedUserId) {
        return reply.status(403).send({
          statusCode: 403,
          error: 'FORBIDDEN',
          message: 'You can only update your own notification preferences',
        });
      }

      const body = request.body as NotificationPreferencesBody;

      // Validate input
      const errors = validateNotificationPreferences(body);
      if (errors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Notification preferences validation failed',
          details: errors,
        });
      }

      // Check that at least one field is provided
      const hasFields =
        body.flightReminderOffset !== undefined ||
        body.hotelReminderTime !== undefined ||
        body.carReminderOffset !== undefined ||
        body.pushEnabled !== undefined ||
        body.emailEnabled !== undefined;

      if (!hasFields) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'At least one preference field must be provided',
        });
      }

      try {
        // Build the values object for upsert
        const values: Record<string, unknown> = {
          user_id: userId,
        };

        if (body.flightReminderOffset !== undefined) {
          values.flight_reminder_offset = body.flightReminderOffset;
        }
        if (body.hotelReminderTime !== undefined) {
          values.hotel_reminder_time = body.hotelReminderTime;
        }
        if (body.carReminderOffset !== undefined) {
          values.car_reminder_offset = body.carReminderOffset;
        }
        if (body.pushEnabled !== undefined) {
          values.push_enabled = body.pushEnabled;
        }
        if (body.emailEnabled !== undefined) {
          values.email_enabled = body.emailEnabled;
        }

        // Build the update set (only provided fields)
        const updateSet: Record<string, unknown> = {};
        if (body.flightReminderOffset !== undefined) {
          updateSet.flight_reminder_offset = body.flightReminderOffset;
        }
        if (body.hotelReminderTime !== undefined) {
          updateSet.hotel_reminder_time = body.hotelReminderTime;
        }
        if (body.carReminderOffset !== undefined) {
          updateSet.car_reminder_offset = body.carReminderOffset;
        }
        if (body.pushEnabled !== undefined) {
          updateSet.push_enabled = body.pushEnabled;
        }
        if (body.emailEnabled !== undefined) {
          updateSet.email_enabled = body.emailEnabled;
        }

        // Upsert notification preferences
        await db
          .insertInto('notification_preferences')
          .values(values as never)
          .onConflict((oc) =>
            oc.column('user_id').doUpdateSet(updateSet as never),
          )
          .execute();

        // Fetch the updated preferences
        const prefs = await db
          .selectFrom('notification_preferences')
          .selectAll()
          .where('user_id', '=', userId)
          .executeTakeFirstOrThrow();

        return reply.status(200).send({
          userId: prefs.user_id,
          flightReminderOffset: prefs.flight_reminder_offset,
          hotelReminderTime: prefs.hotel_reminder_time,
          carReminderOffset: prefs.car_reminder_offset,
          pushEnabled: prefs.push_enabled,
          emailEnabled: prefs.email_enabled,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to update notification preferences');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while updating notification preferences',
        });
      }
    },
  );
}
