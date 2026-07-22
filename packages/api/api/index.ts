/**
 * Vercel Serverless Function Entry Point
 * 
 * Wraps the Fastify app as a Vercel serverless function.
 * Vercel routes all requests to this handler.
 */
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

export default async function handler(req: any, res: any) {
  const fastify = await getApp();
  fastify.server.emit('request', req, res);
}
