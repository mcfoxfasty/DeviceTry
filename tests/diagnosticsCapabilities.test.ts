/**
 * Browser capability + system info regressions.
 *
 * Two specific lies are pinned here:
 *  - `mediaDevices in navigator` used to report "Supported" even when
 *    getUserMedia was missing or not callable,
 *  - `pictureInPictureEnabled in document` used to report "Supported" even
 *    when the value was false.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readGlobal } from '../lib/testing/browserCapabilities';
import {
  CapabilityCheck,
  CapabilityRow,
  CAPABILITY_CHECKS,
  countCapabilities,
  evaluateCapabilities,
  filterCapabilities,
} from '../lib/testing/browserCapabilities';
import {
  collectScreenFacts,
  collectSystemSnapshot,
  formatMeasurement,
  isAmbiguousDesktopStyleIpad,
  isNonSafariIosBrowser,
  parseOperatingSystem,
  parseUserAgentFacts,
  summarizeSystemSnapshot,
} from '../lib/testing/systemInfoFacts';

/** Install a temporary set of globals, restoring the originals afterwards. */
function withGlobals<T>(values: Record<string, unknown>, fn: () => T): T {
  const globals = globalThis as Record<string, unknown>;
  const saved = new Map<string, PropertyDescriptor | undefined>();
  for (const [key, value] of Object.entries(values)) {
    saved.set(key, Object.getOwnPropertyDescriptor(globals, key));
    // Node exposes some globals (e.g. `navigator`) as getter-only accessors,
    // so plain assignment throws. Redefine instead, then put back exactly.
    Object.defineProperty(globals, key, { value, configurable: true, writable: true, enumerable: true });
  }
  try {
    return fn();
  } finally {
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globals, key, descriptor);
      else delete globals[key];
    }
  }
}

const check = (name: string): CapabilityCheck => CAPABILITY_CHECKS.find((c) => c.name === name)!;

// ---------------------------------------------------------------------------
// getUserMedia
// ---------------------------------------------------------------------------

test('capabilities - a mediaDevices object without a callable getUserMedia is missing', () => {
  const row = (navigatorValue: unknown): CapabilityRow =>
    withGlobals({ navigator: navigatorValue }, () => evaluateCapabilities([check('Media capture (getUserMedia)')]))[0];

  assert.equal(row({}).state, 'missing', 'no mediaDevices at all');
  assert.equal(row({ mediaDevices: {} }).state, 'missing', 'mediaDevices without getUserMedia');
  assert.equal(row({ mediaDevices: { getUserMedia: 'nope' } }).state, 'missing', 'getUserMedia must be callable');
  assert.equal(row({ mediaDevices: { getUserMedia: () => undefined } }).state, 'available');
});

test('capabilities - getDisplayMedia is checked the same way', () => {
  const row = (nav: unknown): CapabilityRow =>
    withGlobals({ navigator: nav }, () => evaluateCapabilities([check('Screen capture (getDisplayMedia)')]))[0];
  assert.equal(row({ mediaDevices: {} }).state, 'missing');
  assert.equal(row({ mediaDevices: { getDisplayMedia: () => undefined } }).state, 'available');
});

// ---------------------------------------------------------------------------
// pictureInPictureEnabled
// ---------------------------------------------------------------------------

test('capabilities - pictureInPictureEnabled is read as a value, not as an existence check', () => {
  const row = (value: unknown): CapabilityRow =>
    withGlobals({ document: { pictureInPictureEnabled: value } }, () =>
      evaluateCapabilities([check('Picture-in-Picture (video)')])
    )[0];

  assert.equal(row(true).state, 'available');
  assert.match(row(true).detail, /=== true/);
  assert.equal(row(false).state, 'disabled', 'exposed but switched off is not "available"');
  assert.match(row(false).detail, /=== false/);

  const absent = withGlobals({ document: {} }, () =>
    evaluateCapabilities([check('Picture-in-Picture (video)')])
  )[0];
  assert.equal(absent.state, 'missing', 'a document without the property is missing');

  const nonsense = row('yes');
  assert.equal(nonsense.state, 'error', 'a non-boolean value is an anomaly, not support');
});

test('capabilities - a browser that ships the property but disables it is reported as off, not supported', () => {
  // This is the exact scenario the old `in` check got wrong.
  const rows = withGlobals({ document: { pictureInPictureEnabled: false } }, () =>
    evaluateCapabilities([check('Picture-in-Picture (video)')])
  );
  assert.equal(rows[0].state, 'disabled');
  assert.notEqual(rows[0].state, 'available');
});

// ---------------------------------------------------------------------------
// Matrix behaviour
// ---------------------------------------------------------------------------

test('capabilities - every check names the property or function it reads', () => {
  for (const entry of CAPABILITY_CHECKS) {
    assert.ok(entry.reads.length > 10, `${entry.name} must state what it reads`);
    assert.ok(CAPABILITY_CHECKS.some((c) => c.category === entry.category));
  }
});

test('capabilities - counts separate available, disabled, missing and error', () => {
  const rows: CapabilityRow[] = [
    { name: 'a', category: 'Media', reads: 'x', state: 'available', detail: '' },
    { name: 'b', category: 'Media', reads: 'x', state: 'disabled', detail: '' },
    { name: 'c', category: 'Media', reads: 'x', state: 'missing', detail: '' },
    { name: 'd', category: 'Media', reads: 'x', state: 'error', detail: '' },
  ];
  assert.deepEqual(countCapabilities(rows), { available: 1, disabled: 1, missing: 1, error: 1, total: 4 });
});

test('capabilities - a probe that throws becomes an error row instead of breaking the matrix', () => {
  const rows = evaluateCapabilities([
    {
      name: 'Exploding',
      category: 'Runtime',
      reads: 'nothing',
      probe: () => {
        throw new Error('boom');
      },
    },
  ]);
  assert.equal(rows[0].state, 'error');
  assert.match(rows[0].detail, /boom/);
});

test('capabilities - search matches name, category and the property read', () => {
  const rows: CapabilityRow[] = [
    { name: 'Media capture (getUserMedia)', category: 'Media', reads: 'navigator.mediaDevices.getUserMedia is a function', state: 'available', detail: '' },
    { name: 'Vibration API', category: 'Input', reads: 'navigator.vibrate is a function', state: 'missing', detail: '' },
  ];
  assert.deepEqual(filterCapabilities(rows, { query: 'vibrat', category: 'All' }).map((r) => r.name), ['Vibration API']);
  assert.deepEqual(filterCapabilities(rows, { query: 'MEDIA DEVICES', category: 'All' }).map((r) => r.name), [
    'Media capture (getUserMedia)',
  ]);
  assert.deepEqual(filterCapabilities(rows, { query: 'input', category: 'All' }).map((r) => r.name), ['Vibration API']);
  assert.deepEqual(filterCapabilities(rows, { query: 'media', category: 'Input' }), []);
  assert.equal(filterCapabilities(rows, { query: '   ', category: 'All' }).length, 2, 'a blank query shows everything');
});

test('capabilities - the matrix stays passive: no permission is requested and nothing is captured', () => {
  const readGlobalSpy: string[] = [];
  withGlobals(
    {
      navigator: { permissions: { query: () => readGlobalSpy.push('permissions.query') }, mediaDevices: {} },
      Notification: { requestPermission: () => readGlobalSpy.push('Notification.requestPermission') },
      geolocation: { getCurrentPosition: () => readGlobalSpy.push('geolocation') },
      speechSynthesis: { getVoices: () => readGlobalSpy.push('getVoices') },
      indexdb: undefined,
    },
    () => evaluateCapabilities(CAPABILITY_CHECKS)
  );
  assert.deepEqual(readGlobalSpy, [], 'evaluating the matrix must not call any of these');
});

test('capabilities - readGlobal walks a dotted path without throwing on a missing root', () => {
  withGlobals({ navigator: { mediaDevices: { getUserMedia: () => 1 } } }, () => {
    assert.equal(typeof readGlobal('navigator.mediaDevices.getUserMedia'), 'function');
    assert.equal(readGlobal('navigator.nothing.here'), undefined);
    assert.equal(readGlobal('document.createElement'), undefined);
  });
});

// ---------------------------------------------------------------------------
// System info
// ---------------------------------------------------------------------------

test('system info - screen, viewport and pixel ratio are three separate readings', () => {
  const facts = collectScreenFacts({
    screen: { width: 2560, height: 1440, availWidth: 2560, availHeight: 1415, colorDepth: 24 },
    innerWidth: 1280,
    innerHeight: 700,
    devicePixelRatio: 2,
  });
  assert.equal(facts.screenWidth, '2560 CSS px');
  assert.equal(facts.viewportWidth, '1280 CSS px');
  assert.notEqual(facts.screenWidth, facts.viewportWidth);
  assert.match(facts.devicePixelRatio, /^2 /);
  // devicePixelRatio is device pixels PER css pixel. The old label inverted it,
  // which reads as "each device pixel is smaller than a CSS pixel" — true only
  // above 1, and backwards on every HiDPI display.
  assert.match(facts.devicePixelRatio, /device pixels per CSS pixel/i);
  assert.doesNotMatch(facts.devicePixelRatio, /CSS pixels per device pixel/i);
  assert.match(facts.devicePixelRatio, /zoom and OS scaling/i);

  // A ratio below 1 (a zoomed-out window) makes the inversion obvious.
  const zoomedOut = collectScreenFacts({ devicePixelRatio: 0.5 });
  assert.match(zoomedOut.devicePixelRatio, /^0\.5 \(device pixels per CSS pixel/);
  assert.match(facts.note, /The panel's true physical resolution is not knowable/);
});

test('system info - a valid zero survives, an absent value reads Not exposed', () => {
  const snapshot = collectSystemSnapshot({ navigator: { maxTouchPoints: 0, userAgent: 'x' } });
  assert.equal(snapshot.maxTouchPoints, '0', 'no touch digitizer is a real reading, not a missing value');
  assert.equal(snapshot.hardwareConcurrency, 'Not exposed');
  assert.equal(snapshot.deviceMemory, 'Not exposed');
  assert.equal(formatMeasurement(0), '0');
  assert.equal(formatMeasurement(undefined), 'Not exposed');
  assert.equal(formatMeasurement(null), 'Not exposed');
});

test('system info - an invalid device pixel ratio is reported as unavailable, never as 0', () => {
  const facts = collectScreenFacts({ devicePixelRatio: 0 });
  assert.equal(facts.devicePixelRatio, 'Not exposed');
});

test('system info - engine, OS and architecture are labelled as estimates', () => {
  const facts = parseUserAgentFacts(
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    'Win32',
    0
  );
  assert.equal(facts.engine, 'Blink (Chromium)');
  assert.equal(facts.engineSource, 'estimated from user agent');
  assert.equal(facts.osConfidence, 'estimated from user agent');
  assert.match(facts.os, /Windows 10 or 11/);
  assert.match(String(facts.note), /cannot be told apart/);
  assert.equal(facts.architectureSource, 'estimated from user agent');
});

test('system info - a non-Safari iOS browser is not reported as Safari, and not guessed', () => {
  const ua =
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0 Mobile/15E148 Safari/604.1';
  assert.equal(isNonSafariIosBrowser(ua), true);
  const parsed = parseOperatingSystem(ua, 'iPhone', 5);
  assert.match(parsed.os, /browser not identifiable from user agent/);
  assert.match(String(parsed.note), /desktop Safari string/);
});

test('system info - a desktop-style iPad user agent is not confidently called macOS', () => {
  const ua =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
  assert.equal(isAmbiguousDesktopStyleIpad(ua, 5), true);
  assert.equal(isAmbiguousDesktopStyleIpad(ua, 0), false, 'a real Mac reports no touch points');
  const parsed = parseOperatingSystem(ua, 'MacIntel', 5);
  assert.equal(parsed.confidence, 'ambiguous');
  assert.match(parsed.os, /macOS or iPadOS \(ambiguous\)/);
});

test('system info - ARM never implies AArch64', () => {
  const arm64 = parseUserAgentFacts('Mozilla/5.0 (Linux; armv7l)', 'Linux armv7l', 0);
  assert.equal(arm64.architecture, 'ARM family');
  assert.match(String(arm64.note), /does not distinguish 32-bit from 64-bit/);
  assert.doesNotMatch(arm64.architecture, /AArch64/i);

  const arm64Explicit = parseUserAgentFacts('Mozilla/5.0 (Linux; aarch64)', 'Linux', 0);
  assert.equal(arm64Explicit.architecture, 'ARM 64-bit family');
});

test('system info - the snapshot verdict is measured, never passed', () => {
  const snapshot = collectSystemSnapshot({
    navigator: { userAgent: 'Mozilla/5.0 (X11; Linux x86_64)', platform: 'Linux x86_64', hardwareConcurrency: 8, onLine: true },
    screen: collectScreenFacts({ screen: { width: 1920, height: 1080 }, innerWidth: 800, innerHeight: 600, devicePixelRatio: 1 }),
  });
  const summary = summarizeSystemSnapshot(snapshot);
  assert.equal(summary.status, 'measured');
  assert.notEqual(summary.status, 'passed');
  assert.match(summary.details, /Nothing was tested here/);
  assert.equal(summary.metrics.logicalCoresReported, 8);
});
