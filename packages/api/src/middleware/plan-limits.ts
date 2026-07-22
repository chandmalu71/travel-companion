/**
 * Plan Limits Enforcement Middleware
 *
 * Checks the user's subscription plan limits before allowing resource creation.
 * Returns 403 with upgrade prompt when limit is reached.
 *
 * Usage in routes:
 *   await checkPlanLimit(db, userId, 'trips');
 *   // throws PlanLimitError if limit exceeded
 */
import { type Kysely, sql } from 'kysely';
import { type Database } from '../db/types.js';

export class PlanLimitError extends Error {
  statusCode = 403;
  limit: number;
  current: number;
  resource: string;
  planName: string;

  constructor(resource: string, limit: number, current: number, planName: string) {
    super(`Plan limit reached: ${resource} (${current}/${limit}) on ${planName} plan`);
    this.resource = resource;
    this.limit = limit;
    this.current = current;
    this.planName = planName;
  }
}

type LimitResource =
  | 'trips'
  | 'expenses'
  | 'network_connections'
  | 'family_members'
  | 'email_aliases'
  | 'messages'
  | 'ai_tips'
  | 'ai_chat';

/**
 * Get user's current plan (resolves subscription or defaults to Free)
 */
async function getUserPlan(db: Kysely<Database>, userId: string): Promise<any> {
  const sub = await (db.selectFrom('user_subscriptions' as any) as any)
    .innerJoin('subscription_plans' as any, 'subscription_plans.id', 'user_subscriptions.plan_id')
    .selectAll('subscription_plans' as any)
    .select(['user_subscriptions.status', 'user_subscriptions.trial_ends_at'])
    .where('user_subscriptions.user_id', '=', userId)
    .executeTakeFirst();

  if (!sub || (sub as any).status === 'cancelled') {
    return (db.selectFrom('subscription_plans' as any) as any).selectAll().where('slug', '=', 'free').executeTakeFirst();
  }

  // If on trial and trial hasn't expired, treat as Premium
  if ((sub as any).status === 'trialing') {
    const trialEnd = new Date((sub as any).trial_ends_at);
    if (trialEnd > new Date()) return sub; // trial active, use trial plan limits
    // Trial expired — fall back to free
    return (db.selectFrom('subscription_plans' as any) as any).selectAll().where('slug', '=', 'free').executeTakeFirst();
  }

  return sub;
}

/**
 * Get current usage count for a resource
 */
async function getUsageCount(db: Kysely<Database>, userId: string, resource: LimitResource): Promise<number> {
  let result: any;

  switch (resource) {
    case 'trips':
      result = await db.selectFrom('trips').select(db.fn.count<number>('id').as('c')).where('owner_id', '=', userId).executeTakeFirst();
      break;
    case 'expenses':
      // Monthly count
      result = await (db.selectFrom('expenses') as any).select(sql<number>`count(*)`.as('c'))
        .where('user_id', '=', userId)
        .where('created_at', '>=', sql`date_trunc('month', now())`)
        .executeTakeFirst();
      break;
    case 'network_connections':
      result = await (db.selectFrom('user_connections') as any).select(sql<number>`count(*)`.as('c')).where('user_id', '=', userId).executeTakeFirst();
      break;
    case 'family_members':
      result = await (db.selectFrom('family_members' as any) as any).select(sql<number>`count(*)`.as('c')).where('user_id', '=', userId).executeTakeFirst();
      break;
    case 'email_aliases':
      result = await (db.selectFrom('user_email_aliases' as any) as any).select(sql<number>`count(*)`.as('c')).where('user_id', '=', userId).executeTakeFirst();
      break;
    case 'messages':
      // Daily count
      result = await (db.selectFrom('messages' as any) as any).select(sql<number>`count(*)`.as('c'))
        .where('sender_id', '=', userId)
        .where('created_at', '>=', sql`date_trunc('day', now())`)
        .executeTakeFirst();
      break;
    case 'ai_tips':
      result = { c: 0 };
      break;
    case 'ai_chat':
      result = { c: 0 };
      break;
  }

  return Number(result?.c ?? 0);
}

/**
 * Get the plan limit for a resource
 */
function getPlanLimit(plan: any, resource: LimitResource): number | null {
  switch (resource) {
    case 'trips': return plan.max_active_trips;
    case 'expenses': return plan.max_expenses_per_month;
    case 'network_connections': return plan.max_network_connections;
    case 'family_members': return plan.max_family_members;
    case 'email_aliases': return plan.max_email_aliases;
    case 'messages': return plan.max_messages_per_day;
    case 'ai_tips': return plan.max_ai_tips_per_trip;
    case 'ai_chat': return plan.max_ai_chat_per_day;
    default: return null;
  }
}

/**
 * Check if user can create a new resource. Throws PlanLimitError if limit exceeded.
 * Returns silently if limit not reached or limit is null (unlimited).
 */
export async function checkPlanLimit(
  db: Kysely<Database>,
  userId: string,
  resource: LimitResource,
): Promise<void> {
  const plan = await getUserPlan(db, userId);
  if (!plan) return; // no plan info, allow (shouldn't happen)

  const limit = getPlanLimit(plan, resource);
  if (limit === null || limit === undefined) return; // null = unlimited

  const current = await getUsageCount(db, userId, resource);

  if (current >= limit) {
    throw new PlanLimitError(resource, limit, current, plan.name ?? 'Free');
  }
}

/**
 * Check if a specific feature is available on user's plan.
 * Uses the 'features' JSON array on the plan.
 */
export async function checkPlanFeature(
  db: Kysely<Database>,
  userId: string,
  feature: string,
): Promise<boolean> {
  const plan = await getUserPlan(db, userId);
  if (!plan) return false;
  const features: string[] = plan.features ?? [];
  return features.includes(feature);
}
