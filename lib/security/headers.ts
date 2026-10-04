/**
 * Response security headers for DeviceTry.
 *
 * DeviceTry is a static, client-side-only site served from Cloudflare through
 * OpenNext: no accounts, no payments, no server session, and nothing leaves the
 * browser. The headers below are the ones that can be added WITHOUT changing
 * how the product behaves, which is the whole criterion here — a header that
 * breaks a tester is worse than a missing header.
 *
 * WHY THE CSP IS REPORT-ONLY, AND WHY IT STILL NAMES EVERY SOURCE:
 * Next.js App Router bootstraps React from inline `<script>` tags
 * (`self.__next_f.push(...)`), so any policy without 'unsafe-inline' would
 * block hydration and take the whole site down. Doing that safely needs a
 * per-request nonce generated in middleware and forwarded to every inline
 * script, which cannot be applied to a prerendered static build without
 * turning the site dynamic. Instead the policy ships in
 * `Content-Security-Policy-Report-Only`: the browser evaluates it, reports
 * every violation, and blocks nothing, so the real behaviour of each tester
 * can be observed before anything is enforced. It is written from the app's
 * actual API usage rather than from a generic template — every source below is
 * there because a tester on this site uses it:
 *
 *   - `blob:`/`mediastream:` in media-src — Voice Recorder, Online Voice
 *     Recorder and the instrument tuner play and record captured audio.
 *   - `blob:` in img-src — canvas snapshots and captured frames.
 *   - `https://speed.cloudflare.com` (and wss) in connect-src — the Internet
 *     Speed Test runs on Cloudflare's official measurement engine.
 *   - `'unsafe-inline'` in style-src — the motion library writes inline styles.
 *   - No 'unsafe-eval', no wildcard, no http: sources.
 *   WebRTC needs no directive here: its loopback test builds its peers with
 *   `iceServers: []`, so no STUN/TURN host is contacted.
 *
 * HSTS is deliberately NOT set. The staging environment is workers.dev and the
 * production domain is not chosen yet; a hardcoded max-age would be wrong for
 * the current environment and must be added with the real domain.
 */

export const SECURITY_POLICY_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  // No remote images are loaded by the app (the picsum remote pattern in
  // next.config is unused), so this stays narrow.
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline'",
  // blob: covers the object URLs the testers create; speed.cloudflare.com is
  // the Internet Speed Test's measurement endpoint.
  "connect-src 'self' blob: https://speed.cloudflare.com wss://speed.cloudflare.com",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-src 'self'",
];

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = SECURITY_POLICY_DIRECTIVES.join('; ');

/**
 * The device capabilities DeviceTry actually asks for, and nothing else.
 * microphone/camera are what every permission-gated tester needs;
 * display-capture is probed by the capabilities report; clipboard is used by
 * the share buttons and the Clipboard tester; autoplay/fullscreen are used by
 * the audio and presentation paths. Everything else is denied explicitly so a
 * future feature cannot silently inherit it.
 */
export const PERMISSIONS_POLICY = [
  'camera=(self)',
  'microphone=(self)',
  'display-capture=(self)',
  'autoplay=(self)',
  'fullscreen=(self)',
  'clipboard-read=(self)',
  'clipboard-write=(self)',
  'geolocation=()',
  'payment=()',
  'usb=()',
  'midi=()',
  'bluetooth=()',
  'hid=()',
  'serial=()',
].join(', ');

/**
 * Headers applied to every route. Order matters only for readability; all of
 * them are set unconditionally.
 */
export function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'Content-Security-Policy-Report-Only', value: CONTENT_SECURITY_POLICY_REPORT_ONLY },
  ];
}