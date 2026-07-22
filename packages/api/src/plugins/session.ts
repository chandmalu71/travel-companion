import { type FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { type Redis as RedisClient } from 'ioredis';

export interface SessionData {
  userId: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  [key: string]: unknown;
}

export interface CreateSessionInput {
  userId: string;
  email: string;
  [key: string]: unknown;
}

export interface SessionStore {
  /** Create a new session, returns the session ID */
  create(data: CreateSessionInput): Promise<string>;
  /** Get session data by session ID, returns null if expired or not found */
  get(sessionId: string): Promise<SessionData | null>;
  /** Update session data (extends TTL) */
  update(sessionId: string, data: Partial<SessionData>): Promise<boolean>;
  /** Delete a session */
  destroy(sessionId: string): Promise<boolean>;
  /** Touch a session to extend its TTL without modifying data */
  touch(sessionId: string): Promise<boolean>;
}

declare module 'fastify' {
  interface FastifyInstance {
    sessionStore: SessionStore;
  }
}

export interface SessionPluginOptions {
  /** Session TTL in seconds (default: 30 days) */
  ttl?: number;
  /** Key prefix for session storage in Redis */
  prefix?: string;
}

/** Default session TTL: 30 days in seconds */
const DEFAULT_SESSION_TTL = 30 * 24 * 60 * 60;
const DEFAULT_PREFIX = 'session:';

function generateSessionId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let id = '';
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  for (const byte of bytes) {
    id += chars[byte % chars.length];
  }
  return id;
}

function createSessionStore(
  redis: RedisClient,
  options: SessionPluginOptions = {},
): SessionStore {
  const ttl = options.ttl ?? DEFAULT_SESSION_TTL;
  const prefix = options.prefix ?? DEFAULT_PREFIX;

  return {
    async create(data: CreateSessionInput): Promise<string> {
      const sessionId = generateSessionId();
      const now = Date.now();
      const sessionData: SessionData = {
        ...data,
        createdAt: now,
        expiresAt: now + ttl * 1000,
      };
      const key = `${prefix}${sessionId}`;
      await redis.set(key, JSON.stringify(sessionData), 'EX', ttl);
      return sessionId;
    },

    async get(sessionId: string): Promise<SessionData | null> {
      const key = `${prefix}${sessionId}`;
      const raw = await redis.get(key);
      if (!raw) return null;

      const data = JSON.parse(raw) as SessionData;
      return data;
    },

    async update(sessionId: string, data: Partial<SessionData>): Promise<boolean> {
      const key = `${prefix}${sessionId}`;
      const raw = await redis.get(key);
      if (!raw) return false;

      const existing = JSON.parse(raw) as SessionData;
      const updated: SessionData = {
        ...existing,
        ...data,
        expiresAt: Date.now() + ttl * 1000,
      };
      await redis.set(key, JSON.stringify(updated), 'EX', ttl);
      return true;
    },

    async destroy(sessionId: string): Promise<boolean> {
      const key = `${prefix}${sessionId}`;
      const deleted = await redis.del(key);
      return deleted > 0;
    },

    async touch(sessionId: string): Promise<boolean> {
      const key = `${prefix}${sessionId}`;
      const exists = await redis.expire(key, ttl);
      if (exists) {
        // Also update the expiresAt in the stored data
        const raw = await redis.get(key);
        if (raw) {
          const data = JSON.parse(raw) as SessionData;
          data.expiresAt = Date.now() + ttl * 1000;
          await redis.set(key, JSON.stringify(data), 'EX', ttl);
        }
      }
      return exists === 1;
    },
  };
}

/**
 * Session management plugin for Fastify.
 *
 * Uses Redis to store session data with configurable TTL.
 * Sessions auto-expire after 30 days of inactivity (sliding window).
 * Decorates the Fastify instance with `app.sessionStore`.
 */
async function sessionPlugin(
  app: FastifyInstance,
  options: SessionPluginOptions,
): Promise<void> {
  if (!app.redis) {
    app.log.warn('Redis not available — session store disabled');
    return;
  }

  const store = createSessionStore(app.redis, options);
  app.decorate('sessionStore', store);
}

export const registerSession = fp(sessionPlugin, {
  name: 'session',
  dependencies: ['redis'],
  fastify: '>=4.0.0',
});
