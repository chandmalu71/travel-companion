import { type Kysely, sql } from 'kysely';

/**
 * Migration 016: Family Members
 *
 * Permanently linked family profiles with two modes:
 * - Connected: has own Nayya account (spouse/partner enforced)
 * - Managed: no account (children, elderly) — user maintains their details
 *
 * Stores: name, relationship, DOB, dietary, allergies, passport (encrypted),
 * travel preferences (seat, meal), and preference sharing settings.
 *
 * Passport/ID data is encrypted at application level before storage.
 */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('family_members')
    .addColumn('id', 'uuid', (col) =>
      col.primaryKey().defaultTo(sql`gen_random_uuid()`),
    )
    .addColumn('user_id', 'uuid', (col) => col.notNull()) // owner of this family member record
    .addColumn('linked_user_id', 'uuid', (col) => col.references('users.id').onDelete('set null')) // if connected mode
    .addColumn('mode', 'varchar(20)', (col) => col.notNull().defaultTo('managed')) // 'managed' | 'connected'
    .addColumn('relationship', 'varchar(30)', (col) => col.notNull()) // spouse, partner, child, parent, sibling, grandparent, other
    .addColumn('first_name', 'varchar(100)', (col) => col.notNull())
    .addColumn('last_name', 'varchar(100)')
    .addColumn('date_of_birth', 'date')
    .addColumn('gender', 'varchar(20)') // male, female, non-binary, prefer_not_to_say
    // Preferences (stored as arrays for managed members)
    .addColumn('dietary_preferences', sql`text[]`, (col) => col.defaultTo(sql`'{}'::text[]`))
    .addColumn('allergies', sql`text[]`, (col) => col.defaultTo(sql`'{}'::text[]`))
    // Travel preferences
    .addColumn('seat_preference', 'varchar(20)') // window, aisle, middle, no_preference
    .addColumn('meal_preference', 'varchar(50)') // vegetarian, vegan, halal, kosher, standard, child_meal, etc.
    .addColumn('cabin_class_preference', 'varchar(20)') // economy, premium_economy, business, first
    // Passport/ID (encrypted at app level — stored as encrypted text)
    .addColumn('passport_name', 'text') // encrypted: full name as on passport
    .addColumn('passport_number', 'text') // encrypted: passport number
    .addColumn('passport_nationality', 'varchar(3)') // ISO country code (not sensitive)
    .addColumn('passport_expiry', 'text') // encrypted: expiry date
    .addColumn('passport_issuing_country', 'varchar(3)') // ISO country code
    .addColumn('has_passport_stored', 'boolean', (col) => col.defaultTo(false))
    // Preference sharing settings
    .addColumn('sharing_scope', 'varchar(20)', (col) => col.defaultTo('this_trip')) // 'this_trip' | 'all_trips' | 'none'
    .addColumn('share_dietary', 'boolean', (col) => col.defaultTo(true))
    .addColumn('share_allergies', 'boolean', (col) => col.defaultTo(true))
    .addColumn('share_travel_prefs', 'boolean', (col) => col.defaultTo(false))
    // Metadata
    .addColumn('notes', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`now()`))
    .execute();

  // Index for quick lookup by owner
  await db.schema
    .createIndex('idx_family_members_user')
    .on('family_members')
    .column('user_id')
    .execute();

  // Index for linked account lookup
  await db.schema
    .createIndex('idx_family_members_linked')
    .on('family_members')
    .column('linked_user_id')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('family_members').execute();
}
