import { NextResponse } from 'next/server';
import { resolveClientIp } from '@/lib/testing/ipTrust';

export const dynamic = 'force-dynamic';

/**
 * Public-IP endpoint (Phase 9, item G — corrected).
 *
 * The trust model and validation live in lib/testing/ipTrust.ts so every
 * branch is unit-testable. Summary:
 * - `cf-connecting-ip` is trusted only when IP_TRUSTED_PROXY=cloudflare is
 *   configured (and the operator has locked the origin to Cloudflare).
 * - `x-forwarded-for` is read only for local development.
 * - `PORT` never enables dev fallbacks — production containers set PORT.
 * - Returned IPs pass a strict validator; malformed header values cannot be
 *   emitted as an "IP address".
 *
 * - Cache-Control: no-store — one visitor's answer is never cached for another.
 * - No IP is persisted or logged here, and no third party is called.
 * - No location/ISP enrichment: the response is exactly { ip }.
 * - Live Cloudflare deployment is NOT verified; see docs/phase9-migration.md.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const noStore = { 'Cache-Control': 'no-store, private', Vary: '*' };
  const resolution = resolveClientIp(request.headers, {
    trustedProxy: process.env.IP_TRUSTED_PROXY,
    isProduction: process.env.NODE_ENV === 'production',
  });

  if (resolution.outcome === 'unconfigured') {
    const declared = (process.env.IP_TRUSTED_PROXY ?? '').trim().toLowerCase() === 'cloudflare';
    return NextResponse.json(
      {
        error: declared
          ? 'The proxy did not provide a valid client IP address.'
          : 'IP lookup is not available on this deployment. Set IP_TRUSTED_PROXY=cloudflare when the site is served behind Cloudflare.',
      },
      { status: declared ? 502 : 501, headers: noStore }
    );
  }

  if (resolution.outcome === 'invalid') {
    return NextResponse.json(
      { error: 'The proxy did not provide a valid client IP address.' },
      { status: 502, headers: noStore }
    );
  }

  return NextResponse.json({ ip: resolution.ip }, { headers: noStore });
}
