import { cookies } from 'next/headers';
import { db } from '../db/adapter';
import { User, Workspace } from '../db/schema';

const SESSION_COOKIE_NAME = 'devtry_session';
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || 'devtry-default-secure-fallback-secret-2026';

/**
 * Hash raw token with Web Crypto SHA-256
 */
export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token + SESSION_SECRET);
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

  return computedHashHex === originalHashHex;
}

export interface CurrentSubscriber {
  user: User;
  workspace: Workspace;
  isPro: boolean;
  subscriptionStatus: 'active' | 'canceled' | 'past_due' | 'incomplete' | 'none';
  renewsAt?: number;
}

/**
 * Authoritatively get current logged-in subscriber from HttpOnly cookie
 */
export async function getCurrentSubscriber(): Promise<CurrentSubscriber | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const tokenHash = await hashToken(token);
    const session = await db.getSessionByTokenHash(tokenHash);
    if (!session) return null;

    const user = await db.getUserById(session.user_id);
    if (!user) return null;

    const workspace = await db.getWorkspaceForUser(user.id);
    if (!workspace) return null;

    const subscription = await db.getSubscription(workspace.id);
    const isPro = subscription ? subscription.status === 'active' || subscription.status === 'canceled' : false;

    return {
      user,
      workspace,
      isPro,
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
