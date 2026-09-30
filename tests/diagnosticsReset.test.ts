/**
 * Reset / unmount regressions for the six Advanced Diagnostics cards.
 *
 * The shared banner's "Clear result" button resets the shared ResultController
 * only. Without an explicit signal, each card keeps the tables, figures and
 * verdicts it rendered, so after a clear the page contradicts itself: the
 * banner says "no result" while the card still shows the numbers of the run the
 * user just cancelled.
 *
 * These are source-level pins on purpose — the behaviour is the wiring between
 * three modules (wrapper -> prop -> effect), and the effect itself (a React
 * hook) has no meaning outside a rendered tree. The controller-side token
 * invalidation that stops a stale run from re-reporting is covered for real in
 * resultLifecycle.test.ts.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = process.cwd();
const read = (rel: string) => readFileSync(join(repoRoot, rel), 'utf8');

const SIX = {
  WebRTCTester: 'components/tests/WebRTCTester.tsx',
  PrivacyStorageInspectorTester: 'components/tests/PrivacyStorageInspectorTester.tsx',
  PermissionDiagnosticsTester: 'components/tests/PermissionDiagnosticsTester.tsx',
  CodecSupportTester: 'components/tests/CodecSupportTester.tsx',
  BrowserCompatibilityTester: 'components/tests/BrowserCompatibilityTester.tsx',
  BrowserSystemInfoTester: 'components/tests/BrowserSystemInfoTester.tsx',
} as const;

test('reset - the wrapper bumps a signal on every clear so cards can wipe their own output', () => {
  const source = read('components/TestResultBanner.tsx');
  assert.match(source, /const \[resetSignal, setResetSignal\] = useState\(0\)/, 'wrapper must own a reset counter');
  assert.match(source, /setResetSignal\(\(value\) => value \+ 1\)/, 'each clear must bump the counter');
  // The banner's Clear button must go through the bumping handler, not straight
  // to the controller — otherwise the banner clears and the card does not.
  assert.match(source, /onClear=\{handleReset\}/, 'banner Clear must use the signal-bumping handler');
  assert.match(source, /resetSignal=\{resetSignal\}/, 'the counter must reach the tester as a prop');
});

test('reset - the pulse never fires on first render, only on a real clear afterwards', () => {
  const source = read('components/tests/useResetSignal.ts');
  // A card that reads on load (permissions, system info) must still do so
  // after this effect is added; firing on mount would wipe it instantly.
  assert.match(source, /firstSeen = useRef\(resetSignal\)/);
  assert.match(source, /if \(firstSeen\.current === resetSignal\) return;/);
  assert.match(source, /useEffect\(\(\) => \{[\s\S]*\}, \[resetSignal\]\)/);
});

test('reset - all six cards subscribe to the pulse', () => {
  for (const [name, path] of Object.entries(SIX)) {
    const source = read(path);
    assert.match(source, /resetSignal\?: number;/, `${name} must declare the prop`);
    assert.match(source, /useResetPulse\(resetSignal,/, `${name} must subscribe to the reset pulse`);
  }
});

test('reset - a cleared card shows no verdict text, only its own empty state', () => {
  const cases: [string, string, RegExp][] = [
    // WebRTC: an in-flight loopback must be stopped too, or its late snapshot
    // repaints the handshake/RTT tiles the user just discarded.
    ['WebRTCTester', SIX.WebRTCTester, /useResetPulse\(resetSignal, \(\) => \{[\s\S]{0,200}stopRun\(\)/],
    ['WebRTCTester', SIX.WebRTCTester, /setResult\(null\)/],
    ['PrivacyStorageInspectorTester', SIX.PrivacyStorageInspectorTester, /setOutcome\(null\)/],
    ['CodecSupportTester', SIX.CodecSupportTester, /setRows\(null\)/],
    ['PermissionDiagnosticsTester', SIX.PermissionDiagnosticsTester, /useResetPulse\(resetSignal, clearVisible\)/],
    ['BrowserSystemInfoTester', SIX.BrowserSystemInfoTester, /setInfo\(null\)/],
  ];
  for (const [name, path, pattern] of cases) {
    assert.match(read(path), pattern, `${name} must clear its visible result on reset`);
  }
});

test('reset - the codec card invalidates its generation so a late probe cannot repaint the table', () => {
  const source = read(SIX.CodecSupportTester);
  assert.match(source, /useResetPulse\(resetSignal, \(\) => \{[\s\S]{0,200}generationRef\.current \+= 1;/);
});

test('reset - cards that query on load stay quiet after a clear until re-armed', () => {
  // Permissions and system info read state on mount. If a clear left the
  // auto-query armed, the effect would immediately repopulate and the user's
  // clear would appear not to work.
  assert.match(
    read(SIX.PermissionDiagnosticsTester),
    /suppressedRef\.current = true;/,
    'permissions must suppress the auto-query after a clear'
  );
  assert.match(
    read(SIX.PermissionDiagnosticsTester),
    /suppressedRef\.current = false;/,
    'permissions must offer a way to re-arm the query'
  );

  // System info carries the same suppression flag in state, because it renders
  // the flag in the cleared placeholder — a ref read during render is not
  // guaranteed to have re-rendered with it.
  const systemInfo = read(SIX.BrowserSystemInfoTester);
  assert.match(systemInfo, /setSuppressed\(true\)/, 'system info must suppress the auto-query after a clear');
  assert.match(systemInfo, /setSuppressed\(false\)/, 'system info must offer a way to re-arm the query');
});

test('controls - each storage button is reachable by an accessible name that matches its label', () => {
  // The Refresh button was announced as "Reset inspector state" while showing
  // "Refresh", which is a WCAG 2.5.3 (Label in Name) failure and makes the
  // control impossible to find by its visible text.
  const source = read(SIX.PrivacyStorageInspectorTester);
  assert.match(
    source,
    /aria-label="Refresh:[^"]*"/,
    'the Refresh accessible name must contain its visible label'
  );
  assert.doesNotMatch(source, /aria-label="Reset inspector state"/);
  // The other two are identified by their visible text alone.
  assert.match(source, />\s*Export Backup\s*</);
  assert.match(source, />\s*Clear Owned Data\s*</);
});

test('reset - every card clears the shared banner when its own reset runs', () => {
  // A card-level reset that leaves the banner behind is the same bug in
  // reverse: the verdict outlives the reading it describes.
  for (const [name, path] of Object.entries(SIX)) {
    assert.match(read(path), /onResultClear\?\.\(\)/, `${name} must clear the shared result on its own reset`);
  }
});