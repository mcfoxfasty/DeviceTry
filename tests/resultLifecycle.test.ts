/**
 * Corrective Phase 2 regressions for the result-state lifecycle.
 *
 * These tests exercise the REAL ResultController and calculateReportStatus —
 * the same objects the testers and GuidedInspectionFlow use — not mocks:
 * - Explicit reset clears the current result and notifies the host clear
 *   callback exactly once.
 * - Clearing a previously passed guided step makes aggregation inconclusive.
 * - Unmount-only invalidation does NOT delete a recorded guided result.
 * - A delayed callback using a token captured before reset is rejected even
 *   after a newer token exists.
 * - A microphone-like stale promise cannot adopt the latest token.
 * - A gamepad calibration timeout cannot report for a newer device/run.
 * - An identical emission is marked unchanged and causes no repeated
 *   sink/UI update, including metrics-aware dedupe.
 * - A new run can emit the same verdict again.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultController, ResultSink } from '../lib/testing/resultController';
import { calculateReportStatus, TestResultItem } from '../lib/testing/reportStatus';

function createRecorder(): ResultSink & {
  updates: Array<{ status: string; details?: string }>;
  records: Array<{ status: string; details: string; metrics?: Record<string, unknown> }>;
  clears: number;
} {
  const recorder = {
    updates: [] as Array<{ status: string; details?: string }>,
    records: [] as Array<{ status: string; details: string; metrics?: Record<string, unknown> }>,
    clears: 0,
    onResultUpdate(
      status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
      details?: string
    ) {
      recorder.updates.push({ status, details });
    },
    onRecordResult(result: {
      status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';
      details: string;
      metrics?: Record<string, unknown>;
    }) {
      recorder.records.push({ status: result.status, details: result.details, metrics: result.metrics });
    },
    onResultClear() {
      recorder.clears += 1;
    },
  };
  return recorder;
}

test('result lifecycle - explicit reset clears the current result and notifies the parent clear callback exactly once', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', '5 keys verified');
  assert.equal(sink.records.length, 1);
  assert.equal(controller.hasEmittedForCurrentRun(), true);

  // User presses Reset — useTestResult.reset() calls clearResult().
  controller.clearResult();

  assert.equal(sink.clears, 1, 'host must be told to drop the recorded result exactly once');
  assert.equal(controller.hasEmittedForCurrentRun(), false, 'no recorded result survives an explicit reset');

  // A second reset with nothing recorded must NOT emit another clear event.
  controller.clearResult();
  assert.equal(sink.clears, 1, 'reset with nothing recorded must not emit a second parent-clear event');
});

test('result lifecycle - clearing a previously passed guided step makes aggregation inconclusive', () => {
  const steps = ['mic', 'webcam'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed', classification: 'browser', details: 'Stream active' },
    webcam: { status: 'passed', classification: 'browser', details: 'Camera operational' },
  };
  assert.equal(calculateReportStatus(steps, results), 'passed');

  // GuidedInspectionFlow.clearStepResult('webcam') deletes the entry from
  // both results state and resultsRef.
  const afterClear: Record<string, TestResultItem> = { mic: results.mic };
  assert.equal(
    calculateReportStatus(steps, afterClear),
    'inconclusive',
    'a cleared step must make the report inconclusive until a new observation produces a result'
  );
});

test('result lifecycle - unmount-only invalidation does not delete an already recorded guided result', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Camera operational at 1920x1080');
  assert.equal(sink.records.length, 1);
  assert.equal(sink.clears, 0);

  // Component unmounts while the user advances to the next guided step:
  // useTestResult.invalidate() → controller.invalidateRun().
  controller.invalidateRun();

  assert.equal(sink.clears, 0, 'unmount must NOT notify onResultClear');
  assert.equal(controller.hasEmittedForCurrentRun(), true, 'the recorded result survives unmount-only invalidation');

  // The guided flow's calculateReportStatus still sees the recorded result.
  const steps = ['mic', 'webcam'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed', classification: 'browser' },
    webcam: { status: 'passed', classification: 'browser' },
  };
  assert.equal(calculateReportStatus(steps, results), 'passed');
});

test('result lifecycle - a delayed callback using a token captured before reset is rejected even after a newer token exists', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  // Delayed operation begins: captures run1's token.
  const staleToken = run1;

  // User resets; a new observation starts.
  const run2 = controller.startRun();
  controller.emitRun(run2, 'inconclusive', 'No interaction yet');

  // The delayed callback fires late with the OLD token — even though a
  // newer token now exists, it must be rejected.
  const outcome = controller.emitRun(staleToken, 'passed', '5 keys verified');
  assert.equal(outcome.accepted, false, 'stale token must be rejected, never adopted as the current run');
  assert.equal(sink.records.at(-1)?.status, 'inconclusive', 'old verdict must not replace the new run verdict');
  assert.equal(sink.records.length, 1);
});

test('result lifecycle - a microphone-like stale getUserMedia promise cannot adopt the latest token', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  // startMicrophone(): stopMicrophone() bumps the token, then the request
  // captures the fresh token — this models the corrected tester code.
  controller.startRun(); // stopMicrophone's startRun
  const requestToken = controller.startRun(); // token captured at operation start
  assert.equal(requestToken, controller.getCurrentRun());

  // The user stops the microphone before the permission prompt resolves.
  controller.startRun(); // stopMicrophone again

  // getUserMedia resolves late with the captured token.
  const outcome = controller.emitRunRich(requestToken, {
    status: 'passed',
    details: 'Browser audio input stream active.',
    metrics: { deviceLabel: 'Internal Microphone' },
  });
  assert.equal(outcome.accepted, false, 'a stale stream resolution must be rejected');
  assert.equal(sink.records.length, 0, 'stale stream must not attach or update the verdict');
  assert.equal(sink.clears, 0, 'a stale resolution must not trigger a host clear either');
});

test('result lifecycle - a gamepad calibration timeout cannot report for a newer device/run', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  // Calibration starts on Pad #0: token captured at operation start.
  controller.startRun();
  const calibrationToken = controller.getCurrentRun();

  // Mid-window, the user selects Pad #1 (a new run).
  controller.startRun();
  controller.emitRun(controller.getCurrentRun(), 'passed', 'Controller active: Pad #1', { padId: 'Pad #1' });
  assert.equal(sink.records.length, 1);

  // The 2.5s calibration timeout completes late for Pad #0.
  const outcome = controller.emitRunRich(calibrationToken, {
    status: 'passed',
    details: 'Neutral calibration verified clean centering within 12% deadzone.',
    metrics: { maxLeftIdleOffset: 0.02, maxRightIdleOffset: 0.03 },
  });
  assert.equal(outcome.accepted, false, 'stale calibration must not report for the newer device/run');
  assert.equal(sink.records.length, 1, 'no additional forward from the stale calibration');
  assert.equal(sink.records[0].details, 'Controller active: Pad #1');
});

test('result lifecycle - an identical emission is marked unchanged and causes no repeated sink or UI update', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run = controller.startRun();
  const first = controller.emitRun(run, 'passed', 'Controller active: Pad #0', { padId: 'Pad #0', buttonCount: 17 });
  assert.equal(first.accepted, true);
  assert.equal(first.changed, true);
  assert.equal(first.forwarded, true);
  assert.equal(sink.records.length, 1);

  // 49 more identical animation-frame emissions: unchanged, never forwarded.
  for (let i = 0; i < 49; i++) {
    const outcome = controller.emitRun(run, 'passed', 'Controller active: Pad #0', { padId: 'Pad #0', buttonCount: 17 });
    assert.equal(outcome.accepted, true);
    assert.equal(outcome.changed, false, 'identical emission must be marked unchanged');
    assert.equal(outcome.forwarded, false, 'unchanged emission must not forward');
  }
  assert.equal(sink.records.length, 1, 'sink received exactly one record');
  assert.equal(sink.updates.length, 1, 'sink received exactly one generic update');

  // A real metrics change (button pressed mid-poll) is retained and forwarded.
  const changed = controller.emitRun(run, 'passed', 'Controller active: Pad #0', { padId: 'Pad #0', buttonCount: 18 });
  assert.equal(changed.changed, true, 'metrics differences count as a change');
  assert.equal(changed.forwarded, true);
  assert.equal(sink.records.length, 2);

  // Key-order-insensitive metrics equality is still deduped.
  const reordered = controller.emitRun(run, 'passed', 'Controller active: Pad #0', { buttonCount: 18, padId: 'Pad #0' });
  assert.equal(reordered.changed, false, 'metric key order must not defeat dedupe');
  assert.equal(sink.records.length, 2);
});

test('result lifecycle - a new run can emit the same verdict again after reset', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Screen coverage: 100%', { coveragePercent: 100 });
  assert.equal(sink.records.length, 1);

  controller.clearResult();
  assert.equal(sink.clears, 1);

  const run2 = controller.startRun();
  const outcome = controller.emitRun(run2, 'passed', 'Screen coverage: 100%', { coveragePercent: 100 });
  assert.equal(outcome.accepted, true);
  assert.equal(outcome.changed, true, 'dedupe state is per-run: the same verdict after reset is a change');
  assert.equal(outcome.forwarded, true);
  assert.equal(sink.records.length, 2);
});
