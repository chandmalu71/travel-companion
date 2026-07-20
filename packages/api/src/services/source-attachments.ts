/**
 * Source Attachments Service
 *
 * Manages provenance tracking for bookings and expenses.
 * Stores original emails, receipt images, and PDFs in S3.
 * Performs privacy sanitization (strips PII but keeps traveller names).
 *
 * Implements Requirement 32
 */

import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SourceType = 'email' | 'receipt_scan' | 'pdf' | 'manual' | 'forwarded';
export type EntityType = 'booking' | 'expense';
export type RetentionPolicy = 'account_lifetime' | '5years' | '2years' | '1year' | '6months';

export interface SourceAttachment {
  id: string;
  entityType: EntityType;
  entityId: string;
  sourceType: SourceType;
  emailSubject?: string;
  emailFrom?: string;
  emailDate?: string;
  mimeType?: string;
  fileSize?: number;
  viewUrl?: string; // presigned URL
}

export interface StoreEmailSourceParams {
  userId: string;
  entityType: EntityType;
  entityId: string;
  emailHtml: string;
  emailSubject: string;
  emailFrom: string;
  emailDate: Date;
  emailProvider?: string;
  emailMessageId?: string;
}

export interface StoreFileSourceParams {
  userId: string;
  entityType: EntityType;
  entityId: string;
  sourceType: 'receipt_scan' | 'pdf';
  fileContent: Buffer;
  mimeType: string;
  filename: string;
}

// ─── Service ─────────────────────────────────────────────────────────────────

export class SourceAttachmentService {
  private s3: S3Client;
  private bucket: string;
  private cloudfrontDomain?: string;

  constructor(
    private readonly db: Kysely<Database>,
    bucket: string,
    region = 'eu-west-1',
    cloudfrontDomain?: string,
  ) {
    this.s3 = new S3Client({ region });
    this.bucket = bucket;
    this.cloudfrontDomain = cloudfrontDomain;
  }

  /**
   * Store an email as source attachment.
   * Sanitizes PII before storage.
   */
  async storeEmailSource(params: StoreEmailSourceParams): Promise<string> {
    const { userId, entityType, entityId, emailHtml, emailSubject, emailFrom, emailDate, emailProvider, emailMessageId } = params;

    // Sanitize the email HTML (strip PII but keep names)
    const sanitizedHtml = sanitizeEmailHtml(emailHtml);
    const buffer = Buffer.from(sanitizedHtml, 'utf-8');

    // Upload to S3
    const s3Key = `sources/${userId}/${entityType}/${entityId}/email.html`;
    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: buffer,
      ContentType: 'text/html',
    }));

    // Store metadata
    const attachment = await this.db
      .insertInto('source_attachments')
      .values({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        source_type: 'email',
        s3_key: s3Key,
        s3_bucket: this.bucket,
        mime_type: 'text/html',
        file_size: buffer.length,
        email_provider: emailProvider ?? null,
        email_message_id: emailMessageId ?? null,
        email_subject: emailSubject,
        email_from: emailFrom,
        email_date: emailDate,
        sanitized: true,
        retention_policy: 'account_lifetime',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    // Link to entity
    if (entityType === 'booking') {
      await this.db.updateTable('bookings').set({ source_attachment_id: attachment.id }).where('id', '=', entityId).execute();
    } else {
      await this.db.updateTable('expenses').set({ source_attachment_id: attachment.id }).where('id', '=', entityId).execute();
    }

    return attachment.id;
  }

  /**
   * Store a receipt image or PDF as source attachment.
   */
  async storeFileSource(params: StoreFileSourceParams): Promise<string> {
    const { userId, entityType, entityId, sourceType, fileContent, mimeType, filename } = params;

    const ext = filename.split('.').pop() ?? 'bin';
    const s3Key = `sources/${userId}/${entityType}/${entityId}/${sourceType}.${ext}`;

    await this.s3.send(new PutObjectCommand({
      Bucket: this.bucket,
      Key: s3Key,
      Body: fileContent,
      ContentType: mimeType,
    }));

    const attachment = await this.db
      .insertInto('source_attachments')
      .values({
        user_id: userId,
        entity_type: entityType,
        entity_id: entityId,
        source_type: sourceType,
        s3_key: s3Key,
        s3_bucket: this.bucket,
        mime_type: mimeType,
        file_size: fileContent.length,
        sanitized: false,
        retention_policy: 'account_lifetime',
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    if (entityType === 'booking') {
      await this.db.updateTable('bookings').set({ source_attachment_id: attachment.id }).where('id', '=', entityId).execute();
    } else {
      await this.db.updateTable('expenses').set({ source_attachment_id: attachment.id }).where('id', '=', entityId).execute();
    }

    return attachment.id;
  }

  /**
   * Get source attachment for an entity.
   */
  async getForEntity(entityType: EntityType, entityId: string): Promise<SourceAttachment | null> {
    const att = await this.db
      .selectFrom('source_attachments')
      .selectAll()
      .where('entity_type', '=', entityType)
      .where('entity_id', '=', entityId)
      .executeTakeFirst();

    if (!att) return null;

    // Generate presigned URL for viewing
    let viewUrl: string | undefined;
    if (att.s3_key) {
      if (this.cloudfrontDomain) {
        viewUrl = `https://${this.cloudfrontDomain}/${att.s3_key}`;
      } else {
        viewUrl = await getSignedUrl(
          this.s3,
          new GetObjectCommand({ Bucket: att.s3_bucket ?? this.bucket, Key: att.s3_key }),
          { expiresIn: 3600 },
        );
      }
    }

    return {
      id: att.id,
      entityType: att.entity_type as EntityType,
      entityId: att.entity_id,
      sourceType: att.source_type as SourceType,
      emailSubject: att.email_subject ?? undefined,
      emailFrom: att.email_from ?? undefined,
      emailDate: att.email_date ? new Date(att.email_date).toISOString() : undefined,
      mimeType: att.mime_type ?? undefined,
      fileSize: att.file_size ?? undefined,
      viewUrl,
    };
  }

  /**
   * Delete all source attachments for a user (GDPR account deletion).
   */
  async deleteAllForUser(userId: string): Promise<number> {
    const attachments = await this.db
      .selectFrom('source_attachments')
      .select(['id', 's3_key', 's3_bucket'])
      .where('user_id', '=', userId)
      .execute();

    // Delete from S3
    for (const att of attachments) {
      if (att.s3_key) {
        try {
          await this.s3.send(new DeleteObjectCommand({
            Bucket: att.s3_bucket ?? this.bucket,
            Key: att.s3_key,
          }));
        } catch {}
      }
    }

    // Delete from DB
    await this.db.deleteFrom('source_attachments').where('user_id', '=', userId).execute();

    return attachments.length;
  }

  /**
   * Cleanup expired attachments (run daily via cron).
   */
  async cleanupExpired(): Promise<number> {
    const now = new Date();
    const expired = await this.db
      .selectFrom('source_attachments')
      .select(['id', 's3_key', 's3_bucket'])
      .where('expires_at', '<', now)
      .execute();

    for (const att of expired) {
      if (att.s3_key) {
        try {
          await this.s3.send(new DeleteObjectCommand({
            Bucket: att.s3_bucket ?? this.bucket,
            Key: att.s3_key,
          }));
        } catch {}
      }
    }

    await this.db.deleteFrom('source_attachments').where('expires_at', '<', now).execute();
    return expired.length;
  }
}

// ─── Privacy Sanitization ────────────────────────────────────────────────────

/**
 * Sanitize email HTML by removing sensitive PII:
 * - Credit card numbers (partial or full)
 * - CVV codes
 * - Billing addresses (but keep traveller names)
 * - Full payment details
 *
 * Keeps: traveller names, dates, confirmation numbers, booking details.
 */
export function sanitizeEmailHtml(html: string): string {
  let sanitized = html;

  // Remove credit card numbers (13-19 digits, possibly with spaces/dashes)
  sanitized = sanitized.replace(/\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{1,4}\b/g, '****-****-****-****');

  // Remove CVV/CVC (3-4 digit codes near "CVV", "CVC", "security code")
  sanitized = sanitized.replace(/(CVV|CVC|security\s*code|card\s*code)\s*:?\s*\d{3,4}/gi, '$1: ***');

  // Remove expiry dates near card context (MM/YY format)
  sanitized = sanitized.replace(/(expir[ey]|exp)\s*:?\s*\d{2}\s*\/\s*\d{2,4}/gi, '$1: **/**');

  // Remove partial card numbers (last 4 shown) — but this is often useful, keep it
  // sanitized = sanitized.replace(/ending\s+in\s+\d{4}/gi, 'ending in ****');

  // Remove billing address patterns (but keep general addresses for hotel/venue)
  // Only strip if preceded by "billing" keyword
  sanitized = sanitized.replace(/billing\s*address\s*:?\s*[^<\n]{10,100}/gi, 'Billing address: [redacted]');

  // Remove bank account numbers (8+ digits)
  sanitized = sanitized.replace(/(?:account|acct)\s*(?:number|no|#)\s*:?\s*\d{8,}/gi, 'Account: [redacted]');

  // Remove routing numbers
  sanitized = sanitized.replace(/(?:routing|sort\s*code)\s*(?:number|no|#)?\s*:?\s*[\d-]{6,}/gi, 'Routing: [redacted]');

  return sanitized;
}
