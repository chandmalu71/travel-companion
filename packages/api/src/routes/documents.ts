/**
 * Document Upload and Management Routes
 *
 * Handles document upload to S3, categorization, and retrieval.
 * Supports boarding passes, confirmations, vouchers, visas, insurance.
 *
 * Routes:
 * - POST /api/documents/upload - Upload a document
 * - GET /api/trips/:tripId/documents - List trip documents
 * - DELETE /api/documents/:documentId - Delete a document
 *
 * Implements Requirements: 16.1-16.9
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Types ───────────────────────────────────────────────────────────────────

export const DOCUMENT_CATEGORIES = [
  'boarding_pass',
  'confirmation',
  'voucher',
  'visa',
  'insurance',
  'other',
] as const;

export type DocumentCategory = (typeof DOCUMENT_CATEGORIES)[number];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/heic',
];

const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25MB
const MAX_DOCUMENTS_PER_TRIP = 100;

interface UploadDocumentBody {
  tripId: string;
  category: DocumentCategory;
  filename: string;
  mimeType: string;
  fileContent: string; // base64-encoded
  bookingId?: string;
}

interface DocumentRoutesOptions {
  db: Kysely<Database>;
  s3Bucket: string;
  s3Region: string;
  cloudfrontDomain?: string;
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerDocumentRoutes(
  app: FastifyInstance,
  options: DocumentRoutesOptions,
): Promise<void> {
  const { db, s3Bucket, s3Region, cloudfrontDomain } = options;

  const s3Client = new S3Client({ region: s3Region });

  // ─── POST /api/documents/upload ────────────────────────────────────────

  app.post(
    '/api/documents/upload',
    async (request: FastifyRequest<{ Body: UploadDocumentBody }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      const { tripId, category, filename, mimeType, fileContent, bookingId } = request.body;

      // Validate
      if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `Unsupported file type. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
        });
      }

      if (!DOCUMENT_CATEGORIES.includes(category)) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `Invalid category. Allowed: ${DOCUMENT_CATEGORIES.join(', ')}`,
        });
      }

      // Decode base64 and check size
      const buffer = Buffer.from(fileContent, 'base64');
      if (buffer.length > MAX_FILE_SIZE) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: `File too large. Maximum size is 25MB.`,
        });
      }

      // Check document limit per trip
      const existingCount = await db
        .selectFrom('documents')
        .select(db.fn.count('id').as('count'))
        .where('trip_id', '=', tripId)
        .executeTakeFirst();

      if (Number(existingCount?.count ?? 0) >= MAX_DOCUMENTS_PER_TRIP) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'LIMIT_EXCEEDED',
          message: `Maximum ${MAX_DOCUMENTS_PER_TRIP} documents per trip`,
        });
      }

      try {
        // Upload to S3
        const s3Key = `documents/${userId}/${tripId}/${Date.now()}-${filename}`;

        await s3Client.send(
          new PutObjectCommand({
            Bucket: s3Bucket,
            Key: s3Key,
            Body: buffer,
            ContentType: mimeType,
            Metadata: {
              userId,
              tripId,
              category,
            },
          }),
        );

        // Store metadata in database
        const doc = await db
          .insertInto('documents')
          .values({
            user_id: userId,
            trip_id: tripId,
            booking_id: bookingId ?? null,
            category,
            filename,
            mime_type: mimeType,
            file_size: buffer.length,
            s3_key: s3Key,
            s3_bucket: s3Bucket,
          })
          .returning(['id', 'filename', 'category', 'file_size', 'created_at'])
          .executeTakeFirstOrThrow();

        // Build URL (CloudFront if configured, otherwise S3 presigned URL)
        const url = cloudfrontDomain
          ? `https://${cloudfrontDomain}/${s3Key}`
          : await getSignedUrl(
              s3Client,
              new GetObjectCommand({ Bucket: s3Bucket, Key: s3Key }),
              { expiresIn: 3600 },
            );

        return reply.status(201).send({
          statusCode: 201,
          data: {
            ...doc,
            url,
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to upload document');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Failed to upload document',
        });
      }
    },
  );

  // ─── GET /api/trips/:tripId/documents ──────────────────────────────────

  app.get(
    '/api/trips/:tripId/documents',
    async (
      request: FastifyRequest<{
        Params: { tripId: string };
        Querystring: { category?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { tripId } = request.params;
      const { category } = request.query;

      let query = db
        .selectFrom('documents')
        .selectAll()
        .where('trip_id', '=', tripId)
        .where('user_id', '=', userId)
        .orderBy('created_at', 'desc');

      if (category && DOCUMENT_CATEGORIES.includes(category as DocumentCategory)) {
        query = query.where('category', '=', category);
      }

      const documents = await query.execute();

      // Generate URLs
      const docsWithUrls = await Promise.all(
        documents.map(async (doc) => {
          const url = cloudfrontDomain
            ? `https://${cloudfrontDomain}/${doc.s3_key}`
            : await getSignedUrl(
                s3Client,
                new GetObjectCommand({ Bucket: doc.s3_bucket, Key: doc.s3_key }),
                { expiresIn: 3600 },
              );

          return { ...doc, url };
        }),
      );

      return reply.send({ statusCode: 200, data: docsWithUrls });
    },
  );

  // ─── DELETE /api/documents/:documentId ─────────────────────────────────

  app.delete(
    '/api/documents/:documentId',
    async (
      request: FastifyRequest<{ Params: { documentId: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { documentId } = request.params;

      const doc = await db
        .selectFrom('documents')
        .select(['id', 's3_key', 's3_bucket'])
        .where('id', '=', documentId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!doc) {
        return reply.status(404).send({
          statusCode: 404,
          error: 'NOT_FOUND',
          message: 'Document not found',
        });
      }

      // Delete from S3
      try {
        await s3Client.send(
          new DeleteObjectCommand({
            Bucket: doc.s3_bucket,
            Key: doc.s3_key,
          }),
        );
      } catch (error) {
        request.log.warn(error, 'Failed to delete S3 object (continuing with DB delete)');
      }

      // Delete from database
      await db.deleteFrom('documents').where('id', '=', documentId).execute();

      return reply.send({ statusCode: 200, message: 'Document deleted' });
    },
  );
}
