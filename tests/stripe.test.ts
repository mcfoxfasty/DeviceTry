import test from 'node:test';
import assert from 'node:assert/strict';
import { handleStripeWebhook } from '../lib/stripe/billing';

test('Stripe Webhook - Unconfigured secret returns error gracefully', async () => {
  const res = await handleStripeWebhook('{}', 'invalid_signature');
  assert.strictEqual(res.success, false);
  assert.ok(res.error?.includes('unconfigured') || res.error?.includes('Signature'));
});
