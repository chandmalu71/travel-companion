import { type Kysely, sql } from 'kysely';

/**
 * Migration 019: Subscription Plans & User Subscriptions
 *
 * Creates the subscription system tables for the freemium model.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Subscription plans (Free, Pro, Premium)
  await db.schema
    .createTable('subscription_plans')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(50)', (col) => col.notNull())
    .addColumn('slug', 'varchar(30)', (col) => col.notNull().unique())
    .addColumn('tier', 'integer', (col) => col.notNull().defaultTo(0))
    .addColumn('price_monthly_eur', 'decimal(10, 2)')
    .addColumn('price_annual_eur', 'decimal(10, 2)')
    .addColumn('features', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .addColumn('max_active_trips', 'integer', (col) => col.defaultTo(2))
    .addColumn('max_bookings', 'integer', (col) => col.defaultTo(10))
    .addColumn('max_expenses_per_month', 'integer', (col) => col.defaultTo(20))
    .addColumn('max_ai_tips_per_trip', 'integer', (col) => col.defaultTo(3))
    .addColumn('max_ai_chat_per_day', 'integer', (col) => col.defaultTo(5))
    .addColumn('max_email_connections', 'integer', (col) => col.defaultTo(1))
    .addColumn('max_network_connections', 'integer', (col) => col.defaultTo(5))
    .addColumn('max_family_members', 'integer', (col) => col.defaultTo(0))
    .addColumn('max_storage_mb', 'integer', (col) => col.defaultTo(100))
    .addColumn('max_messages_per_day', 'integer', (col) => col.defaultTo(20))
    .addColumn('max_email_aliases', 'integer', (col) => col.defaultTo(1))
    .addColumn('weather_days', 'integer', (col) => col.defaultTo(3))
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
    .addColumn('stripe_price_id_monthly', 'text')
    .addColumn('stripe_price_id_annual', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // User subscriptions
  await db.schema
    .createTable('user_subscriptions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('user_id', 'uuid', (col) => col.notNull().references('users.id').onDelete('cascade'))
    .addColumn('plan_id', 'uuid', (col) => col.notNull())
    .addColumn('status', 'varchar(20)', (col) => col.notNull().defaultTo('active'))
    .addColumn('billing_cycle', 'varchar(10)', (col) => col.defaultTo('monthly'))
    .addColumn('is_family_plan', 'boolean', (col) => col.defaultTo(false))
    .addColumn('trial_ends_at', 'timestamptz')
    .addColumn('current_period_start', 'timestamptz')
    .addColumn('current_period_end', 'timestamptz')
    .addColumn('cancel_at_period_end', 'boolean', (col) => col.defaultTo(false))
    .addColumn('auto_renew', 'boolean', (col) => col.defaultTo(true))
    .addColumn('stripe_customer_id', 'text')
    .addColumn('stripe_subscription_id', 'text')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .addColumn('updated_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  await db.schema.createIndex('idx_user_subscriptions_user_id').on('user_subscriptions').column('user_id').execute();

  // Subscription promotions
  await db.schema
    .createTable('subscription_promotions')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('discount_percent', 'integer', (col) => col.notNull())
    .addColumn('applicable_plans', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .addColumn('is_active', 'boolean', (col) => col.defaultTo(true))
    .addColumn('starts_at', 'timestamptz', (col) => col.notNull())
    .addColumn('ends_at', 'timestamptz', (col) => col.notNull())
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Subscription campaigns (discount codes)
  await db.schema
    .createTable('subscription_campaigns')
    .addColumn('id', 'uuid', (col) => col.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn('code', 'varchar(30)', (col) => col.notNull().unique())
    .addColumn('name', 'varchar(100)', (col) => col.notNull())
    .addColumn('discount_percent', 'integer', (col) => col.notNull())
    .addColumn('discount_months', 'integer', (col) => col.defaultTo(1))
    .addColumn('applicable_plans', 'jsonb', (col) => col.defaultTo(sql`'[]'::jsonb`))
    .addColumn('max_uses', 'integer')
    .addColumn('current_uses', 'integer', (col) => col.defaultTo(0))
    .addColumn('valid_until', 'timestamptz')
    .addColumn('created_at', 'timestamptz', (col) => col.notNull().defaultTo(sql`NOW()`))
    .execute();

  // Seed default plans
  await sql`
    INSERT INTO subscription_plans (name, slug, tier, price_monthly_eur, price_annual_eur, max_active_trips, max_bookings, max_expenses_per_month, max_ai_tips_per_trip, max_ai_chat_per_day, max_email_connections, max_network_connections, max_family_members, max_storage_mb, max_messages_per_day, max_email_aliases, weather_days, features) VALUES
    ('Free', 'free', 0, 0, 0, 2, 10, 20, 3, 5, 1, 5, 0, 100, 20, 1, 3, '["basic_trips", "basic_bookings", "basic_expenses"]'),
    ('Pro', 'pro', 1, 14.99, 149.99, 10, 100, 200, 10, 20, 3, 25, 3, 1000, 100, 3, 7, '["basic_trips", "basic_bookings", "basic_expenses", "ai_tips", "email_scanning", "family_sharing", "weather_extended"]'),
    ('Premium', 'premium', 2, 29.99, 299.99, -1, -1, -1, -1, -1, 10, -1, 10, 10000, -1, 10, 14, '["basic_trips", "basic_bookings", "basic_expenses", "ai_tips", "ai_chat", "email_scanning", "family_sharing", "weather_extended", "priority_support", "advanced_analytics", "unlimited_storage"]')
  `.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('subscription_campaigns').ifExists().execute();
  await db.schema.dropTable('subscription_promotions').ifExists().execute();
  await db.schema.dropTable('user_subscriptions').ifExists().execute();
  await db.schema.dropTable('subscription_plans').ifExists().execute();
}
