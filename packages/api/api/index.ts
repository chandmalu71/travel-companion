/**
 * Vercel Serverless Function Entry Point
 *
 * Wraps the Fastify app for Vercel serverless deployment.
 */
import type { IncomingMessage, ServerResponse } from 'http';

let app: any;
let initError: string | null = null;

async function getApp() {
  if (initError) throw new Error(initError);
  if (app) return app;

  try {
    const { buildApp } = await import('../src/app.js');
    const { getDatabase } = await import('../src/db/database.js');
    const db = getDatabase();
    app = await buildApp({ db });
    await app.ready();
    return app;
  } catch (err: any) {
    initError = err.message + '\n' + (err.stack ?? '');
    throw err;
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    const fastify = await getApp();
    await fastify.ready();
    fastify.server.emit('request', req, res);
  } catch (err: any) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end(JSON.stringify({
      error: 'API_INIT_FAILED',
      message: err.message,
      stack: process.env.NODE_ENV !== 'production' ? err.stack : undefined,
    }));
  }
}
