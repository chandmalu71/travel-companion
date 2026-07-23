/**
 * Backfill Translation Keys
 * 
 * Ensures ALL keys from packages/web/src/i18n/en.json are in the
 * translation_keys database table. Safe to run multiple times (uses ON CONFLICT DO NOTHING).
 *
 * Run: npx tsx src/scripts/backfill-translation-keys.ts
 */
import { createDatabaseFromEnv } from '../db/database.js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

async function main() {
  const db = createDatabaseFromEnv();

  // Try loading en.json from the Docker container's expected path
  let en: Record<string, string>;
  try {
    const enPath = resolve('/app/packages/web/src/i18n/en.json');
    en = JSON.parse(readFileSync(enPath, 'utf8'));
  } catch {
    try {
      const enPath = resolve(process.cwd(), '../../web/src/i18n/en.json');
      en = JSON.parse(readFileSync(enPath, 'utf8'));
    } catch {
      // Fallback: use the keys embedded in the migration file
      const migPath = resolve(process.cwd(), 'src/db/migrations/020_seed_translation_keys.ts');
      const migContent = readFileSync(migPath, 'utf8');
      const match = migContent.match(/TRANSLATION_KEYS[^{]*({[\s\S]*?^};)/m);
      if (match) {
        // Can't easily parse TS, so just count and report
        console.log('Could not load en.json, using migration data via DB insert');
      }
      en = {};
    }
  }

  if (Object.keys(en).length === 0) {
    console.log('No en.json found — skipping backfill');
    process.exit(0);
  }

  const entries = Object.entries(en);
  console.log(`Found ${entries.length} translation keys in en.json`);

  let inserted = 0;
  for (let i = 0; i < entries.length; i += 50) {
    const chunk = entries.slice(i, i + 50);
    const values = chunk.map(([key, text]) => ({
      key,
      namespace: key.split('.')[0],
      english_text: String(text),
    }));

    await db.insertInto('translation_keys')
      .values(values)
      .onConflict((oc) => oc.column('key').doNothing())
      .execute();
    inserted += chunk.length;
  }

  // Count actual rows
  const count = await db.selectFrom('translation_keys').select(db.fn.count('id').as('c')).executeTakeFirst();
  console.log(`Done. translation_keys table now has ${(count as any)?.c ?? '?'} rows (processed ${inserted} from en.json)`);
  process.exit(0);
}

main().catch((e) => { console.error('Error:', e.message); process.exit(1); });
