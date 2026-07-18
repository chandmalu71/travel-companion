import type { Kysely } from 'kysely';
import { sql } from 'kysely';

export async function up(db: Kysely<unknown>): Promise<void> {
  // --- Favorites ---
  await db.schema
    .createTable('favorites')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('trip_id', 'uuid', (col) => col.references('trips.id').onDelete('set null'))
    .addColumn('name', 'varchar(200)', (col) => col.notNull())
    .addColumn('category', 'varchar(50)')
    .addColumn('place_id', 'varchar(255)')
    .addColumn('location_lat', 'decimal(9, 6)')
    .addColumn('location_lng', 'decimal(9, 6)')
    .addColumn('rating', 'decimal(2, 1)')
    .addColumn('notes', 'text')
    .addColumn('added_by', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint('favorites_notes_length', sql`char_length(notes) <= 1000`)
    .execute();

  // --- Collections ---
  await db.schema
    .createTable('collections')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('name', 'varchar(50)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Favorite Collections (junction table) ---
  await db.schema
    .createTable('favorite_collections')
    .addColumn('favorite_id', 'uuid', (col) =>
      col.notNull().references('favorites.id').onDelete('cascade'),
    )
    .addColumn('collection_id', 'uuid', (col) =>
      col.notNull().references('collections.id').onDelete('cascade'),
    )
    .execute();

  await sql`ALTER TABLE favorite_collections ADD PRIMARY KEY (favorite_id, collection_id)`.execute(
    db,
  );

  // --- Timeline Events ---
  await db.schema
    .createTable('timeline_events')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('title', 'varchar(100)', (col) => col.notNull())
    .addColumn('event_time', 'timestamptz')
    .addColumn('all_day', 'boolean', (col) => col.defaultTo(false))
    .addColumn('location', 'text')
    .addColumn('notes', 'text')
    .addColumn('event_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('reference_id', 'uuid')
    .addColumn('added_by', 'uuid', (col) => col.references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint('timeline_events_notes_length', sql`char_length(notes) <= 500`)
    .addCheckConstraint(
      'valid_event_type',
      sql`event_type IN ('booking', 'favorite', 'custom')`,
    )
    .execute();

  // --- Votes ---
  await db.schema
    .createTable('votes')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('entity_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid', (col) => col.notNull())
    .addColumn('vote_value', 'int2', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_entity_type',
      sql`entity_type IN ('favorite', 'timeline_event')`,
    )
    .addCheckConstraint('valid_vote_value', sql`vote_value IN (-1, 1)`)
    .addUniqueConstraint('votes_user_entity_unique', ['user_id', 'entity_type', 'entity_id'])
    .execute();

  // --- Expenses ---
  await db.schema
    .createTable('expenses')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('trip_id', 'uuid', (col) => col.references('trips.id').onDelete('set null'))
    .addColumn('booking_id', 'uuid', (col) => col.references('bookings.id').onDelete('set null'))
    .addColumn('amount', 'decimal(12, 2)', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('converted_amount', 'decimal(12, 2)')
    .addColumn('converted_currency', 'varchar(3)')
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('category', 'varchar(30)', (col) => col.notNull())
    .addColumn('merchant_name', 'varchar(200)')
    .addColumn('notes', 'text')
    .addColumn('receipt_document_id', 'uuid')
    .addColumn('is_shared', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_expense_amount',
      sql`amount >= 0.01 AND amount <= 999999999.99`,
    )
    .addCheckConstraint('expenses_notes_length', sql`char_length(notes) <= 500`)
    .addCheckConstraint(
      'valid_expense_category',
      sql`category IN ('accommodation', 'transportation', 'food_dining', 'shopping', 'tours_activities', 'entertainment', 'other')`,
    )
    .execute();

  // --- Expense Groups ---
  await db.schema
    .createTable('expense_groups')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('created_by', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Group Members ---
  await db.schema
    .createTable('group_members')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('group_id', 'uuid', (col) =>
      col.notNull().references('expense_groups.id').onDelete('cascade'),
    )
    .addColumn('user_id', 'uuid', (col) => col.references('users.id').onDelete('set null'))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('email', 'varchar(255)')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Expense Splits ---
  await db.schema
    .createTable('expense_splits')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('expense_id', 'uuid', (col) =>
      col.notNull().references('expenses.id').onDelete('cascade'),
    )
    .addColumn('group_id', 'uuid', (col) =>
      col.notNull().references('expense_groups.id').onDelete('cascade'),
    )
    .addColumn('split_type', 'varchar(20)', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_split_type',
      sql`split_type IN ('equal', 'percentage', 'per_item')`,
    )
    .execute();

  // --- Settlements ---
  await db.schema
    .createTable('settlements')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('group_id', 'uuid', (col) =>
      col.notNull().references('expense_groups.id').onDelete('cascade'),
    )
    .addColumn('from_member_id', 'uuid', (col) =>
      col.notNull().references('group_members.id'),
    )
    .addColumn('to_member_id', 'uuid', (col) =>
      col.notNull().references('group_members.id'),
    )
    .addColumn('amount', 'decimal(12, 2)', (col) => col.notNull())
    .addColumn('currency', 'varchar(3)', (col) => col.notNull())
    .addColumn('settled', 'boolean', (col) => col.defaultTo(false))
    .addColumn('settled_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Documents ---
  await db.schema
    .createTable('documents')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('trip_id', 'uuid', (col) => col.references('trips.id').onDelete('set null'))
    .addColumn('booking_id', 'uuid', (col) => col.references('bookings.id').onDelete('set null'))
    .addColumn('category', 'varchar(20)', (col) => col.notNull())
    .addColumn('file_name', 'varchar(255)', (col) => col.notNull())
    .addColumn('file_size', 'integer', (col) => col.notNull())
    .addColumn('mime_type', 'varchar(100)', (col) => col.notNull())
    .addColumn('s3_key', 'text', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_document_category',
      sql`category IN ('boarding_pass', 'confirmation', 'voucher', 'visa', 'insurance')`,
    )
    .execute();

  // --- Scheduled Notifications ---
  await db.schema
    .createTable('scheduled_notifications')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('booking_id', 'uuid', (col) => col.references('bookings.id').onDelete('cascade'))
    .addColumn('type', 'varchar(30)', (col) => col.notNull())
    .addColumn('fire_at', 'timestamptz', (col) => col.notNull())
    .addColumn('payload', 'jsonb', (col) => col.notNull().defaultTo(sql`'{}'`))
    .addColumn('delivered', 'boolean', (col) => col.defaultTo(false))
    .addColumn('delivered_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Notification Preferences ---
  await db.schema
    .createTable('notification_preferences')
    .addColumn('user_id', 'uuid', (col) =>
      col.primaryKey().references('users.id').onDelete('cascade'),
    )
    .addColumn('flight_reminder_offset', 'integer', (col) => col.defaultTo(1440))
    .addColumn('hotel_reminder_time', 'varchar(5)', (col) => col.defaultTo('08:00'))
    .addColumn('car_reminder_offset', 'integer', (col) => col.defaultTo(120))
    .addColumn('push_enabled', 'boolean', (col) => col.defaultTo(true))
    .addColumn('email_enabled', 'boolean', (col) => col.defaultTo(true))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Gap Alerts ---
  await db.schema
    .createTable('gap_alerts')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('type', 'varchar(30)', (col) => col.notNull())
    .addColumn('date', 'date', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('suggested_action', 'text')
    .addColumn('dismissed', 'boolean', (col) => col.defaultTo(false))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_gap_type',
      sql`type IN ('missing_accommodation', 'missing_transportation', 'scheduling_conflict')`,
    )
    .execute();

  // --- Activity Feed ---
  await db.schema
    .createTable('activity_feed')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('action', 'varchar(50)', (col) => col.notNull())
    .addColumn('entity_type', 'varchar(30)', (col) => col.notNull())
    .addColumn('entity_id', 'uuid')
    .addColumn('metadata', 'jsonb', (col) => col.defaultTo(sql`'{}'`))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Share Links ---
  await db.schema
    .createTable('share_links')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('token', 'varchar(64)', (col) => col.unique().notNull())
    .addColumn('expires_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_by', 'uuid', (col) => col.notNull().references('users.id'))
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .execute();

  // --- Highlights (Social Sharing) ---
  await db.schema
    .createTable('highlights')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('trip_id', 'uuid', (col) => col.notNull().references('trips.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('caption', 'text')
    .addColumn('layout', 'varchar(20)', (col) => col.notNull())
    .addColumn('photo_ids', sql`TEXT[]`, (col) => col.defaultTo(sql`'{}'`))
    .addColumn('tag_trip_name', 'boolean', (col) => col.defaultTo(true))
    .addColumn('tag_destinations', 'boolean', (col) => col.defaultTo(true))
    .addColumn('include_stats', 'boolean', (col) => col.defaultTo(false))
    .addColumn('is_draft', 'boolean', (col) => col.defaultTo(true))
    .addColumn('shared_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint(
      'valid_highlight_layout',
      sql`layout IN ('single', 'carousel', 'collage')`,
    )
    .addCheckConstraint('highlights_caption_length', sql`char_length(caption) <= 500`)
    .execute();

  // --- Email Connections ---
  await db.schema
    .createTable('email_connections')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('provider', 'varchar(20)', (col) => col.notNull())
    .addColumn('email_address', 'varchar(255)', (col) => col.notNull())
    .addColumn('access_token_encrypted', 'text', (col) => col.notNull())
    .addColumn('refresh_token_encrypted', 'text', (col) => col.notNull())
    .addColumn('token_expires_at', 'timestamptz')
    .addColumn('last_sync_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.defaultTo(sql`NOW()`))
    .addCheckConstraint('valid_email_provider', sql`provider IN ('gmail', 'outlook')`)
    .addUniqueConstraint('email_connections_user_provider_unique', ['user_id', 'provider'])
    .execute();

  // --- Supporting Indexes ---

  // Favorites indexes
  await db.schema.createIndex('idx_favorites_user_id').on('favorites').column('user_id').execute();
  await db.schema.createIndex('idx_favorites_trip_id').on('favorites').column('trip_id').execute();

  // Timeline events indexes
  await db.schema
    .createIndex('idx_timeline_events_trip_time')
    .on('timeline_events')
    .columns(['trip_id', 'event_time'])
    .execute();

  // Votes indexes
  await db.schema
    .createIndex('idx_votes_entity')
    .on('votes')
    .columns(['entity_type', 'entity_id'])
    .execute();

  // Expenses indexes
  await db.schema.createIndex('idx_expenses_user_id').on('expenses').column('user_id').execute();
  await db.schema.createIndex('idx_expenses_trip_id').on('expenses').column('trip_id').execute();
  await db.schema.createIndex('idx_expenses_date').on('expenses').column('date').execute();

  // Expense splits indexes
  await db.schema
    .createIndex('idx_expense_splits_expense_id')
    .on('expense_splits')
    .column('expense_id')
    .execute();

  // Group members indexes
  await db.schema
    .createIndex('idx_group_members_group_id')
    .on('group_members')
    .column('group_id')
    .execute();

  // Documents indexes
  await db.schema.createIndex('idx_documents_trip_id').on('documents').column('trip_id').execute();
  await db.schema
    .createIndex('idx_documents_booking_id')
    .on('documents')
    .column('booking_id')
    .execute();

  // Scheduled notifications indexes
  await db.schema
    .createIndex('idx_scheduled_notifications_fire_at')
    .on('scheduled_notifications')
    .columns(['fire_at', 'delivered'])
    .execute();

  // Gap alerts indexes
  await db.schema
    .createIndex('idx_gap_alerts_trip_id')
    .on('gap_alerts')
    .column('trip_id')
    .execute();

  // Activity feed indexes
  await db.schema
    .createIndex('idx_activity_feed_trip_created')
    .on('activity_feed')
    .columns(['trip_id', 'created_at'])
    .execute();

  // Highlights indexes
  await db.schema
    .createIndex('idx_highlights_trip_id')
    .on('highlights')
    .column('trip_id')
    .execute();

  // Email connections indexes
  await db.schema
    .createIndex('idx_email_connections_user_id')
    .on('email_connections')
    .column('user_id')
    .execute();
}

export async function down(db: Kysely<unknown>): Promise<void> {
  // Drop indexes first
  await db.schema.dropIndex('idx_email_connections_user_id').execute();
  await db.schema.dropIndex('idx_highlights_trip_id').execute();
  await db.schema.dropIndex('idx_activity_feed_trip_created').execute();
  await db.schema.dropIndex('idx_gap_alerts_trip_id').execute();
  await db.schema.dropIndex('idx_scheduled_notifications_fire_at').execute();
  await db.schema.dropIndex('idx_documents_booking_id').execute();
  await db.schema.dropIndex('idx_documents_trip_id').execute();
  await db.schema.dropIndex('idx_group_members_group_id').execute();
  await db.schema.dropIndex('idx_expense_splits_expense_id').execute();
  await db.schema.dropIndex('idx_expenses_date').execute();
  await db.schema.dropIndex('idx_expenses_trip_id').execute();
  await db.schema.dropIndex('idx_expenses_user_id').execute();
  await db.schema.dropIndex('idx_votes_entity').execute();
  await db.schema.dropIndex('idx_timeline_events_trip_time').execute();
  await db.schema.dropIndex('idx_favorites_trip_id').execute();
  await db.schema.dropIndex('idx_favorites_user_id').execute();

  // Drop tables in reverse dependency order
  await db.schema.dropTable('email_connections').execute();
  await db.schema.dropTable('highlights').execute();
  await db.schema.dropTable('share_links').execute();
  await db.schema.dropTable('activity_feed').execute();
  await db.schema.dropTable('gap_alerts').execute();
  await db.schema.dropTable('notification_preferences').execute();
  await db.schema.dropTable('scheduled_notifications').execute();
  await db.schema.dropTable('documents').execute();
  await db.schema.dropTable('settlements').execute();
  await db.schema.dropTable('expense_splits').execute();
  await db.schema.dropTable('group_members').execute();
  await db.schema.dropTable('expense_groups').execute();
  await db.schema.dropTable('expenses').execute();
  await db.schema.dropTable('votes').execute();
  await db.schema.dropTable('timeline_events').execute();
  await db.schema.dropTable('favorite_collections').execute();
  await db.schema.dropTable('collections').execute();
  await db.schema.dropTable('favorites').execute();
}
