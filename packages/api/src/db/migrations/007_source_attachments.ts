import { type Kysely, sql } from 'kysely';

/**
 * Migration 007: Source Attachments
 *
 * Adds source_attachments table to link bookings/expenses to their
 * original source (email, receipt image, PDF).
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('source_attachments')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull())
    .addColumn('entity_type', 'varchar(20)', (col) => col.notNull()) // 'booking' or 'expense'
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('source_type', 'varchar(20)', (col) => col.notNull()) // email, receipt_scan, pdf, manual, forwarded
    .addColumn('s3_key', 'text') // S3 key for stored file (email HTML, image, PDF)
    .addColumn('s3_bucket', 'varchar(100)')
    .addColumn('mime_type', 'varchar(50)') // text/html, image/jpeg, application/pdf
    .addColumn('file_size', 'integer') // bytes
    .addColumn('email_provider', 'varchar(20)') // gmail, outlook, etc.
    .addColumn('email_message_id', 'text') // provider message ID for reference
    .addColumn('email_subject', 'varchar(500)')
    .addColumn('email_from', 'varchar(255)')
    .addColumn('email_date', 'timestamptz')
    .addColumn('sanitized', 'boolean', (col) => col.defaultTo(false)) // has PII been stripped?
    .addColumn('retention_policy', 'varchar(20)', (col) => col.defaultTo('account_lifetime')) // account_lifetime, 5years, 2years, 1year, 6months
    .addColumn('expires_at', 'timestamptz') // null = no expiry (account_lifetime)
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema
    .createIndex('idx_source_attachments_entity')
    .on('source_attachments')
    .columns(['entity_type', 'entity_id'])
    .execute();

  await db.schema
    .createIndex('idx_source_attachments_user')
    .on('source_attachments')
    .column('user_id')
    .execute();

  await db.schema
    .createIndex('idx_source_attachments_expires')
    .on('source_attachments')
    .column('expires_at')
    .execute();

  // Add source_type column to bookings and expenses for quick access
  await sql`ALTER TABLE bookings ADD COLUMN IF NOT EXISTS source_attachment_id UUID`.execute(db);
  await sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS source_attachment_id UUID`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('source_attachments').execute();
  await sql`ALTER TABLE bookings DROP COLUMN IF EXISTS source_attachment_id`.execute(db);
  await sql`ALTER TABLE expenses DROP COLUMN IF EXISTS source_attachment_id`.execute(db);
}
