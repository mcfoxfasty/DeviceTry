/**
 * Regression tests for run-guarded result state:
 * - Reset clears a previously visible result.
 * - A callback belonging to an old run is ignored after Reset.
 * - A new run cannot display or forward the previous run's verdict.
 * - Dedupe: identical re-emissions from polling/animation loops forward once.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultController, ResultSink } from '../lib/testing/resultController';

function createRecorder(): ResultSink & {
  updates: Array<{ status: string; details?: string }>;
  records: Array<{ status: string; details: string }>;
} {
  const recorder = {
    updates: [] as Array<{ status: string; details?: string }>,
    records: [] as Array<{ status: string; details: string }>,
    onResultUpdate(status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) {
      recorder.updates.push({ status, details });
    },
    onRecordResult(result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string }) {
      recorder.records.push({ status: result.status, details: result.details });
    },
  };
  return recorder;
}

test('result state - verdict is cleared and stale old-run callback is ignored after Reset', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  // Run 1 emits a passing verdict.
  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', '5 keys verified');
  assert.equal(sink.records.length, 1, 'first run verdict should forward');
  assert.equal(sink.updates.length, 1);

  // User presses Reset (same as useTestResult.reset()).
  controller.reset();

  // A delayed callback from run 1 fires AFTER the reset.
  const stale = controller.emitRun(run1, 'passed', '5 keys verified');
  assert.equal(stale.accepted, false, 'stale old-run callback must be rejected');
  assert.equal(sink.records.length, 1, 'no new forwarding after reset');
  assert.equal(sink.updates.length, 1, 'no new host update after reset');
});

test('result state - a new run cannot display or forward the previous run verdict', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Left clicks verified');

  // Start a new run (Start New Test / device change).
  const run2 = controller.startRun();
  controller.emitRun(run2, 'inconclusive', 'No interaction yet');
  assert.equal(sink.records.at(-1)?.status, 'inconclusive');

  // The old run's delayed callback fires late.
  controller.emitRun(run1, 'passed', 'Left clicks verified');
  assert.equal(
    sink.records.at(-1)?.status,
    'inconclusive',
    'stale run-1 emission must not replace the new run verdict'
  );
  assert.equal(sink.records.length, 2, 'stale emission must not forward again');
});

test('result state - identical re-emissions within one run forward exactly once (polling dedupe)', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run = controller.startRun();
  // Simulate an animation-frame/polling loop emitting the same verdict 50 times.
  for (let i = 0; i < 50; i++) {
    controller.emitRun(run, 'passed', 'Controller active: Pad #0');
  }
  assert.equal(sink.records.length, 1, 'identical emissions dedupe to a single forward');
  assert.equal(sink.updates.length, 1, 'identical emissions dedupe to a single host update');

  // A genuinely different verdict still forwards.
  controller.emitRun(run, 'warning', 'Idle stick drift exceeded deadzone');
  assert.equal(sink.records.length, 2);
});

test('result state - reset clears dedupe so a new run can report the same verdict again', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Screen coverage: 100%');
  assert.equal(sink.updates.length, 1);

  controller.reset();
  const run2 = controller.startRun();
  controller.emitRun(run2, 'passed', 'Screen coverage: 100%');
  assert.equal(sink.updates.length, 2, 'same verdict after reset belongs to a new run and forwards');
});

test('result state - forwarding policy still drops skipped and rich-unsupported', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run = controller.startRun();
  controller.emitRun(run, 'skipped', 'User skipped');
  controller.emitRun(run, 'unsupported', 'Battery API not exposed');
  assert.equal(sink.records.length, 0, 'skipped/unsupported must never reach rich report callbacks');
  assert.equal(sink.updates.length, 1, 'only unsupported forwarded once on generic hosts');

  controller.reset();
  const run2 = controller.startRun();
  controller.emitRun(run2, 'unsupported', 'Battery API not exposed');
  assert.equal(sink.updates.length, 2, 'unsupported still forwards on generic hosts after reset');
  assert.equal(sink.records.length, 0);
});
