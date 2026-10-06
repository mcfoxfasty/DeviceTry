/**
 * The public origin to advertise in Keystatic's GitHub OAuth redirect.
 *
 * WHY THIS EXISTS.
 * `@keystatic/core` builds its OAuth `redirect_uri` from the incoming request —
 * `/api/keystatic/github/oauth/callback` appended to `new URL(request.url).origin`
 * — and `@keystatic/next` passes that request through unchanged. When Next is
 * started bound to every interface (`next start -H 0.0.0.0`, which is how both the
 * preview and the container host run it) Next builds `request.url` from the
 * address it bound to rather than from the request's `Host` header, so the origin
 * comes out as `http(s)://0.0.0.0:3000`. GitHub answers that sign-in with
 * `redirect_uri_mismatch`, because `0.0.0.0` is a wildcard bind address and not a
 * URL a browser can be sent to.
 *
 * The real host is still on the request, so the origin is rebuilt from, in order
 * of trust: the reverse proxy's `x-forwarded-host` / `x-forwarded-proto` (the edge
 * knows where the visitor actually is), then `Host`, then the site's own
 * configured public URL (`NEXT_PUBLIC_SITE_URL`, via lib/site.ts). Only a
 * browser-reachable origin is ever returned — the unspecified addresses are
 * rejected outright — so when there is no better answer the caller keeps the
 * original request rather than rewriting it to something equally unreachable.
 *
 * `localhost` is deliberately NOT rejected: a developer running the CSP outside a
 * proxy reaches the CMS at `http://localhost:3000`, and that is a callback GitHub
 * can redirect to. Keystatic's own documentation expects that origin.
 *
 * Pure on purpose — the headers arrive as a minimal `get` interface so the rules
 * can be exercised from tests without a server.
 */

/** Hosts that mean "every interface". No browser, and so no OAuth redirect, can use them. */
const UNSPECIFIED_HOSTS = new Set(['', '0.0.0.0', '::', '[::]', '[::0]']);

/** The source of request headers, narrowed to what a `Headers` object already offers. */
export interface HeaderSource {
  get(name: string): string | null;
}

/** The host portion of a `Host`/`x-forwarded-host` value, without its port. */
export function hostWithoutPort(host: string): string {
  const value = host.trim().toLowerCase();
  if (value.startsWith('[')) {
    const end = value.indexOf(']');
    return end === -1 ? value : value.slice(0, end + 1);
  }
  const colon = value.lastIndexOf(':');
  return colon === -1 ? value : value.slice(0, colon);
}

/** True when an origin would point the visitor's browser at a bind address. */
export function isUnreachableHost(host: string): boolean {
  return UNSPECIFIED_HOSTS.has(hostWithoutPort(host));
}

/** The protocol of an absolute URL, as the OAuth redirect must spell it. */
function protocolOf(url: string): string {
  try {
    const protocol = new URL(url).protocol;
    return protocol === 'http:' || protocol === 'https:' ? protocol.slice(0, -1) : 'https';
  } catch {
    return 'https';
  }
}

/** The `host:port` of an absolute URL, or an empty string when it is not one. */
function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return '';
  }
}

/**
 * The origin to use, or `null` when even the fallbacks are unreachable (in which
 * case the caller should leave the request untouched).
 */
export function resolvePublicOrigin(
  headers: HeaderSource,
  requestUrl: string,
  siteUrl: string | undefined
): string | null {
  const forwardedHost = (headers.get('x-forwarded-host') ?? '').split(',')[0]?.trim() ?? '';
  const host = forwardedHost || (headers.get('host') ?? '').trim();
  const forwardedProto = (headers.get('x-forwarded-proto') ?? '').split(',')[0]?.trim() ?? '';

  if (host && !isUnreachableHost(host)) {
    const protocol = forwardedProto === 'http' || forwardedProto === 'https' ? forwardedProto : protocolOf(requestUrl);
    return `${protocol}://${host}`;
  }

  const configured = (siteUrl ?? '').trim().replace(/\/+$/, '');
  if (configured && !isUnreachableHost(hostOf(configured))) return configured;

  return null;
}
