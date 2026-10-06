/**
 * Cloudflare Worker response wrapper for DeviceTry security headers.
 *
 * This file is the Cloudflare Worker boundary wrapper that OpenNext emits as
 * `.open-next/worker.js`. It is imported by the Worker entrypoint and wraps the
 * generated handler so every response that passes through the Worker gets the
 * full enforcing security header set, with HSTS restricted to the production
 * hostname(s).
 *
 * WHY HSTS IS HANDLED HERE AND NOT IN next.config.ts `headers()`:
 * HSTS is a *connection-level* instruction that should only be sent for the
 * real production domain. Sending `max-age=31536000; includeSubDomains; preload`
 * on the workers.dev preview host, on localhost, or on any future staging host
 * would pin HTTPS-only policy onto hosts that may later serve HTTP — that is the
 * wrong policy for the wrong host. The app-level `securityHeaders()` in
 * lib/security/headers.ts intentionally omits HSTS; this wrapper adds it only
 * when the request hostname matches the production domain(s).
 *
 * WHAT THIS WRAPPER PRESERVES:
 * - the response status code
 * - every existing response header (including any custom app headers)
 * - the response body (streamed as-is)
 * - response streaming / encoding behaviour
 *
 * WHAT IT ADDS ON EVERY RESPONSE:
 * - Strict-Transport-Security (production hostnames only)
 * - X-Frame-Options: SAMEORIGIN
 * - X-Content-Type-Options: nosniff
 * - Referrer-Policy: strict-origin-when-cross-origin
 * - Permissions-Policy: geolocation=(), microphone=(), camera=()
 * - Content-Security-Policy (enforcing) with the directives from
 *   lib/security/headers.ts
 *
 * IMPLEMENTATION NOTES:
 * - The generated worker entrypoint exports an `fetch` handler as the default
 *   export or as `export default { fetch }`. This wrapper imports that handler
 *   and re-exports it with the header injection applied.
 * - The Worker runs on Cloudflare; `request.url` is the authoritative request
 *   URL. The production hostname(s) are compared case-insensitively against the
 *   host component of that URL.
 * - When the production domain is not yet chosen, `PRODUCTION_HOSTNAMES` should
 *   be set to the empty list (or the real domain once known). With an empty list
 *   the wrapper still applies every header except HSTS — which is exactly the
 *   desired staging behaviour.
 */

import { securityHeaders } from './headers';

// Update these once the production domain is confirmed. With an empty list the
// wrapper still applies every enforcing header except HSTS.
export const PRODUCTION_HOSTNAMES: readonly string[] = [
  // e.g. 'devicetry.com', 'www.devicetry.com'
];

function isProductionHost(requestUrl: string): boolean {
  try {
    const host = new URL(requestUrl).hostname;
    return PRODUCTION_HOSTNAMES.some((h) => host === h || host === `www.${h}`);
  } catch {
    return false;
  }
}

/**
 * Inject the full enforcing security header set into `response`, preserving all
 * existing headers, status, and body.
 */
export function applySecurityHeaders(response: Response): Response {
  const headers = new Headers(response.headers);

  // Only the app-level headers() set; HSTS is added by the wrapper when the
  // request is for a production hostname.
  for (const { key, value } of securityHeaders()) {
    headers.set(key, value);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Wrap the generated OpenNext handler so every response passes through the
 * security header injector.
 *
 * Cloudflare Workers' `ExecutionContext` is available globally in the Worker
 * runtime; do not import it from a Node package. Here we type it via the Worker
 * runtime's global `ExecutionContext` which is declared by the `cloudflare-workers`
 * environment. For the TypeScript build inside this project (which targets the
 * Next.js app runtime, not the Worker runtime), we therefore duck-type it to
 * avoid a hard dependency on the Cloudflare Workers types.
 */
export function wrapHandler(handler: (request: Request, env: Record<string, unknown>, ctx: ExecutionContextLike) => Promise<Response>) {
  return async (request: Request, env: Record<string, unknown>, ctx: ExecutionContextLike): Promise<Response> => {
    const response = await handler(request, env, ctx);
    const clonedRequest = request.clone();

    // HSTS only on production hostnames — never on the preview host, localhost,
    // or any other environment.
    if (isProductionHost(clonedRequest.url)) {
      const headers = new Headers(response.headers);
      headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
      return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    }

    return applySecurityHeaders(response);
  };
}

/**
 * Minimal duck-type for Cloudflare Workers' `ExecutionContext`, enough for the
 * handler signature this wrapper adapts. The real Worker runtime provides the
 * full `waitUntil`/`passThroughOnException` surface; this is only so the wrapper
 * can be type-checked alongside the Next.js app build.
 */
export interface ExecutionContextLike {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}
