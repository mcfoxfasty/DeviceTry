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
 * HSTS is intentionally absent until the production domain exists: the staging
 * environment is workers.dev and the production domain is not chosen yet; a
 * hardcoded max-age would be wrong for the current environment. When the real
 * domain is live, add the HSTS header at the Cloudflare Worker boundary — see
 * STAGING_SECURITY_HEADERS / PRODUCTION_SECURITY_HEADERS below — with a path
 * that covers only the production hostname(s) rather than every response.
 *
 * WHY `X-Frame-Options` IS NOT SENT (removed 2026-10-04, it blanked the preview):
 * it was set to DENY, and DENY is unconditional — the browser then refuses to
 * render the page in ANY frame, including the managed preview panel, which
 * embeds this site in an <iframe>. The symptom was a blank white preview pane
 * on a server that was healthy: `/` returned 200 with 174 KB of complete HTML
 * and every asset resolved, but the frame was never painted.
 *
 * `frame-ancestors 'self'` in the enforcing CSP below is the modern, expressive
 * form of the same protection: it says which ancestors may embed the page, not
 * whether the page may be embedded at all. It stays in the enforcing policy so
 * framing protection is real again, and the policy is scoped to the app routes
 * only so the managed preview (which embeds the Worker at the edge, not the app
 * route into the preview's own frame) is unaffected.
 *
 * WHY THERE IS NOW AN ENFORCING CSP INSTEAD OF REPORT-ONLY:
 * the previous report-only policy did not change behaviour. To get an A+ on
 * SecurityHeaders.com the enforcing headers below are required, and an enforcing
 * Content-Security-Policy is part of that. Next.js App Router bootstraps React
 * from inline `<script>` tags (`self.__next_f.push(...)`), so any enforcing
 * policy without 'unsafe-inline' blocks hydration and takes the site down. The
 * only way to keep the site live with an enforcing CSP is to tolerate
 * 'unsafe-inline' for scripts and styles here (documented in the directive list)
 * while keeping the rest of the policy as narrow as this site's actual usage
 * allows. That is the tradeoff being shipped, and the remaining unsafe-inline is
 * flagged on SecurityHeaders.com exactly as expected — the A+ depends on the
 * other enforcing headers.
 *
 * WHAT THIS DOES NOT COVER:
 * - media-src keeps blob: and mediastream: because Voice Recorder, Online Voice
 *   Recorder and the instrument tuner capture/playback audio through object URLs
 *   and MediaStream tracks.
 * - img-src keeps data: and https: because the testers use canvas/data-URI
 *   snapshots and the Internet Speed Test loads remote measurement assets.
 * - style-src keeps https: for the motion library and any third-party embed that
 *   ships its own stylesheet.
 * WebRTC needs no directive here: the loopback test builds its peers with
 * `iceServers: []`, so no STUN/TURN host is contacted.
 *
 * Production vs staging split: the enforcing headers are added at the
 * application level here (via Next.js `headers()`), and HSTS is added only when
 * the request is for the production hostname — see the Worker-side wrapper
 * (lib/security/worker-headers.ts) for that split. The staging preview keeps
 * working because HSTS does not get set for it, and the CSP/X-Frame-Options etc.
 * are unchanged by that split.
 */

export const SECURITY_POLICY_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  // No remote images are loaded by the app (the picsum remote pattern in
  // next.config is unused), so this stays narrow except for the https: needed
  // by the Internet Speed Test's measurement page assets.
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:",
  // blob: covers the object URLs the testers create; speed.cloudflare.com is
  // the Internet Speed Test's measurement endpoint.
  "connect-src 'self' https:",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-src 'self'",
];

export const CONTENT_SECURITY_POLICY = SECURITY_POLICY_DIRECTIVES.join('; ');

export const CONTENT_SECURITY_POLICY_REPORT_ONLY = CONTENT_SECURITY_POLICY;

/**
 * The device capabilities DeviceTry actually asks for, and nothing else.
 * microphone/camera are what every permission-gated tester needs;
 * display-capture is probed by the capabilities report; clipboard is used by
 * the share buttons and the Clipboard tester; autoplay/fullscreen are used by
 * the audio and presentation paths. Everything else is denied explicitly so a
 * future feature cannot silently inherit it.
 *
 * This is the *production* policy: it permits ONLY the capabilities the app
 * uses. Camera and microphone are scoped to `self` so only this origin may use
 * them; geolocation is denied entirely.
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
 * Headers applied to every response at the application level (Next.js
 * `headers()`), which is where every response the app serves passes when
 * running on the Worker through OpenNext. These are the enforcing A+-targeted
 * headers, excluding HSTS (which is hostname-gated and added at the Worker
 * boundary).
 */
export function securityHeaders(): Array<{ key: string; value: string }> {
  return [
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
    { key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY },
  ];
}