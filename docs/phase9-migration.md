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

`next.config.ts` exports `SITE_URL` (from `NEXT_PUBLIC_SITE_URL`, defaulting to the
release domain). `lib/site.ts`, sitemap, robots, and layout metadata all consume it,
so metadataBase, canonicals, Open Graph URLs, and the sitemap always agree. If the
release domain changes, set `NEXT_PUBLIC_SITE_URL` — no code edits needed.
