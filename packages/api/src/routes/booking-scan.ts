/**
 * Booking Document Scan Route
 *
 * POST /api/bookings/scan - Scan a booking confirmation (image/PDF screenshot)
 * and extract flight, hotel, or car rental details using AI (Bedrock Claude).
 * Automatically creates the booking if extraction succeeds.
 *
 * Accepts JPEG, PNG images up to 10MB as base64.
 * Returns extracted booking with confidence score.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from '@aws-sdk/client-bedrock-runtime';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScanBookingBody {
  image: string; // base64-encoded
  mimeType: string;
  tripId?: string; // Optional: assign to trip
}

interface ExtractedBookingResult {
  type: 'flight' | 'hotel' | 'car_rental';
  confidence: number;
  fields: Record<string, string | null>;
  booking?: { id: string };
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function registerBookingScanRoute(
  app: FastifyInstance,
  options: { db: Kysely<Database> },
): Promise<void> {
  const { db } = options;

  app.post(
    '/api/bookings/scan',
    { preHandler: [app.requireAuth] },
    async (request: FastifyRequest<{ Body: ScanBookingBody }>, reply: FastifyReply) => {
      const { image, mimeType, tripId } = request.body ?? {};
      const userId = request.user!.userId;

      if (!image || !mimeType) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Both "image" (base64) and "mimeType" are required',
        });
      }

      // Validate image
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
      if (!allowedTypes.includes(mimeType)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'UNSUPPORTED_FORMAT',
          message: 'Supported formats: JPEG, PNG, WebP, PDF',
        });
      }

      const imageBuffer = Buffer.from(image, 'base64');
      if (imageBuffer.length > 10 * 1024 * 1024) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'TOO_LARGE',
          message: 'File too large. Maximum 10MB.',
        });
      }

      try {
        // Use Bedrock Claude to extract booking details from the image
        const extracted = await extractBookingFromImage(image, mimeType);

        if (!extracted || extracted.confidence < 0.3) {
          return reply.status(422).send({
            statusCode: 422,
            error: 'EXTRACTION_FAILED',
            message: 'Could not extract booking details from this document. Please try a clearer image or add the booking manually.',
            data: extracted,
          });
        }

        // Create the booking in the database
        const booking = await createBookingFromScan(db, userId, extracted, tripId ?? null);

        return reply.send({
          statusCode: 200,
          message: `${extracted.type.replace('_', ' ')} booking created successfully`,
          data: {
            ...extracted,
            booking: { id: booking.id },
          },
        });
      } catch (error: any) {
        request.log.error(error, 'Booking scan failed');

        // Fallback response if AI is unavailable
        if (error.name === 'ServiceUnavailableException' || error.name === 'ThrottlingException') {
          return reply.status(503).send({
            statusCode: 503,
            error: 'AI_UNAVAILABLE',
            message: 'AI service temporarily unavailable. Please try again in a moment.',
            retryable: true,
          });
        }

        return reply.status(500).send({
          statusCode: 500,
          error: 'SCAN_FAILED',
          message: 'Failed to process booking document. Please try again.',
        });
      }
    },
  );
}

// ─── AI Extraction ───────────────────────────────────────────────────────────

async function extractBookingFromImage(
  imageBase64: string,
  mimeType: string,
): Promise<ExtractedBookingResult | null> {
  const client = new BedrockRuntimeClient({
    region: process.env.BEDROCK_REGION ?? 'eu-west-1',
  });

  const mediaType = mimeType === 'application/pdf' ? 'image/png' : mimeType;

  const systemPrompt = `You are a booking confirmation extractor. Analyse the image of a booking confirmation and extract structured data.

Return ONLY a JSON object (no markdown, no explanation) with this structure:
{
  "type": "flight" | "hotel" | "car_rental",
  "confidence": 0.0-1.0,
  "fields": { ... type-specific fields ... }
}

For flights:
- fields: { "airline", "flight_number", "departure_airport" (3-letter IATA), "arrival_airport", "departure_time" (ISO 8601), "arrival_time" (ISO 8601), "confirmation_number", "cabin_class", "passenger_name" }

For hotels:
- fields: { "hotel_name", "address", "checkin_date" (YYYY-MM-DD), "checkout_date" (YYYY-MM-DD), "confirmation_number", "room_type", "guest_name" }

For car rentals:
- fields: { "company", "vehicle_class", "pickup_location", "return_location", "pickup_time" (ISO 8601), "return_time" (ISO 8601), "confirmation_number" }

Rules:
- Set confidence based on how clearly you can read the data (1.0 = all fields clearly visible)
- Use null for fields you cannot determine
- For dates, use the year from the document or current year if not visible
- Airport codes should be 3-letter IATA codes
- If the image is not a booking confirmation, return { "type": "unknown", "confidence": 0, "fields": {} }`;

  const body = JSON.stringify({
    anthropic_version: 'bedrock-2023-05-31',
    max_tokens: 1000,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: mediaType,
              data: imageBase64,
            },
          },
          {
            type: 'text',
            text: 'Extract the booking details from this confirmation document.',
          },
        ],
      },
    ],
    system: systemPrompt,
  });

  const command = new InvokeModelCommand({
    modelId: 'anthropic.claude-3-5-haiku-20241022-v1:0',
    contentType: 'application/json',
    accept: 'application/json',
    body,
  });

  const response = await client.send(command);
  const responseBody = JSON.parse(new TextDecoder().decode(response.body));
  const text = responseBody.content?.[0]?.text ?? '';

  // Parse JSON from response (may be wrapped in ```json blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;

  try {
    const parsed = JSON.parse(jsonMatch[0]);
    if (!parsed.type || parsed.type === 'unknown') return null;
    return parsed as ExtractedBookingResult;
  } catch {
    return null;
  }
}

// ─── Create Booking from Scan ────────────────────────────────────────────────

async function createBookingFromScan(
  db: Kysely<Database>,
  userId: string,
  extracted: ExtractedBookingResult,
  tripId: string | null,
): Promise<{ id: string }> {
  const { type, fields } = extracted;

  return db.transaction().execute(async (trx) => {
    // Create main booking record
    const booking = await trx
      .insertInto('bookings')
      .values({
        user_id: userId,
        trip_id: tripId,
        type,
        source: 'manual' as const, // 'scan' not in enum yet, use manual
      })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    // Create type-specific details
    if (type === 'flight') {
      await trx.insertInto('flight_details').values({
        booking_id: booking.id,
        airline: fields.airline ?? null,
        flight_number: fields.flight_number ?? null,
        departure_airport: fields.departure_airport ?? null,
        arrival_airport: fields.arrival_airport ?? null,
        departure_time: fields.departure_time ? new Date(fields.departure_time) : null,
        arrival_time: fields.arrival_time ? new Date(fields.arrival_time) : null,
        departure_lat: null,
        departure_lng: null,
        arrival_lat: null,
        arrival_lng: null,
        checkin_window_opens: null,
        checkin_window_closes: null,
      }).execute();
    } else if (type === 'hotel') {
      await trx.insertInto('hotel_details').values({
        booking_id: booking.id,
        hotel_name: fields.hotel_name ?? null,
        address: fields.address ?? null,
        checkin_date: fields.checkin_date ?? null,
        checkout_date: fields.checkout_date ?? null,
        latitude: null,
        longitude: null,
        confirmation_number: fields.confirmation_number ?? null,
      }).execute();
    } else if (type === 'car_rental') {
      await trx.insertInto('car_rental_details').values({
        booking_id: booking.id,
        company: fields.company ?? null,
        vehicle_type: fields.vehicle_class ?? null,
        pickup_location: fields.pickup_location ?? null,
        return_location: fields.return_location ?? null,
        pickup_time: fields.pickup_time ? new Date(fields.pickup_time) : null,
        return_time: fields.return_time ? new Date(fields.return_time) : null,
        pickup_lat: null,
        pickup_lng: null,
        return_lat: null,
        return_lng: null,
        confirmation_number: fields.confirmation_number ?? null,
      }).execute();
    }

    return { id: booking.id };
  });
}
