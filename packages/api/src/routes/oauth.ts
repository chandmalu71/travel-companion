/**
 * OAuth Routes — Google (+ Microsoft future)
 *
 * Flow:
 * 1. User clicks "Sign in with Google" → GET /api/auth/google
 * 2. Redirects to Google consent screen
 * 3. Google redirects back → GET /api/auth/google/callback
 * 4. Exchange code for tokens, get profile, create/find user, issue JWT
 * 5. Redirect to frontend /auth/callback with tokens
 */
import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';
import { randomUUID, createHmac } from 'node:crypto';

interface OAuthOptions {
  db: Kysely<Database>;
}

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo';

export async function registerOAuthRoutes(
  app: FastifyInstance,
  options: OAuthOptions,
): Promise<void> {
  const { db } = options;

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.APP_URL ?? 'http://localhost:3001';
  const apiUrl = process.env.API_URL ?? 'http://localhost:3000';
  const redirectUri = `${apiUrl}/api/auth/google/callback`;

  // ─── GET /api/auth/google ──────────────────────────────────────────────────
  app.get('/api/auth/google', async (_request: FastifyRequest, reply: FastifyReply) => {
    if (!clientId) {
      return reply.status(500).send({ statusCode: 500, error: 'Google OAuth not configured' });
    }

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'consent',
    });

    return reply.redirect(`${GOOGLE_AUTH_URL}?${params.toString()}`);
  });

  // ─── GET /api/auth/google/callback ─────────────────────────────────────────
  app.get('/api/auth/google/callback', async (request: FastifyRequest<{ Querystring: { code?: string; error?: string } }>, reply: FastifyReply) => {
    const { code, error } = request.query;

    if (error || !code) {
      return reply.redirect(`${appUrl}/login?error=oauth_cancelled`);
    }

    if (!clientId || !clientSecret) {
      return reply.redirect(`${appUrl}/login?error=oauth_not_configured`);
    }

    try {
      // Exchange code for tokens
      const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });

      if (!tokenRes.ok) {
        console.error('[OAuth] Token exchange failed:', await tokenRes.text());
        return reply.redirect(`${appUrl}/login?error=oauth_token_failed`);
      }

      const tokens = await tokenRes.json() as { access_token: string };

      // Get user profile from Google
      const profileRes = await fetch(GOOGLE_USERINFO_URL, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });

      if (!profileRes.ok) {
        return reply.redirect(`${appUrl}/login?error=oauth_profile_failed`);
      }

      const profile = await profileRes.json() as {
        sub: string; email: string; name: string; picture?: string;
      };

      // Find or create user in our DB
      let user = await db.selectFrom('users')
        .selectAll()
        .where('email', '=', profile.email.toLowerCase())
        .executeTakeFirst();

      if (!user) {
        // New user — create account
        user = await db.insertInto('users')
          .values({
            id: randomUUID(),
            email: profile.email.toLowerCase(),
            display_name: profile.name,
            cognito_sub: `google_${profile.sub}`,
            password_hash: '',
          })
          .returningAll()
          .executeTakeFirstOrThrow();

        console.log(`[OAuth] New user created via Google: ${profile.email}`);
      } else if (!user.cognito_sub?.startsWith('google_')) {
        // Link Google to existing account
        await db.updateTable('users')
          .set({ cognito_sub: `google_${profile.sub}` })
          .where('id', '=', user.id)
          .execute();
      }

      // Generate JWT tokens
      const jwt = generateJWT(user.id, user.email);

      // Redirect to frontend callback page with tokens
      const callbackParams = new URLSearchParams({
        token: jwt.accessToken,
        refreshToken: jwt.refreshToken,
        user: JSON.stringify({ displayName: user.display_name ?? profile.name, email: user.email }),
      });

      return reply.redirect(`${appUrl}/auth/callback?${callbackParams.toString()}`);
    } catch (err: any) {
      console.error('[OAuth] Error:', err.message);
      return reply.redirect(`${appUrl}/login?error=oauth_failed`);
    }
  });
}

// ─── JWT Generation (mirrors existing auth logic) ────────────────────────────
function generateJWT(userId: string, email: string): { accessToken: string; refreshToken: string } {
  const secret = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');

  const accessPayload = Buffer.from(JSON.stringify({
    sub: userId, email, iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString('base64url');

  const refreshPayload = Buffer.from(JSON.stringify({
    sub: userId, email, type: 'refresh', iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 2592000,
  })).toString('base64url');

  const accessSig = createHmac('sha256', secret).update(`${header}.${accessPayload}`).digest('base64url');
  const refreshSig = createHmac('sha256', secret).update(`${header}.${refreshPayload}`).digest('base64url');

  return {
    accessToken: `${header}.${accessPayload}.${accessSig}`,
    refreshToken: `${header}.${refreshPayload}.${refreshSig}`,
  };
}
