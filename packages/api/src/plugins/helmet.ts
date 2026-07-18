import { type FastifyInstance } from 'fastify';
import helmet from '@fastify/helmet';

/**
 * Register helmet plugin for security headers.
 */
export async function registerHelmet(app: FastifyInstance): Promise<void> {
  await app.register(helmet, {
    contentSecurityPolicy: false, // Disabled for API-only server
  });
}
