/**
 * IP trust and validation logic for /api/ip (kept out of the route file so
 * Next.js sees only the handler export and tests can exercise every branch).
 *
 * Trust model:
 * - `cf-connecting-ip` is honored ONLY when the deployment declares a
 *   Cloudflare-fronted origin via IP_TRUSTED_PROXY=cloudflare. Cloudflare sets
 *   this header itself; the operator must additionally make the origin
 *   reachable only via Cloudflare (lock origin to Cloudflare IP ranges or
 *   enable Authenticated Origin Pulls) — the header is forgeable on a
 *   directly reachable origin. This module enforces the configuration gate,
 *   not the network topology.
 * - `x-forwarded-for` is read ONLY for local development (non-production AND
 *   no trusted proxy configured), matching the sandbox dev proxy.
 * - `PORT` never influences behavior: production containers routinely set
 *   PORT, so it must never unlock dev fallbacks.
 * - A resolved value must pass a strict IP validator before it is returned,
 *   so a malformed or spoofed header value can never reach the client as an
 *   "IP address".
 *
 * Deployment requirement (NOT verified live): serve through Cloudflare with
 * IP_TRUSTED_PROXY=cloudflare on the origin; confirm /api/ip returns the real
 * client IP after the first deploy. Documented in docs/phase9-migration.md.
 */

/** Structural IPv6 validator: 8 groups, or ≤7 around a single `::` compression. */
function isValidIpv6Structure(raw: string): boolean {
  if (!raw.includes(':')) return false;
  if (raw.includes(':::')) return false;
  const compressions = (raw.match(/::/g) ?? []).length;
  if (compressions > 1) return false;

  const groupRe = /^[0-9a-fA-F]{1,4}$/;
  const countGroups = (side: string): number => {
    if (side === '') return 0;
    const groups = side.split(':');
    return groups.every((g) => groupRe.test(g)) ? groups.length : -1;
  };

  if (compressions === 1) {
    const [left, right] = raw.split('::');
    const lc = countGroups(left);
    const rc = countGroups(right);
    if (lc < 0 || rc < 0) return false;
    return lc + rc <= 7; // `::` expands to at least one zero group
  }
  return countGroups(raw) === 8;
}

/** Strict IPv4/IPv6 validator. Exported for focused regression tests. */
export function isValidIp(value: string): boolean {
  if (typeof value !== 'string' || value.length === 0 || value.length > 45) return false;

  const v4 =
    /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (v4.test(value)) return true;

  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — valid; resolution normalizes it.
  if (/^::ffff:(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/.test(value)) {
    return true;
  }

  // IPv6 (optionally with a zone suffix): validate structurally.
  const zoneIndex = value.indexOf('%');
  const [address, zone] = zoneIndex >= 0
    ? [value.slice(0, zoneIndex), value.slice(zoneIndex + 1)]
    : [value, undefined];
  if (zone !== undefined && !/^[A-Za-z0-9_]+$/.test(zone)) return false;
  return isValidIpv6Structure(address);
}

export type ClientIpResolution =
  | { outcome: 'ok'; ip: string }
  | { outcome: 'unconfigured' }
  | { outcome: 'invalid' };

/**
 * Resolve the client IP from request headers under the declared trust
 * configuration. Pure — every branch is regression-tested without a server.
 */
export function resolveClientIp(
  headers: Headers,
  env: { trustedProxy?: string | undefined; isProduction: boolean }
): ClientIpResolution {
  const trustedProxy = (env.trustedProxy ?? '').trim().toLowerCase();
  const isCloudflareFronted = trustedProxy === 'cloudflare';

  const readHeader = (name: string): string | null => {
    const v = headers.get(name);
    return v && v.trim().length > 0 ? v.trim() : null;
  };

  let raw: string | null = null;

  if (isCloudflareFronted) {
    raw = readHeader('cf-connecting-ip');
  } else if (!trustedProxy && !env.isProduction) {
    // Local development convenience ONLY: the sandbox dev proxy may append
    // x-forwarded-for. Unreachable in production builds and whenever any
    // IP_TRUSTED_PROXY value is configured.
    const xff = readHeader('x-forwarded-for');
    raw = xff ? (xff.split(',')[0]?.trim() ?? null) : null;
  }
  // Production without a declared trusted proxy: raw stays null. No
  // forwarded header is trusted, regardless of PORT or any other env signal.

  if (raw === null) return { outcome: 'unconfigured' };
  if (!isValidIp(raw)) return { outcome: 'invalid' };

  // Normalize IPv4-mapped IPv6 for display honesty.
  const normalized =
    raw.startsWith('::ffff:') && raw.includes('.') ? raw.slice('::ffff:'.length) : raw;
  return { outcome: 'ok', ip: normalized };
}
