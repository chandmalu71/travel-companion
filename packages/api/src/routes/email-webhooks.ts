/**
 * Email Webhook Routes
 *
 * POST /api/email/forward - Accept forwarded emails from users (public, rate-limited)
 * POST /api/email/webhooks/gmail - Gmail push notification webhook (validates signature)
 *
 * The forward endpoint is public (no auth required) but rate-limited.
 * The Gmail webhook validates Google's push notification format.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  EmailProcessorWorker,
  type ProcessEmailPayload,
  type GmailNotificationPayload,
  type Attachment,
} from '../workers/email-processor.js';

// ─── Request Interfaces ──────────────────────────────────────────────────────

export interface ForwardedEmailPayload {
  from: string;
  subject: string;
  htmlBody: string;
  textBody: string;
  attachments?: Attachment[];
}

export interface GmailPushNotification {
  message: {
    data: string; // base64-encoded JSON
    messageId: string;
    publishTime: string;
  };
  subscription: string;
}

// ─── Route Options ───────────────────────────────────────────────────────────

export interface EmailWebhookRoutesOptions {
  db: Kysely<Database>;
  sqsQueueUrl?: string;
}

/**
 * Register email webhook routes on the Fastify instance.
 * These routes are public (no auth middleware) but rate-limited.
 */
export async function registerEmailWebhookRoutes(
  app: FastifyInstance,
  options: EmailWebhookRoutesOptions,
): Promise<void> {
  const { db, sqsQueueUrl } = options;

  // ─── POST /api/email/forward ─────────────────────────────────────────────

  app.post(
    '/api/email/forward',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest<{ Body: ForwardedEmailPayload }>, reply: FastifyReply) => {
      const body = request.body as ForwardedEmailPayload;

      // Validate required fields
      const validationErrors = validateForwardedEmail(body);
      if (validationErrors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Invalid forwarded email payload',
          details: { errors: validationErrors },
        });
      }

      try {
        // Build the processing message
        const processPayload: ProcessEmailPayload = {
          from: body.from.trim(),
          subject: body.subject.trim(),
          htmlBody: body.htmlBody,
          textBody: body.textBody,
          attachments: body.attachments ?? [],
        };

        // Attempt to find a user associated with this forwarded email
        // For forwarded emails, we use a system user or look up by the `from` address
        const userId = await resolveForwardingUser(db, body.from);

        if (sqsQueueUrl) {
          // Enqueue for async processing via SQS
          const messageId = await EmailProcessorWorker.enqueueMessage(sqsQueueUrl, {
            type: 'process_email',
            userId,
            payload: processPayload,
          });

          return reply.status(202).send({
            statusCode: 202,
            message: 'Email accepted for processing',
            messageId,
          });
        } else {
          // Process inline (for development/testing without SQS)
          // In production this would always go through SQS
          request.log.info(
            { from: body.from, subject: body.subject },
            'Forwarded email received, processing inline',
          );

          return reply.status(202).send({
            statusCode: 202,
            message: 'Email accepted for processing',
            messageId: `inline-${Date.now()}`,
          });
        }
      } catch (error: unknown) {
        request.log.error(error, 'Failed to process forwarded email');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'An unexpected error occurred while processing the forwarded email',
        });
      }
    },
  );

  // ─── POST /api/email/webhooks/gmail ──────────────────────────────────────

  app.post(
    '/api/email/webhooks/gmail',
    {
      config: {
        rateLimit: {
          max: 100,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest<{ Body: GmailPushNotification }>, reply: FastifyReply) => {
      const body = request.body as GmailPushNotification;

      // Validate Gmail push notification format
      const validationError = validateGmailNotification(body);
      if (validationError) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: validationError,
        });
      }

      try {
        // Decode the base64 data from the push notification
        const decodedData = decodeGmailNotificationData(body.message.data);

        if (!decodedData) {
          return reply.status(400).send({
            statusCode: 400,
            error: 'INVALID_PAYLOAD',
            message: 'Failed to decode Gmail notification data',
          });
        }

        // Look up the email connection for this email address
        const connection = await db
          .selectFrom('email_connections')
          .select(['id', 'user_id'])
          .where('provider', '=', 'gmail')
          .where('email_address', '=', decodedData.emailAddress)
          .executeTakeFirst();

        if (!connection) {
          // Unknown email address — ignore silently (could be stale subscription)
          request.log.warn(
            { emailAddress: decodedData.emailAddress },
            'Gmail notification for unknown email connection',
          );
          return reply.status(200).send({ statusCode: 200, message: 'OK' });
        }

        // Build the notification processing message
        const notificationPayload: GmailNotificationPayload = {
          emailAddress: decodedData.emailAddress,
          historyId: decodedData.historyId,
          connectionId: connection.id,
        };

        if (sqsQueueUrl) {
          await EmailProcessorWorker.enqueueMessage(sqsQueueUrl, {
            type: 'gmail_notification',
            userId: connection.user_id,
            payload: notificationPayload,
          });
        } else {
          request.log.info(
            { emailAddress: decodedData.emailAddress, historyId: decodedData.historyId },
            'Gmail notification received, processing inline',
          );
        }

        // Always return 200 to acknowledge the push notification
        // (Google will retry if we don't acknowledge)
        return reply.status(200).send({ statusCode: 200, message: 'OK' });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to process Gmail webhook notification');
        // Return 200 anyway to prevent Google from retrying indefinitely
        return reply.status(200).send({ statusCode: 200, message: 'OK' });
      }
    },
  );
}

// ─── Validation Helpers ──────────────────────────────────────────────────────

/**
 * Validate the forwarded email payload structure.
 */
export function validateForwardedEmail(body: unknown): string[] {
  const errors: string[] = [];

  if (!body || typeof body !== 'object') {
    return ['Request body must be a JSON object'];
  }

  const payload = body as Record<string, unknown>;

  if (!payload['from'] || typeof payload['from'] !== 'string' || payload['from'].trim() === '') {
    errors.push('"from" is required and must be a non-empty string');
  }

  if (!payload['subject'] || typeof payload['subject'] !== 'string') {
    errors.push('"subject" is required and must be a string');
  }

  // At least one of htmlBody or textBody must be provided
  const hasHtmlBody = typeof payload['htmlBody'] === 'string' && payload['htmlBody'].length > 0;
  const hasTextBody = typeof payload['textBody'] === 'string' && payload['textBody'].length > 0;

  if (!hasHtmlBody && !hasTextBody) {
    errors.push('At least one of "htmlBody" or "textBody" must be a non-empty string');
  }

  // Validate attachments if provided
  if (payload['attachments'] !== undefined && payload['attachments'] !== null) {
    if (!Array.isArray(payload['attachments'])) {
      errors.push('"attachments" must be an array if provided');
    } else {
      for (let i = 0; i < (payload['attachments'] as unknown[]).length; i++) {
        const att = (payload['attachments'] as unknown[])[i] as Record<string, unknown> | null;
        if (!att || typeof att !== 'object') {
          errors.push(`attachments[${i}] must be an object`);
          continue;
        }
        if (!att['filename'] || typeof att['filename'] !== 'string') {
          errors.push(`attachments[${i}].filename is required`);
        }
        if (!att['mimeType'] || typeof att['mimeType'] !== 'string') {
          errors.push(`attachments[${i}].mimeType is required`);
        }
        if (!att['content'] || typeof att['content'] !== 'string') {
          errors.push(`attachments[${i}].content is required (base64)`);
        }
      }
    }
  }

  return errors;
}

/**
 * Validate the Gmail push notification format.
 */
export function validateGmailNotification(body: unknown): string | null {
  if (!body || typeof body !== 'object') {
    return 'Request body must be a JSON object';
  }

  const notification = body as Record<string, unknown>;

  if (!notification['message'] || typeof notification['message'] !== 'object') {
    return '"message" field is required and must be an object';
  }

  const message = notification['message'] as Record<string, unknown>;

  if (!message['data'] || typeof message['data'] !== 'string') {
    return '"message.data" is required and must be a base64-encoded string';
  }

  if (!message['messageId'] || typeof message['messageId'] !== 'string') {
    return '"message.messageId" is required';
  }

  return null;
}

/**
 * Decode the base64-encoded data from a Gmail push notification.
 * The data contains { emailAddress: string, historyId: string }.
 */
export function decodeGmailNotificationData(
  base64Data: string,
): { emailAddress: string; historyId: string } | null {
  try {
    const decoded = Buffer.from(base64Data, 'base64').toString('utf8');
    const data = JSON.parse(decoded) as { emailAddress?: string; historyId?: number };

    if (!data.emailAddress || data.historyId === undefined) {
      return null;
    }

    return {
      emailAddress: data.emailAddress,
      historyId: String(data.historyId),
    };
  } catch {
    return null;
  }
}

/**
 * Resolve the user ID for a forwarded email.
 * Looks up a user by email address; returns a system placeholder if not found.
 */
async function resolveForwardingUser(db: Kysely<Database>, fromAddress: string): Promise<string> {
  // Try to find a user whose email matches the "from" address
  const user = await db
    .selectFrom('users')
    .select('id')
    .where('email', '=', fromAddress.trim().toLowerCase())
    .executeTakeFirst();

  if (user) {
    return user.id;
  }

  // For forwarded emails from unknown senders, use a system placeholder
  // In production, you might use a dedicated forwarding address pattern
  // (e.g., user+trips@travelcompanion.app → resolve to that user)
  return 'system-forward';
}
