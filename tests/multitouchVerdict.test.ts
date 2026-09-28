/**
 * Multi-Touch verdict regressions.
 *
 * The reported bug: on a real iPhone, observing 2+ simultaneous fingers still
 * reported INCONCLUSIVE because the component's only status literal was
 * `'inconclusive'` — a pass was unreachable by construction.
 *
 * The rules these pin:
 * - Two or more genuine simultaneous touch points is a PASS, worded as an
 *   observation that never claims the device's maximum touch capacity.
 * - One finger stays INCONCLUSIVE.
 * - Mouse input never passes and is explained, not silently ignored.
 * - Nothing observed stays INCONCLUSIVE with guidance.
 * - Reset clears the verdict, tab switching cannot leak one verdict into the
 *   other tab, and the pad cannot scroll the page during the gesture.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  multitouchVerdict,
  MULTITOUCH_MIN_SIMULTANEOUS,
} from '../lib/testing/sensorGates';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (relative: string) => readFileSync(join(repoRoot, relative), 'utf8');

/** The source with comments removed, so code assertions ignore prose. */
function stripComments(source: string): string {
  return source
    .split('\n')
    .map((line) => {
      const idx = line.indexOf('//');
      return idx === -1 ? line : line.slice(0, idx);
    })
    .join('\n');
}

const tester = () => stripComments(read('components/tests/MultitouchTester.tsx'));
const hub = () => stripComments(read('components/tests/TouchscreenTestHub.tsx'));

// ------------------------------------------------------------- pass / fail rules

test('multi-touch - two or more genuine simultaneous points is a PASS', () => {
  for (const observed of [2, 3, 4, 5, 10]) {
    const v = multitouchVerdict({ observed });
    assert.equal(v.status, 'passed', `${observed} fingers must pass`);
    assert.equal(v.observed, observed);
    assert.equal(v.unverified, false);
    assert.match(v.details, /Observed 2 simultaneous|Observed 3 simultaneous|Observed 4 simultaneous|Observed 5 simultaneous|Observed 10 simultaneous/);
  }
});

test('multi-touch - the pass never claims a device maximum', () => {
  const v = multitouchVerdict({ observed: 5 });
  assert.match(v.details, /not the device's maximum supported touch count/);
  assert.match(v.details, /does not certify how many fingers/);
  assert.doesNotMatch(v.details, /maximum of \d|supports \d+ fingers|capable of \d+/);
});

test('multi-touch - one finger stays INCONCLUSIVE with guidance', () => {
  const v = multitouchVerdict({ observed: 1 });
  assert.equal(v.status, 'inconclusive');
  assert.match(v.details, /single finger is ordinary single-touch/);
});

test('multi-touch - zero observations stays INCONCLUSIVE with guidance', () => {
  const v = multitouchVerdict({ observed: 0 });
  assert.equal(v.status, 'inconclusive');
  assert.equal(v.observed, 0);
  assert.match(v.details, /No touch has been observed yet/);
});

test('multi-touch - mouse input never passes and is explained', () => {
  const v = multitouchVerdict({ observed: 0, mouseInput: true });
  assert.equal(v.status, 'inconclusive');
  assert.match(v.details, /Mouse input does not count/);
});

test('multi-touch - unsupported observation never passes and says why', () => {
  const v = multitouchVerdict({ observed: 0, unsupportedObservation: true });
  assert.equal(v.status, 'inconclusive');
  assert.match(v.details, /did not provide a simultaneous touch observation/);
});

test('multi-touch - non-finite or negative observations are treated as zero', () => {
  assert.equal(multitouchVerdict({ observed: NaN }).status, 'inconclusive');
  assert.equal(multitouchVerdict({ observed: -3 }).observed, 0);
  assert.equal(multitouchVerdict({ observed: 2.9 }).observed, 2);
});

test('multi-touch - the threshold constant is exactly two', () => {
  assert.equal(MULTITOUCH_MIN_SIMULTANEOUS, 2);
  // The verdict itself must use the same threshold.
  assert.equal(multitouchVerdict({ observed: MULTITOUCH_MIN_SIMULTANEOUS - 1 }).status, 'inconclusive');
  assert.equal(multitouchVerdict({ observed: MULTITOUCH_MIN_SIMULTANEOUS }).status, 'passed');
});

// ------------------------------------------------------------- component wiring

test('multi-touch - the component derives its verdict, not a hard-coded status', () => {
  const code = tester();
  // The verdict function must be used at the emit site…
  assert.match(code, /multitouchVerdict\(/);
  // …and the only status the component can emit comes from that verdict, i.e.
  // no hard-coded 'inconclusive' or 'passed' literal may remain in an emit.
  assert.doesNotMatch(
    code,
    /onResultUpdate\?\.\(\s*'(?:inconclusive|passed)'/,
    'a hard-coded status literal would reintroduce the bug',
  );
});

test('multi-touch - the readout shows the count of simultaneous genuine touch points', () => {
  const code = tester();
  assert.match(code, /Simultaneous genuine touch points/);
  assert.match(code, /MULTITOUCH_MIN_SIMULTANEOUS/);
});

test('multi-touch - reset clears the counter, display, and the verdict', () => {
  const code = tester();
  assert.match(code, /const resetMax = \(\) => \{/);
  assert.match(code, /resetMax[\s\S]{0,400}counterRef\.current\.reset\(\)/);
  assert.match(code, /resetMax[\s\S]{0,400}onResultClear\?\.\(\)/);
});

test('multi-touch - the pad cannot scroll the page during a gesture', () => {
  const code = tester();
  // touch-action: none stops iOS claiming the drag for panning; without it a
  // two-finger gesture scrolls the page and no simultaneous contact is seen.
  assert.match(code, /touch-none/);
  assert.match(code, /overscroll-contain/);
  assert.match(code, /select-none/);
});

test('multi-touch - tab switching clears the outgoing verdict', () => {
  const code = hub();
  assert.match(code, /const selectTab = \(next: TouchTab\) => \{/);
  assert.match(code, /if \(next === tab\) return;[\s\S]{0,40}onResultClear\?\.\(\)/);
  // Both tabs must receive the clear hook.
  assert.match(code, /<TouchscreenTester[\s\S]{0,200}?onResultClear=\{onResultClear\}/);
  assert.match(code, /<MultitouchTester[\s\S]{0,200}?onResultClear=\{onResultClear\}/);
});

test('multi-touch - the host wires result propagation through the hub', () => {
  const code = hub();
  assert.match(code, /onResultUpdate\?: \(status/);
  assert.match(code, /<MultitouchTester[\s\S]{0,200}?onResultUpdate=\{onResultUpdate\}/);
});
