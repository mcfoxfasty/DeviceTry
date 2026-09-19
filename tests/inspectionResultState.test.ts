import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReportStatus, TestResultItem } from '../lib/testing/reportStatus';

type StepResult = Record<string, TestResultItem>;

type FillStatus = 'passed' | 'failed' | 'warning' | 'inconclusive' | 'unsupported' | 'skipped';

// classification is a separate, narrower union in TestResultItem — map each
// fill status to a valid classification value.
const CLASSIFICATION_BY_STATUS: Record<FillStatus, NonNullable<TestResultItem['classification']>> = {
  passed: 'browser',
  failed: 'browser',
  warning: 'user',
  inconclusive: 'inconclusive',
  unsupported: 'unsupported',
  skipped: 'skipped',
};

function completeResults(steps: string[], fill: FillStatus): StepResult {
  const out: StepResult = {};
  for (const s of steps) out[s] = { status: fill, classification: CLASSIFICATION_BY_STATUS[fill] };
  return out;
}

test('guided aggregation - all passed yields passed', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  assert.equal(
    calculateReportStatus(steps, completeResults(steps, 'passed')),
    'passed'
  );
});

test('guided aggregation - a single failed step yields failed', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: StepResult = completeResults(steps, 'passed');
  results['webcam'] = { status: 'failed', classification: 'browser', details: 'No video track' };
  assert.equal(calculateReportStatus(steps, results), 'failed');
});

test('guided aggregation - warning only yields warning', () => {
  const steps = ['keyboard', 'mouse'];
  assert.equal(
    calculateReportStatus(steps, completeResults(steps, 'warning')),
    'warning'
  );
});

test('guided aggregation - unsupported step yields inconclusive, not passed', () => {
  const steps = ['mic', 'battery'];
  const results: StepResult = completeResults(steps, 'passed');
  results['battery'] = { status: 'unsupported', classification: 'unsupported' };
  assert.equal(calculateReportStatus(steps, results), 'inconclusive');
});

test('guided aggregation - skipped step yields inconclusive, not passed', () => {
  const steps = ['mic', 'webcam'];
  const results: StepResult = completeResults(steps, 'passed');
  results['webcam'] = { status: 'skipped', classification: 'skipped' };
  assert.equal(calculateReportStatus(steps, results), 'inconclusive');
});

test('guided aggregation - inconclusive step yields inconclusive', () => {
  const steps = ['speakers', 'display'];
  const results: StepResult = completeResults(steps, 'passed');
  results['speakers'] = { status: 'inconclusive', classification: 'inconclusive' };
  assert.equal(calculateReportStatus(steps, results), 'inconclusive');
});

test('guided aggregation - advanced without testing plus passed others is inconclusive', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: StepResult = {
    mic: { status: 'passed', classification: 'browser' },
    // webcam never tested, but user advanced
    speakers: { status: 'passed', classification: 'browser' },
  };
  // simulate explicit inconclusive for the untested step
  results['webcam'] = { status: 'inconclusive', classification: 'inconclusive', details: 'Step advanced without test' };
  assert.equal(calculateReportStatus(steps, results), 'inconclusive');
});

test('guided aggregation - empty results for all steps is inconclusive', () => {
  const steps = ['mic', 'webcam'];
  assert.equal(calculateReportStatus(steps, {}), 'inconclusive');
});
