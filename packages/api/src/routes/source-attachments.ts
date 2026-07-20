/**
 * Source Attachments Route
 *
 * GET /api/bookings/:bookingId/source-attachment
 * GET /api/expenses/:expenseId/source-attachment
 *
 * Returns source attachment metadata for a booking or expense.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

export interface SourceAttachmentOptions {
  db: Kysely<Database>;
}

export async function registerSourceAttachmentsRoute(
  app: FastifyInstance,
  options: SourceAttachmentOptions,
): Promise<void> {
  const { db } = options;

  // Get source attachment for a booking
  app.get(
    '/api/bookings/:bookingId/source-attachment',
    async (request: FastifyRequest<{ Params: { bookingId: string } }>, reply: FastifyReply) => {
      const { bookingId } = request.params;
      const userId = (request as any).userId as string;

      // Verify the user owns this booking
      const booking = await db
        .selectFrom('bookings')
        .select(['id', 'user_id'])
        .where('id', '=', bookingId)
        .executeTakeFirst();

      if (!booking || booking.user_id !== userId) {
        return reply.status(404).send({ statusCode: 404, error: 'Booking not found' });
      }

      const attachment = await db
        .selectFrom('source_attachments')
        .selectAll()
        .where('entity_type', '=', 'booking')
        .where('entity_id', '=', bookingId)
        .executeTakeFirst()
        .catch(() => null);

      if (!attachment) {
        return reply.send({ statusCode: 200, data: null });
      }

      return reply.send({
        statusCode: 200,
        data: {
          id: attachment.id,
          sourceType: attachment.source_type,
          mimeType: attachment.mime_type,
          fileSize: attachment.file_size,
          emailSubject: attachment.email_subject,
          emailFrom: attachment.email_from,
          emailDate: attachment.email_date ? new Date(attachment.email_date).toISOString() : null,
          retentionPolicy: attachment.retention_policy,
          expiresAt: attachment.expires_at ? new Date(attachment.expires_at).toISOString() : null,
          createdAt: new Date(attachment.created_at).toISOString(),
          // In production, generate a presigned S3 URL here
          viewUrl: attachment.s3_key ? `/api/source-attachments/${attachment.id}/view` : null,
        },
      });
    },
  );

  // Get source attachment for an expense
  app.get(
    '/api/expenses/:expenseId/source-attachment',
    async (request: FastifyRequest<{ Params: { expenseId: string } }>, reply: FastifyReply) => {
      const { expenseId } = request.params;
      const userId = (request as any).userId as string;

      const expense = await db
        .selectFrom('expenses')
        .select(['id', 'user_id'])
        .where('id', '=', expenseId)
        .executeTakeFirst();

      if (!expense || expense.user_id !== userId) {
        return reply.status(404).send({ statusCode: 404, error: 'Expense not found' });
      }

      const attachment = await db
        .selectFrom('source_attachments')
        .selectAll()
        .where('entity_type', '=', 'expense')
        .where('entity_id', '=', expenseId)
        .executeTakeFirst()
        .catch(() => null);

      if (!attachment) {
        return reply.send({ statusCode: 200, data: null });
      }

      return reply.send({
        statusCode: 200,
        data: {
          id: attachment.id,
          sourceType: attachment.source_type,
          mimeType: attachment.mime_type,
          fileSize: attachment.file_size,
          emailSubject: attachment.email_subject,
          emailFrom: attachment.email_from,
          emailDate: attachment.email_date ? new Date(attachment.email_date).toISOString() : null,
          retentionPolicy: attachment.retention_policy,
          expiresAt: attachment.expires_at ? new Date(attachment.expires_at).toISOString() : null,
          createdAt: new Date(attachment.created_at).toISOString(),
          viewUrl: attachment.s3_key ? `/api/source-attachments/${attachment.id}/view` : null,
        },
      });
    },
  );

  // View/download source attachment (returns presigned URL or file in production)
  app.get(
    '/api/source-attachments/:attachmentId/view',
    async (request: FastifyRequest<{ Params: { attachmentId: string } }>, reply: FastifyReply) => {
      const { attachmentId } = request.params;
      const userId = (request as any).userId as string;

      const attachment = await db
        .selectFrom('source_attachments')
        .selectAll()
        .where('id', '=', attachmentId)
        .where('user_id', '=', userId)
        .executeTakeFirst()
        .catch(() => null);

      if (!attachment) {
        return reply.status(404).send({ statusCode: 404, error: 'Attachment not found' });
      }

      // In production, generate a presigned S3 URL via AWS SDK
      // For now, return structured response the preview component can use
      const previewUrl = attachment.s3_key
        ? `/api/source-attachments/${attachment.id}/download`
        : null;

      return reply.send({
        statusCode: 200,
        data: {
          id: attachment.id,
          s3Key: attachment.s3_key,
          mimeType: attachment.mime_type,
          sourceType: attachment.source_type,
          previewUrl,
          downloadUrl: previewUrl,
          emailHtml: null, // In production, fetch from S3 for email types
          emailSubject: attachment.email_subject,
          emailFrom: attachment.email_from,
          emailDate: attachment.email_date ? new Date(attachment.email_date).toISOString() : null,
        },
      });
    },
  );

  // POST /api/expenses/:expenseId/receipt — attach a receipt to an expense
  app.post(
    '/api/expenses/:expenseId/receipt',
    async (request: FastifyRequest<{ Params: { expenseId: string }; Body: { mimeType?: string; fileName?: string } }>, reply: FastifyReply) => {
      const { expenseId } = request.params;
      const userId = (request as any).userId as string;
      const { mimeType, fileName } = (request.body as any) ?? {};

      // Verify ownership
      const expense = await db
        .selectFrom('expenses')
        .select(['id', 'user_id'])
        .where('id', '=', expenseId)
        .executeTakeFirst();

      if (!expense || expense.user_id !== userId) {
        return reply.status(404).send({ statusCode: 404, error: 'Expense not found' });
      }

      // Create source attachment record
      const attachment = await db
        .insertInto('source_attachments')
        .values({
          user_id: userId,
          entity_type: 'expense',
          entity_id: expenseId,
          source_type: 'receipt_scan',
          mime_type: mimeType ?? 'image/jpeg',
          s3_key: `receipts/${userId}/${expenseId}/${fileName ?? 'receipt.jpg'}`,
          s3_bucket: 'nayya-attachments',
        })
        .returning(['id', 'source_type', 'mime_type', 's3_key', 'created_at'])
        .executeTakeFirstOrThrow();

      // In production, generate a presigned upload URL for S3
      const uploadUrl = `/api/source-attachments/${attachment.id}/upload`;

      return reply.status(201).send({
        statusCode: 201,
        data: {
          id: attachment.id,
          sourceType: attachment.source_type,
          mimeType: attachment.mime_type,
          uploadUrl,
          message: 'Receipt attached. In production, upload file to the presigned S3 URL.',
        },
      });
    },
  );

  // DELETE /api/source-attachments/:attachmentId — remove an attachment
  app.delete(
    '/api/source-attachments/:attachmentId',
    async (request: FastifyRequest<{ Params: { attachmentId: string } }>, reply: FastifyReply) => {
      const { attachmentId } = request.params;
      const userId = (request as any).userId as string;

      const deleted = await db
        .deleteFrom('source_attachments')
        .where('id', '=', attachmentId)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!deleted || Number(deleted.numDeletedRows) === 0) {
        return reply.status(404).send({ statusCode: 404, error: 'Attachment not found' });
      }

      return reply.send({ statusCode: 200, message: 'Attachment removed' });
    },
  );
}
