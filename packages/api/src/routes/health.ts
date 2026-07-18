import { type FastifyInstance } from 'fastify';

export interface HealthCheckResponse {
  status: 'ok';
  timestamp: string;
  uptime: number;
  environment: string;
}

/**
 * Register health check route.
 */
export async function registerHealthRoutes(
  app: FastifyInstance,
): Promise<void> {
  app.get('/api/health', async (_request, _reply) => {
    const response: HealthCheckResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment:
        (
          app as unknown as {
            config: { NODE_ENV: string };
          }
        ).config.NODE_ENV || 'development',
    };
    return response;
  });
}
