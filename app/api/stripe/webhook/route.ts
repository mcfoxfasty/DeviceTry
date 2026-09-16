import { NextRequest, NextResponse } from 'next/server';
import { handleStripeWebhook } from '@/lib/stripe/billing';

export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 });
    }

    const rawBody = await req.text();
    const { success, eventType, error } = await handleStripeWebhook(rawBody, signature);

    if (!success) {
      return NextResponse.json({ error: error || 'Webhook verification failed.' }, { status: 400 });
    }

    return NextResponse.json({ received: true, eventType });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Webhook error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
