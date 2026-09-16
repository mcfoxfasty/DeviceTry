import { cookies } from 'next/headers';
import { db } from '../db/adapter';
import { User, Workspace, Subscription } from '../db/schema';
import { isProMode } from '../config/mode';

export const SESSION_COOKIE_NAME = 'devtry_session';

function getSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (!secret) {
    if (isProMode()) {
      throw new Error('AUTH_SESSION_SECRET is required when NEXT_PUBLIC_APP_MODE=PRO_ENABLED.');
    }
    // In FREE_ONLY mode, return a dummy string if invoked (though auth is disabled)
    return 'free-only-mode-dummy-auth-secret';
  }
  return secret;
}

/**
 * Hash raw token with Web Crypto SHA-256
 */
export async function hashToken(token: string): Promise<string> {
  const secret = getSessionSecret();
  const encoder = new TextEncoder();
  const data = encoder.encode(token + secret);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Generate secure random token
 */
export function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Hash password using Web Crypto PBKDF2
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = Array.from(salt)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );

  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  const hashHex = Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return `${saltHex}:${hashHex}`;
}

function constantTimeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

/**
 * Verify password against salt:hash
 */
export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, originalHashHex] = storedHash.split(':');
  if (!saltHex || !originalHashHex) return false;

  const saltBytes = new Uint8Array(
    saltHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
  );

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );

  const derivedKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'HMAC', hash: 'SHA-256', length: 256 },
    true,
    ['sign']
  );

  const exported = await crypto.subtle.exportKey('raw', derivedKey);
  const computedHashHex = Array.from(new Uint8Array(exported))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');

  return constantTimeCompare(computedHashHex, originalHashHex);
}

export interface CurrentSubscriber {
  user: User;
  workspace: Workspace;
  isPro: boolean;
  subscription: Subscription | null;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'none';
  renewsAt?: number;
}

/**
 * Authoritatively get current logged-in subscriber from HttpOnly cookie.
 * In FREE_ONLY mode, returns null immediately without error.
 */
export async function getCurrentSubscriber(): Promise<CurrentSubscriber | null> {
  if (!isProMode()) {
    return null;
  }

  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = await hashToken(token);
    const sessionRes = await db.getSessionByTokenHash(tokenHash);
    if (!sessionRes) return null;

    const { user } = sessionRes;
    const workspace = await db.getWorkspaceByUserId(user.id);
    if (!workspace) return null;

    const subscription = await db.getSubscription(workspace.id);

    // Pro is active if:
    // 1. status is 'active'
    // 2. OR status is 'canceled' but current_period_end is still in the future
    const now = Date.now();
    const isPro = Boolean(
      subscription &&
        ((subscription.status === 'active') ||
          (subscription.status === 'canceled' && subscription.current_period_end > now))
    );

    return {
      user,
      workspace,
      isPro,
      subscription: subscription || null,
      subscriptionStatus: subscription ? subscription.status : 'none',
      renewsAt: subscription?.current_period_end,
    };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 30 * 24 * 60 * 60, // 30 days
};
