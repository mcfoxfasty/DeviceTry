# Phase 9 Route Migration Map

This document is the project's record of the Phase 9 catalog reorganization. It is
kept in the repository so future changes can check old routes against the mapping.

## Final primary catalog (15 tools)

| # | Route | Notes |
|---|-------|-------|
| 1 | `/test/microphone-test` | Merged: Level & Waveform / Pitch Detector / Recorder tabs |
| 2 | `/test/webcam-test` | Merged: Camera Test / Mirror tabs |
| 3 | `/test/speakers-test` | Speaker & headphone checks incl. left/right stereo |
| 4 | `/test/voice-recorder` | Dedicated recording tool (same recorder implementation as the mic tab) |
| 5 | `/test/tone-generator` | Unchanged |
| 6 | `/test/keyboard-test` | Unchanged |
| 7 | `/test/mouse-test` | Unchanged |
| 8 | `/test/gamepad-test` | Unchanged |
| 9 | `/test/touchscreen-test` | Merged: Coverage / Multi-Touch tabs |
| 10 | `/test/click-speed-test` | Migrated from click-counter; CPS & Spacebar Test |
| 11 | `/test/reaction-time-test` | New tool |
| 12 | `/test/screen-test` | Merged: Dead Pixel / Patterns / Screen Info tabs |
| 13 | `/test/refresh-rate-test` | Migrated from display-fps |
| 14 | `/test/internet-speed-test` | New tool (@cloudflare/speedtest adapter) |
| 15 | `/test/what-is-my-ip` | New tool (same-origin endpoint) |

## Route migrations (301 permanent redirects via next.config.ts)

| Old route | New destination | Deep link |
|-----------|-----------------|-----------|
| `/test/online-mirror` | `/test/webcam-test` | `?tab=mirror` |
| `/test/pitch-detector` | `/test/microphone-test` | `?tab=pitch` |
| `/test/multitouch-test` | `/test/touchscreen-test` | `?tab=multi-touch` |
| `/test/dead-pixel-test` | `/test/screen-test` | `?tab=dead-pixel` |
| `/test/display-patterns` | `/test/screen-test` | `?tab=patterns` |
| `/test/screen-info` | `/test/screen-test` | `?tab=screen-info` |
| `/test/display-fps` | `/test/refresh-rate-test` | — |
| `/test/click-counter` | `/test/click-speed-test` | — |

Single source of truth: `lib/tools/migration.ts` (`ROUTE_MIGRATIONS`), consumed by
`next.config.ts` redirects and the tests in `tests/phase9.test.ts`.

## Retired standalone tools (no redirect — genuine 404)

`battery-monitor`, `accelerometer-test`, `gyroscope-test`, `vibration-test`,
`clipboard-test`, `browser-storage-test`, `clock-timezone`, `offline-check`,
`font-rendering`, `canvas-benchmark`, `javascript-benchmark`,
`webassembly-benchmark`, `webgl-test`, `instrument-tuner`, `metronome`

These routes are removed from the registry, navigation, and sitemap. Because tool
pages use `generateStaticParams` + `notFound()`, requests render the app's real
404 page. Retired tool routes are intentionally **not** redirected to the homepage.

## Supporting functions (not primary catalog cards)

- `permission-diagnostics` — linked from microphone/camera permission help
- `browser-compatibility`, `codec-support`, `webrtc-test` — advanced diagnostics
  linked from relevant help (WebRTC remains a local capability test)
- `browser-system-info` — used by guided inspection/reporting
- `devicetry-storage-inspector` — privacy/settings data controls

## Site URL configuration

`lib/site.ts` is the SINGLE source of truth: it validates `NEXT_PUBLIC_SITE_URL`
(absolute http(s), site root only) and every generated surface — metadataBase,
canonicals, Open Graph, sitemap, robots — imports it from there.

- **Required deployment variable:** `NEXT_PUBLIC_SITE_URL` must be set to the
  confirmed public URL (e.g. `https://example.com`) at deploy time. There is NO
  assumed production-domain fallback in code.
- Local development without the variable uses `http://localhost:3000`.
- A production build without the variable emits a build-time console error and
  uses the RFC 2606 placeholder `https://site-url-unset.invalid` — canonicals
  and OG URLs will not resolve. Treat that placeholder in built output as a
  release blocker.
- Production env vars are set separately from the sandbox: `freebuff-deploy env
  set '{"NEXT_PUBLIC_SITE_URL":"https://…"}'` (applied on the next deploy).

## Build lint enforcement on the 2 GiB container (2026-09-21 record)

Next's in-build lint worker OOM-killed two verification builds in this
container: compile succeeded, then "Cannot find module for page" ENOENT storms
during page-data collection, with `memory.events` showing `max 611 / oom 15 /
oom_kill 1` and identical failure signatures across two clean rebuilds.
Keeping `eslint.ignoreDuringBuilds: true` (as the code comment in
`next.config.ts` records) was therefore necessary **for this container's build
step only**; lint is enforced as a hard gate in `bun run verify`
(`lint && test && tsc && build`) — the build does not pass verification unless
lint exits 0. On a container with more memory, removing the option restores
in-build lint at zero behavioral risk. Historical note: an earlier
lint-skipping option also existed and was removed on 2026-09-21 because it
suppressed real regressions; the current state keeps lint fully enforced via
the verify gate while keeping the container's build memory-safe.

## What's My IP — endpoint trust requirements

`/api/ip` returns the visitor IP from `cf-connecting-ip` **only** when the
origin declares `IP_TRUSTED_PROXY=cloudflare`. Under that configuration the
operator must ensure the origin is reachable only via Cloudflare (lock the
origin to Cloudflare IP ranges or enable Authenticated Origin Pulls) — the
header is forgeable on a directly reachable origin.

- Without the variable the endpoint returns an honest 501 — it never falls
  back to `x-forwarded-for` in production, and `PORT` no longer influences
  behavior (production containers routinely set PORT).
- The IP is validated against a strict IPv4/IPv6 validator before it is
  returned; a malformed or spoofed header value can never be emitted as an IP.
- `Cache-Control: no-store` prevents one visitor's answer being served to
  another. The handler persists or logs no IP.
- Live Cloudflare deployment has NOT been verified — that remains a release
  step (first deploy, then confirm `/api/ip` returns the real client IP).
