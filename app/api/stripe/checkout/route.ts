import { NextRequest, NextResponse } from 'next/server';
import { getCurrentSubscriber } from '@/lib/auth/session';
import { createCheckoutSession } from '@/lib/stripe/billing';
import { isProEnabled } from '@/lib/config/mode';

export async function POST(req: NextRequest) {
  if (!isProEnabled()) {
    return NextResponse.json({ error: 'Pro features are disabled in FREE_ONLY mode.' }, { status: 404 });
  }

  try {
    const subscriber = await getCurrentSubscriber();
    if (!subscriber) {
      return NextResponse.json(
        { error: 'AUTH_REQUIRED: Please sign in or create an account before subscribing to Pro.' },
        { status: 401 }
      );
    }

    const host = req.headers.get('host') || 'localhost:3000';
    const proto = req.headers.get('x-forwarded-proto') || 'http';
    const origin = `${proto}://${host}`;

    const { url, error } = await createCheckoutSession({
      workspaceId: subscriber.workspace.id,
      userEmail: subscriber.user.email,
      returnUrl: `${origin}/pro/workspace?checkout=success`,
      cancelUrl: `${origin}/pro?checkout=canceled`,
    });

    if (error || !url) {
      return NextResponse.json({ error: error || 'Failed to generate checkout link.' }, { status: 400 });
    }

    return NextResponse.json({ url });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Checkout error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
