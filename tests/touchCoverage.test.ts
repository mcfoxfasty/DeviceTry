/**
 * Touchscreen Test coverage-verdict regressions.
 *
 * The reported bug: on a real iPhone the user covered 100/100 cells with touch
 * input (481 touch events, 0 mouse events) and the result stayed INCONCLUSIVE
 * with an explanation that still said "Partial coverage". The status was
 * hard-coded to `'inconclusive'` at the only emit site, so a fully-swept grid
 * could never pass and the wording was wrong at 100% by construction.
 *
 * The rules these pin:
 * - Full coverage by genuine touch or pen input is a PASS.
 * - Partial coverage stays inconclusive.
 * - Mouse (or unclassified) input can never produce a pass.
 * - The pass wording admits it does not certify every pixel.
 * - Reset clears the result, and the grid cannot scroll the page under a drag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  coveragePercent,
  coverageVerdict,
  emptyTally,
  tileKey,
  tallySource,
  TOUCH_GRID_COLS,
  TOUCH_GRID_ROWS,
  TOUCH_GRID_TILES,
  type TouchSourceTally,
} from '../lib/testing/sensorGates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

/** The source with comments removed, so code assertions ignore prose. */
function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n')
    .map((line) => line.replace(/(^|[^:])\/\/.*$/, '$1'))
    .join('\n');
}

const testerCode = stripComments(read('components/tests/TouchscreenTester.tsx'));

function withTouch(count: number, extra: Partial<TouchSourceTally> = {}): TouchSourceTally {
  return { ...emptyTally(), touch: count, ...extra };
}

// ------------------------------------------------------- grid geometry

test('touch coverage - the grid is the 10x10 the UI reports', () => {
  assert.equal(TOUCH_GRID_ROWS, 10);
  assert.equal(TOUCH_GRID_COLS, 10);
  assert.equal(TOUCH_GRID_TILES, 100);
});

test('touch coverage - tile keys are stable and reject out-of-range cells', () => {
  assert.equal(tileKey(0, 0), '0-0');
  assert.equal(tileKey(9, 9), '9-9');
  assert.equal(tileKey(10, 0), null, 'row past the last row is not a tile');
  assert.equal(tileKey(0, 10), null);
  assert.equal(tileKey(-1, 0), null);
  assert.equal(tileKey(0, -1), null);
  assert.equal(tileKey(1.5, 0), null, 'fractional coordinates are not tiles');
  assert.equal(tileKey(Number.NaN, 0), null);
});

test('touch coverage - percent is clamped and rounded', () => {
  assert.equal(coveragePercent(0), 0);
  assert.equal(coveragePercent(50), 50);
  assert.equal(coveragePercent(100), 100);
  assert.equal(coveragePercent(150), 100, 'over-count can never exceed 100%');
  assert.equal(coveragePercent(-5), 0);
  assert.equal(coveragePercent(1), 1);
});

// ------------------------------------------------------ the reported bug

test('touch coverage - 100/100 tiles by real touch PASSES (the reported bug)', () => {
  // Exactly the device state: full grid covered, many genuine touch events,
  // zero mouse events.
  const verdict = coverageVerdict({ covered: 100, sources: withTouch(481) });

  assert.equal(verdict.status, 'passed', 'full genuine coverage must not stay inconclusive');
  assert.equal(verdict.percent, 100);
  assert.match(verdict.details, /100%/);
  assert.match(verdict.details, /100\/100 tiles/);
  assert.equal(
    /Partial coverage/.test(verdict.details),
    false,
    'the explanation must not claim partial coverage at 100%',
  );
});

test('touch coverage - the pass wording admits it does not certify every pixel', () => {
  const verdict = coverageVerdict({ covered: 100, sources: withTouch(10) });

  assert.equal(verdict.status, 'passed');
  assert.match(
    verdict.details,
    /does not certify every pixel of the display/,
    'a swept grid still cannot prove every pixel works — the note must be present',
  );
  assert.match(verdict.details, /dead spot smaller than one grid cell/);
});

test('touch coverage - full coverage by pen alone also passes, with a pen note', () => {
  const verdict = coverageVerdict({
    covered: 100,
    sources: { ...emptyTally(), pen: 40 },
  });
  assert.equal(verdict.status, 'passed');
  assert.match(verdict.details, /pen/i, 'the pen caveat must be stated, not hidden');
});

test('touch coverage - partial coverage stays INCONCLUSIVE', () => {
  for (const covered of [1, 42, 99]) {
    const verdict = coverageVerdict({ covered, sources: withTouch(covered * 5) });
    assert.equal(verdict.status, 'inconclusive', `${covered}/100 must not pass`);
    assert.match(verdict.details, /Partial coverage does not certify the whole screen/);
  }
});

test('touch coverage - an empty grid is inconclusive, not a pass', () => {
  const verdict = coverageVerdict({ covered: 0, sources: emptyTally() });
  assert.equal(verdict.status, 'inconclusive');
  assert.match(verdict.details, /does not count toward a touchscreen result/);
});

// -------------------------------------------------- mouse must never count

test('touch coverage - mouse-only input can never pass, even at 100%', () => {
  // Even if a caller somehow passed a full grid with only mouse events tallied,
  // the verdict must refuse the pass.
  const verdict = coverageVerdict({
    covered: 100,
    sources: { ...emptyTally(), mouse: 500 },
  });
  assert.equal(verdict.status, 'inconclusive', 'a mouse never proves a touchscreen');
  assert.match(verdict.details, /Mouse or unclassified input does not count/);
});

test('touch coverage - unclassified pointer input can never pass either', () => {
  const verdict = coverageVerdict({
    covered: 100,
    sources: { ...emptyTally(), other: 500 },
  });
  assert.equal(verdict.status, 'inconclusive');
});

test('touch coverage - a single genuine touch alongside mouse events still counts', () => {
  const tally = tallySource(tallySource(emptyTally(), 'mouse'), 'touch');
  const verdict = coverageVerdict({ covered: 100, sources: tally });
  assert.equal(verdict.status, 'passed');
});

test('touch coverage - the tester only records tiles from touch/pen pointers', () => {
  // Structural guarantee that mouse movement cannot add coverage.
  assert.match(testerCode, /countsAsTouchInput\(source\)/);
  assert.match(
    testerCode,
    /if \(!countsAsTouchInput\(source\)\) \{[\s\S]{0,40}return;/,
    'non-touch pointers must return before any tile is recorded',
  );
});

test('touch coverage - the tester derives its status from the verdict, not a constant', () => {
  // The bug was a hard-coded 'inconclusive' at the emit site.
  assert.match(testerCode, /coverageVerdict\(\{/, 'the verdict must be computed');
  assert.match(
    testerCode,
    /onResultUpdate\?\.\(verdict\.status, verdict\.details\)/,
    'the emitted status must come from the verdict',
  );
  assert.equal(
    /onResultUpdate\?\.\(\s*'inconclusive'/.test(testerCode),
    false,
    'a literal inconclusive status must not remain at the emit site',
  );
});

// ----------------------------------------------------- reset and scrolling

test('touch coverage - Reset clears the grid AND the recorded result', () => {
  assert.match(testerCode, /const clearCanvas = \(\) => \{/, 'reset must exist');
  assert.match(testerCode, /setTouchedTiles\(new Set\(\)\)/);
  assert.match(testerCode, /setTotalPoints\(0\)/);
  assert.match(testerCode, /setSources\(emptyTally\(\)\)/);
  assert.match(
    testerCode,
    /onResultClear\?\.\(\)/,
    'reset must also clear the result — a stale verdict must not survive it',
  );
});

test('touch coverage - the grid prevents page scrolling under a drag', () => {
  // touch-action: none is what stops iOS claiming the gesture for panning.
  assert.match(testerCode, /touch-none/, 'the canvas must disable touch gestures');
  assert.match(testerCode, /overscroll-contain/, 'scroll chaining must be contained');
});

test('touch coverage - the reset hook is wired from the host through the hub', () => {
  const hub = stripComments(read('components/tests/TouchscreenTestHub.tsx'));
  assert.match(hub, /onResultClear\?: \(\) => void;/, 'the hub must accept a clear hook');
  assert.match(
    hub,
    /<TouchscreenTester[\s\S]{0,200}?onResultClear=\{onResultClear\}/,
    'the hub must forward the hook to the coverage tester',
  );

  // And TesterWithBanner must actually hand a clear function to testers that
  // are not direct-mounted, otherwise the prop is always undefined.
  const banner = stripComments(read('components/TestResultBanner.tsx'));
  assert.match(
    banner,
    /<Tester[^>]*onResultClear=\{reset\}/,
    'non-direct testers must receive the reset callback',
  );
});

test('touch coverage - switching tabs clears the outgoing verdict', () => {
  const hub = stripComments(read('components/tests/TouchscreenTestHub.tsx'));
  // Multi-Touch must not inherit a coverage pass (or the reverse).
  assert.match(hub, /const selectTab = \(next: TouchTab\) => \{/);
  assert.match(hub, /if \(next === tab\) return;[\s\S]{0,40}onResultClear\?\.\(\)/);
  assert.match(hub, /onClick=\{\(\) => selectTab\(key\)\}/);
});

test('touch coverage - Multi-Touch keeps its own verdict and its own reset', () => {
  const multi = stripComments(read('components/tests/MultitouchTester.tsx'));
  assert.match(
    multi,
    /onResultClear\?: \(\) => void;/,
    'multi-touch must accept its own clear hook',
  );
  assert.match(multi, /const resetMax = \(\) => \{[\s\S]{0,200}onResultClear\?\.\(\)/);
  // Its verdict is about observed simultaneous touches, and must keep saying so.
  assert.match(multi, /maxSimultaneousObserved/);
  assert.match(multi, /not the device's maximum supported touch count/);
});
