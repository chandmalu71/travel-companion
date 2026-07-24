import { type Kysely, sql } from 'kysely';

/**
 * Migration 027: User Consent Columns
 *
 * Adds marketing_consent and terms_accepted_at to the users table.
 * These are the authoritative source for registered users' consent status.
 * - marketing_consent: whether user agreed to receive marketing emails (set at registration, toggleable in Settings)
 * - terms_accepted_at: when user accepted Terms of Service (set at registration)
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('users')
    .addColumn('marketing_consent', 'boolean', (col) => col.defaultTo(false))
    .execute();

  await db.schema
    .alterTable('users')
    .addColumn('terms_accepted_at', 'timestamptz')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('marketing_consent').execute();
  await db.schema.alterTable('users').dropColumn('terms_accepted_at').execute();
}
