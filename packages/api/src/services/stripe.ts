/**
 * Stripe Service
 *
 * Handles:
 * - Checkout session creation (upgrade flow)
 * - Webhook event processing (subscription lifecycle)
 * - Customer portal (self-service billing)
 * - Plan-to-Price mapping
 */
import Stripe from 'stripe';
import { type Kysely } from 'kysely';
import { type Database } from '../db/types.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? '', {
  apiVersion: '2025-04-30.basil' as any,
});

interface CreateCheckoutOptions {
  userId: string;
  email: string;
  planSlug: 'pro' | 'premium';
  billingCycle: 'monthly' | 'annual';
  isFamily?: boolean;
  successUrl: string;
  cancelUrl: string;
}

/**
 * Create a Stripe Checkout Session for subscription upgrade.
 */
export async function createCheckoutSession(
  db: Kysely<Database>,
  options: CreateCheckoutOptions,
): Promise<{ url: string; sessionId: string }> {
  const { userId, email, planSlug, billingCycle, isFamily, successUrl, cancelUrl } = options;

  // Get plan pricing from DB
  const plan = await (db.selectFrom('subscription_plans' as any) as any)
    .selectAll()
    .where('slug', '=', planSlug)
    .executeTakeFirst();

  if (!plan) throw new Error(`Plan "${planSlug}" not found`);

  // Determine price in cents
  let priceEur: number;
  if (isFamily) {
    priceEur = billingCycle === 'annual' ? Number(plan.price_annual_family_eur) : Number(plan.price_monthly_family_eur);
  } else {
    priceEur = billingCycle === 'annual' ? Number(plan.price_annual_eur) : Number(plan.price_monthly_eur);
  }
  const priceInCents = Math.round(priceEur * 100);

  // Find or create Stripe customer
  let customerId: string | undefined;
  const sub = await (db.selectFrom('user_subscriptions' as any) as any)
    .select('stripe_customer_id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (sub?.stripe_customer_id) {
    customerId = sub.stripe_customer_id;
  } else {
    const customer = await stripe.customers.create({
      email,
      metadata: { userId, planSlug },
    });
    customerId = customer.id;
  }

  // Create checkout session
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    line_items: [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: `Neyya ${plan.name}${isFamily ? ' Family' : ''}`,
          description: `${billingCycle === 'annual' ? 'Annual' : 'Monthly'} subscription`,
        },
        unit_amount: priceInCents,
        recurring: {
          interval: billingCycle === 'annual' ? 'year' : 'month',
        },
      },
      quantity: 1,
    }],
    success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl,
    metadata: { userId, planSlug, billingCycle, isFamily: isFamily ? 'true' : 'false' },
    subscription_data: {
      metadata: { userId, planSlug },
    },
  });

  return { url: session.url!, sessionId: session.id };
}

/**
 * Create a Stripe Customer Portal session (self-service billing management).
 */
export async function createPortalSession(
  db: Kysely<Database>,
  userId: string,
  returnUrl: string,
): Promise<{ url: string }> {
  const sub = await (db.selectFrom('user_subscriptions' as any) as any)
    .select('stripe_customer_id')
    .where('user_id', '=', userId)
    .executeTakeFirst();

  if (!sub?.stripe_customer_id) {
    throw new Error('No Stripe customer found for this user');
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: returnUrl,
  });

  return { url: session.url };
}

/**
 * Process a Stripe webhook event.
 * Updates user_subscriptions based on subscription lifecycle events.
 */
export async function handleWebhookEvent(
  db: Kysely<Database>,
  event: Stripe.Event,
): Promise<void> {
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planSlug = session.metadata?.planSlug;
      const billingCycle = session.metadata?.billingCycle ?? 'monthly';
      const isFamily = session.metadata?.isFamily === 'true';

      if (!userId || !planSlug) break;

      // Get plan ID
      const plan = await (db.selectFrom('subscription_plans' as any) as any)
        .select('id')
        .where('slug', '=', planSlug)
        .executeTakeFirst();
      if (!plan) break;

      // Create or update subscription
      const existing = await (db.selectFrom('user_subscriptions' as any) as any)
        .select('id')
        .where('user_id', '=', userId)
        .executeTakeFirst();

      if (existing) {
        await (db.updateTable('user_subscriptions' as any) as any).set({
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          is_family_plan: isFamily,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          cancel_at_period_end: false,
          updated_at: new Date(),
        }).where('user_id', '=', userId).execute();
      } else {
        await (db.insertInto('user_subscriptions' as any) as any).values({
          user_id: userId,
          plan_id: plan.id,
          status: 'active',
          billing_cycle: billingCycle,
          is_family_plan: isFamily,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: session.subscription as string,
          auto_renew: true,
          cancel_at_period_end: false,
        }).execute();
      }

      console.log(`[Stripe] Checkout completed: user=${userId} plan=${planSlug}`);
      break;
    }

    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoice.subscription as string;
      if (!subId) break;

      // Update period end
      const stripeSub = await stripe.subscriptions.retrieve(subId);
      await (db.updateTable('user_subscriptions' as any) as any).set({
        status: 'active',
        current_period_end: new Date(stripeSub.current_period_end * 1000),
        updated_at: new Date(),
      }).where('stripe_subscription_id', '=', subId).execute();

      console.log(`[Stripe] Invoice paid: subscription=${subId}`);
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = invoice.subscription as string;
      if (!subId) break;

      await (db.updateTable('user_subscriptions' as any) as any).set({
        status: 'past_due',
        updated_at: new Date(),
      }).where('stripe_subscription_id', '=', subId).execute();

      console.log(`[Stripe] Payment failed: subscription=${subId}`);
      break;
    }

    case 'customer.subscription.updated': {
      const subscription = event.data.object as Stripe.Subscription;
      const updates: Record<string, unknown> = { updated_at: new Date() };

      if (subscription.cancel_at_period_end) {
        updates.cancel_at_period_end = true;
      } else {
        updates.cancel_at_period_end = false;
      }
      updates.current_period_end = new Date(subscription.current_period_end * 1000);
      updates.status = subscription.status === 'active' ? 'active' : subscription.status;

      await (db.updateTable('user_subscriptions' as any) as any)
        .set(updates)
        .where('stripe_subscription_id', '=', subscription.id)
        .execute();

      console.log(`[Stripe] Subscription updated: ${subscription.id} status=${subscription.status}`);
      break;
    }

    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;

      // Downgrade to free
      const freePlan = await (db.selectFrom('subscription_plans' as any) as any)
        .select('id')
        .where('slug', '=', 'free')
        .executeTakeFirst();

      await (db.updateTable('user_subscriptions' as any) as any).set({
        plan_id: freePlan?.id,
        status: 'cancelled',
        cancel_at_period_end: false,
        stripe_subscription_id: null,
        updated_at: new Date(),
      }).where('stripe_subscription_id', '=', subscription.id).execute();

      console.log(`[Stripe] Subscription deleted (downgraded to free): ${subscription.id}`);
      break;
    }
  }
}

/**
 * Verify Stripe webhook signature.
 */
export function verifyWebhookSignature(payload: string | Buffer, signature: string): Stripe.Event {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? '';
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}
