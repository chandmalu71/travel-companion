/**
 * i18n & Locale Routes
 *
 * Admin endpoints for managing languages, currencies, locales.
 * Public endpoints for fetching enabled items.
 * User endpoints for locale preferences.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

export interface I18nRoutesOptions {
  db: Kysely<Database>;
}

export async function registerI18nRoutes(
  app: FastifyInstance,
  options: I18nRoutesOptions,
): Promise<void> {
  const { db } = options;

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC ENDPOINTS (no auth required for enabled items)
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/i18n/languages — enabled languages
  app.get('/api/i18n/languages', async (_request: FastifyRequest, reply: FastifyReply) => {
    const languages = await db
      .selectFrom('supported_languages')
      .selectAll()
      .where('enabled', '=', true)
      .orderBy('name', 'asc')
      .execute();
    return reply.send({ statusCode: 200, data: languages });
  });

  // GET /api/i18n/currencies — enabled currencies
  app.get('/api/i18n/currencies', async (_request: FastifyRequest, reply: FastifyReply) => {
    const currencies = await db
      .selectFrom('supported_currencies')
      .selectAll()
      .where('enabled', '=', true)
      .orderBy('display_order', 'asc')
      .execute();
    return reply.send({ statusCode: 200, data: currencies });
  });

  // GET /api/i18n/locales — enabled locale configs
  app.get('/api/i18n/locales', async (_request: FastifyRequest, reply: FastifyReply) => {
    const locales = await db
      .selectFrom('locale_configs')
      .selectAll()
      .where('enabled', '=', true)
      .orderBy('name', 'asc')
      .execute();
    return reply.send({ statusCode: 200, data: locales });
  });

  // GET /api/i18n/translations/:language — all translations for a language
  app.get('/api/i18n/translations/:language', async (request: FastifyRequest<{ Params: { language: string } }>, reply: FastifyReply) => {
    const { language } = request.params;

    const results = await db
      .selectFrom('translations')
      .innerJoin('translation_keys', 'translation_keys.id', 'translations.key_id')
      .select(['translation_keys.key', 'translations.text'])
      .where('translations.language_code', '=', language)
      .execute();

    const translationMap: Record<string, string> = {};
    for (const r of results) {
      translationMap[r.key] = r.text;
    }

    return reply.send({ statusCode: 200, data: translationMap });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // USER ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/users/me/locale — get user's locale preferences
  app.get('/api/users/me/locale', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    const prefs = await db
      .selectFrom('user_preferences')
      .select(['locale_code', 'date_format_override', 'time_format_override', 'number_format_override', 'units', 'language'])
      .where('user_id', '=', userId)
      .executeTakeFirst();

    if (!prefs) {
      return reply.send({ statusCode: 200, data: { locale: 'en-GB', language: 'en', dateFormat: null, timeFormat: null, numberFormat: null, units: 'metric' } });
    }

    return reply.send({
      statusCode: 200,
      data: {
        locale: prefs.locale_code ?? 'en-GB',
        language: prefs.language ?? 'en',
        dateFormat: prefs.date_format_override,
        timeFormat: prefs.time_format_override,
        numberFormat: prefs.number_format_override,
        units: prefs.units ?? 'metric',
      },
    });
  });

  // PUT /api/users/me/locale — update user's locale preferences
  app.put(
    '/api/users/me/locale',
    async (
      request: FastifyRequest<{
        Body: { locale?: string; language?: string; dateFormat?: string; timeFormat?: string; numberFormat?: string; units?: string };
      }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      const { locale, language, dateFormat, timeFormat, numberFormat, units } = request.body;

      // Upsert user preferences
      const existing = await db.selectFrom('user_preferences').select('user_id').where('user_id', '=', userId).executeTakeFirst();

      if (existing) {
        const updates: Record<string, any> = { updated_at: sql`NOW()` };
        if (locale !== undefined) updates['locale_code'] = locale;
        if (language !== undefined) updates['language'] = language;
        if (dateFormat !== undefined) updates['date_format_override'] = dateFormat;
        if (timeFormat !== undefined) updates['time_format_override'] = timeFormat;
        if (numberFormat !== undefined) updates['number_format_override'] = numberFormat;
        if (units !== undefined) updates['units'] = units;

        await db.updateTable('user_preferences').set(updates).where('user_id', '=', userId).execute();
      } else {
        await db.insertInto('user_preferences').values({
          user_id: userId,
          locale_code: locale ?? 'en-GB',
          language: language ?? 'en',
          date_format_override: dateFormat ?? null,
          time_format_override: timeFormat ?? null,
          number_format_override: numberFormat ?? null,
          units: units ?? 'metric',
        }).execute();
      }

      return reply.send({ statusCode: 200, message: 'Locale preferences updated' });
    },
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // ADMIN ENDPOINTS
  // ═══════════════════════════════════════════════════════════════════════════

  // GET /api/admin/i18n/languages — all languages (with disabled)
  app.get('/api/admin/i18n/languages', async (_request: FastifyRequest, reply: FastifyReply) => {
    const languages = await db.selectFrom('supported_languages').selectAll().orderBy('name', 'asc').execute();
    return reply.send({ statusCode: 200, data: languages });
  });

  // PUT /api/admin/i18n/languages/:code — enable/disable a language
  app.put(
    '/api/admin/i18n/languages/:code',
    async (request: FastifyRequest<{ Params: { code: string }; Body: { enabled?: boolean } }>, reply: FastifyReply) => {
      const { code } = request.params;
      const { enabled } = request.body;

      await db.updateTable('supported_languages')
        .set({ enabled: enabled ?? true, updated_at: sql`NOW()` })
        .where('code', '=', code)
        .execute();

      return reply.send({ statusCode: 200, message: `Language ${code} updated` });
    },
  );

  // GET /api/admin/i18n/currencies — all currencies
  app.get('/api/admin/i18n/currencies', async (request: FastifyRequest<{ Querystring: { search?: string } }>, reply: FastifyReply) => {
    let query = db.selectFrom('supported_currencies').selectAll().orderBy('display_order', 'asc');
    const { search } = request.query as any;
    if (search) {
      query = query.where((eb) =>
        eb.or([
          eb('code', 'ilike', `%${search}%`),
          eb('name', 'ilike', `%${search}%`),
        ])
      );
    }
    const currencies = await query.execute();
    return reply.send({ statusCode: 200, data: currencies });
  });

  // PUT /api/admin/i18n/currencies/:code — enable/disable, reorder
  app.put(
    '/api/admin/i18n/currencies/:code',
    async (request: FastifyRequest<{ Params: { code: string }; Body: { enabled?: boolean; displayOrder?: number } }>, reply: FastifyReply) => {
      const { code } = request.params;
      const { enabled, displayOrder } = request.body;

      const updates: Record<string, any> = {};
      if (enabled !== undefined) updates['enabled'] = enabled;
      if (displayOrder !== undefined) updates['display_order'] = displayOrder;

      if (Object.keys(updates).length > 0) {
        await db.updateTable('supported_currencies').set(updates).where('code', '=', code).execute();
      }

      return reply.send({ statusCode: 200, message: `Currency ${code} updated` });
    },
  );

  // GET /api/admin/i18n/locales — all locale configs
  app.get('/api/admin/i18n/locales', async (_request: FastifyRequest, reply: FastifyReply) => {
    const locales = await db.selectFrom('locale_configs').selectAll().orderBy('name', 'asc').execute();
    return reply.send({ statusCode: 200, data: locales });
  });

  // PUT /api/admin/i18n/locales/:code — enable/disable
  app.put(
    '/api/admin/i18n/locales/:code',
    async (request: FastifyRequest<{ Params: { code: string }; Body: { enabled?: boolean } }>, reply: FastifyReply) => {
      const { code } = request.params;
      const { enabled } = request.body;

      await db.updateTable('locale_configs').set({ enabled: enabled ?? true }).where('code', '=', code).execute();
      return reply.send({ statusCode: 200, message: `Locale ${code} updated` });
    },
  );

  // GET /api/admin/i18n/translations/:language — all keys with translations
  app.get(
    '/api/admin/i18n/translations/:language',
    async (request: FastifyRequest<{ Params: { language: string } }>, reply: FastifyReply) => {
      const { language } = request.params;

      const keys = await db.selectFrom('translation_keys').selectAll().orderBy('namespace', 'asc').orderBy('key', 'asc').execute();
      const translations = await db.selectFrom('translations').selectAll().where('language_code', '=', language).execute();
      const translationMap = new Map(translations.map(t => [t.key_id, t]));

      const result = keys.map(k => ({
        id: k.id,
        key: k.key,
        namespace: k.namespace,
        englishText: k.english_text,
        translation: translationMap.get(k.id)?.text ?? null,
        isAuto: translationMap.get(k.id)?.is_auto ?? false,
        isReviewed: translationMap.get(k.id)?.is_reviewed ?? false,
      }));

      return reply.send({ statusCode: 200, data: result, total: keys.length, translated: translations.length });
    },
  );

  // PUT /api/admin/i18n/translations/:language/:keyId — edit a translation
  app.put(
    '/api/admin/i18n/translations/:language/:keyId',
    async (request: FastifyRequest<{ Params: { language: string; keyId: string }; Body: { text: string } }>, reply: FastifyReply) => {
      const { language, keyId } = request.params;
      const { text } = request.body;
      const userId = (request as any).userId as string;

      await db
        .insertInto('translations')
        .values({ key_id: keyId, language_code: language, text, is_auto: false, is_reviewed: true, last_edited_by: userId })
        .onConflict(oc => oc.columns(['key_id', 'language_code']).doUpdateSet({ text, is_reviewed: true, last_edited_by: userId, updated_at: sql`NOW()` }))
        .execute();

      return reply.send({ statusCode: 200, message: 'Translation saved' });
    },
  );

  // POST /api/admin/i18n/languages/:code/auto-translate — trigger AI translation
  app.post(
    '/api/admin/i18n/languages/:code/auto-translate',
    async (request: FastifyRequest<{ Params: { code: string } }>, reply: FastifyReply) => {
      const { code } = request.params;

      // Get all English keys
      const keys = await db.selectFrom('translation_keys').selectAll().execute();

      // Simple mock translation for now (in production, call Bedrock Claude)
      // This simulates the auto-translate by prefixing with language code
      const translations = keys.map(k => ({
        key_id: k.id,
        language_code: code,
        text: `[${code.toUpperCase()}] ${k.english_text}`, // Placeholder — in production this calls LLM
        is_auto: true,
        is_reviewed: false,
      }));

      // Batch upsert
      for (const t of translations) {
        await db
          .insertInto('translations')
          .values(t)
          .onConflict(oc => oc.columns(['key_id', 'language_code']).doUpdateSet({ text: t.text, is_auto: true, is_reviewed: false, updated_at: sql`NOW()` }))
          .execute();
      }

      // Update language coverage and auto_translated flag
      await db.updateTable('supported_languages')
        .set({ translation_coverage: 100, auto_translated: true, updated_at: sql`NOW()` })
        .where('code', '=', code)
        .execute();

      return reply.send({ statusCode: 200, message: `Auto-translated ${translations.length} keys to ${code}`, count: translations.length });
    },
  );
}
