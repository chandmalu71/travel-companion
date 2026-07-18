import { type FastifyInstance } from 'fastify';
import fastifyEnv from '@fastify/env';

/**
 * Environment variable schema for @fastify/env validation.
 */
const envSchema = {
  type: 'object',
  required: ['PORT'],
  properties: {
    PORT: {
      type: 'number',
      default: 3000,
    },
    HOST: {
      type: 'string',
      default: '0.0.0.0',
    },
    NODE_ENV: {
      type: 'string',
      default: 'development',
      enum: ['development', 'production', 'test'],
    },
    LOG_LEVEL: {
      type: 'string',
      default: 'info',
      enum: ['fatal', 'error', 'warn', 'info', 'debug', 'trace'],
    },
    CORS_ORIGIN: {
      type: 'string',
      default: '*',
    },
    RATE_LIMIT_MAX: {
      type: 'number',
      default: 100,
    },
    RATE_LIMIT_TIME_WINDOW: {
      type: 'number',
      default: 60000,
    },
    DATABASE_URL: {
      type: 'string',
      default: 'postgresql://localhost:5432/travel_companion',
    },
    REDIS_URL: {
      type: 'string',
      default: 'redis://localhost:6379',
    },
    COGNITO_USER_POOL_ID: {
      type: 'string',
      default: '',
    },
    COGNITO_CLIENT_ID: {
      type: 'string',
      default: '',
    },
    COGNITO_REGION: {
      type: 'string',
      default: 'eu-west-1',
    },
    COGNITO_JWKS_URL: {
      type: 'string',
      default: '',
    },
    GOOGLE_PLACES_API_KEY: {
      type: 'string',
      default: '',
    },
    GMAIL_CLIENT_ID: {
      type: 'string',
      default: '',
    },
    GMAIL_CLIENT_SECRET: {
      type: 'string',
      default: '',
    },
    OUTLOOK_CLIENT_ID: {
      type: 'string',
      default: '',
    },
    OUTLOOK_CLIENT_SECRET: {
      type: 'string',
      default: '',
    },
    EMAIL_ENCRYPTION_KEY: {
      type: 'string',
      default: '',
    },
    SQS_EMAIL_QUEUE_URL: {
      type: 'string',
      default: '',
    },
  },
} as const;

export interface AppConfig {
  PORT: number;
  HOST: string;
  NODE_ENV: string;
  LOG_LEVEL: string;
  CORS_ORIGIN: string;
  RATE_LIMIT_MAX: number;
  RATE_LIMIT_TIME_WINDOW: number;
  DATABASE_URL: string;
  REDIS_URL: string;
  COGNITO_USER_POOL_ID: string;
  COGNITO_CLIENT_ID: string;
  COGNITO_REGION: string;
  COGNITO_JWKS_URL: string;
  GOOGLE_PLACES_API_KEY: string;
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  OUTLOOK_CLIENT_ID: string;
  OUTLOOK_CLIENT_SECRET: string;
  EMAIL_ENCRYPTION_KEY: string;
  SQS_EMAIL_QUEUE_URL: string;
}

/**
 * Register environment variable configuration plugin.
 */
export async function registerConfig(app: FastifyInstance): Promise<void> {
  await app.register(fastifyEnv, {
    schema: envSchema,
    dotenv: true,
  });
}
