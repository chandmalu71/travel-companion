/**
 * Social Sharing / Highlights Routes
 *
 * Manages trip highlights for social media sharing.
 * Supports photo selection, captions, layouts, and sharing via
 * platform native share sheets.
 *
 * Routes:
 * - POST /api/trips/:tripId/highlights - Create a highlight
 * - POST /api/trips/:tripId/highlights/:highlightId/share - Share a highlight
 * - POST /api/trips/:tripId/highlights/:highlightId/draft - Save as draft
 * - GET /api/trips/:tripId/highlights - List highlights
 *
 * Implements Requirements: 23.1-23.10
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Types ───────────────────────────────────────────────────────────────────

export type HighlightLayout = 'single' | 'carousel' | 'collage';
export type SharePlatform = 'instagram' | 'facebook' | 'x' | 'whatsapp' | 'native_share';

interface CreateHighlightBody {
  photos: string[]; // URLs or document IDs
  caption?: string; // max 500 chars
  layout: HighlightLayout;
  tagTripName?: boolean;
  tagDestinations?: string[];
  includeStats?: boolean; // include trip stats (days, cities visited, etc.)
}

interface ShareHighlightBody {
  platform: SharePlatform;
}

interface HighlightRoutesOptions {
  db: Kysely<Database>;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerHighlightRoutes(
  app: FastifyInstance,
  options: HighlightRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ─── POST /api/trips/:tripId/highlights ────────────────────────────────

  app.post(
    '/api/trips/:tripId/highlights',
    async (
      request: FastifyRequest<{ Params: { tripId: string }; Body: CreateHighlightBody }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const body = request.body;

      // Validate
      const errors = validateHighlight(body);
      if (errors.length > 0) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          details: { errors },
        });
      }

      const highlight = await db
        .insertInto('highlights')
        .values({
          trip_id: tripId,
          user_id: userId,
          photos: JSON.stringify(body.photos),
          caption: body.caption ?? null,
          layout: body.layout,
          tag_trip_name: body.tagTripName ?? false,
          tag_destinations: body.tagDestinations ? JSON.stringify(body.tagDestinations) : null,
          include_stats: body.includeStats ?? false,
          status: 'draft',
        })
        .returning(['id', 'trip_id', 'layout', 'caption', 'status', 'created_at'])
        .executeTakeFirstOrThrow();

      return reply.status(201).send({ statusCode: 201, data: highlight });
    },
  );

  // ─── GET /api/trips/:tripId/highlights ─────────────────────────────────

  app.get(
    '/api/trips/:tripId/highlights',
    async (request: FastifyRequest<{ Params: { tripId: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;

      const highlights = await db
        .selectFrom('highlights')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc')
        .execute();

      return reply.send({ statusCode: 200, data: highlights });
    },
  );

  // ─── POST /api/trips/:tripId/highlights/:highlightId/share ─────────────

  app.post(
    '/api/trips/:tripId/highlights/:highlightId/share',
    async (
      request: FastifyRequest<{
        Params: { tripId: string; highlightId: string };
        Body: ShareHighlightBody;
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId, highlightId } = request.params;
      const { platform } = request.body;

      const highlight = await db
        .selectFrom('highlights')
        .selectAll()
        .where('id', '=', highlightId)
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!highlight) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Highlight not found',
        });
      }

      // Generate shareable content (sanitized — no personal booking details)
      const shareContent = generateShareContent(highlight, platform);

      // Update status
      await db
        .updateTable('highlights')
        .set({ status: 'shared', shared_at: new Date(), shared_platform: platform })
        .where('id', '=', highlightId)
        .execute();

      // Record in activity feed
      await db
        .insertInto('activity_feed')
        .values({
          trip_id: tripId,
          user_id: userId,
          action: 'shared_highlight',
          entity_type: 'highlight',
          entity_id: highlightId,
          details: JSON.stringify({ platform }),
        })
        .execute();

      return reply.send({
        statusCode: 200,
        data: {
          shareUrl: shareContent.url,
          shareText: shareContent.text,
          platform,
        },
      });
    },
  );

  // ─── POST /api/trips/:tripId/highlights/:highlightId/draft ─────────────

  app.post(
    '/api/trips/:tripId/highlights/:highlightId/draft',
    async (
      request: FastifyRequest<{ Params: { tripId: string; highlightId: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { highlightId } = request.params;

      await db
        .updateTable('highlights')
        .set({ status: 'draft', updated_at: new Date() })
        .where('id', '=', highlightId)
        .where('user_id', '=', userId)
        .execute();

      return reply.send({ statusCode: 200, message: 'Saved as draft' });
    },
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validateHighlight(body: CreateHighlightBody): string[] {
  const errors: string[] = [];

  if (!body.photos || body.photos.length === 0) {
    errors.push('At least one photo is required');
  }

  if (body.layout === 'carousel' && body.photos.length > 10) {
    errors.push('Carousel layout supports up to 10 images');
  }

  if (body.layout === 'collage' && (body.photos.length < 2 || body.photos.length > 6)) {
    errors.push('Collage layout requires 2-6 images');
  }

  if (body.caption && body.caption.length > 500) {
    errors.push('Caption must be at most 500 characters');
  }

  if (!['single', 'carousel', 'collage'].includes(body.layout)) {
    errors.push('Layout must be "single", "carousel", or "collage"');
  }

  return errors;
}

/**
 * Generate share content for a platform.
 * Ensures no personal booking details (confirmation numbers, flight numbers,
 * addresses) are leaked unless they appear in the user's caption.
 */
function generateShareContent(
  highlight: any,
  platform: SharePlatform,
): { url: string; text: string } {
  const caption = highlight.caption ?? '';
  const tripName = highlight.tag_trip_name ? '✈️ Trip Highlight' : '';

  const shareText = [tripName, caption].filter(Boolean).join(' — ');

  // Platform-specific URLs (in production, use actual share APIs)
  const shareUrl = `https://travel-companion.app/share/${highlight.id}`;

  return { url: shareUrl, text: shareText };
}

/**
 * Check if share content contains personal booking details.
 * Used by the data leakage prevention property test.
 */
export function containsPersonalDetails(
  content: string,
  personalDetails: string[],
  caption: string,
): boolean {
  for (const detail of personalDetails) {
    if (content.includes(detail) && !caption.includes(detail)) {
      return true; // Leak detected
    }
  }
  return false;
}
