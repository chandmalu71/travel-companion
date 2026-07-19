/**
 * Email Connection Management Routes
 *
 * Manages connected email accounts for automatic booking scanning.
 * Supports Gmail, Outlook, Yahoo, and generic IMAP.
 *
 * Routes:
 * - GET /api/email/connections - List connected accounts with status
 * - POST /api/email/connections - Connect a new email account
 * - DELETE /api/email/connections/:id - Disconnect an account
 * - PUT /api/email/connections/:id/frequency - Update scan frequency
 * - POST /api/email/connections/:id/scan - Trigger manual scan ("Scan Now")
 *
 * Implements Requirement 27
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  EmailScannerService,
  type EmailProvider,
  type ScanFrequency,
} from '../services/email-scanner.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ConnectEmailBody {
  provider: EmailProvider;
  email: string;
  accessToken?: string;
  refreshToken?: string;
  // IMAP
  imapHost?: string;
  imapPort?: number;
  imapUsername?: string;
  imapPassword?: string;
  imapUseTls?: boolean;
  // Settings
  scanFrequency?: ScanFrequency;
}

interface UpdateFrequencyBody {
  frequency: ScanFrequency;
}

interface ConnectionIdParams {
  id: string;
}

interface EmailConnectionRoutesOptions {
  db: Kysely<Database>;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerEmailConnectionRoutes(
  app: FastifyInstance,
  options: EmailConnectionRoutesOptions,
): Promise<void> {
  const { db } = options;
  const scanner = new EmailScannerService(db);

  // ─── GET /api/email/connections ────────────────────────────────────────

  app.get(
    '/api/email/connections',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;

      const statuses = await scanner.getConnectionStatuses(userId);

      return reply.send({
        statusCode: 200,
        data: {
          connections: statuses,
          supportedProviders: [
            { id: 'gmail', name: 'Gmail', authType: 'oauth' },
            { id: 'outlook', name: 'Outlook / Hotmail', authType: 'oauth' },
            { id: 'yahoo', name: 'Yahoo Mail', authType: 'oauth' },
            { id: 'imap', name: 'Other (IMAP)', authType: 'credentials' },
          ],
          frequencyOptions: [
            { id: 'realtime', label: 'Real-time (push)' },
            { id: '5min', label: 'Every 5 minutes' },
            { id: '15min', label: 'Every 15 minutes' },
            { id: '1hour', label: 'Every hour' },
            { id: 'manual', label: 'Manual only' },
          ],
        },
      });
    },
  );

  // ─── POST /api/email/connections ───────────────────────────────────────

  app.post(
    '/api/email/connections',
    async (request: FastifyRequest<{ Body: ConnectEmailBody }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const body = request.body;

      // Validate provider
      const validProviders: EmailProvider[] = ['gmail', 'outlook', 'yahoo', 'imap'];
      if (!body.provider || !validProviders.includes(body.provider)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `provider must be one of: ${validProviders.join(', ')}`,
        });
      }

      if (!body.email) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'email is required',
        });
      }

      // Validate IMAP-specific fields
      if (body.provider === 'imap') {
        if (!body.imapHost || !body.imapUsername || !body.imapPassword) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'IMAP connections require imapHost, imapUsername, and imapPassword',
          });
        }
      } else {
        // OAuth providers need tokens
        if (!body.accessToken) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'VALIDATION_ERROR',
            message: 'OAuth providers require accessToken',
          });
        }
      }

      try {
        const result = await scanner.connectAccount(userId, {
          provider: body.provider,
          email: body.email,
          accessToken: body.accessToken,
          refreshToken: body.refreshToken,
          imapHost: body.imapHost,
          imapPort: body.imapPort ?? 993,
          imapUsername: body.imapUsername,
          imapPassword: body.imapPassword,
          imapUseTls: body.imapUseTls ?? true,
        }, body.scanFrequency ?? '5min');

        return reply.status(201).send({
          statusCode: 201,
          data: {
            connectionId: result.connectionId,
            message: 'Email account connected. Initial scan of last 90 days will begin shortly.',
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to connect email account');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to connect email account',
        });
      }
    },
  );

  // ─── DELETE /api/email/connections/:id ──────────────────────────────────

  app.delete(
    '/api/email/connections/:id',
    async (request: FastifyRequest<{ Params: ConnectionIdParams }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { id } = request.params;

      await scanner.disconnectAccount(userId, id);

      return reply.send({
        statusCode: 200,
        message: 'Email account disconnected. Previously extracted bookings are retained.',
      });
    },
  );

  // ─── PUT /api/email/connections/:id/frequency ──────────────────────────

  app.put(
    '/api/email/connections/:id/frequency',
    async (
      request: FastifyRequest<{ Params: ConnectionIdParams; Body: UpdateFrequencyBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { id } = request.params;
      const { frequency } = request.body;

      const validFrequencies: ScanFrequency[] = ['realtime', '5min', '15min', '1hour', 'manual'];
      if (!frequency || !validFrequencies.includes(frequency)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `frequency must be one of: ${validFrequencies.join(', ')}`,
        });
      }

      await scanner.updateScanFrequency(userId, id, frequency);

      return reply.send({
        statusCode: 200,
        message: `Scan frequency updated to "${frequency}"`,
      });
    },
  );

  // ─── POST /api/email/connections/:id/scan ──────────────────────────────
  // "Scan Now" button — manually triggers an immediate scan.

  app.post(
    '/api/email/connections/:id/scan',
    async (request: FastifyRequest<{ Params: ConnectionIdParams }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { id } = request.params;

      try {
        const result = await scanner.scanNow(userId, id);

        return reply.send({
          statusCode: 200,
          data: {
            ...result,
            message: result.newBookingsFound > 0
              ? `Found ${result.newBookingsFound} new booking(s)!`
              : 'Scan complete. No new bookings found.',
          },
        });
      } catch (error: unknown) {
        const msg = (error as Error).message;
        return reply.status(400).send({
          statusCode: 400,
          error: 'SCAN_FAILED',
          message: msg,
        });
      }
    },
  );
}
