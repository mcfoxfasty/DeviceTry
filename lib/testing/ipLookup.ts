/**
 * What's My IP — client logic (Phase 9, item G).
 *
 * The endpoint returns the visitor's public IP as seen by the trusted proxy
 * (Cloudflare in production: CF-Connecting-IP; local dev: the connecting
 * socket address). Rules enforced here:
 * - One explicit user-triggered request; no automatic retries or polling.
 * - Cache-Control: no-store respected — never a shared/cached answer.
 * - No location, ISP, or identity data is requested or displayed.
 */

export type IpVersion = 'IPv4' | 'IPv6' | 'unknown';

export interface IpResult {
  ip: string;
  version: IpVersion;
}

/** Classify an address as IPv4 or IPv6 where reliable. */
export function classifyIp(ip: string): IpVersion {
  const v4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (v4.test(ip)) return 'IPv4';
  // Conservative IPv6 shape: hex groups separated by colons (compressed forms
  // include '::'), possibly a zone or an IPv4 tail.
  const v6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}(%\w+)?$/;
  if (v6.test(ip)) return 'IPv6';
  return 'unknown';
}

export class IpLookupError extends Error {
  constructor(message: string, readonly kind: 'network' | 'unavailable' | 'bad-response') {
    super(message);
  }
}

/**
 * Fetch the public IP once. Throws IpLookupError with a comprehensible kind
 * on failure; the UI maps kinds to honest error copy.
 */
export async function fetchPublicIp(signal?: AbortSignal): Promise<IpResult> {
  let response: Response;
  try {
    response = await fetch('/api/ip', {
      method: 'GET',
      cache: 'no-store',
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new IpLookupError('The lookup request could not reach the server.', 'network');
  }
  if (!response.ok) {
    throw new IpLookupError(
      response.status === 501
        ? 'IP lookup is not available on this deployment.'
        : 'The lookup endpoint returned an error.',
      response.status === 501 ? 'unavailable' : 'bad-response'
    );
  }
  let data: { ip?: unknown };
  try {
    data = (await response.json()) as { ip?: unknown };
  } catch {
    throw new IpLookupError('The lookup endpoint returned an unreadable response.', 'bad-response');
  }
  if (typeof data.ip !== 'string' || data.ip.length === 0 || data.ip.length > 45) {
    throw new IpLookupError('The lookup endpoint did not report an IP address.', 'bad-response');
  }
  return { ip: data.ip, version: classifyIp(data.ip) };
}
