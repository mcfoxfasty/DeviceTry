/**
 * The admin dashboard's entire authentication model: one password, one cookie.
 *
 * WHY THIS REPLACED THE KEYSTATIC GITHUB APP FLOW.
 * That flow needed a GitHub App, four server-side values, an OAuth round trip
 * through github.com, a callback URL registered per origin (the preview host and
 * localhost differ), and it could still fail after a successful token exchange —
 * with the reason buried in a client-side GitHub API call. All of that was
 * building an identity system to answer one question: "is this the site owner?"
 * A single password answers the same question with nothing to misconfigure.
 *
 * WHAT THE COOKIE IS.
 * Not a random session id backed by a store — there is no store on an edge
 * runtime — but a value derived from the password itself: the base64url of
 * HMAC-SHA256(key = password, message = a fixed label). Verifying it means
 * recomputing that value and comparing in constant time, so the check is a pure
 * function of the password and nothing has to be persisted.
 *
 * Two consequences worth stating, because they are the trade-offs of the design:
 *
 * 1. Changing ADMIN_PASSWORD invalidates every existing session immediately.
 *    That is the intended revocation mechanism.
 * 2. Anyone who learns the cookie value has the same access as the password.
 *    The cookie is HttpOnly (no script can read it), SameSite=Lax (a cross-site
 *    form post cannot use it) and Secure in production, and it expires after
 *    ADMIN_SESSION_SECONDS. The dashboard is a single-author tool for a public
 *    site, and this is the level of ceremony that fits.
 *
 * `constantTimeEqual` exists so a wrong password cannot be found character by
 * character from response timing. It compares the full length of both values
 * whatever they are, and never short-circuits.
 *
 * Nothing here imports Node APIs: the same code runs under `next start` and in
 * the Cloudflare Worker, which is where this site is deployed.
 */

/** The cookie the dashboard reads and the login route sets. */
export const ADMIN_SESSION_COOKIE = 'devicetry-admin';

/** How long a sign-in lasts. Long enough for an article, short enough to expire. */
export const ADMIN_SESSION_SECONDS = 60 * 60 * 12;

/**
 * The password used when none is configured.
 *
 * Deliberately a documented constant rather than a random value or a hard
 * failure: a fresh deployment must be usable, and the default is printed in
 * docs/cms.md along with the instruction to change it. `ADMIN_PASSWORD` in the
 * environment overrides it.
 */
export const DEFAULT_ADMIN_PASSWORD = 'MySecretPass2026!';

/** The signing label, so this token cannot be confused with any other HMAC. */
const SESSION_LABEL = 'devicetry-admin-session-v1';

/** The configured password, or the documented default. */
export function adminPassword(): string {
  const configured = (process.env.ADMIN_PASSWORD ?? '').trim();
  return configured.length > 0 ? configured : DEFAULT_ADMIN_PASSWORD;
}

/** Whether the deployment is using the default rather than a chosen password. */
export function usingDefaultPassword(): boolean {
  return !((process.env.ADMIN_PASSWORD ?? '').trim().length > 0);
}

/**
 * Compare two strings without leaking where they differ.
 *
 * Length is folded into the result rather than returned early, and every byte of
 * the longer value is still visited, so a guess cannot be refined by timing.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const left = encoder.encode(a);
  const right = encoder.encode(b);
  const length = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < length; index += 1) {
    difference |= (left[index] ?? 0) ^ (right[index] ?? 0);
  }
  return difference === 0;
}

/** base64url without padding, the form a cookie value can carry unescaped. */
function base64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * The cookie value a signed-in dashboard carries, derived from the password.
 *
 * Exported separately from `expectedSessionToken` so the derivation can be
 * exercised with a known password, including the property that a different
 * password produces a different token.
 */
export async function sessionTokenFor(password: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(SESSION_LABEL));
  return base64Url(new Uint8Array(signature));
}

/** The only cookie value this deployment currently accepts. */
export async function expectedSessionToken(): Promise<string> {
  return sessionTokenFor(adminPassword());
}

/** True when the request carries a session cookie this deployment accepts. */
export async function isAuthenticated(cookies: {
  get(name: string): { value: string } | undefined;
}): Promise<boolean> {
  const presented = cookies.get(ADMIN_SESSION_COOKIE)?.value;
  if (typeof presented !== 'string' || presented.length === 0) return false;
  return constantTimeEqual(presented, await expectedSessionToken());
}

/** The attributes every session cookie carries, for both setting and clearing. */
export function sessionCookieAttributes(): {
  httpOnly: true;
  sameSite: 'Lax';
  secure: boolean;
  path: '/';
  maxAge: number;
} {
  return {
    httpOnly: true,
    // `Lax` in its canonical spelling. Browsers compare cookie attribute values
    // case-insensitively, but a Set-Cookie a reader has to squint at is a worse
    // artefact than one that reads the way the spec writes it.
    sameSite: 'Lax',
    // A Secure cookie is required in production; on http://localhost a browser
    // still stores it (localhost is a trustworthy origin), which is what makes
    // the workspace preview usable.
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: ADMIN_SESSION_SECONDS,
  };
}

/** Serialize a cookie without pulling in a dependency. */
export function serializeCookie(
  name: string,
  value: string,
  attributes: {
    httpOnly?: boolean;
    sameSite?: 'Lax' | 'Strict' | 'None';
    secure?: boolean;
    path?: string;
    maxAge?: number;
  }
): string {
  const parts = [`${name}=${value}`];
  if (attributes.path) parts.push(`Path=${attributes.path}`);
  if (typeof attributes.maxAge === 'number') parts.push(`Max-Age=${attributes.maxAge}`);
  if (attributes.httpOnly) parts.push('HttpOnly');
  if (attributes.secure) parts.push('Secure');
  if (attributes.sameSite) parts.push(`SameSite=${attributes.sameSite}`);
  return parts.join('; ');
}

/** The `Set-Cookie` value that signs a browser in. */
export async function signInCookie(password: string): Promise<string> {
  return serializeCookie(ADMIN_SESSION_COOKIE, await sessionTokenFor(password), sessionCookieAttributes());
}

/** The `Set-Cookie` value that signs a browser out, keeping the attributes. */
export function signOutCookie(): string {
  const attributes = sessionCookieAttributes();
  return serializeCookie(ADMIN_SESSION_COOKIE, '', { ...attributes, maxAge: 0 });
}
