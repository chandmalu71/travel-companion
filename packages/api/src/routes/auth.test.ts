import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { type FastifyInstance } from 'fastify';
import { buildApp } from '../app.js';
import { type CognitoService } from '../services/cognito.js';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

// ─── Mock Cognito Service ────────────────────────────────────────────────────

function createMockCognitoService(): CognitoService {
  return {
    signUp: vi.fn(),
    initiateAuth: vi.fn(),
    refreshAuth: vi.fn(),
    forgotPassword: vi.fn(),
  } as unknown as CognitoService;
}

// ─── Mock Database ───────────────────────────────────────────────────────────

function createMockDb() {
  const mockExecuteTakeFirstOrThrow = vi.fn();
  const mockExecuteTakeFirst = vi.fn();
  const mockReturning = vi.fn(() => ({ executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow }));
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsertInto = vi.fn(() => ({ values: mockValues }));

  const mockWhere = vi.fn(() => ({ executeTakeFirst: mockExecuteTakeFirst }));
  const mockSelect = vi.fn(() => ({ where: mockWhere }));
  const mockSelectFrom = vi.fn(() => ({ select: mockSelect }));

  return {
    db: {
      insertInto: mockInsertInto,
      selectFrom: mockSelectFrom,
    } as unknown as Kysely<Database>,
    mocks: {
      insertInto: mockInsertInto,
      values: mockValues,
      returning: mockReturning,
      executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
      selectFrom: mockSelectFrom,
      select: mockSelect,
      where: mockWhere,
      executeTakeFirst: mockExecuteTakeFirst,
    },
  };
}

describe('Auth Routes', () => {
  let app: FastifyInstance;
  let mockCognito: CognitoService;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeAll(async () => {
    mockCognito = createMockCognitoService();
    mockDb = createMockDb();

    app = await buildApp({
      logger: false,
      skipRedis: true,
      authOptions: {
        cognitoService: mockCognito,
        db: mockDb.db,
      },
    });
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  // ─── Registration Tests ──────────────────────────────────────────────────

  describe('POST /api/auth/register', () => {
    it('returns 201 on successful registration', async () => {
      (mockCognito.signUp as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        userSub: 'cognito-sub-123',
        userConfirmed: false,
      });
      mockDb.mocks.executeTakeFirstOrThrow.mockResolvedValueOnce({
        id: 'user-uuid-123',
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(201);
      const body = response.json();
      expect(body.userId).toBe('user-uuid-123');
      expect(body.verificationRequired).toBe(true);
    });

    it('returns 400 for invalid email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'not-an-email',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password too short', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'Ab1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without uppercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'lowercase1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without lowercase', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'UPPERCASE1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for password without digit', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'NoDigitHere',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for missing body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('VALIDATION_ERROR');
    });

    it('returns 409 when email already exists', async () => {
      const error = new Error('User already exists');
      (error as unknown as { name: string }).name = 'UsernameExistsException';
      (mockCognito.signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'existing@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(409);
      const body = response.json();
      expect(body.error).toBe('EMAIL_EXISTS');
    });

    it('returns 400 for Cognito InvalidPasswordException', async () => {
      const error = new Error('Invalid password');
      (error as unknown as { name: string }).name = 'InvalidPasswordException';
      (mockCognito.signUp as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/register',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('INVALID_PASSWORD');
    });
  });

  // ─── Login Tests ─────────────────────────────────────────────────────────

  describe('POST /api/auth/login', () => {
    it('returns 200 with tokens and user profile on successful login', async () => {
      (mockCognito.initiateAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        accessToken: 'access-token-jwt',
        refreshToken: 'refresh-token-jwt',
        idToken: 'id-token-jwt',
        expiresIn: 3600,
      });
      mockDb.mocks.executeTakeFirst.mockResolvedValueOnce({
        id: 'user-uuid-123',
        email: 'test@example.com',
        display_name: 'test',
        avatar_url: null,
        email_verified: true,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accessToken).toBe('access-token-jwt');
      expect(body.refreshToken).toBe('refresh-token-jwt');
      expect(body.user.id).toBe('user-uuid-123');
      expect(body.user.email).toBe('test@example.com');
      expect(body.user.email_verified).toBe(true);
    });

    it('returns 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for missing password', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for invalid credentials', async () => {
      const error = new Error('Incorrect username or password');
      (error as unknown as { name: string }).name = 'NotAuthorizedException';
      (mockCognito.initiateAuth as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'WrongPass1',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 403 for unverified email', async () => {
      const error = new Error('User is not confirmed');
      (error as unknown as { name: string }).name = 'UserNotConfirmedException';
      (mockCognito.initiateAuth as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(403);
      const body = response.json();
      expect(body.error).toBe('EMAIL_NOT_VERIFIED');
    });

    it('returns 401 for non-existent user (no email enumeration)', async () => {
      const error = new Error('User does not exist');
      (error as unknown as { name: string }).name = 'UserNotFoundException';
      (mockCognito.initiateAuth as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'noone@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('INVALID_CREDENTIALS');
    });

    it('returns 404 when user is not in local DB', async () => {
      (mockCognito.initiateAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        accessToken: 'access-token-jwt',
        refreshToken: 'refresh-token-jwt',
        idToken: 'id-token-jwt',
        expiresIn: 3600,
      });
      mockDb.mocks.executeTakeFirst.mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: {
          email: 'test@example.com',
          password: 'ValidPass1',
        },
      });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error).toBe('USER_NOT_FOUND');
    });
  });

  // ─── OAuth Tests ─────────────────────────────────────────────────────────

  describe('POST /api/auth/oauth', () => {
    it('returns 400 for missing provider', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        payload: {
          idToken: 'some-id-token',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for missing idToken', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        payload: {
          provider: 'google',
        },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for invalid provider', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        payload: {
          provider: 'facebook',
          idToken: 'some-id-token',
        },
      });

      expect(response.statusCode).toBe(400);
      const body = response.json();
      expect(body.error).toBe('INVALID_PROVIDER');
    });

    it('returns 501 for valid OAuth request (not yet implemented)', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/oauth',
        payload: {
          provider: 'google',
          idToken: 'valid-google-id-token',
        },
      });

      expect(response.statusCode).toBe(501);
      const body = response.json();
      expect(body.error).toBe('NOT_IMPLEMENTED');
    });
  });

  // ─── Password Reset Tests ────────────────────────────────────────────────

  describe('POST /api/auth/password-reset', () => {
    it('returns 200 on successful password reset request', async () => {
      (mockCognito.forgotPassword as ReturnType<typeof vi.fn>).mockResolvedValueOnce(undefined);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.message).toContain('password reset link');
    });

    it('returns 200 even for non-existent email (no enumeration)', async () => {
      const error = new Error('User does not exist');
      (error as unknown as { name: string }).name = 'UserNotFoundException';
      (mockCognito.forgotPassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset',
        payload: {
          email: 'noone@example.com',
        },
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 400 for missing email', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 429 when rate limited by Cognito', async () => {
      const error = new Error('Attempt limit exceeded');
      (error as unknown as { name: string }).name = 'LimitExceededException';
      (mockCognito.forgotPassword as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/password-reset',
        payload: {
          email: 'test@example.com',
        },
      });

      expect(response.statusCode).toBe(429);
    });
  });

  // ─── Refresh Token Tests ─────────────────────────────────────────────────

  describe('POST /api/auth/refresh', () => {
    it('returns 200 with new tokens on successful refresh', async () => {
      (mockCognito.refreshAuth as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        accessToken: 'new-access-token',
        refreshToken: 'original-refresh-token',
        idToken: 'new-id-token',
        expiresIn: 3600,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'valid-refresh-token',
        },
      });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.accessToken).toBe('new-access-token');
      expect(body.refreshToken).toBe('original-refresh-token');
      expect(body.expiresIn).toBe(3600);
    });

    it('returns 400 for missing refresh token', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {},
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 401 for invalid refresh token', async () => {
      const error = new Error('Invalid Refresh Token');
      (error as unknown as { name: string }).name = 'NotAuthorizedException';
      (mockCognito.refreshAuth as ReturnType<typeof vi.fn>).mockRejectedValueOnce(error);

      const response = await app.inject({
        method: 'POST',
        url: '/api/auth/refresh',
        payload: {
          refreshToken: 'expired-refresh-token',
        },
      });

      expect(response.statusCode).toBe(401);
      const body = response.json();
      expect(body.error).toBe('INVALID_TOKEN');
    });
  });
});
