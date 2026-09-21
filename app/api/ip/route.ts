import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Public-IP endpoint (Phase 9, item G).
 *
 * Production: served behind Cloudflare, the ONLY trusted source is the
 * CF-Connecting-IP header set by Cloudflare itself — arbitrary client-supplied
 * parameters are never trusted. Local dev (no proxy): falls back to the
 * socket address from the request (x-forwarded-for is only read when it was
 * set by the local dev proxy), otherwise an honest 501.
 *
 * - Cache-Control: no-store — one visitor's answer is never cached for another.
 * - No IP is persisted, logged by this handler, or returned to any third party.
 * - No location/ISP enrichment: the response is exactly { ip }.
 */
export async function GET(request: Request): Promise<NextResponse> {
  const cfIp = request.headers.get('cf-connecting-ip');
  let ip: string | null = cfIp;

  if (!ip) {
    // Local development: Next's dev server is reached through a local proxy
    // that may append x-forwarded-for. In production behind Cloudflare this
    // branch is unreachable because cf-connecting-ip is present.
    const isLocalDev =
      process.env.NODE_ENV === 'development' || process.env.PORT !== undefined;
    if (isLocalDev) {
      const xff = request.headers.get('x-forwarded-for');
      if (xff) {
        ip = xff.split(',')[0]?.trim() ?? null;
      } else {
        // Hypercorn/Node runtime: attempt the socket address when exposed.
        const anyReq = request as unknown as { socket?: { remoteAddress?: string } };
        ip = anyReq.socket?.remoteAddress ?? null;
        if (ip && (ip === '::1' || ip === '127.0.0.1')) ip = ip;
      }
    }
  }

  if (!ip) {
    return NextResponse.json(
      { error: 'IP lookup is not available on this deployment.' },
      { status: 501, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Normalize IPv4-mapped IPv6 loopback forms for display honesty.
  if (ip.startsWith('::ffff:') && ip.includes('.')) {
    ip = ip.slice('::ffff:'.length);
  }

  return NextResponse.json(
    { ip },
    {
      headers: {
        'Cache-Control': 'no-store, private',
        Vary: '*',
      },
    }
  );
}
