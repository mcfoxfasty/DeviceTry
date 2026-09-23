/**
 * Phase 1 regressions — results stay visible after stopping a test.
 *
 * These tests exercise the REAL ResultController (the same object the testers
 * drive through useTestResult) against the Phase 1 policy:
 * - Explicit Stop is resource cleanup only: it must invalidate in-flight work
 *   WITHOUT clearing the visible verdict or the host/guided result.
 * - Actually starting a new attempt (retry) is the only thing that clears a
 *   previous verdict — exactly one lifecycle transition.
 * - A completed measurement survives a later failed attempt in the same run.
 * - A stale callback (token captured before the retry) can never restore a
 *   cleared verdict.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { ResultController, ResultSink } from '../lib/testing/resultController';

function createRecorder(): ResultSink & {
  updates: Array<{ status: string; details?: string }>;
  records: Array<{ status: string; details: string; metrics?: Record<string, unknown> }>;
  clears: number;
} {
  const recorder = {
    updates: [] as Array<{ status: string; details?: string }>,
    records: [] as Array<{ status: string; details: string; metrics?: Record<string, unknown> }>,
    clears: 0,
    onResultUpdate(status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) {
      recorder.updates.push({ status, details });
    },
    onRecordResult(result: { status: 'passed' | 'warning' | 'failed' | 'inconclusive'; details: string; metrics?: Record<string, unknown> }) {
      recorder.records.push({ status: result.status, details: result.details, metrics: result.metrics });
    },
    onResultClear() {
      recorder.clears += 1;
    },
  };
  return recorder;
}

test('stop preserves result - explicit microphone Stop releases resources but keeps the verdict', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  // startMicrophone(): the request token comes from the single startRun()
  // at attempt start; stopMicrophone() no longer clears anything.
  const run = controller.startRun();
  // The waveform loop observes a sustained usable signal: verdict recorded.
  controller.emitRunRich(run, {
    status: 'passed',
    details: 'Usable input signal observed (sustained relative level, peak 41% of meter).',
    metrics: { peakLevelPercent: 41 },
  });
  assert.equal(sink.records.length, 1);

  // User presses Stop: stopMicrophone() → invalidateRun() semantics
  // (resources released, in-flight callbacks invalidated, verdict kept).
  controller.invalidateRun();

  assert.equal(sink.clears, 0, 'Stop must NOT erase the verdict or notify the host clear');
  assert.equal(
    controller.hasEmittedForCurrentRun(),
    true,
    'the recorded verdict survives an explicit Stop'
  );

  // A late waveform frame from the stopped run is rejected.
  const lateFrame = controller.emitRunRich(run, {
    status: 'inconclusive',
    details: 'late waveform frame',
  });
  assert.equal(lateFrame.accepted, false, 'stale post-Stop callbacks must be rejected');
  assert.equal(sink.records.length, 1, 'verdict list unchanged by stale callbacks');
});

test('stop preserves result - retry after Stop clears the old verdict exactly once', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Usable input signal observed (peak 30%).');
  assert.equal(sink.records.length, 1);
  assert.equal(sink.clears, 0);

  // User stops (resources only), then actually starts a new attempt.
  controller.invalidateRun(); // stopMicrophone()
  const run2 = controller.startRun(); // startMicrophone() retry
  assert.equal(sink.clears, 1, 'starting the new attempt clears the previous result exactly once');
  assert.equal(controller.hasEmittedForCurrentRun(), false, 'no recorded result for the fresh run yet');

  // The retry fails (permission revoked in the meantime): the honest failure
  // replaces the previous attempt's verdict.
  controller.emitRunRich(run2, {
    status: 'failed',
    details: 'Microphone access failed.',
  });
  assert.equal(sink.records.at(-1)?.status, 'failed');
  assert.equal(sink.records.length, 2, 'exactly two records: the passed verdict and the failed retry');
});

test('stop preserves result - a completed measurement survives a later failed measurement in the same attempt', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run = controller.startRun();
  // Download measurement completes and is recorded…
  controller.emitRun(run, 'passed', 'Download measurement complete: 120 Mbps', { downloadMbps: 120 });
  assert.equal(sink.records.length, 1);

  // …then the upload phase fails mid-run.
  controller.emitRun(run, 'failed', 'Upload measurement failed: connection dropped.');
  assert.equal(sink.records.at(-1)?.status, 'failed');
  assert.equal(sink.records[0].details, 'Download measurement complete: 120 Mbps');
  assert.equal(sink.records.length, 2, 'the completed measurement is kept; the failure is appended, not substituted');
});

test('stop preserves result - a stale callback captured before a retry cannot restore the cleared verdict', () => {
  const sink = createRecorder();
  const controller = new ResultController(sink);

  const run1 = controller.startRun();
  controller.emitRun(run1, 'passed', 'Old attempt verdict');

  // User stops, then starts a new attempt.
  controller.invalidateRun(); // stopMicrophone()
  const run2 = controller.startRun(); // retry captures the fresh token
  controller.emitRun(run2, 'inconclusive', 'New attempt started');
  assert.equal(sink.records.length, 2);

  // getUserMedia resolves late from the OLD attempt.
  const outcome = controller.emitRunRich(run1, {
    status: 'passed',
    details: 'stale stream resolution',
  });
  assert.equal(outcome.accepted, false, 'stale resolution must be rejected after a retry');
  assert.equal(sink.records.length, 2, 'the cleared old verdict must not be restored');
  assert.equal(sink.records[1].details, 'New attempt started', 'the new run verdict stands');
});
