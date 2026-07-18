/**
 * @travel-companion/api
 *
 * Fastify API server for Travel Companion application.
 * Provides RESTful endpoints for trips, bookings, authentication,
 * and all supporting services.
 */

export { buildApp } from './app.js';
export type { AppConfig } from './config.js';
export type { HealthCheckResponse } from './routes/health.js';
