/**
 * Tests for Notification Preferences Routes.
 *
 * Tests cover:
 * - PUT /api/users/:userId/notification-preferences
 *   - Valid preference updates
 *   - Validation errors (offset range, time format, types)
 *   - Authentication and authorization (userId match)
 *   - Upsert behavior
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { type FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { registerNotificationPreferencesRoutes, validateNotificationPreferences } from './notification-preferences.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Test Setup ──────────────────────────────────────────────────────────────

function createMockDb(options: {
  preferences?: Record<string, unknown> | null;
} = {}) {
  const { preferences = null } = options;

  const executeFn = vi.fn(() => Promise.resolve());
  const executeTakeFirstOrThrowFn = vi.fn(() =>
    Promise.resolve(
      preferences ?? {
        user_id: 'user-123',
        flight_reminder_offset: 1440,
        hotel_reminder_time: '08:00',
        car_reminder_offset: 120,
        push_enabled: true,
        email_enabled: false,
      },
    ),
  );

  const db = {
    insertInto: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflict: vi.fn(() => ({
          execute: executeFn,
        })),
      })),
    })),
    selectFrom: vi.fn(() => ({
      selectAll: vi.fn(() => ({
        where: vi.fn(() => ({
          executeTakeFirstOrThrow: executeTakeFirstOrThrowFn,
        })),
      })),
    })),
  };

  return db;
}

async function buildApp(db: unknown): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });

  // Register a mock auth middleware
  app.decorateRequest('user', undefined);
  app.decorate('requireAuth', async (request: { user?: { userId: string; email: string }; headers: { authorization?: string } }) => {
    // Simulate authentication from Authorization header
    const authHeader = request.headers.authorization;
    if (authHeader === 'Bearer valid-token-user-123') {
      request.user = { userId: 'user-123', email: 'user@example.com' };
    } else if (authHeader === 'Bearer valid-token-user-456') {
      request.user = { userId: 'user-456', email: 'other@example.com' };
    } else {
      request.user = { userId: 'user-123', email: 'user@example.com' };
    }
  });

  await registerNotificationPreferencesRoutes(app, { db: db as Kysely<Database> });
  await app.ready();
  return app;
}

// ─── Validation Tests ────────────────────────────────────────────────────────

describe('validateNotificationPreferences', () => {
  it('should pass with valid preferences', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 1440,
      hotelReminderTime: '08:00',
      carReminderOffset: 120,
      pushEnabled: true,
      emailEnabled: false,
    });
    expect(errors).toHaveLength(0);
  });

  it('should pass with partial preferences', () => {
    const errors = validateNotificationPreferences({
      pushEnabled: true,
    });
    expect(errors).toHaveLength(0);
  });

  it('should fail for flightReminderOffset below minimum (15)', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 10,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('flightReminderOffset');
  });

  it('should fail for flightReminderOffset above maximum (4320)', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 5000,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('flightReminderOffset');
  });

  it('should fail for non-integer flightReminderOffset', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 60.5,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('flightReminderOffset');
  });

  it('should fail for carReminderOffset below minimum (15)', () => {
    const errors = validateNotificationPreferences({
      carReminderOffset: 5,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('carReminderOffset');
  });

  it('should fail for carReminderOffset above maximum (4320)', () => {
    const errors = validateNotificationPreferences({
      carReminderOffset: 10000,
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('carReminderOffset');
  });

  it('should fail for invalid hotelReminderTime format', () => {
    const errors = validateNotificationPreferences({
      hotelReminderTime: '25:00',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('hotelReminderTime');
  });

  it('should fail for non-HH:mm hotelReminderTime', () => {
    const errors = validateNotificationPreferences({
      hotelReminderTime: '8:00',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('hotelReminderTime');
  });

  it('should fail for invalid hotelReminderTime with bad minutes', () => {
    const errors = validateNotificationPreferences({
      hotelReminderTime: '08:60',
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('hotelReminderTime');
  });

  it('should accept valid boundary values', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 15,
      carReminderOffset: 4320,
      hotelReminderTime: '23:59',
    });
    expect(errors).toHaveLength(0);
  });

  it('should collect multiple errors', () => {
    const errors = validateNotificationPreferences({
      flightReminderOffset: 0,
      carReminderOffset: -1,
      hotelReminderTime: 'invalid',
    });
    expect(errors).toHaveLength(3);
  });
});

// ─── Route Tests ─────────────────────────────────────────────────────────────

describe('PUT /api/users/:userId/notification-preferences', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    const db = createMockDb({
      preferences: {
        user_id: 'user-123',
        flight_reminder_offset: 60,
        hotel_reminder_time: '09:00',
        car_reminder_offset: 30,
        push_enabled: true,
        email_enabled: true,
      },
    });
    app = await buildApp(db);
  });

  it('should update notification preferences successfully', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        flightReminderOffset: 60,
        hotelReminderTime: '09:00',
        carReminderOffset: 30,
        pushEnabled: true,
        emailEnabled: true,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.userId).toBe('user-123');
    expect(body.flightReminderOffset).toBe(60);
    expect(body.hotelReminderTime).toBe('09:00');
    expect(body.carReminderOffset).toBe(30);
    expect(body.pushEnabled).toBe(true);
    expect(body.emailEnabled).toBe(true);
  });

  it('should accept partial updates', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        pushEnabled: false,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should reject requests for different userId (403)', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-456/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        pushEnabled: true,
      },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('FORBIDDEN');
  });

  it('should return 400 for invalid flightReminderOffset', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        flightReminderOffset: 5,
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details[0].field).toBe('flightReminderOffset');
  });

  it('should return 400 for invalid hotelReminderTime', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        hotelReminderTime: 'not-a-time',
      },
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.details[0].field).toBe('hotelReminderTime');
  });

  it('should return 400 for empty body', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('VALIDATION_ERROR');
    expect(body.message).toContain('At least one preference field must be provided');
  });

  it('should accept minimum offset values', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        flightReminderOffset: 15,
        carReminderOffset: 15,
      },
    });

    expect(response.statusCode).toBe(200);
  });

  it('should accept maximum offset values', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/users/user-123/notification-preferences',
      headers: { authorization: 'Bearer valid-token-user-123' },
      payload: {
        flightReminderOffset: 4320,
        carReminderOffset: 4320,
      },
    });

    expect(response.statusCode).toBe(200);
  });
});
