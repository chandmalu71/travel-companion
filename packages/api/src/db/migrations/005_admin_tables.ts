import { type Kysely, sql } from 'kysely';

/**
 * Migration 005: Admin Panel Tables
 *
 * Adds: audit_log table, user suspension fields, admin role field
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Audit log table
  await db.schema
    .createTable('audit_log')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('admin_id', 'text', (col) => col.notNull())
    .addColumn('action', 'varchar(50)', (col) => col.notNull())
    .addColumn('target', 'text', (col) => col.notNull())
    .addColumn('details', 'text')
    .addColumn('ip_address', 'varchar(45)')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.createIndex('idx_audit_log_created_at').on('audit_log').column('created_at').execute();
  await db.schema.createIndex('idx_audit_log_action').on('audit_log').column('action').execute();

  // Add user suspension and admin fields
  await db.schema.alterTable('users').addColumn('suspended', 'boolean', (col) => col.defaultTo(false)).execute();
  await db.schema.alterTable('users').addColumn('suspended_reason', 'text').execute();
  await db.schema.alterTable('users').addColumn('admin_role', 'varchar(20)').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('audit_log').execute();
  await db.schema.alterTable('users').dropColumn('suspended').execute();
  await db.schema.alterTable('users').dropColumn('suspended_reason').execute();
  await db.schema.alterTable('users').dropColumn('admin_role').execute();
}
