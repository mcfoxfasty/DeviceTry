import Stripe from 'stripe';
import { db } from '../db/adapter';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey || secretKey.startsWith('sk_test_placeholder') || secretKey === 'sk_test_...') {
    return null;
  }
  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

export const PRO_MONTHLY_PRICE_ID = process.env.STRIPE_PRO_PRICE_ID || '';

/**
 * Creates a Stripe Checkout Session for $9 USD/month subscription
 */
export async function createCheckoutSession(params: {
  workspaceId: string;
  userEmail: string;
  returnUrl: string;
  cancelUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return {
      url: null,
      error: 'STRIPE_NOT_CONFIGURED: Stripe secret key has not been provided. Please configure STRIPE_SECRET_KEY in .env.',
    };
  }

  if (!PRO_MONTHLY_PRICE_ID || PRO_MONTHLY_PRICE_ID.includes('...')) {
    return {
      url: null,
      error: 'STRIPE_PRICE_NOT_CONFIGURED: STRIPE_PRO_PRICE_ID is not set. Create a $9 USD/month recurring product in Stripe and provide the Price ID (price_...).',
    };
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email: params.userEmail,
      client_reference_id: params.workspaceId,
      metadata: {
        workspaceId: params.workspaceId,
      },
      line_items: [
        {
          price: PRO_MONTHLY_PRICE_ID,
          quantity: 1,
        },
      ],
      success_url: `${params.returnUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: params.cancelUrl,
      subscription_data: {
        metadata: {
          workspaceId: params.workspaceId,
        },
      },
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
    });

    return { url: session.url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to initialize Stripe checkout';
    return { url: null, error: message };
  }
}

/**
 * Creates a Stripe Customer Portal Session for managing cards, billing info, invoices, cancellation
 */
export async function createPortalSession(params: {
  stripeCustomerId: string;
  returnUrl: string;
}): Promise<{ url: string | null; error?: string }> {
  const stripe = getStripe();
  if (!stripe) {
    return { url: null, error: 'Stripe is not configured.' };
  }

  try {
    const portal = await stripe.billingPortal.sessions.create({
      customer: params.stripeCustomerId,
      return_url: params.returnUrl,
    });
    return { url: portal.url };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to create billing portal';
    return { url: null, error: message };
  }
}

/**
 * Authoritative Webhook Event Handler with Idempotency & Raw Signature Verification
 */
export async function handleStripeWebhook(
  rawPayload: string | Buffer,
  signature: string
): Promise<{ success: boolean; eventType?: string; error?: string }> {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripe || !webhookSecret) {
    return { success: false, error: 'Stripe or webhook secret is unconfigured.' };
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawPayload, signature, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Invalid webhook signature';
    return { success: false, error: `Webhook Signature Verification Failed: ${msg}` };
  }

  // Idempotency check
  const alreadyProcessed = await db.isBillingEventProcessed(event.id);
  if (alreadyProcessed) {
    return { success: true, eventType: event.type };
  }

  // Process supported events
  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const workspaceId = session.client_reference_id || session.metadata?.workspaceId;
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      if (workspaceId && subscriptionId) {
        const subObj = await stripe.subscriptions.retrieve(subscriptionId);
        const firstItem = subObj.items.data[0];
        await db.upsertSubscription({
          workspace_id: workspaceId,
          stripe_subscription_id: subscriptionId,
          stripe_price_id: firstItem ? firstItem.price.id : (PRO_MONTHLY_PRICE_ID || 'price_unknown'),
          status: subObj.status === 'active' || subObj.status === 'trialing' ? 'active' : 'incomplete',
          current_period_start: (subObj as unknown as { current_period_start: number }).current_period_start * 1000 || Date.now(),
          current_period_end: (subObj as unknown as { current_period_end: number }).current_period_end * 1000 || Date.now() + 30 * 86400000,
          cancel_at_period_end: subObj.cancel_at_period_end ? 1 : 0,
        });

        await db.recordAuditEvent(workspaceId, null, 'stripe_subscription_activated', `Sub ID: ${subscriptionId}, Customer: ${customerId}`);
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        const firstItem = sub.items.data[0];
        let normalizedStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' = 'incomplete';
        if (sub.status === 'active' || sub.status === 'trialing') normalizedStatus = 'active';
        else if (sub.status === 'past_due') normalizedStatus = 'past_due';
        else if (sub.status === 'canceled' || sub.status === 'unpaid') normalizedStatus = 'canceled';

        await db.upsertSubscription({
          workspace_id: workspaceId,
          stripe_subscription_id: sub.id,
          stripe_price_id: firstItem ? firstItem.price.id : (PRO_MONTHLY_PRICE_ID || 'price_unknown'),
          status: normalizedStatus,
          current_period_start: (sub as unknown as { current_period_start: number }).current_period_start * 1000 || Date.now(),
          current_period_end: (sub as unknown as { current_period_end: number }).current_period_end * 1000 || Date.now() + 30 * 86400000,
          cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
        });

        await db.recordAuditEvent(workspaceId, null, 'stripe_subscription_updated', `Status: ${sub.status}`);
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const workspaceId = sub.metadata?.workspaceId;
      if (workspaceId) {
        const firstItem = sub.items.data[0];
        await db.upsertSubscription({
          workspace_id: workspaceId,
          stripe_subscription_id: sub.id,
          stripe_price_id: firstItem ? firstItem.price.id : (PRO_MONTHLY_PRICE_ID || 'price_unknown'),
          status: 'canceled',
          current_period_start: (sub as unknown as { current_period_start: number }).current_period_start * 1000 || Date.now(),
          current_period_end: (sub as unknown as { current_period_end: number }).current_period_end * 1000 || Date.now(),
          cancel_at_period_end: 1,
        });

        await db.recordAuditEvent(workspaceId, null, 'stripe_subscription_canceled', `Sub ID: ${sub.id}`);
      }
      break;
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const subId = (invoice as unknown as { subscription?: string }).subscription;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        const workspaceId = sub.metadata?.workspaceId;
        if (workspaceId) {
          const firstItem = sub.items.data[0];
          await db.upsertSubscription({
            workspace_id: workspaceId,
            stripe_subscription_id: sub.id,
            stripe_price_id: firstItem ? firstItem.price.id : (PRO_MONTHLY_PRICE_ID || 'price_unknown'),
            status: 'past_due',
            current_period_start: (sub as unknown as { current_period_start: number }).current_period_start * 1000 || Date.now(),
            current_period_end: (sub as unknown as { current_period_end: number }).current_period_end * 1000 || Date.now(),
            cancel_at_period_end: sub.cancel_at_period_end ? 1 : 0,
          });

          await db.recordAuditEvent(workspaceId, null, 'invoice_payment_failed', `Invoice: ${invoice.id}`);
        }
      }
      break;
    }
  }

  // Record idempotency
  await db.recordBillingEvent(event.id, event.type, `Processed event ${event.id} of type ${event.type}`);

  return { success: true, eventType: event.type };
}
