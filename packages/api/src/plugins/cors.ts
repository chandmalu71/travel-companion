import { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';

/**
 * Register CORS plugin with configurable origin.
 */
export async function registerCors(app: FastifyInstance): Promise<void> {
  const origin = (app as unknown as { config: { CORS_ORIGIN: string } }).config
    .CORS_ORIGIN;

  await app.register(cors, {
    origin: origin === '*' ? true : origin.split(','),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  });
}
