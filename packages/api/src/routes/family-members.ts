/**
 * Family Members Routes
 *
 * Permanently linked family profiles with two modes:
 * - Connected: has own Nayya account (spouse/partner enforced)
 * - Managed: no account (children, elderly) — user maintains details
 *
 * Passport/ID data is encrypted at application level (AES-256-GCM).
 *
 * Endpoints:
 *  - GET    /api/family-members           — list user's family members
 *  - POST   /api/family-members           — add a family member
 *  - GET    /api/family-members/:id       — get single member details (with decrypted passport if requested)
 *  - PUT    /api/family-members/:id       — update a family member
 *  - DELETE /api/family-members/:id       — remove a family member
 *  - GET    /api/family-members/for-trip  — get family members with shared preferences for trip context
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const MAX_FAMILY_MEMBERS = 20;
const ENCRYPTION_KEY = process.env.PII_ENCRYPTION_KEY || 'default-dev-key-32-chars-long!!'; // 32 chars = 256 bits
const ALGORITHM = 'aes-256-gcm';

const VALID_RELATIONSHIPS = ['spouse', 'partner', 'child', 'parent', 'sibling', 'grandparent', 'other'];
const VALID_SEAT_PREFERENCES = ['window', 'aisle', 'middle', 'no_preference'];
const VALID_MEAL_PREFERENCES = ['STD', 'VGML', 'AVML', 'VJML', 'RVML', 'GFML', 'NLML', 'DBML', 'LFML', 'LSML', 'BLML', 'KSML', 'MOML', 'HNML', 'CHML', 'BBML'];
const VALID_CABIN_CLASSES = ['economy', 'premium_economy', 'business', 'first'];

interface FamilyMembersOptions {
  db: Kysely<Database>;
}

// ─── Encryption Helpers ──────────────────────────────────────────────────────

function encrypt(text: string): string {
  if (!text) return '';
  const iv = randomBytes(12);
  const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decrypt(encryptedText: string): string {
  if (!encryptedText || !encryptedText.includes(':')) return '';
  try {
    const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = Buffer.from(ENCRYPTION_KEY.padEnd(32, '0').slice(0, 32));
    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch {
    return '[decryption failed]';
  }
}

function maskPassportNumber(number: string): string {
  if (!number || number.length < 4) return '****';
  return '****' + number.slice(-4);
}

// ─── Routes ──────────────────────────────────────────────────────────────────

export async function registerFamilyMemberRoutes(
  app: FastifyInstance,
  options: FamilyMembersOptions,
): Promise<void> {
  const { db } = options;

  // ─── GET /api/family-members ───────────────────────────────────────────────
  app.get(
    '/api/family-members',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const members = await db
        .selectFrom('family_members')
        .selectAll()
        .where('user_id', '=', userId)
        .orderBy('created_at', 'asc')
        .execute();

      const data = members.map((m) => ({
        id: m.id,
        mode: m.mode,
        relationship: m.relationship,
        firstName: m.first_name,
        lastName: m.last_name,
        dateOfBirth: m.date_of_birth,
        gender: m.gender,
        dietaryPreferences: m.dietary_preferences,
        allergies: m.allergies,
        seatPreference: m.seat_preference,
        mealPreference: m.meal_preference,
        cabinClassPreference: m.cabin_class_preference,
        hasPassportStored: m.has_passport_stored,
        passportNationality: m.passport_nationality,
        passportIssuingCountry: m.passport_issuing_country,
        // Passport number masked (never show full in list)
        passportNumberMasked: m.passport_number ? maskPassportNumber(decrypt(m.passport_number)) : null,
        sharingScope: m.sharing_scope,
        shareDietary: m.share_dietary,
        shareAllergies: m.share_allergies,
        shareTravelPrefs: m.share_travel_prefs,
        linkedUserId: m.linked_user_id,
        notes: m.notes,
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));

      return reply.send({ statusCode: 200, data });
    },
  );

  // ─── GET /api/family-members/:id ───────────────────────────────────────────
  app.get(
    '/api/family-members/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Querystring: { reveal_passport?: string } }>,
      reply: FastifyReply,
    ) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { id } = request.params;
      const revealPassport = (request.query as any).reveal_passport === 'true';

      const member = await db
        .selectFrom('family_members')
        .selectAll()
        .where('id', '=', id)
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (!member) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Family member not found' });

      const data: any = {
        id: member.id,
        mode: member.mode,
        relationship: member.relationship,
        firstName: member.first_name,
        lastName: member.last_name,
        dateOfBirth: member.date_of_birth,
        gender: member.gender,
        dietaryPreferences: member.dietary_preferences,
        allergies: member.allergies,
        seatPreference: member.seat_preference,
        mealPreference: member.meal_preference,
        cabinClassPreference: member.cabin_class_preference,
        hasPassportStored: member.has_passport_stored,
        passportNationality: member.passport_nationality,
        passportIssuingCountry: member.passport_issuing_country,
        sharingScope: member.sharing_scope,
        shareDietary: member.share_dietary,
        shareAllergies: member.share_allergies,
        shareTravelPrefs: member.share_travel_prefs,
        linkedUserId: member.linked_user_id,
        notes: member.notes,
        createdAt: member.created_at,
        updatedAt: member.updated_at,
      };

      // Only decrypt passport if explicitly requested
      if (revealPassport && member.has_passport_stored) {
        data.passport = {
          fullName: member.passport_name ? decrypt(member.passport_name) : null,
          number: member.passport_number ? decrypt(member.passport_number) : null,
          expiry: member.passport_expiry ? decrypt(member.passport_expiry) : null,
          nationality: member.passport_nationality,
          issuingCountry: member.passport_issuing_country,
        };
      } else {
        data.passportNumberMasked = member.passport_number ? maskPassportNumber(decrypt(member.passport_number)) : null;
      }

      return reply.send({ statusCode: 200, data });
    },
  );

  // ─── POST /api/family-members ──────────────────────────────────────────────
  app.post(
    '/api/family-members',
    async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const body = request.body as any;

      // Validate required fields
      if (!body.firstName || !body.relationship) {
        return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: 'firstName and relationship are required' });
      }
      if (!VALID_RELATIONSHIPS.includes(body.relationship)) {
        return reply.status(400).send({ statusCode: 400, error: 'VALIDATION_ERROR', message: `Invalid relationship. Valid: ${VALID_RELATIONSHIPS.join(', ')}` });
      }

      // Check limit
      const countResult = await db.selectFrom('family_members').select(db.fn.count<number>('id').as('count')).where('user_id', '=', userId).executeTakeFirst();
      if ((countResult?.count ?? 0) >= MAX_FAMILY_MEMBERS) {
        return reply.status(400).send({ statusCode: 400, error: 'LIMIT_REACHED', message: `Maximum ${MAX_FAMILY_MEMBERS} family members allowed` });
      }

      // For connected mode (spouse/partner), look up linked user
      let linkedUserId: string | null = null;
      if (body.mode === 'connected' && body.email) {
        const linkedUser = await db.selectFrom('users').select('id').where('email', '=', body.email).executeTakeFirst();
        if (linkedUser) linkedUserId = linkedUser.id;
      }

      // Encrypt passport fields if provided
      const passportName = body.passport?.fullName ? encrypt(body.passport.fullName) : null;
      const passportNumber = body.passport?.number ? encrypt(body.passport.number) : null;
      const passportExpiry = body.passport?.expiry ? encrypt(body.passport.expiry) : null;
      const hasPassport = !!(passportName || passportNumber);

      const member = await db
        .insertInto('family_members')
        .values({
          user_id: userId,
          linked_user_id: linkedUserId,
          mode: body.mode ?? 'managed',
          relationship: body.relationship,
          first_name: body.firstName,
          last_name: body.lastName ?? null,
          date_of_birth: body.dateOfBirth ?? null,
          gender: body.gender ?? null,
          dietary_preferences: body.dietaryPreferences ?? [],
          allergies: body.allergies ?? [],
          seat_preference: body.seatPreference ?? null,
          meal_preference: body.mealPreference ?? null,
          cabin_class_preference: body.cabinClassPreference ?? null,
          passport_name: passportName,
          passport_number: passportNumber,
          passport_nationality: body.passport?.nationality ?? null,
          passport_expiry: passportExpiry,
          passport_issuing_country: body.passport?.issuingCountry ?? null,
          has_passport_stored: hasPassport,
          sharing_scope: body.sharingScope ?? 'this_trip',
          share_dietary: body.shareDietary ?? true,
          share_allergies: body.shareAllergies ?? true,
          share_travel_prefs: body.shareTravelPrefs ?? false,
          notes: body.notes ?? null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      return reply.status(201).send({
        statusCode: 201,
        data: {
          id: member.id,
          mode: member.mode,
          relationship: member.relationship,
          firstName: member.first_name,
          lastName: member.last_name,
          hasPassportStored: member.has_passport_stored,
        },
      });
    },
  );

  // ─── PUT /api/family-members/:id ───────────────────────────────────────────
  app.put(
    '/api/family-members/:id',
    async (request: FastifyRequest<{ Params: { id: string }; Body: any }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { id } = request.params;
      const body = request.body as any;

      const existing = await db.selectFrom('family_members').select('id').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();
      if (!existing) return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Family member not found' });

      const updates: Record<string, unknown> = { updated_at: new Date() };

      if (body.firstName !== undefined) updates.first_name = body.firstName;
      if (body.lastName !== undefined) updates.last_name = body.lastName;
      if (body.relationship !== undefined) updates.relationship = body.relationship;
      if (body.dateOfBirth !== undefined) updates.date_of_birth = body.dateOfBirth;
      if (body.gender !== undefined) updates.gender = body.gender;
      if (body.dietaryPreferences !== undefined) updates.dietary_preferences = body.dietaryPreferences;
      if (body.allergies !== undefined) updates.allergies = body.allergies;
      if (body.seatPreference !== undefined) updates.seat_preference = body.seatPreference;
      if (body.mealPreference !== undefined) updates.meal_preference = body.mealPreference;
      if (body.cabinClassPreference !== undefined) updates.cabin_class_preference = body.cabinClassPreference;
      if (body.sharingScope !== undefined) updates.sharing_scope = body.sharingScope;
      if (body.shareDietary !== undefined) updates.share_dietary = body.shareDietary;
      if (body.shareAllergies !== undefined) updates.share_allergies = body.shareAllergies;
      if (body.shareTravelPrefs !== undefined) updates.share_travel_prefs = body.shareTravelPrefs;
      if (body.notes !== undefined) updates.notes = body.notes;

      // Update passport if provided
      if (body.passport) {
        if (body.passport.fullName !== undefined) updates.passport_name = body.passport.fullName ? encrypt(body.passport.fullName) : null;
        if (body.passport.number !== undefined) updates.passport_number = body.passport.number ? encrypt(body.passport.number) : null;
        if (body.passport.expiry !== undefined) updates.passport_expiry = body.passport.expiry ? encrypt(body.passport.expiry) : null;
        if (body.passport.nationality !== undefined) updates.passport_nationality = body.passport.nationality;
        if (body.passport.issuingCountry !== undefined) updates.passport_issuing_country = body.passport.issuingCountry;
        updates.has_passport_stored = !!(body.passport.fullName || body.passport.number);
      }

      // Remove passport entirely if requested
      if (body.removePassport === true) {
        updates.passport_name = null;
        updates.passport_number = null;
        updates.passport_expiry = null;
        updates.passport_nationality = null;
        updates.passport_issuing_country = null;
        updates.has_passport_stored = false;
      }

      await db.updateTable('family_members').set(updates).where('id', '=', id).where('user_id', '=', userId).execute();

      return reply.send({ statusCode: 200, message: 'Family member updated' });
    },
  );

  // ─── DELETE /api/family-members/:id ────────────────────────────────────────
  app.delete(
    '/api/family-members/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const { id } = request.params;
      const result = await db.deleteFrom('family_members').where('id', '=', id).where('user_id', '=', userId).executeTakeFirst();

      if (!result || result.numDeletedRows === 0n) {
        return reply.status(404).send({ statusCode: 404, error: 'NOT_FOUND', message: 'Family member not found' });
      }

      return reply.send({ statusCode: 200, message: 'Family member removed' });
    },
  );

  // ─── GET /api/family-members/for-trip ──────────────────────────────────────
  // Returns family members with their shared preferences (for trip planning context)
  app.get(
    '/api/family-members/for-trip',
    async (request: FastifyRequest, reply: FastifyReply) => {
      const userId = (request as any).userId as string;
      if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Not authenticated' });

      const members = await db
        .selectFrom('family_members')
        .selectAll()
        .where('user_id', '=', userId)
        .orderBy('relationship', 'asc')
        .execute();

      const data = members.map((m) => ({
        id: m.id,
        firstName: m.first_name,
        lastName: m.last_name,
        relationship: m.relationship,
        mode: m.mode,
        // Only include preferences if sharing is enabled
        dietaryPreferences: m.share_dietary ? m.dietary_preferences : [],
        allergies: m.share_allergies ? m.allergies : [],
        seatPreference: m.share_travel_prefs ? m.seat_preference : null,
        mealPreference: m.share_travel_prefs ? m.meal_preference : null,
        sharingScope: m.sharing_scope,
      }));

      return reply.send({ statusCode: 200, data });
    },
  );
}
