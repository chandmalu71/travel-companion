import { type Kysely, sql } from 'kysely';

/**
 * Migration 021: Add first_name and last_name to users table
 *
 * Allows users to set their name separately (First + Last) in profile settings.
 * display_name is kept for backward compatibility and display purposes.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users')
    .addColumn('first_name', 'varchar(100)')
    .execute();

  await db.schema.alterTable('users')
    .addColumn('last_name', 'varchar(100)')
    .execute();

  // Backfill: split existing display_name into first/last
  await sql`
    UPDATE users 
    SET first_name = split_part(display_name, ' ', 1),
        last_name = CASE 
          WHEN position(' ' in display_name) > 0 
          THEN substring(display_name from position(' ' in display_name) + 1)
          ELSE NULL 
        END
    WHERE first_name IS NULL
  `.execute(db);

  // Also add translation keys for profile fields
  const profileKeys = [
    { key: 'settings.profile.first_name', namespace: 'settings', english_text: 'First Name' },
    { key: 'settings.profile.last_name', namespace: 'settings', english_text: 'Last Name' },
    { key: 'settings.profile.display_name', namespace: 'settings', english_text: 'Display Name' },
    { key: 'settings.profile.save_changes', namespace: 'settings', english_text: 'Save Changes' },
    { key: 'settings.profile.photo', namespace: 'settings', english_text: 'Profile Photo' },
    { key: 'settings.profile.email_verified', namespace: 'settings', english_text: 'Email Verified' },
    { key: 'settings.profile.member_since', namespace: 'settings', english_text: 'Member Since' },
  ];

  for (const k of profileKeys) {
    await db.insertInto('translation_keys').values(k)
      .onConflict((oc) => oc.column('key').doNothing()).execute();
  }
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('users').dropColumn('first_name').execute();
  await db.schema.alterTable('users').dropColumn('last_name').execute();
}
