import { type Kysely, sql } from 'kysely';

/**
 * Migration 010: i18n & Locale Management Tables
 *
 * Creates supported_languages, supported_currencies, and locale_configs tables
 * for admin-configurable internationalization.
 */
export async function up(db: Kysely<any>): Promise<void> {
  // Supported Languages
  await sql`CREATE TABLE IF NOT EXISTS supported_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(5) NOT NULL UNIQUE,
    name VARCHAR(50) NOT NULL,
    native_name VARCHAR(50) NOT NULL,
    enabled BOOLEAN DEFAULT FALSE,
    rtl BOOLEAN DEFAULT FALSE,
    translation_coverage INTEGER DEFAULT 0,
    auto_translated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Supported Currencies (ISO 4217 master list)
  await sql`CREATE TABLE IF NOT EXISTS supported_currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    symbol VARCHAR(5) NOT NULL,
    decimal_places INTEGER DEFAULT 2,
    enabled BOOLEAN DEFAULT FALSE,
    display_order INTEGER DEFAULT 999,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Locale Configurations (predefined bundles)
  await sql`CREATE TABLE IF NOT EXISTS locale_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    language_code VARCHAR(5) NOT NULL,
    date_format VARCHAR(20) NOT NULL,
    time_format VARCHAR(5) NOT NULL,
    number_format VARCHAR(20) NOT NULL,
    default_currency VARCHAR(3) NOT NULL,
    units VARCHAR(10) NOT NULL DEFAULT 'metric',
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )`.execute(db);

  // Update user_preferences to include locale settings
  await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS locale_code VARCHAR(10) DEFAULT 'en-GB'`.execute(db);
  await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS date_format_override VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS time_format_override VARCHAR(5)`.execute(db);
  await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS number_format_override VARCHAR(20)`.execute(db);
  await sql`ALTER TABLE user_preferences ADD COLUMN IF NOT EXISTS units VARCHAR(10) DEFAULT 'metric'`.execute(db);

  // --- Seed Languages ---
  await sql`INSERT INTO supported_languages (code, name, native_name, enabled, rtl) VALUES
    ('en', 'English', 'English', true, false),
    ('de', 'German', 'Deutsch', true, false),
    ('it', 'Italian', 'Italiano', true, false),
    ('fr', 'French', 'Français', true, false),
    ('es', 'Spanish', 'Español', true, false),
    ('pt', 'Portuguese', 'Português', true, false),
    ('sv', 'Swedish', 'Svenska', true, false),
    ('no', 'Norwegian', 'Norsk', true, false),
    ('da', 'Danish', 'Dansk', true, false),
    ('el', 'Greek', 'Ελληνικά', true, false),
    ('nl', 'Dutch', 'Nederlands', false, false),
    ('fi', 'Finnish', 'Suomi', false, false),
    ('pl', 'Polish', 'Polski', false, false),
    ('tr', 'Turkish', 'Türkçe', false, false),
    ('ja', 'Japanese', '日本語', false, false),
    ('ko', 'Korean', '한국어', false, false),
    ('zh', 'Chinese', '中文', false, false),
    ('ar', 'Arabic', 'العربية', false, true),
    ('hi', 'Hindi', 'हिन्दी', false, false),
    ('th', 'Thai', 'ไทย', false, false)
  ON CONFLICT (code) DO NOTHING`.execute(db);

  // --- Seed Currencies (top 40) ---
  await sql`INSERT INTO supported_currencies (code, name, symbol, decimal_places, enabled, display_order) VALUES
    ('USD', 'US Dollar', '$', 2, true, 1),
    ('EUR', 'Euro', '€', 2, true, 2),
    ('GBP', 'British Pound', '£', 2, true, 3),
    ('JPY', 'Japanese Yen', '¥', 0, true, 4),
    ('AUD', 'Australian Dollar', 'A$', 2, true, 5),
    ('CAD', 'Canadian Dollar', 'C$', 2, true, 6),
    ('CHF', 'Swiss Franc', 'CHF', 2, true, 7),
    ('INR', 'Indian Rupee', '₹', 2, true, 8),
    ('SGD', 'Singapore Dollar', 'S$', 2, true, 9),
    ('NZD', 'New Zealand Dollar', 'NZ$', 2, true, 10),
    ('SEK', 'Swedish Krona', 'kr', 2, true, 11),
    ('NOK', 'Norwegian Krone', 'kr', 2, true, 12),
    ('DKK', 'Danish Krone', 'kr', 2, true, 13),
    ('BRL', 'Brazilian Real', 'R$', 2, true, 14),
    ('MXN', 'Mexican Peso', 'MX$', 2, true, 15),
    ('KRW', 'South Korean Won', '₩', 0, true, 16),
    ('THB', 'Thai Baht', '฿', 2, true, 17),
    ('IDR', 'Indonesian Rupiah', 'Rp', 0, true, 18),
    ('MYR', 'Malaysian Ringgit', 'RM', 2, true, 19),
    ('PHP', 'Philippine Peso', '₱', 2, true, 20),
    ('VND', 'Vietnamese Dong', '₫', 0, false, 21),
    ('AED', 'UAE Dirham', 'د.إ', 2, true, 22),
    ('SAR', 'Saudi Riyal', '﷼', 2, false, 23),
    ('ZAR', 'South African Rand', 'R', 2, false, 24),
    ('TRY', 'Turkish Lira', '₺', 2, true, 25),
    ('PLN', 'Polish Zloty', 'zł', 2, true, 26),
    ('CZK', 'Czech Koruna', 'Kč', 2, false, 27),
    ('HUF', 'Hungarian Forint', 'Ft', 0, false, 28),
    ('RON', 'Romanian Leu', 'lei', 2, false, 29),
    ('BGN', 'Bulgarian Lev', 'лв', 2, false, 30),
    ('HRK', 'Croatian Kuna', 'kn', 2, false, 31),
    ('ISK', 'Icelandic Krona', 'kr', 0, false, 32),
    ('RUB', 'Russian Ruble', '₽', 2, false, 33),
    ('CNY', 'Chinese Yuan', '¥', 2, true, 34),
    ('HKD', 'Hong Kong Dollar', 'HK$', 2, true, 35),
    ('TWD', 'Taiwan Dollar', 'NT$', 0, false, 36),
    ('ILS', 'Israeli Shekel', '₪', 2, false, 37),
    ('EGP', 'Egyptian Pound', 'E£', 2, false, 38),
    ('NGN', 'Nigerian Naira', '₦', 2, false, 39),
    ('CLP', 'Chilean Peso', 'CL$', 0, false, 40)
  ON CONFLICT (code) DO NOTHING`.execute(db);

  // --- Seed Locale Configs ---
  await sql`INSERT INTO locale_configs (code, name, language_code, date_format, time_format, number_format, default_currency, units, enabled) VALUES
    ('en-GB', 'English (UK)', 'en', 'DD/MM/YYYY', '24h', '1,000.00', 'GBP', 'metric', true),
    ('en-US', 'English (US)', 'en', 'MM/DD/YYYY', '12h', '1,000.00', 'USD', 'imperial', true),
    ('en-AU', 'English (Australia)', 'en', 'DD/MM/YYYY', '12h', '1,000.00', 'AUD', 'metric', true),
    ('en-IN', 'English (India)', 'en', 'DD/MM/YYYY', '12h', '1,00,000.00', 'INR', 'metric', true),
    ('de-DE', 'Deutsch (Deutschland)', 'de', 'DD.MM.YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('de-CH', 'Deutsch (Schweiz)', 'de', 'DD.MM.YYYY', '24h', '1''000.00', 'CHF', 'metric', true),
    ('fr-FR', 'Français (France)', 'fr', 'DD/MM/YYYY', '24h', '1 000,00', 'EUR', 'metric', true),
    ('it-IT', 'Italiano', 'it', 'DD/MM/YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('es-ES', 'Español (España)', 'es', 'DD/MM/YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('pt-BR', 'Português (Brasil)', 'pt', 'DD/MM/YYYY', '24h', '1.000,00', 'BRL', 'metric', true),
    ('pt-PT', 'Português (Portugal)', 'pt', 'DD/MM/YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('sv-SE', 'Svenska', 'sv', 'YYYY-MM-DD', '24h', '1 000,00', 'SEK', 'metric', true),
    ('no-NO', 'Norsk', 'no', 'DD.MM.YYYY', '24h', '1 000,00', 'NOK', 'metric', true),
    ('da-DK', 'Dansk', 'da', 'DD.MM.YYYY', '24h', '1.000,00', 'DKK', 'metric', true),
    ('el-GR', 'Ελληνικά', 'el', 'DD/MM/YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('nl-NL', 'Nederlands', 'nl', 'DD-MM-YYYY', '24h', '1.000,00', 'EUR', 'metric', true),
    ('ja-JP', '日本語', 'ja', 'YYYY/MM/DD', '24h', '1,000', 'JPY', 'metric', false),
    ('ar-SA', 'العربية', 'ar', 'DD/MM/YYYY', '12h', '1,000.00', 'SAR', 'metric', false),
    ('hi-IN', 'हिन्दी', 'hi', 'DD/MM/YYYY', '12h', '1,00,000.00', 'INR', 'metric', false),
    ('th-TH', 'ไทย', 'th', 'DD/MM/YYYY', '24h', '1,000.00', 'THB', 'metric', false)
  ON CONFLICT (code) DO NOTHING`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await sql`DROP TABLE IF EXISTS locale_configs`.execute(db);
  await sql`DROP TABLE IF EXISTS supported_currencies`.execute(db);
  await sql`DROP TABLE IF EXISTS supported_languages`.execute(db);
  await sql`ALTER TABLE user_preferences DROP COLUMN IF EXISTS locale_code`.execute(db);
  await sql`ALTER TABLE user_preferences DROP COLUMN IF EXISTS date_format_override`.execute(db);
  await sql`ALTER TABLE user_preferences DROP COLUMN IF EXISTS time_format_override`.execute(db);
  await sql`ALTER TABLE user_preferences DROP COLUMN IF EXISTS number_format_override`.execute(db);
  await sql`ALTER TABLE user_preferences DROP COLUMN IF EXISTS units`.execute(db);
}
