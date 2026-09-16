import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { createPortalSession } from '@/lib/stripe/billing';
import { db } from '@/lib/db/adapter';
import { isProEnabled } from '@/lib/config/mode';

export async function POST(req: NextRequest) {
  if (!isProEnabled()) {
    return NextResponse.json({ error: 'Pro features are disabled in FREE_ONLY mode.' }, { status: 404 });
  }

  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;

    // Get customer ID from subscription
    const sub = await db.getSubscription(subscriber.workspace.id);
    if (!sub) {
      return NextResponse.json({ error: 'No active Stripe customer found for this workspace.' }, { status: 404 });
    }

    const { url, error } = await createPortalSession({
      stripeCustomerId: sub.stripe_subscription_id,
      returnUrl: `${origin}/pro/workspace`,
    });

    if (error || !url) {
      return NextResponse.json({ error: error || 'Failed to generate portal link.' }, { status: 400 });
    }

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Portal error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
