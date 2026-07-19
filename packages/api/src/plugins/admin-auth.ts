/**
 * Admin Authentication Middleware
 *
 * Verifies that the requesting user has admin privileges (super-admin or support role).
 * Used as a preHandler on all /api/admin/* routes.
 *
 * Roles:
 * - super-admin: Full access to all admin features
 * - support: Read access + user management (no config changes, no deletion)
 *
 * Implements Requirement 30.1-30.5
 */

import { type FastifyInstance, type FastifyRequest, type FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

export type AdminRole = 'super-admin' | 'support';

declare module 'fastify' {
  interface FastifyRequest {
    adminRole?: AdminRole;
    isAdmin?: boolean;
  }
  interface FastifyInstance {
    requireAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
    requireSuperAdmin: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

export interface AdminAuthOptions {
  db: Kysely<Database>;
}

/**
 * Admin auth plugin — registers requireAdmin and requireSuperAdmin decorators.
 */
async function adminAuthPlugin(app: FastifyInstance, options: AdminAuthOptions): Promise<void> {
  const { db } = options;

  /**
   * Middleware: Require any admin role (super-admin or support).
   */
  app.decorate('requireAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = (request as any).userId as string | undefined;

    if (!userId) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'Authentication required',
      });
    }

    // Look up admin role
    const user = await db
      .selectFrom('users')
      .select(['id', 'admin_role', 'suspended'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user) {
      return reply.status(401).send({
        statusCode: 401,
        error: 'UNAUTHORIZED',
        message: 'User not found',
      });
    }

    if (user.suspended) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'SUSPENDED',
        message: 'Your account has been suspended. Contact support@nayya.ai for assistance.',
      });
    }

    const role = user.admin_role as AdminRole | null;
    if (!role || (role !== 'super-admin' && role !== 'support')) {
      return reply.status(403).send({
        statusCode: 403,
        error: 'FORBIDDEN',
        message: 'Admin access required',
      });
    }

    request.adminRole = role;
    request.isAdmin = true;
  });

  /**
   * Middleware: Require super-admin role specifically.
   * Used for destructive or config-changing operations.
   */
  app.decorate('requireSuperAdmin', async (request: FastifyRequest, reply: FastifyReply) => {
    // First run the basic admin check
    const userId = (request as any).userId as string | undefined;

    if (!userId) {
      return reply.status(401).send({ statusCode: 401, error: 'UNAUTHORIZED', message: 'Authentication required' });
    }

    const user = await db
      .selectFrom('users')
      .select(['id', 'admin_role', 'suspended'])
      .where('id', '=', userId)
      .executeTakeFirst();

    if (!user || user.suspended) {
      return reply.status(403).send({ statusCode: 403, error: 'FORBIDDEN', message: 'Access denied' });
    }

    if (user.admin_role !== 'super-admin') {
      return reply.status(403).send({
        statusCode: 403,
        error: 'FORBIDDEN',
        message: 'Super-admin access required for this operation',
      });
    }

    request.adminRole = 'super-admin';
    request.isAdmin = true;
  });
}

export const registerAdminAuth = fp(adminAuthPlugin, {
  name: 'admin-auth',
});

/**
 * Helper: Promote a user to admin (run manually or via CLI).
 */
export async function promoteToAdmin(
  db: Kysely<Database>,
  userId: string,
  role: AdminRole = 'super-admin',
): Promise<void> {
  await db
    .updateTable('users')
    .set({ admin_role: role })
    .where('id', '=', userId)
    .execute();
}

/**
 * Helper: Demote a user from admin.
 */
export async function demoteAdmin(db: Kysely<Database>, userId: string): Promise<void> {
  await db
    .updateTable('users')
    .set({ admin_role: null })
    .where('id', '=', userId)
    .execute();
}
