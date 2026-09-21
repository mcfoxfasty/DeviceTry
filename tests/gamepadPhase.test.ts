/**
 * Phase 4 (gamepad) focused regressions.
 *
 * Exercises lib/testing/gamepadDrift.ts — the extracted calibration state
 * machine that fixes the audited defect: a drift warning being overwritten
 * by the next polling frame's connection "passed".
 *
 * These are SYNTHETIC algorithm tests (simulated axes), not physical
 * controller tests.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  CalibrationTracker,
  DRIFT_THRESHOLD,
  DriftSample,
} from '../lib/testing/gamepadDrift';

const PAD_A = 'Xbox 360 Controller (XInput STANDARD GAMEPAD)';
const PAD_B = 'DualSense Wireless Controller';

function sample(left: number, right: number): DriftSample {
  return { leftMax: left, rightMax: right };
}

test('gamepad drift - simulated drifting axes produce a warning verdict', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  // Left stick resting at 0.3 distance from center (drift), right clean.
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.3, 0.02));

  const verdict = tracker.finish(10);
  assert.notEqual(verdict, null);
  assert.equal(verdict!.hasDrift, true, '0.3 > 0.12 threshold must flag drift');
  assert.ok(verdict!.maxLeft > DRIFT_THRESHOLD);
});

test('gamepad drift - clean centered axes produce a passing verdict', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.01, 0.02));

  const verdict = tracker.finish(10);
  assert.notEqual(verdict, null);
  assert.equal(verdict!.hasDrift, false);
});

test('gamepad drift - retained warning survives subsequent polling frames', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.25, 0.02));
  const verdict = tracker.finish(10);
  assert.equal(verdict!.hasDrift, true);

  // Simulate 100 subsequent poll frames with a HEALTHY connected controller:
  // the retained warning must not be replaced by a connection-level pass.
  for (let frame = 0; frame < 100; frame++) {
    tracker.addSample(sample(0.01, 0.01)); // poll-loop samples are ignored
    assert.equal(tracker.retainedFor(PAD_A), verdict, `frame ${frame}: warning overwritten`);
  }
  assert.equal(tracker.hasRetainedVerdict, true);
});

test('gamepad drift - explicit reset clears the retained verdict', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.25, 0.02));
  tracker.finish(10);
  assert.equal(tracker.hasRetainedVerdict, true);

  tracker.reset();
  assert.equal(tracker.hasRetainedVerdict, false, 'reset must clear the lock');
  assert.equal(tracker.retainedFor(PAD_A), null);
});

test('gamepad drift - completed recalibration replaces the previous verdict', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.25, 0.02));
  const first = tracker.finish(10);
  assert.equal(first!.hasDrift, true);

  // New calibration with healthy sticks (recalibration after re-centering).
  tracker.beginNewCalibration(PAD_A);
  assert.equal(tracker.hasRetainedVerdict, false, 'a new window clears the old lock');
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.01, 0.01));
  const second = tracker.finish(10);
  assert.equal(second!.hasDrift, false, 'completed recalibration produces the new verdict');
  assert.equal(tracker.retainedFor(PAD_A), second);
});

test('gamepad drift - selection change invalidates the old pad verdict', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.25, 0.02));
  tracker.finish(10);
  assert.equal(tracker.hasRetainedVerdict, true);

  // User selects pad B.
  tracker.invalidatePad(PAD_A);
  assert.equal(tracker.hasRetainedVerdict, false, 'pad A result must not leak to pad B');
  assert.equal(tracker.retainedFor(PAD_A), null);
  assert.equal(tracker.retainedFor(PAD_B), null);
});

test('gamepad drift - reconnected different pad under the same index cannot inherit', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.02, 0.02));
  tracker.finish(10);
  assert.equal(tracker.retainedFor(PAD_A)!.hasDrift, false);

  // A DIFFERENT physical pad now reports the same index with a new id.
  assert.equal(tracker.retainedFor(PAD_B), null, 'new pad id has no inherited verdict');
});

test('gamepad drift - disconnection during the window aborts collection', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 5; i++) tracker.addSample(sample(0.4, 0.4));
  // Pad unplugged: the tester aborts the window.
  tracker.invalidatePad(PAD_A);
  // The completion timeout still fires, but nothing collects anymore.
  tracker.addSample(sample(0.4, 0.4));
  assert.equal(tracker.finish(10), null, 'too few samples: no verdict');
  assert.equal(tracker.hasRetainedVerdict, false);
});

test('gamepad drift - samples after completion do not alter the lock', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) tracker.addSample(sample(0.01, 0.01));
  const verdict = tracker.finish(10);
  assert.equal(verdict!.hasDrift, false);
  // Late frames arrive after completion.
  tracker.addSample(sample(0.9, 0.9));
  tracker.addSample(sample(0.9, 0.9));
  assert.equal(tracker.retainedFor(PAD_A), verdict, 'lock unchanged by late samples');
});

test('gamepad drift - too few samples returns null without locking', () => {
  const tracker = new CalibrationTracker();
  tracker.beginNewCalibration(PAD_A);
  for (let i = 0; i < 3; i++) tracker.addSample(sample(0.5, 0.5));
  assert.equal(tracker.finish(10), null, 'below minimum sample count');
  assert.equal(tracker.hasRetainedVerdict, false, 'a failed window locks nothing');
});

test('gamepad drift - threshold is this tool approximate boundary (documented)', () => {
  assert.equal(DRIFT_THRESHOLD, 0.12);
  // 0.12 exactly is NOT drift; just above IS.
  const edge = new CalibrationTracker();
  edge.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) edge.addSample(sample(DRIFT_THRESHOLD, 0));
  assert.equal(edge.finish(10)!.hasDrift, false, 'at-threshold is inside the deadzone');

  const above = new CalibrationTracker();
  above.beginNewCalibration(PAD_A);
  for (let i = 0; i < 20; i++) above.addSample(sample(DRIFT_THRESHOLD + 0.001, 0));
  assert.equal(above.finish(10)!.hasDrift, true);
});
