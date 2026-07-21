import { type Kysely, sql } from 'kysely';

/**
 * Migration 014: Admin-Managed Preference Options
 *
 * Moves interests, dietary preferences, and allergies from hardcoded
 * arrays to admin-configurable database tables.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Supported Interests
  await sql`CREATE TABLE IF NOT EXISTS supported_interests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Supported Dietary Preferences
  await sql`CREATE TABLE IF NOT EXISTS supported_dietary (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Supported Allergies
  await sql`CREATE TABLE IF NOT EXISTS supported_allergies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10),
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Seed interests
  await sql`INSERT INTO supported_interests (key, name, icon, display_order) VALUES
    ('adventure', 'Adventure', '🏔️', 1),
    ('arts_culture', 'Arts & Culture', '🎨', 2),
    ('beaches', 'Beaches', '🏖️', 3),
    ('food_drink', 'Food & Drink', '🍕', 4),
    ('history', 'History', '🏛️', 5),
    ('nature', 'Nature', '🌿', 6),
    ('nightlife', 'Nightlife', '🌃', 7),
    ('photography', 'Photography', '📷', 8),
    ('relaxation', 'Relaxation', '🧘', 9),
    ('shopping', 'Shopping', '🛍️', 10),
    ('sports', 'Sports', '⚽', 11),
    ('wellness', 'Wellness', '💆', 12),
    ('architecture', 'Architecture', '🏗️', 13),
    ('music', 'Music', '🎵', 14),
    ('wildlife', 'Wildlife', '🦁', 15)
  ON CONFLICT (key) DO NOTHING`.execute(db);

  // Seed dietary preferences
  await sql`INSERT INTO supported_dietary (key, name, icon, display_order) VALUES
    ('vegetarian', 'Vegetarian', '🥬', 1),
    ('vegan', 'Vegan', '🌱', 2),
    ('pescatarian', 'Pescatarian', '🐟', 3),
    ('gluten_free', 'Gluten Free', '🌾', 4),
    ('dairy_free', 'Dairy Free', '🥛', 5),
    ('halal', 'Halal', '☪️', 6),
    ('kosher', 'Kosher', '✡️', 7),
    ('nut_free', 'Nut Free', '🥜', 8),
    ('low_carb', 'Low Carb', '🍞', 9),
    ('keto', 'Keto', '🥑', 10),
    ('lacto_vegetarian', 'Lacto-Vegetarian', '🧀', 11),
    ('jain', 'Jain', '☸️', 12),
    ('none', 'No Restrictions', '✅', 13)
  ON CONFLICT (key) DO NOTHING`.execute(db);

  // Seed allergies
  await sql`INSERT INTO supported_allergies (key, name, icon, display_order) VALUES
    ('peanuts', 'Peanuts', '🥜', 1),
    ('tree_nuts', 'Tree Nuts', '🌰', 2),
    ('shellfish', 'Shellfish', '🦐', 3),
    ('fish', 'Fish', '🐟', 4),
    ('eggs', 'Eggs', '🥚', 5),
    ('dairy', 'Milk/Dairy', '🥛', 6),
    ('soy', 'Soy', '🫘', 7),
    ('wheat', 'Wheat', '🌾', 8),
    ('sesame', 'Sesame', '⚪', 9),
    ('sulfites', 'Sulfites', '🍷', 10),
    ('gluten', 'Gluten', '🍞', 11),
    ('mustard', 'Mustard', '🟡', 12),
    ('celery', 'Celery', '🥬', 13),
    ('lupin', 'Lupin', '🌻', 14)
  ON CONFLICT (key) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS supported_allergies`.execute(db);
  await sql`DROP TABLE IF EXISTS supported_dietary`.execute(db);
  await sql`DROP TABLE IF EXISTS supported_interests`.execute(db);
}
