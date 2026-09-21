/**
 * Phase 9 route migration map: old route → new destination + deep-link tab.
 *
 * - `destination` is the new primary route.
 * - `tab` selects a merged-tool tab via the stable `?tab=` query parameter.
 * - `permanent: true` entries are wired as 308 redirects in next.config.ts
 *   (this deployment uses `output: 'standalone'`, so server redirects are
 *   available). Retired tools WITHOUT a relevant replacement are absent from
 *   this map and serve a genuine 404 instead of redirecting to the homepage.
 */
export interface RouteMigration {
  from: string; // old slug (under /test/)
  destination: string; // new slug (under /test/)
  tab?: string; // deep-link tab id on the destination page
  label: string; // human-readable tab label for UI/banner copy
  permanent: true;
}

export const ROUTE_MIGRATIONS: RouteMigration[] = [
  { from: 'online-mirror', destination: 'webcam-test', tab: 'mirror', label: 'Mirror mode', permanent: true },
  { from: 'pitch-detector', destination: 'microphone-test', tab: 'pitch', label: 'Pitch Detector tab', permanent: true },
  { from: 'multitouch-test', destination: 'touchscreen-test', tab: 'multi-touch', label: 'Multi-Touch tab', permanent: true },
  { from: 'dead-pixel-test', destination: 'screen-test', tab: 'dead-pixel', label: 'Dead Pixel tab', permanent: true },
  { from: 'display-patterns', destination: 'screen-test', tab: 'patterns', label: 'Patterns tab', permanent: true },
  { from: 'screen-info', destination: 'screen-test', tab: 'screen-info', label: 'Screen Info tab', permanent: true },
  { from: 'display-fps', destination: 'refresh-rate-test', label: 'Refresh Rate Test', permanent: true },
  { from: 'click-counter', destination: 'click-speed-test', label: 'CPS & Spacebar Test', permanent: true },
];

/** Retired standalone tools with NO relevant replacement → genuine 404. */
export const RETIRED_WITHOUT_REDIRECT: string[] = [
  'battery-monitor',
  'accelerometer-test',
  'gyroscope-test',
  'vibration-test',
  'clipboard-test',
  'browser-storage-test',
  'clock-timezone',
  'offline-check',
  'font-rendering',
  'canvas-benchmark',
  'javascript-benchmark',
  'webassembly-benchmark',
  'webgl-test',
  'instrument-tuner',
  'metronome',
];

/** All old slugs that must leave the sitemap and related-tool lists. */
export const RETIRED_SLUGS: string[] = [
  ...RETIRED_WITHOUT_REDIRECT,
  'online-mirror',
  'pitch-detector',
  'multitouch-test',
  'dead-pixel-test',
  'display-patterns',
  'screen-info',
  'display-fps',
  'click-counter',
];

export function findMigration(fromSlug: string): RouteMigration | undefined {
  return ROUTE_MIGRATIONS.find((m) => m.from === fromSlug);
}

/**
 * The final 15-tool primary catalog, in canonical order (Phase 9, item A).
 * Exported so tests can assert the registry matches this exact lineup.
 */
export const FINAL_CATALOG: readonly string[] = [
  'microphone-test',
  'webcam-test',
  'speakers-test',
  'voice-recorder',
  'tone-generator',
  'keyboard-test',
  'mouse-test',
  'gamepad-test',
  'touchscreen-test',
  'click-speed-test',
  'reaction-time-test',
  'screen-test',
  'refresh-rate-test',
  'internet-speed-test',
  'what-is-my-ip',
] as const;
