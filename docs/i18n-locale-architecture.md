# Internationalization & Locale Management

## Overview

Neyya supports multiple languages, currencies, and locale-specific formatting. The system is admin-configurable (which languages/currencies/locales are available) and user-selectable (each user picks their preferences).

## Supported Languages (Initial)

| Code | Language | Native Name | Script |
|------|----------|-------------|--------|
| en | English | English | Latin |
| de | German | Deutsch | Latin |
| it | Italian | Italiano | Latin |
| fr | French | Français | Latin |
| es | Spanish | Español | Latin |
| pt | Portuguese | Português | Latin |
| sv | Swedish | Svenska | Latin |
| no | Norwegian | Norsk | Latin |
| da | Danish | Dansk | Latin |
| el | Greek | Ελληνικά | Greek |
| nl | Dutch | Nederlands | Latin |
| fi | Finnish | Suomi | Latin |
| pl | Polish | Polski | Latin |
| tr | Turkish | Türkçe | Latin |
| ja | Japanese | 日本語 | CJK |
| ko | Korean | 한국어 | Hangul |
| zh | Chinese (Simplified) | 中文 | CJK |
| ar | Arabic | العربية | Arabic (RTL) |
| hi | Hindi | हिन्दी | Devanagari |
| th | Thai | ไทย | Thai |

## Locale Configuration

Each locale bundle defines formatting rules:

| Setting | Options |
|---------|---------|
| **Display language** | Any enabled language |
| **Date format** | `DD/MM/YYYY`, `MM/DD/YYYY`, `YYYY-MM-DD`, `DD.MM.YYYY` |
| **Time format** | `24h`, `12h` |
| **Number notation** | `1,000.00` (English), `1.000,00` (European), `1 000,00` (French) |
| **Default currency** | Any enabled currency |
| **Units** | `metric`, `imperial` |

### Predefined Locale Bundles

| Code | Name | Language | Date | Time | Numbers | Currency | Units |
|------|------|----------|------|------|---------|----------|-------|
| en-GB | English (UK) | en | DD/MM/YYYY | 24h | 1,000.00 | GBP | metric |
| en-US | English (US) | en | MM/DD/YYYY | 12h | 1,000.00 | USD | imperial |
| en-AU | English (AU) | en | DD/MM/YYYY | 12h | 1,000.00 | AUD | metric |
| en-IN | English (India) | en | DD/MM/YYYY | 12h | 1,00,000.00 | INR | metric |
| de-DE | Deutsch | de | DD.MM.YYYY | 24h | 1.000,00 | EUR | metric |
| de-CH | Deutsch (Schweiz) | de | DD.MM.YYYY | 24h | 1'000.00 | CHF | metric |
| fr-FR | Français | fr | DD/MM/YYYY | 24h | 1 000,00 | EUR | metric |
| it-IT | Italiano | it | DD/MM/YYYY | 24h | 1.000,00 | EUR | metric |
| es-ES | Español | es | DD/MM/YYYY | 24h | 1.000,00 | EUR | metric |
| pt-BR | Português (BR) | pt | DD/MM/YYYY | 24h | 1.000,00 | BRL | metric |
| pt-PT | Português (PT) | pt | DD/MM/YYYY | 24h | 1.000,00 | EUR | metric |
| sv-SE | Svenska | sv | YYYY-MM-DD | 24h | 1 000,00 | SEK | metric |
| no-NO | Norsk | no | DD.MM.YYYY | 24h | 1 000,00 | NOK | metric |
| da-DK | Dansk | da | DD.MM.YYYY | 24h | 1.000,00 | DKK | metric |
| el-GR | Ελληνικά | el | DD/MM/YYYY | 24h | 1.000,00 | EUR | metric |
| nl-NL | Nederlands | nl | DD-MM-YYYY | 24h | 1.000,00 | EUR | metric |
| ja-JP | 日本語 | ja | YYYY/MM/DD | 24h | 1,000 | JPY | metric |
| ar-SA | العربية | ar | DD/MM/YYYY | 12h | 1,000.00 | SAR | metric |
| hi-IN | हिन्दी | hi | DD/MM/YYYY | 12h | 1,00,000.00 | INR | metric |
| th-TH | ไทย | th | DD/MM/YYYY | 24h | 1,000.00 | THB | metric |

## Currencies (Master List)

Full ISO 4217 list (~160 currencies). Admin enables/disables which ones are available to users. Initial enabled set:

USD, EUR, GBP, JPY, AUD, CAD, CHF, INR, SGD, NZD, SEK, NOK, DKK, BRL, MXN, KRW, THB, IDR, MYR, PHP, VND, AED, SAR, ZAR, TRY, PLN, CZK, HUF, RON, BGN, HRK, ISK, RUB, CNY, HKD, TWD

---

## Database Schema

### `supported_languages`

```sql
CREATE TABLE supported_languages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(5) NOT NULL UNIQUE,        -- 'en', 'de', 'fr'
    name VARCHAR(50) NOT NULL,              -- 'English', 'German'
    native_name VARCHAR(50) NOT NULL,       -- 'English', 'Deutsch'
    enabled BOOLEAN DEFAULT FALSE,
    rtl BOOLEAN DEFAULT FALSE,              -- right-to-left
    translation_coverage INTEGER DEFAULT 0, -- percentage of keys translated
    auto_translated BOOLEAN DEFAULT FALSE,  -- has AI translation been run?
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `supported_currencies`

```sql
CREATE TABLE supported_currencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(3) NOT NULL UNIQUE,        -- 'USD', 'EUR'
    name VARCHAR(100) NOT NULL,             -- 'US Dollar'
    symbol VARCHAR(5) NOT NULL,             -- '$', '€'
    decimal_places INTEGER DEFAULT 2,       -- 0 for JPY, 2 for most
    enabled BOOLEAN DEFAULT TRUE,
    display_order INTEGER DEFAULT 999,      -- for sorting in dropdowns
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `locale_configs`

```sql
CREATE TABLE locale_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(10) NOT NULL UNIQUE,       -- 'en-GB', 'de-DE'
    name VARCHAR(100) NOT NULL,             -- 'English (UK)'
    language_code VARCHAR(5) NOT NULL REFERENCES supported_languages(code),
    date_format VARCHAR(20) NOT NULL,       -- 'DD/MM/YYYY'
    time_format VARCHAR(5) NOT NULL,        -- '24h' or '12h'
    number_format VARCHAR(20) NOT NULL,     -- '1,000.00' pattern
    default_currency VARCHAR(3) NOT NULL,   -- 'GBP'
    units VARCHAR(10) NOT NULL DEFAULT 'metric', -- 'metric' or 'imperial'
    enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `translation_keys`

```sql
CREATE TABLE translation_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(200) NOT NULL UNIQUE,       -- 'nav.trips', 'expense.add_title'
    namespace VARCHAR(50) NOT NULL,         -- 'common', 'trips', 'expenses'
    english_text TEXT NOT NULL,             -- 'My Trips'
    context TEXT,                           -- hint for translators
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### `translations`

```sql
CREATE TABLE translations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key_id UUID NOT NULL REFERENCES translation_keys(id) ON DELETE CASCADE,
    language_code VARCHAR(5) NOT NULL,
    text TEXT NOT NULL,
    is_auto BOOLEAN DEFAULT FALSE,          -- true if AI-generated
    is_reviewed BOOLEAN DEFAULT FALSE,      -- true if human-reviewed
    last_edited_by UUID REFERENCES users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (key_id, language_code)
);
```

### User preferences (update existing `user_preferences` table)

```sql
ALTER TABLE user_preferences ADD COLUMN locale_code VARCHAR(10) DEFAULT 'en-GB';
ALTER TABLE user_preferences ADD COLUMN date_format_override VARCHAR(20);
ALTER TABLE user_preferences ADD COLUMN time_format_override VARCHAR(5);
ALTER TABLE user_preferences ADD COLUMN number_format_override VARCHAR(20);
ALTER TABLE user_preferences ADD COLUMN units VARCHAR(10) DEFAULT 'metric';
```

---

## API Endpoints

### Admin Endpoints (require admin role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/languages` | List all languages with status |
| PUT | `/api/admin/languages/:code` | Enable/disable a language |
| POST | `/api/admin/languages/:code/auto-translate` | Trigger AI translation for a language |
| GET | `/api/admin/currencies` | List all currencies with status |
| PUT | `/api/admin/currencies/:code` | Enable/disable, set display order |
| GET | `/api/admin/locales` | List all locale configs |
| PUT | `/api/admin/locales/:code` | Enable/disable a locale |
| GET | `/api/admin/translations/:language` | Get all translations for a language |
| PUT | `/api/admin/translations/:language/:keyId` | Edit a specific translation |
| POST | `/api/admin/translations/export/:language` | Export as JSON |
| POST | `/api/admin/translations/import/:language` | Import from JSON |

### Public Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/i18n/languages` | Enabled languages (for language selector) |
| GET | `/api/i18n/currencies` | Enabled currencies (for currency selectors) |
| GET | `/api/i18n/locales` | Enabled locale configs |
| GET | `/api/i18n/translations/:language` | All translations for a language (cached) |

### User Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/users/me/locale` | Get user's locale preferences |
| PUT | `/api/users/me/locale` | Update locale preferences |

---

## Implementation Phases

### Phase 1 — Foundation & Admin Config

**Goal:** Admin can manage currencies, languages, and locales. Users can select preferences.

**Tasks:**
1. Migration 010: Create `supported_languages`, `supported_currencies`, `locale_configs` tables
2. Seed with master data (20 languages, 160 currencies, 20 locale configs)
3. API: Admin CRUD endpoints for languages, currencies, locales
4. API: Public endpoints for enabled languages/currencies/locales
5. API: User locale preferences GET/PUT
6. Admin panel: Currencies page (searchable table, enable/disable toggle, reorder)
7. Admin panel: Languages page (enable/disable, translation coverage %)
8. Admin panel: Locales page (enable/disable, preview formats)
9. User settings: Language & Region section (locale picker, overrides)
10. Update expense form currency dropdown to use API-driven list

**Deliverables:**
- Admin can enable/disable currencies from ISO 4217 master list
- Admin can enable/disable languages and locales
- Users can choose their locale in settings
- Currency selectors throughout the app use the enabled list

---

### Phase 2 — Translation Infrastructure

**Goal:** App UI can render in any enabled language using translation keys.

**Tasks:**
1. Migration 011: Create `translation_keys` and `translations` tables
2. Extract all English UI strings to translation keys (~200-500 keys)
3. Organize keys by namespace: `common`, `nav`, `auth`, `trips`, `bookings`, `expenses`, `settings`, `admin`, `errors`
4. Create `useTranslation(namespace)` hook for Next.js
5. API: Serve translations per language (with ETag caching)
6. Replace all hardcoded strings in web app with `t('key')` calls
7. Fallback chain: user language → English
8. Language context provider (wraps app, loads translations on language change)

**Deliverables:**
- All UI strings externalized to translation keys
- App renders in English using the translation system
- Language switch possible (shows English for untranslated languages)

**Estimated keys by namespace:**
| Namespace | Approx. Keys |
|-----------|-------------|
| common | 50 (buttons, labels, errors) |
| nav | 15 (menu items) |
| auth | 30 (login, register, reset) |
| trips | 40 (trip CRUD, timeline) |
| bookings | 35 (booking types, status) |
| expenses | 45 (add, edit, split, settle) |
| settings | 30 (preferences, profile) |
| admin | 50 (panels, config) |
| errors | 25 (validation, API errors) |
| **Total** | **~320** |

---

### Phase 3 — Auto-Translation & Admin Editor

**Goal:** Admin can generate translations via AI and manually review/edit them.

**Tasks:**
1. Auto-translate endpoint: takes all English keys, sends to Bedrock (Claude) in batches, stores results
2. Admin translation editor page: searchable table of all keys
3. Side-by-side view: English | Target Language | Status (auto/reviewed/manual)
4. Inline editing with save
5. Bulk actions: mark as reviewed, reset to auto, delete
6. Import/export JSON translation files
7. Translation coverage dashboard (% per language)
8. Diff view: show what changed since last auto-translation

**Auto-Translation Strategy:**
- Batch translate 50 keys at a time via Bedrock Claude
- Provide context hints for ambiguous terms (e.g. "Trip" = travel trip, not stumble)
- Preserve placeholders: `{count}`, `{name}`, `{amount}` must stay in output
- Cost estimate: ~320 keys × 20 languages = 6,400 translations ≈ $0.50 via Haiku

**Deliverables:**
- One-click auto-translation per language
- Admin can review, edit, approve translations
- Import/export for professional translator workflow

---

### Phase 4 — Full User Experience

**Goal:** Complete localized experience across all platforms and touchpoints.

**Tasks:**
1. Language switcher in header/footer (instant, no reload)
2. All date/time displays respect user's locale format
3. All number displays respect locale format (comma vs period)
4. Currency displays use correct symbol position and formatting
5. Distance/temperature units follow user preference (km/mi, °C/°F)
6. RTL layout support for Arabic (CSS logical properties)
7. Email notifications rendered in user's preferred language
8. Error messages and validation text translated
9. Mobile app i18n (react-native-i18n or similar)
10. SEO: `<html lang="xx">`, hreflang tags, translated meta descriptions
11. Date picker and form inputs respect locale (date input format)

**Formatting Rules Applied:**
| User sees | en-US | de-DE | fr-FR | ja-JP |
|-----------|-------|-------|-------|-------|
| Date | Jul 20, 2026 | 20.07.2026 | 20/07/2026 | 2026/07/20 |
| Time | 2:30 PM | 14:30 | 14h30 | 14:30 |
| Number | 1,234.56 | 1.234,56 | 1 234,56 | 1,234.56 |
| Currency | $1,234.56 | 1.234,56 € | 1 234,56 € | ¥1,234 |
| Distance | 3.1 mi | 5,0 km | 5,0 km | 5.0 km |
| Temperature | 86°F | 30°C | 30°C | 30°C |

**Deliverables:**
- App fully localized in all enabled languages
- Formatting adapts to user locale everywhere
- RTL support ready
- Mobile app multilingual

---

## Translation Key Naming Convention

```
{namespace}.{page_or_component}.{element}

Examples:
- common.button.save
- common.button.cancel
- common.label.loading
- nav.menu.trips
- nav.menu.expenses
- trips.create.title
- trips.create.name_placeholder
- expenses.add.shared_toggle
- expenses.add.split_equal
- expenses.settlement.you_owe
- settings.locale.title
- settings.locale.language_label
- errors.validation.amount_required
- errors.api.network_error
```

## Caching Strategy

- Translations cached in Redis with key: `i18n:{language}:{version}`
- Version incremented when admin edits translations
- Client caches translation bundle in localStorage with version check
- ETag-based HTTP caching for translation API responses
- Stale-while-revalidate: serve cached, fetch fresh in background

## Migration Path

1. Start Phase 1 immediately (no breaking changes, purely additive)
2. Phase 2 can be done incrementally (convert pages one at a time)
3. Phase 3 depends on Phase 2 completion
4. Phase 4 depends on Phase 3 (translations must exist before full UX)

Total estimated effort: Phase 1 (1 day) → Phase 2 (2-3 days) → Phase 3 (1 day) → Phase 4 (2 days)
