import { makeRouteHandler } from '@keystatic/next/route-handler';
import { resolvePublicOrigin } from '@/lib/keystatic/origin';
import { resolveKeystaticCredentials } from '@/lib/keystatic/serverEnv';
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
 * WHY THE HANDLER IS BUILT INSIDE EACH REQUEST.
 * Two independent reasons, and the second is the one that decided this shape.
 *
 * 1. Construction validates. GitHub mode throws the moment `makeRouteHandler`
 *    sees missing credentials, and a build imports every route module to collect
 *    page data — so building the handler at module scope made a production build
 *    fail outright on a machine without the CMS's secrets, and the whole site
 *    could not be built because an optional admin dashboard was unconfigured.
 *
 * 2. The credentials do not exist outside a request. On the Cloudflare Worker
 *    the bindings reach the app through the OpenNext adapter, which installs
 *    them as an AsyncLocalStorage store read by a getter on the global scope:
 *
 *      Object.defineProperty(globalThis, Symbol.for('__cloudflare-context__'),
 *        { get: () => cloudflareContextALS.getStore() })
 *
 *    That store is only populated inside `runWithCloudflareRequestContext`,
 *    i.e. between the worker's fetch entrypoint and the response. Read at import
 *    time it is `undefined`, and the accessor throws. The adapter additionally
 *    copies the Worker's string bindings into the process environment on the
 *    first request, which again means "during a request", never before.
 *
 * So resolution and construction both happen per request, here in GET/POST.
 * Nothing about the handler or the credentials is held at module scope, which
 * also means a deployment whose bindings arrive late self-heals on the next
 * request instead of being pinned for the life of the isolate.
 *
 * Resolving per request is cheap: `makeRouteHandler` builds closures over the
 * config object that keystatic.config.ts already constructs once at import.
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
    const handler = makeRouteHandler({
      config: keystaticConfig,
      ...resolveKeystaticCredentials(),
    });
    return handler.GET(withPublicOrigin(request));
  } catch (error) {
    return Promise.resolve(notConfigured(error));
  }
}

export function POST(request: Request): Promise<Response> {
  try {
    const handler = makeRouteHandler({
      config: keystaticConfig,
      ...resolveKeystaticCredentials(),
    });
    return handler.POST(withPublicOrigin(request));
  } catch (error) {
    return Promise.resolve(notConfigured(error));
  }
}
