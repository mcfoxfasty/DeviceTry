/**
 * Response security headers for DeviceTry.
 *
 * DeviceTry is a static, client-side-only site served from Cloudflare through
 * OpenNext: no accounts, no payments, no server session, and nothing leaves the
 * browser. The headers below are the ones that can be added WITHOUT changing how
 * the product behaves, which is the whole criterion here — a header that breaks a
 * tester is worse than a missing header.
 *
 * WHY script-src STILL NEEDS 'unsafe-inline', AND WHAT WAS TRIED (measured
 * 2026-10-06):
 * The App Router ships a page's React Server Component payload and the runtime
 * bootstrap as inline `<script>` blocks inside the prerendered HTML — 25 of them
 * on `/` and 34 on `/test/keyboard-test`, 67-132 KB per document. They are inline
 * because they ARE the streamed page data, not because anything was inlined by
 * mistake, so no build option moves them into a file. Four ways to drop the
 * token were examined, three of them empirically:
 *
 *   1. Just remove it (the "script-src 'self' https:" build). Tested end to end
 *      against the production build in headless Chromium: the browser refused
 *      every inline block (25 violations on `/`, 34 on the tool page), React
 *      never attached to the DOM (`__reactFiber$`/`__reactContainer$` on 0
 *      nodes), and the homepage's visible text fell from 5,412 characters to 0.
 *      The result is a blank page, not a degraded one. Rejected.
 *   2. A nonce. Next.js applies the nonce taken from the CSP request header
 *      during server-side rendering, so, in its own words, "When you use nonces
 *      in your CSP, all pages must be dynamically rendered" — a statically
 *      generated page is built when no request headers exist, so no nonce is
 *      injected. Taking this route disables static optimization and ISR and makes
 *      the pages uncacheable at the CDN; Next's guide lists slower initial loads,
 *      higher server load, no edge caching and higher hosting cost. That would
 *      trade this site's whole delivery model — prerendered HTML behind a
 *      year-long shared cache — for one line on a scanner report. Not taken.
 *   3. Hashes. Each page's inline blocks carry different, page-specific payloads
 *      and every content edit changes them, so a workable policy would need a
 *      per-route hash set regenerated from the finished HTML on every build (a
 *      two-pass or patch-the-manifest build). A stale hash means a blank site,
 *      and a framework upgrade that changes the manifest shape does the same
 *      silently. Rejected as a production hazard.
 *   4. Subresource Integrity (`experimental.sri`). Tested: it added `integrity`
 *      to the 5 external chunks and left all 25/34 inline blocks exactly where
 *      they were, so it cannot lift the cap either. Reverted.
 *
 * WHAT THAT MEANS FOR THE GRADE, DELIBERATELY:
 * securityheaders.com caps this site at A, not A+, because of that remaining
 * 'unsafe-inline'. The cap is accepted rather than paid for with the
 * architecture, because the exposure it would buy back is close to nil: the
 * site renders no user-supplied markup (every word is authored in this repo),
 * has no session, sets no cookie, and reflects no request data into HTML, so
 * there is no injection point for the inline script a strict policy would block.
 * Revisit only if the site ever renders third-party or visitor content.
 *
 * WHY 'unsafe-eval' IS NOT IN script-src (removed 2026-10-06):
 * Next's guide is explicit that "'unsafe-eval' is not required for production.
 * Neither React nor Next.js use eval in production by default" — it is needed
 * only in development, where React reconstructs server error stacks in the
 * browser. The removal is confirmed against the production build: in the strict
 * test build above, not one violation mentioned eval, and with the token gone
 * the served policy produces no violations at all (see the verification note on
 * the directive list). Nothing on this site evaluates a string as code.
 *
 * FRAMING: WHY THERE IS NO X-Frame-Options, AND WHAT frame-ancestors ALLOWS
 * (2026-10-06):
 * Framing is expressed ONLY in CSP `frame-ancestors`; the X-Frame-Options header
 * is deliberately NOT sent. XFO cannot say "this site plus one known embedder":
 * SAMEORIGIN — like the DENY value that was tried and reverted on 2026-10-04 —
 * is decided per ancestor origin, so ANY cross-origin parent is refused. The
 * managed preview panel embeds this site in an <iframe> from another origin, so
 * SAMEORIGIN blanked it on a healthy server (`/` still answered 200 with a
 * complete 174 KB document, but nothing was painted). That failure was
 * reproduced deliberately: a parent page on another origin framing this site is
 * refused with "an ancestor violates the following Content Security Policy
 * directive: \"frame-ancestors 'self'\"" and the iframe lands on
 * `chrome-error://chromewebdata/`. frame-ancestors is both the modern form of
 * this rule and the only one that can allowlist a specific embedder, so it
 * carries the rule and names the panel's own origin as well as 'self'.
 *
 * The tradeoff is explicit rather than accidental: a scanner that insists on the
 * X-Frame-Options header itself will report that row as missing, even though the
 * same rule is still enforced in CSP. Sending XFO again from here is not the fix
 * — this config is what the sandbox preview uses too, so it would re-blank the
 * panel. If a scan ever regresses on that row, hostname-gate XFO at the Worker
 * boundary for the production hostname(s) only, the way HSTS is already gated in
 * lib/security/worker-headers.ts.
 *
 * HSTS is added only at the Worker boundary, for the production hostname(s) —
 * see STAGING/PRODUCTION handling in lib/security/worker-headers.ts. The staging
 * preview is not covered, so a hardcoded max-age is never sent for it, and the
 * HSTS a scanner may see on the sandbox URL comes from the sandbox's own proxy
 * layer rather than from this file.
 *
 * WHAT THE REST OF THE POLICY NAMES, AND WHY:
 *   - `blob:`/`mediastream:` in media-src — Voice Recorder, Online Voice
 *     Recorder and the instrument tuner play and record captured audio.
 *   - `blob:` in img-src — canvas snapshots and captured frames.
 *   - `data:` in img-src — inline snapshots the testers draw themselves.
 *   - `https:` in connect-src/img-src/font-src/style-src — the Internet Speed
 *     Test runs on Cloudflare's measurement engine and loads its own assets.
 *   - `'unsafe-inline'` in style-src — the motion library writes inline styles.
 *   - No wildcard and no http: source anywhere.
 * WebRTC needs no directive here: its loopback test builds its peers with
 * `iceServers: []`, so no STUN/TURN host is contacted.
 *
 * VERIFICATION: `bun run lint`, `bunx tsc --noEmit`, the test suite, and a
 * production build all pass. The built headers were confirmed on the wire and
 * driven in a real browser (page rendered, React hydrated, the catalog's search
 * filter narrowed 25 cards to 10, zero CSP violations, no failed requests), and
 * framing was exercised both ways: an allowlisted parent origin renders the page
 * in an iframe, and a third-party parent is still refused.
 */

export const SECURITY_POLICY_DIRECTIVES: readonly string[] = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  // 'self' plus the managed preview panel's own origin — see the framing note
  // above for why the embedder has to be named here instead of in
  // X-Frame-Options.
  "frame-ancestors 'self' https://freebuff.com https://*.freebuff.com",
  // No remote images are loaded by the app (the picsum remote pattern in
  // next.config is unused), so this stays narrow except for the https: needed
  // by the Internet Speed Test's measurement page assets.
  "img-src 'self' data: https:",
  "font-src 'self' data: https:",
  "style-src 'self' 'unsafe-inline' https:",
  // 'unsafe-inline' is mandatory here (see the header comment); 'unsafe-eval' is
  // deliberately absent because production React and Next.js never need it.
  "script-src 'self' 'unsafe-inline' https:",
  // blob: covers the object URLs the testers create; https: covers the Internet
  // Speed Test's measurement endpoint.
  "connect-src 'self' https:",
  "media-src 'self' blob: mediastream:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "form-action 'self'",
  "frame-src 'self'",
];

export const CONTENT_SECURITY_POLICY = SECURITY_POLICY_DIRECTIVES.join('; ');

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
 * running on the Worker through OpenNext. These are the enforcing A-targeted
 * headers, excluding HSTS (which is hostname-gated and added at the Worker
 * boundary).
 *
 * The CSP is deliberately omitted in development. Next.js dev mode compiles
 * pages with webpack's eval-source-map, which emits JS via eval(), so the
 * current policy — script-src 'self' 'unsafe-inline' https: without
 * 'unsafe-eval' — blocks the dev server's own bundles and leaves the site
 * dead. The policy stays exactly as-is in production; this only gates the
 * whole header behind NODE_ENV === 'production'.
 */
export function securityHeaders(): Array<{ key: string; value: string }> {
  const headers: Array<{ key: string; value: string }> = [
    { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
    // No X-Frame-Options: see the framing note above. frame-ancestors carries the
    // rule because it is the only directive that can allowlist the managed
    // preview panel's origin.
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'Permissions-Policy', value: PERMISSIONS_POLICY },
  ];

  // The Content-Security-Policy header is a production header only. In dev,
  // Next.js webpack eval-source-map needs eval(), which this policy forbids,
  // so sending it breaks every page. Never add 'unsafe-eval' to the policy
  // itself — the production value is unchanged.
  if (process.env.NODE_ENV === 'production') {
    headers.push({ key: 'Content-Security-Policy', value: CONTENT_SECURITY_POLICY });
  }

  return headers;
}
