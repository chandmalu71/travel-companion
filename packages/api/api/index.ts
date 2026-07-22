/**
 * Vercel Serverless Function Entry Point
 *
 * Wraps the Fastify app for Vercel serverless deployment.
 */
import type { IncomingMessage, ServerResponse } from 'http';
import { buildApp } from '../src/app.js';
import { getDatabase } from '../src/db/database.js';

let app: any;

async function getApp() {
  if (!app) {
    const db = getDatabase();
    app = await buildApp({ db });
    await app.ready();
  }
  return app;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const fastify = await getApp();
  await fastify.ready();
  fastify.server.emit('request', req, res);
}
