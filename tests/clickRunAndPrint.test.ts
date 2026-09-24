/**
 * Regressions for three real-testing findings.
 *
 *  1. "Cannot update TesterWithBanner while rendering ClickCounterTester" —
 *     the finished-run callback was invoked from inside a React state
 *     updater. State updaters are render-phase code, so forwarding the host
 *     result from one updated a parent during render. The run now lives in a
 *     plain object (lib/testing/clickSpeed.ts) and the host callback is
 *     invoked from event/timer context only.
 *  2. The speed-test progress label must stay short while still naming the
 *     engine's real active phase.
 *  3. When a browser blocks the print window (iOS Safari), the fallback must
 *     be an honest, working path — and a text file is never called a PDF.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { BoundedCpsRun, computeCps } from '../lib/testing/clickSpeed';
import { describeSpeedPhase } from '../lib/testing/speedProvider';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const clickTesterSource = readFileSync(join(repoRoot, 'components/tests/ClickCounterTester.tsx'), 'utf8');
const exportControlSource = readFileSync(join(repoRoot, 'components/ui/ExportReportControl.tsx'), 'utf8');

/* ------------------------------------------------------------------ */
/* 1. No host update from a state updater                               */
/* ------------------------------------------------------------------ */

test('click run - the host result callback is never called inside a state updater', () => {
  // The original defect: setClicks((current) => { finishTest(current, ...) }).
  // React runs updater functions during render, so the parent's
  // onResultUpdate fired mid-render and React warned.
  // The invariant: setClicks is only ever called with a plain VALUE, never
  // with an updater function — there is no render-phase callback path left.
  const setClicksCalls = clickTesterSource.match(/setClicks\(([^;]*?)\);/g) ?? [];
  assert.ok(setClicksCalls.length > 0, 'setClicks is still used');
  for (const call of setClicksCalls) {
    assert.ok(
      !/=>|\(\s*\w+\s*\)\s*=>/.test(call),
      `setClicks must receive a value, not an updater function: ${call.trim()}`
    );
  }
  assert.ok(
    !/setClicks\([\s\S]{0,400}finishTest\(/.test(clickTesterSource),
    'finishTest must not be invoked from within a setClicks updater'
  );
  assert.match(
    clickTesterSource,
    /runRef\.current = run/,
    'the run is held in a ref, not reconstructed from state'
  );
  assert.match(clickTesterSource, /onResultUpdateRef\.current\(/, 'the host is notified from event context');
});

test('click run - a 36 click / 5 second run reports 7.2 CPS and completes', () => {
  const run = new BoundedCpsRun(5, 'mouse');
  run.start(0);
  for (let i = 0; i < 36; i += 1) run.hit(100);
  // Timer advances past the 5s limit.
  const tick = run.tick(5000);
  assert.equal(tick.finished, true);
  assert.equal(tick.remaining, 0);

  const result = run.result(5000);
  assert.equal(result.clicks, 36);
  assert.equal(result.cps, 7.2);
  assert.equal(result.durationSeconds, 5);
  assert.equal(result.inputMode, 'mouse');
});

test('click run - the countdown reports the real remaining time before the limit', () => {
  const run = new BoundedCpsRun(5);
  run.start(0);
  run.hit(0);
  assert.deepEqual(run.tick(1200), { remaining: 3.8, finished: false });
  assert.deepEqual(run.tick(4990), { remaining: 0, finished: false });
  assert.deepEqual(run.tick(5000), { remaining: 0, finished: true });
});

test('click run - CPS is 0 before any elapsed time, never a fabricated value', () => {
  assert.equal(computeCps(12, 0), 0);
  assert.equal(computeCps(0, 5), 0);
  assert.equal(computeCps(10, 4), 2.5);
});

/* ------------------------------------------------------------------ */
/* 2. Concise, real speed progress label                                */
/* ------------------------------------------------------------------ */

test('speed label - stays short and names the engine active phase', () => {
  assert.equal(describeSpeedPhase(null), 'Measuring…');
  assert.equal(
    describeSpeedPhase({ type: 'latency', step: 1, totalSteps: 9 }),
    'Measuring latency — 1/9'
  );
  assert.equal(
    describeSpeedPhase({ type: 'download', bytes: 25_000_000, count: 1, step: 3, totalSteps: 9 }),
    'Measuring download — 3/9'
  );
  assert.equal(
    describeSpeedPhase({ type: 'upload', bytes: 1_000_000, count: 1, step: 9, totalSteps: 9 }),
    'Measuring upload — 9/9'
  );
});

test('speed label - no payload sizes or word salad in the progress line', () => {
  const label = describeSpeedPhase({ type: 'download', bytes: 100_000_000, count: 1, step: 4, totalSteps: 9 });
  assert.ok(label.length <= 30, `label stays concise (got ${label.length} chars): ${label}`);
  assert.ok(!/MB|bytes|per request/.test(label), 'raw payload sizes are not shown in the progress label');
});

/* ------------------------------------------------------------------ */
/* 3. Honest, working print fallback on iOS                            */
/* ------------------------------------------------------------------ */

test('print fallback - a blocked print window falls back to a same-tab report, not a dead end', () => {
  assert.match(exportControlSource, /window\.location\.assign\(url\)/, 'iOS path navigates the same tab (not a pop-up)');
  assert.match(exportControlSource, /setPopupsBlocked\(true\)/, 'the dialog knows a pop-up was blocked');
  assert.match(
    exportControlSource,
    /Open report in this tab \(print or save as PDF\)/,
    'the action is relabeled for the same-tab path'
  );
  assert.match(
    exportControlSource,
    /Use your device(?:&apos;|')s Print action/,
    'the user is told exactly how to get the PDF on iOS'
  );
});

test('print fallback - the text report is only a last resort and is never called a PDF', () => {
  assert.match(exportControlSource, /plain-text \(\.txt\) copy/, 'the notice says what was actually produced');
  assert.match(exportControlSource, /it is not a PDF/);
  // The TXT download must not be the first thing attempted.
  const openIdx = exportControlSource.indexOf('const openPrintWindow');
  const textIdx = exportControlSource.indexOf('const downloadTextReport');
  assert.ok(openIdx >= 0 && textIdx >= 0);
  assert.ok(
    /window\.open\('',\s*'_blank'/.test(exportControlSource),
    'the pop-up print window is still tried first on browsers that allow it'
  );
});

test('print fallback - the report is escaped before entering the same-tab document', () => {
  assert.match(exportControlSource, /function escapeHtml/);
  assert.match(exportControlSource, /escapeHtml\(report\)/, 'summary text cannot inject markup into the report page');
  assert.match(exportControlSource, /\.replace\(/);
});

test('print fallback - preview scope and device-label opt-in are unchanged', () => {
  assert.match(exportControlSource, /includeSensitive/, 'the opt-in still gates device labels');
  assert.match(exportControlSource, /preview\.map/, 'the preview still lists exactly what will be exported');
  assert.match(
    exportControlSource,
    /buildPrintReport\(data, origin \|\| undefined\)/,
    'the printed report is built from the same previewed data model'
  );
});
