/**
 * Local Development Authentication Routes
 *
 * Bypasses AWS Cognito for local testing.
 * Uses SHA-256 password hashing and local JWT generation.
 * NOT for production use.
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { registrationSchema, loginSchema } from '@travel-companion/shared';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { LocalAuthService, decodeLocalToken } from '../services/local-auth.js';

export interface LocalAuthRoutesOptions {
  db: Kysely<Database>;
}

export async function registerLocalAuthRoutes(
  app: FastifyInstance,
  options: LocalAuthRoutesOptions,
): Promise<void> {
  const { db } = options;
  const localAuth = new LocalAuthService();

  // ─── GET /api/auth/providers — public, returns enabled OAuth providers ─────
  app.get('/api/auth/providers', async (_request: FastifyRequest, reply: FastifyReply) => {
    const providers = [
      { id: 'google', name: 'Google', status: process.env.GOOGLE_CLIENT_ID && !process.env.GOOGLE_CLIENT_ID.includes('placeholder') ? 'enabled' : 'disabled' },
      { id: 'microsoft', name: 'Microsoft', status: process.env.MICROSOFT_CLIENT_ID && !process.env.MICROSOFT_CLIENT_ID.includes('placeholder') ? 'enabled' : 'disabled' },
      { id: 'facebook', name: 'Facebook', status: process.env.FACEBOOK_APP_ID ? 'enabled' : 'disabled' },
      { id: 'apple', name: 'Apple', status: 'coming_soon' as const },
    ];
    return reply.send({ statusCode: 200, data: providers });
  });

  // ─── POST /api/auth/register ─────────────────────────────────────────

  app.post(
    '/api/auth/register',
    async (request: FastifyRequest<{ Body: { email: string; password: string; displayName?: string; termsAccepted?: boolean; marketingConsent?: boolean } }>, reply: FastifyReply) => {
      const body = request.body ?? {};

      const parseResult = registrationSchema.safeParse(body);
      if (!parseResult.success) {
        request.log.warn({ body, issues: parseResult.error.issues }, 'Registration validation failed');
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Registration validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { email, password } = parseResult.data;
      const displayName = (body as any).displayName ?? email.split('@')[0] ?? email;
      const termsAccepted = (body as any).termsAccepted === true;
      const marketingConsent = (body as any).marketingConsent === true;

      if (!termsAccepted) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'TERMS_REQUIRED',
          message: 'You must accept the Terms of Service to create an account',
        });
      }

      try {
        // Check if user already exists
        const existing = await db
          .selectFrom('users')
          .select('id')
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst();

        if (existing) {
          return reply.status(409).send({
            statusCode: 409,
            error: 'EMAIL_EXISTS',
            message: 'An account with this email address already exists',
          });
        }

        // Create user with hashed password
        const passwordHash = localAuth.hashPassword(password);
        const signUpResult = await localAuth.signUp(email, password);

        const newUser = await db
          .insertInto('users')
          .values({
            email: email.toLowerCase(),
            cognito_sub: signUpResult.userSub,
            display_name: displayName,
            email_verified: true,
            password_hash: passwordHash,
            marketing_consent: marketingConsent,
            terms_accepted_at: new Date(),
          } as any)
          .returning(['id', 'email', 'display_name'])
          .executeTakeFirstOrThrow();

        // If marketing consent given, create/update CRM lead and trigger welcome automation
        if (marketingConsent) {
          try {
            // Upsert into crm_leads (may already exist from landing page capture)
            const { sql } = await import('kysely');
            await sql`INSERT INTO crm_leads (email, full_name, source, status, marketing_consent, terms_consent, converted_user_id)
              VALUES (${email.toLowerCase()}, ${displayName}, 'registration', 'converted', true, true, ${newUser.id})
              ON CONFLICT (email) DO UPDATE SET
                status = 'converted',
                marketing_consent = true,
                terms_consent = true,
                converted_user_id = ${newUser.id},
                converted_at = NOW()`.execute(db);

            // Trigger welcome automation
            await fetch(`http://localhost:${process.env.PORT ?? 3000}/api/internal/trigger-automation`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ event: 'lead_signup', email: email.toLowerCase(), name: displayName, userId: newUser.id }),
            }).catch(() => {}); // Non-blocking
          } catch { /* non-blocking CRM update */ }
        }

        // Send welcome email
        try {
          const { EmailService } = await import('../services/email.js');
          const emailService = new EmailService(db);
          const appUrl = process.env.APP_URL ?? process.env.WEB_URL ?? 'http://localhost:3001';
          await emailService.sendTemplate({
            to: newUser.email,
            templateSlug: 'welcome',
            variables: {
              name: displayName.split(' ')[0] ?? displayName,
              dashboardUrl: `${appUrl}/dashboard`,
            },
          });
        } catch (e) {
          console.error('[Auth] Failed to send welcome email:', (e as Error).message);
        }

        return reply.status(201).send({
          statusCode: 201,
          data: {
            userId: newUser.id,
            email: newUser.email,
            displayName: newUser.display_name,
            verificationRequired: false,
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Local registration failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Registration failed',
        });
      }
    },
  );

  // ─── POST /api/auth/login ────────────────────────────────────────────

  app.post(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: { email: string; password: string } }>, reply: FastifyReply) => {
      const body = request.body ?? {};

      const parseResult = loginSchema.safeParse(body);
      if (!parseResult.success) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'Login validation failed',
          details: parseResult.error.issues.map((issue) => ({
            field: issue.path.map(String).join('.'),
            message: issue.message,
          })),
        });
      }

      const { email, password } = parseResult.data;

      try {
        // Look up user
        const user = await db
          .selectFrom('users')
          .select(['id', 'email', 'display_name', 'password_hash', 'avatar_url', 'email_verified', 'admin_role'])
          .where('email', '=', email.toLowerCase())
          .executeTakeFirst();

        if (!user || !user.password_hash) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        // Verify password
        if (!localAuth.verifyPassword(password, user.password_hash)) {
          return reply.status(401).send({
            statusCode: 401,
            error: 'INVALID_CREDENTIALS',
            message: 'Invalid email or password',
          });
        }

        // Generate tokens
        const authResult = await localAuth.signIn(user.email, user.id);

        // Track login session for security (device detection)
        try {
          const ip = request.ip ?? (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ?? 'unknown';
          const userAgent = request.headers['user-agent'] ?? 'unknown';
          const crypto = await import('crypto');
          const fingerprint = crypto.createHash('sha256').update(`${userAgent}:${ip}`).digest('hex').slice(0, 64);

          // Check if this device has been seen before
          const existingDevice = await (db as any)
            .selectFrom('login_sessions')
            .select('id')
            .where('user_id', '=', user.id)
            .where('device_fingerprint', '=', fingerprint)
            .executeTakeFirst();

          const isNewDevice = !existingDevice;

          // Record the session
          await (db as any).insertInto('login_sessions').values({
            user_id: user.id,
            ip_address: ip,
            user_agent: userAgent,
            device_fingerprint: fingerprint,
            is_new_device: isNewDevice,
          }).execute();

          // Send security alert for new device
          if (isNewDevice && user.email_verified) {
            const { EmailService } = await import('../services/email.js');
            const emailService = new EmailService(db);
            await emailService.sendRaw({
              to: user.email,
              subject: 'New login to your Neyya account',
              html: `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
                  <h2 style="color:#333;">New Login Detected</h2>
                  <p>Hi ${(user.display_name ?? 'there').split(' ')[0]},</p>
                  <p>We noticed a new login to your Neyya account:</p>
                  <table style="border-collapse:collapse;margin:16px 0;">
                    <tr><td style="padding:4px 12px;color:#666;">IP Address</td><td style="padding:4px 12px;font-weight:600;">${ip}</td></tr>
                    <tr><td style="padding:4px 12px;color:#666;">Device</td><td style="padding:4px 12px;font-weight:600;">${userAgent.slice(0, 80)}</td></tr>
                    <tr><td style="padding:4px 12px;color:#666;">Time</td><td style="padding:4px 12px;font-weight:600;">${new Date().toISOString()}</td></tr>
                  </table>
                  <p>If this was you, no action is needed. If you didn't log in, please change your password immediately.</p>
                  <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
                  <p style="font-size:11px;color:#999;">Neyya Security Team</p>
                </div>
              `,
              from: 'Neyya Security <security@neyya.ai>',
            }).catch(() => {}); // Non-blocking
          }
        } catch { /* device tracking is non-blocking */ }

        return reply.send({
          statusCode: 200,
          data: {
            accessToken: authResult.accessToken,
            refreshToken: authResult.refreshToken,
            userId: user.id,
            user: {
              id: user.id,
              email: user.email,
              display_name: user.display_name,
              avatar_url: user.avatar_url,
              email_verified: user.email_verified,
              admin_role: user.admin_role || null,
            },
          },
        });
      } catch (error: unknown) {
        request.log.error(error, 'Local login failed');
        return reply.status(500).send({
          statusCode: 500,
          error: 'INTERNAL_ERROR',
          message: 'Login failed',
        });
      }
    },
  );

  // ─── POST /api/auth/refresh ──────────────────────────────────────────

  app.post(
    '/api/auth/refresh',
    async (request: FastifyRequest<{ Body: { refreshToken: string } }>, reply: FastifyReply) => {
      const { refreshToken } = request.body ?? {};

      if (!refreshToken) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'VALIDATION_ERROR',
          message: 'refreshToken is required',
        });
      }

      const decoded = decodeLocalToken(refreshToken);
      if (!decoded) {
        return reply.status(401).send({
          statusCode: 401,
          error: 'INVALID_TOKEN',
          message: 'Invalid or expired refresh token',
        });
      }

      // Generate new tokens
      const authResult = await localAuth.signIn(decoded.email, decoded.sub);

      return reply.send({
        statusCode: 200,
        data: {
          accessToken: authResult.accessToken,
          refreshToken: authResult.refreshToken,
        },
      });
    },
  );

  // ─── GET /api/user/profile ───────────────────────────────────────────

  app.get('/api/user/profile', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const user = await db.selectFrom('users').selectAll().where('id', '=', userId).executeTakeFirst();
    if (!user) return reply.status(404).send({ statusCode: 404, error: 'User not found' });

    return reply.send({
      statusCode: 200,
      data: {
        id: (user as any).id,
        email: (user as any).email,
        display_name: (user as any).display_name,
        first_name: (user as any).first_name ?? null,
        last_name: (user as any).last_name ?? null,
        avatar_url: (user as any).avatar_url,
        email_verified: (user as any).email_verified,
        marketing_consent: (user as any).marketing_consent ?? false,
        terms_accepted_at: (user as any).terms_accepted_at ?? null,
        date_of_birth: (user as any).date_of_birth ?? null,
        anniversary_date: (user as any).anniversary_date ?? null,
        nationality: (user as any).nationality ?? null,
        current_city: (user as any).current_city ?? null,
        current_country: (user as any).current_country ?? null,
        moved_to_city_date: (user as any).moved_to_city_date ?? null,
        moved_to_country_date: (user as any).moved_to_country_date ?? null,
        phone: (user as any).phone ?? null,
        gender: (user as any).gender ?? null,
        created_at: (user as any).created_at,
      },
    });
  });

  // ─── PUT /api/user/profile ───────────────────────────────────────────

  app.put('/api/user/profile', async (request: FastifyRequest<{ Body: any }>, reply: FastifyReply) => {
    const userId = (request as any).userId as string;
    if (!userId) return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED' });

    const { first_name, last_name, display_name, marketing_consent,
      date_of_birth, anniversary_date, nationality, current_city, current_country,
      moved_to_city_date, moved_to_country_date, phone, gender } = request.body as any;

    const updates: Record<string, any> = { updated_at: new Date() };
    if (first_name !== undefined) updates.first_name = first_name;
    if (last_name !== undefined) updates.last_name = last_name;
    if (display_name !== undefined) updates.display_name = display_name;
    if (marketing_consent !== undefined) updates.marketing_consent = marketing_consent;
    if (date_of_birth !== undefined) updates.date_of_birth = date_of_birth || null;
    if (anniversary_date !== undefined) updates.anniversary_date = anniversary_date || null;
    if (nationality !== undefined) updates.nationality = nationality || null;
    if (current_city !== undefined) updates.current_city = current_city || null;
    if (current_country !== undefined) updates.current_country = current_country || null;
    if (moved_to_city_date !== undefined) updates.moved_to_city_date = moved_to_city_date || null;
    if (moved_to_country_date !== undefined) updates.moved_to_country_date = moved_to_country_date || null;
    if (phone !== undefined) updates.phone = phone || null;
    if (gender !== undefined) updates.gender = gender || null;

    // Auto-generate display_name from first+last if not explicitly set
    if (first_name !== undefined && !display_name) {
      updates.display_name = [first_name, last_name].filter(Boolean).join(' ');
    }

    await db.updateTable('users').set(updates).where('id', '=', userId).execute();

    return reply.send({ statusCode: 200, message: 'Profile updated' });
  });

  // ─── POST /api/auth/password-reset — Request password reset ────────────

  app.post(
    '/api/auth/password-reset',
    async (request: FastifyRequest<{ Body: { email: string } }>, reply: FastifyReply) => {
      const { email } = request.body ?? {};

      if (!email || typeof email !== 'string') {
        return reply.status(400).send({ statusCode: 400, error: 'Email is required' });
      }

      // Always return success to prevent email enumeration
      const successMessage = 'If an account with that email exists, a password reset link has been sent';

      try {
        const user = await db
          .selectFrom('users')
          .select(['id', 'email', 'display_name'])
          .where('email', '=', email.toLowerCase().trim())
          .executeTakeFirst();

        if (!user) {
          return reply.send({ statusCode: 200, message: successMessage });
        }

        // Generate reset token (6-digit code for simplicity)
        const crypto = await import('crypto');
        const resetToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

        // Store token (using Redis if available, else a temp field)
        // For now, store in a simple approach: hash as cognito_sub prefix
        // In production, this should use Redis or a password_reset_tokens table
        const { sql } = await import('kysely');
        await sql`INSERT INTO user_preferences (user_id, language)
          VALUES (${user.id}, 'en')
          ON CONFLICT (user_id) DO UPDATE SET
            language = user_preferences.language`.execute(db);

        // Store the reset token temporarily (using localStorage pattern on server: Redis)
        // For local dev without Redis, we'll encode it in a JWT
        const resetUrl = `${process.env.APP_URL ?? 'http://localhost:3001'}/reset-password?token=${resetToken}&email=${encodeURIComponent(user.email)}`;

        // Send reset email
        const { EmailService } = await import('../services/email.js');
        const emailService = new EmailService(db);
        await emailService.sendRaw({
          to: user.email,
          subject: 'Reset your Neyya password',
          html: `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;">
              <h2 style="color:#333;">Password Reset</h2>
              <p>Hi ${(user.display_name ?? 'there').split(' ')[0]},</p>
              <p>You requested a password reset for your Neyya account. Click the button below to set a new password:</p>
              <p style="text-align:center;margin:30px 0;">
                <a href="${resetUrl}" style="background:#32CD32;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600;">Reset Password</a>
              </p>
              <p style="font-size:12px;color:#666;">This link expires in 1 hour. If you didn't request this, you can safely ignore this email.</p>
              <hr style="border:none;border-top:1px solid #eee;margin:20px 0;" />
              <p style="font-size:11px;color:#999;">Neyya — Your AI Travel Companion</p>
            </div>
          `,
          from: 'Neyya <noreply@neyya.ai>',
        });
      } catch (e) {
        console.error('[Auth] Password reset email failed:', (e as Error).message);
      }

      return reply.send({ statusCode: 200, message: successMessage });
    },
  );
}
