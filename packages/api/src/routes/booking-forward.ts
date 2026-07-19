/**
 * Booking Forward Ingestion Route
 *
 * Handles emails forwarded to trips@nayya.ai.
 * This endpoint is called by SES (inbound email → Lambda → API) or
 * directly by users via the POST /api/bookings/forward endpoint.
 *
 * Flow:
 * 1. Receive email content (from, subject, body)
 * 2. Parse booking details using email parser
 * 3. Pass to BookingIngestionService for user matching + trip assignment
 * 4. Return result
 *
 * Routes:
 * - POST /api/bookings/forward - Accept a forwarded booking email
 * - POST /api/bookings/claim/:token - Claim a booking with verification token
 * - GET /api/bookings/unclaimed - List unclaimed bookings for current user's email
 *
 * Implements Requirement 26
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { BookingIngestionService } from '../services/booking-ingestion.js';
import { parseBookingEmail, type ExtractedBooking } from '../services/email-parser.js';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ForwardEmailBody {
  from: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
}

interface ClaimTokenParams {
  token: string;
}

interface BookingForwardRoutesOptions {
  db: Kysely<Database>;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerBookingForwardRoutes(
  app: FastifyInstance,
  options: BookingForwardRoutesOptions,
): Promise<void> {
  const { db } = options;
  const ingestionService = new BookingIngestionService(db);

  // ─── POST /api/bookings/forward ────────────────────────────────────────
  // Public endpoint — accepts forwarded emails from SES/Lambda or direct API calls.
  // Rate-limited to prevent abuse.

  app.post(
    '/api/bookings/forward',
    {
      config: {
        rateLimit: {
          max: 30,
          timeWindow: '1 minute',
        },
      },
    },
    async (request: FastifyRequest<{ Body: ForwardEmailBody }>, reply: FastifyReply) => {
      const { from, subject, htmlBody, textBody } = request.body ?? {};

      if (!from || !subject) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: '"from" and "subject" are required fields',
        });
      }

      if (!htmlBody && !textBody) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'At least one of "htmlBody" or "textBody" must be provided',
        });
      }

      try {
        // Step 1: Parse the booking from the email
        const extracted = await parseBookingEmail({
          from,
          subject,
          htmlBody: htmlBody ?? '',
          textBody: textBody ?? '',
        });

        if (!extracted) {
          return reply.status(422).send({
            statusCode: 422,
            error: 'EXTRACTION_FAILED',
            message: 'Could not extract booking details from this email. Make sure it\'s a booking confirmation.',
          });
        }

        // Step 2: Process through ingestion service
        const result = await ingestionService.processForwardedBooking(from, extracted);

        const statusCode = result.status === 'error' ? 500 :
          result.status === 'pending_user_signup' ? 202 : 200;

        return reply.status(statusCode).send({
          statusCode,
          data: result,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Booking forward processing failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to process the forwarded booking',
        });
      }
    },
  );

  // ─── POST /api/bookings/claim/:token ───────────────────────────────────
  // Allows a logged-in user to claim a booking using a verification token.
  // Used when user has a different email than the forwarding address.

  app.post(
    '/api/bookings/claim/:token',
    async (request: FastifyRequest<{ Params: ClaimTokenParams }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { token } = request.params;

      if (!userId || userId === 'dev-user') {
        return reply.status(401).send({
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: 'You must be logged in to claim a booking',
        });
      }

      const result = await ingestionService.claimByToken(userId, token);

      if (result.status === 'error') {
        return reply.status(400).send({ statusCode: 400, ...result });
      }

      return reply.send({ statusCode: 200, data: result });
    },
  );

  // ─── GET /api/bookings/unclaimed ───────────────────────────────────────
  // Returns unclaimed bookings matching the current user's email.
  // Called after login/registration to auto-claim pending bookings.

  app.get(
    '/api/bookings/unclaimed',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;

      if (!userId || userId === 'dev-user') {
        return reply.status(401).send({
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      // Get user email
      const user = await db
        .selectFrom('users')
        .select('email')
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'User not found' });
      }

      // Find unclaimed bookings
      const unclaimed = await db
        .selectFrom('unclaimed_bookings')
        .select(['id', 'booking_type', 'destination', 'start_date', 'end_date', 'created_at', 'expires_at'])
        .where('email', '=', user.email)
        .where('claimed', '=', false)
        .where('expires_at', '>', new Date())
        .orderBy('created_at', 'desc')
        .execute();

      return reply.send({
        statusCode: 200,
        data: {
          count: unclaimed.length,
          bookings: unclaimed,
          autoClaimAvailable: unclaimed.length > 0,
        },
      });
    },
  );

  // ─── POST /api/bookings/claim-all ──────────────────────────────────────
  // Auto-claims all unclaimed bookings for the current user's email.
  // Called after registration or login.

  app.post(
    '/api/bookings/claim-all',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;

      if (!userId || userId === 'dev-user') {
        return reply.status(401).send({
          statusCode: 401,
          error: 'UNAUTHORIZED',
          message: 'Authentication required',
        });
      }

      const user = await db
        .selectFrom('users')
        .select('email')
        .where('id', '=', userId)
        .executeTakeFirst();

      if (!user) {
        return reply.status(404).send({ statusCode: 404, error: 'User not found' });
      }

      const claimedCount = await ingestionService.claimBookingsForUser(userId, user.email);

      return reply.send({
        statusCode: 200,
        data: {
          claimedCount,
          message: claimedCount > 0
            ? `${claimedCount} booking(s) have been added to your account!`
            : 'No unclaimed bookings found for your email.',
        },
      });
    },
  );
}

/**
 * Parse a forwarded email to extract booking information.
 * Wraps the email parser service for the ingestion flow.
 */
async function parseBookingEmail(email: {
  from: string;
  subject: string;
  htmlBody: string;
  textBody: string;
}): Promise<ExtractedBooking | null> {
  // Use the existing email parser
  // In production this calls AWS Comprehend; locally it uses regex patterns
  try {
    const { EmailParserService } = await import('../services/email-parser.js');
    const parser = new EmailParserService();
    const result = await parser.parseEmail(email.htmlBody || email.textBody, email.subject);
    return result;
  } catch {
    return null;
  }
}
