/**
 * Setup Super Admin — Creates a persistent super-admin account.
 * This account is NOT affected by seed --clean.
 *
 * Usage: npx tsx src/scripts/setup-super-admin.ts
 */

import { Kysely, PostgresDialect, sql } from 'kysely';
import { Pool } from 'pg';
import crypto from 'crypto';

const db = new Kysely<any>({
  dialect: new PostgresDialect({
    pool: new Pool({ connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/travel_companion' }),
  }),
});

function hashPassword(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

const SUPER_ADMIN = {
  email: 'chand.malu@gmail.com',
  displayName: 'Chand Malu',
  password: 'SuperAdmin2026!',
  adminRole: 'super-admin',
};

async function setup() {
  console.log('🔐 Setting up super-admin account...\n');

  // Check if user already exists
  const existing = await db
    .selectFrom('users')
    .select(['id', 'email', 'admin_role'])
    .where('email', '=', SUPER_ADMIN.email)
    .executeTakeFirst();

  if (existing) {
    // Update to super-admin if not already
    if (existing.admin_role !== 'super-admin') {
      await db.updateTable('users')
        .set({ admin_role: 'super-admin', password_hash: hashPassword(SUPER_ADMIN.password) })
        .where('id', '=', existing.id)
        .execute();
      console.log(`  ✅ Existing user promoted to super-admin: ${SUPER_ADMIN.email}`);
    } else {
      // Just update password
      await db.updateTable('users')
        .set({ password_hash: hashPassword(SUPER_ADMIN.password) })
        .where('id', '=', existing.id)
        .execute();
      console.log(`  ✅ Super-admin already exists, password updated: ${SUPER_ADMIN.email}`);
    }
  } else {
    // Create the user
    await sql`INSERT INTO users (email, display_name, cognito_sub, email_verified, password_hash, admin_role)
      VALUES (${SUPER_ADMIN.email}, ${SUPER_ADMIN.displayName}, ${'super-admin-' + SUPER_ADMIN.email}, true, ${hashPassword(SUPER_ADMIN.password)}, ${SUPER_ADMIN.adminRole})
      ON CONFLICT (email) DO UPDATE SET admin_role = 'super-admin', password_hash = ${hashPassword(SUPER_ADMIN.password)}`.execute(db);
    console.log(`  ✅ Super-admin created: ${SUPER_ADMIN.email}`);
  }

  // Also create user_preferences
  const user = await db.selectFrom('users').select('id').where('email', '=', SUPER_ADMIN.email).executeTakeFirst();
  if (user) {
    await sql`INSERT INTO user_preferences (user_id, language, locale_code)
      VALUES (${user.id}, 'en', 'en-GB')
      ON CONFLICT (user_id) DO NOTHING`.execute(db);
  }

  console.log(`\n🔐 Super-admin setup complete!`);
  console.log(`   Email: ${SUPER_ADMIN.email}`);
  console.log(`   Password: ${SUPER_ADMIN.password}`);
  console.log(`   Role: super-admin`);
  console.log(`\n   This account persists across seed --clean operations.`);

  await db.destroy();
}

setup().catch((e) => {
  console.error('❌ Error:', e.message);
  process.exit(1);
});
