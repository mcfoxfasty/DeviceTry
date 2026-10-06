import { makeRouteHandler } from '@keystatic/next/route-handler';
import { resolvePublicOrigin } from '@/lib/keystatic/origin';
import { SITE_URL } from '@/lib/site';
import keystaticConfig from '../../../../keystatic.config';

/**
 * The CMS's server side: GitHub OAuth plus the content reads and writes behind
 * /keystatic.
 *
 * This is the one part of the site that is genuinely dynamic — it exchanges an
 * OAuth code for a token, then commits to GitHub — so it is also the one part
 * that cannot be prerendered.
 *
 * WHY THE HANDLER IS CREATED INSIDE THE REQUEST INSTEAD OF AT MODULE SCOPE.
 * GitHub mode validates its credentials the moment it is constructed, and a
 * build imports every route module to collect page data. Building the handler at
 * module scope therefore made a production build fail outright on a machine
 * without the CMS's secrets — the whole site could not be built because an
 * optional admin dashboard was unconfigured. Deferring construction to the first
 * request keeps the promise that matters: the public site builds and runs with no
 * CMS credentials at all, and only /keystatic reports that it needs them.
 *
 * WHY A MISSING CONFIGURATION ANSWERS 503 WITH TEXT.
 * Deferring the throw moved it from the build to the first click on "Sign in with
 * GitHub", where a bare throw reached the browser as an empty 500 — a blank tab
 * with no way to learn what was wrong. The 503 below says which values are
 * missing and where to read about creating the GitHub App that issues them. It
 * names variables, never values.
 *
 * WHY THE REQUEST ORIGIN IS REWRITTEN BEFORE KEYSTATIC SEES IT.
 * GitHub mode copies the request's origin into the OAuth redirect it hands
 * GitHub. Under `next start -H 0.0.0.0` Next derives that origin from the address
 * it bound to rather than from the visitor's `Host`, so the redirect pointed at
 * `0.0.0.0:3000` and GitHub refused the sign-in with `redirect_uri_mismatch`.
 * `withPublicOrigin` below puts the reachable host back on the request; the rules
 * and the order of trust live in lib/keystatic/origin.ts.
 *
 * The four values GitHub mode requires are KEYSTATIC_GITHUB_CLIENT_ID,
 * KEYSTATIC_GITHUB_CLIENT_SECRET, KEYSTATIC_SECRET, and — read at build time, so
 * it must be present in the environment that builds the site —
 * NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG. The first visit to /keystatic walks
 * through creating the App and prints the first three; docs/cms.md covers the
 * rest.
 */

type RouteHandler = ReturnType<typeof makeRouteHandler>;

/** What to tell a person whose CMS has no GitHub App behind it yet. */
const NOT_CONFIGURED = [
  'The DeviceTry CMS is not connected to GitHub yet.',
  '',
  'GitHub mode needs a GitHub App with write access to this repository, and the',
  'three values it issues: KEYSTATIC_GITHUB_CLIENT_ID,',
  'KEYSTATIC_GITHUB_CLIENT_SECRET and KEYSTATIC_SECRET.',
  'NEXT_PUBLIC_KEYSTATIC_GITHUB_APP_SLUG is read when the site is built, so it',
  'has to be set for the build environment as well.',
  '',
  'See docs/cms.md for the setup walkthrough. The public site does not depend on',
  'any of this.',
].join('\n');

let cached: RouteHandler | null = null;

function keystaticApi(): RouteHandler {
  if (!cached) cached = makeRouteHandler({ config: keystaticConfig });
  return cached;
}

/**
 * Hand Keystatic a request whose origin is one a browser can actually be sent to.
 *
 * Only the origin is replaced: the path, the query string (OAuth's `code` and
 * `state` arrive there) and the body are carried over from the original request.
 * When no reachable origin can be determined the request passes through untouched.
 */
function withPublicOrigin(request: Request): Request {
  const origin = resolvePublicOrigin(request.headers, request.url, SITE_URL);
  if (!origin) return request;
  const url = new URL(request.url);
  if (url.origin === origin) return request;
  return new Request(`${origin}${url.pathname}${url.search}`, request);
}

/** A readable answer for the one failure a fresh deployment always hits first. */
function notConfigured(error: unknown): Response {
  const reason = error instanceof Error ? error.message : String(error);
  return new Response(`${NOT_CONFIGURED}\n\nReported reason: ${reason}\n`, {
    status: 503,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function GET(request: Request): Promise<Response> {
  try {
    return keystaticApi().GET(withPublicOrigin(request));
  } catch (error) {
    return Promise.resolve(notConfigured(error));
  }
}

export function POST(request: Request): Promise<Response> {
  try {
    return keystaticApi().POST(withPublicOrigin(request));
  } catch (error) {
    return Promise.resolve(notConfigured(error));
  }
}
