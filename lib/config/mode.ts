export type AppMode = 'FREE_ONLY' | 'PRO_ENABLED';

/**
 * Returns the current validated application mode.
 * Defaults to 'FREE_ONLY' if NEXT_PUBLIC_APP_MODE is missing or invalid.
 */
export function getAppMode(): AppMode {
  const mode = process.env.NEXT_PUBLIC_APP_MODE;
  if (mode === 'PRO_ENABLED') {
    return 'PRO_ENABLED';
  }
  return 'FREE_ONLY';
}

/**
 * Convenience helper to check if Pro capabilities are active.
 */
export function isProMode(): boolean {
  return getAppMode() === 'PRO_ENABLED';
}

export function isProEnabled(): boolean {
  return isProMode();
}

export function isFreeOnlyMode(): boolean {
  return getAppMode() === 'FREE_ONLY';
}

export interface ProConfigValidation {
  valid: boolean;
  missing: string[];
  errors: string[];
}

/**
 * Validates required secrets and environment variables when in PRO_ENABLED mode.
 * In FREE_ONLY mode, this always returns valid: true with no required secrets.
 */
export function validateProConfiguration(): ProConfigValidation {
  if (!isProMode()) {
    return { valid: true, missing: [], errors: [] };
  }

  const missing: string[] = [];
  const errors: string[] = [];

  const sessionSecret = process.env.AUTH_SESSION_SECRET;
  if (!sessionSecret) {
    missing.push('AUTH_SESSION_SECRET');
  } else if (sessionSecret.length < 32) {
    errors.push('AUTH_SESSION_SECRET must be at least 32 characters long for secure HMAC/AES.');
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    missing.push('STRIPE_SECRET_KEY');
  } else if (stripeKey.includes('placeholder') || stripeKey === 'sk_test_...') {
    errors.push('STRIPE_SECRET_KEY contains placeholder values.');
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    missing.push('STRIPE_WEBHOOK_SECRET');
  } else if (webhookSecret.includes('placeholder') || webhookSecret === 'whsec_...') {
    errors.push('STRIPE_WEBHOOK_SECRET contains placeholder values.');
  }

  const priceId = process.env.STRIPE_PRO_PRICE_ID;
  if (!priceId) {
    missing.push('STRIPE_PRO_PRICE_ID');
  } else if (!priceId.startsWith('price_')) {
    errors.push('STRIPE_PRO_PRICE_ID must be a valid Stripe price identifier (starting with price_).');
  }

  return {
    valid: missing.length === 0 && errors.length === 0,
    missing,
    errors,
  };
}
