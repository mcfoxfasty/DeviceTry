/**
 * Phase 3 — rerun comparison (lib/testing/compare.ts).
 *
 * The comparison store keeps the last NUMERIC measurement per tool+metric in
 * this browser only. These tests pin the honesty + privacy contract:
 * numeric-only storage, neutral directional deltas, honest "first recorded"
 * handling, and read-before-write ordering (a rerun compares with the
 * genuinely previous run, never with itself).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDelta,
  compareToPrevious,
  formatDelta,
  isComparableValue,
  recordMeasurements,
} from '../lib/testing/compare';

/** Isolated localStorage per test so runs cannot leak into each other. */
function withStorage(fn: () => void): void {
  const backing = new Map<string, string>();
  const storage = {
    getItem: (k: string) => (backing.has(k) ? backing.get(k)! : null),
    setItem: (k: string, v: string) => void backing.set(k, v),
    removeItem: (k: string) => void backing.delete(k),
  };
  const g = globalThis as unknown as { localStorage?: unknown };
  const had = 'localStorage' in g ? g.localStorage : undefined;
  g.localStorage = storage;
  try {
    fn();
  } finally {
    if (had === undefined) delete g.localStorage;
    else g.localStorage = had;
  }
}

test('compare - only finite numbers qualify for storage', () => {
  assert.equal(isComparableValue(42), true);
  assert.equal(isComparableValue('12.5'), true);
  assert.equal(isComparableValue('loud mic'), false);
  assert.equal(isComparableValue(NaN), false);
  assert.equal(isComparableValue(Infinity), false);
  assert.equal(isComparableValue(undefined), false);
});

test('compare - rerun compares with the previous run, then stores the new value', () => {
  withStorage(() => {
    // First run: nothing stored yet — every metric is honestly "first recorded".
    const first = compareToPrevious('speed-test', { downloadMbps: 90 });
    assert.deepEqual(first.deltas, []);
    assert.deepEqual(first.firstRecorded, ['downloadMbps']);

    recordMeasurements('speed-test', { downloadMbps: 90 }, 1000);

    // Second run reads the stored 90 BEFORE writing 120 → delta describes the previous run.
    const second = compareToPrevious('speed-test', { downloadMbps: 120 });
    assert.equal(second.deltas.length, 1);
    assert.equal(second.deltas[0].previous, 90);
    assert.equal(second.deltas[0].current, 120);
    assert.equal(second.deltas[0].direction, 'higher');

    // A metric that appeared only now (not yet recorded) is honestly
    // first-recorded, not a fake zero delta — downloadMbps already stored
    // still produces a delta, jitterMs does not.
    const third = compareToPrevious('speed-test', { downloadMbps: 130, jitterMs: 3 });
    assert.deepEqual(
      third.deltas.map((d) => d.key),
      ['downloadMbps']
    );
    assert.deepEqual(third.firstRecorded, ['jitterMs']);
  });
});

test('compare - identical re-emission never collapses the baseline into the current value', () => {
  withStorage(() => {
    recordMeasurements('mic-test', { peakLevelPercent: 40 }, 1000);
    // Same verdict re-emitted by a polling loop: same value recorded again.
    recordMeasurements('mic-test', { peakLevelPercent: 40 }, 2000);
    // A later real run must still compare against the ORIGINAL baseline (40).
    const cmp = compareToPrevious('mic-test', { peakLevelPercent: 65 });
    assert.equal(cmp.deltas[0].previous, 40);
    assert.equal(cmp.deltas[0].current, 65);
    assert.equal(cmp.deltas[0].direction, 'higher');
  });
});

test('compare - non-numeric values are never coerced into the store', () => {
  withStorage(() => {
    recordMeasurements('mic-test', { deviceLabel: 'Blue Yeti', measurement: 'text', peak: 12 }, 1000);
    const cmp = compareToPrevious('mic-test', { deviceLabel: 'Blue Yeti' });
    assert.deepEqual(cmp.deltas, []);
    assert.deepEqual(cmp.firstRecorded, [], 'text metrics are not comparable and not stored');
  });
});

test('compare - deltas are neutral and sign-aware in display', () => {
  assert.equal(buildDelta('hz', 60, 60).direction, 'unchanged');
  assert.equal(formatDelta(buildDelta('hz', 60, 120)), '+60');
  assert.equal(formatDelta(buildDelta('hz', 120, 60)), '−60');
  assert.equal(formatDelta(buildDelta('hz', 60, 60.4)), '+0.4');
  assert.equal(formatDelta(buildDelta('hz', 60, 60)), '±0');
});
