import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateReportStatus, TestResultItem } from '../lib/testing/reportStatus';

test('Report Status - All required tests passed returns passed', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    webcam: { status: 'passed' },
    speakers: { status: 'passed' },
  };

  const status = calculateReportStatus(steps, results);
  assert.strictEqual(status, 'passed');
});

test('Report Status - Any failed test returns failed', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    webcam: { status: 'failed' },
    speakers: { status: 'passed' },
  };

  const status = calculateReportStatus(steps, results);
  assert.strictEqual(status, 'failed');
});

test('Report Status - Warning with no fail or inconclusive returns warning', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    webcam: { status: 'warning' },
    speakers: { status: 'passed' },
  };

  const status = calculateReportStatus(steps, results);
  assert.strictEqual(status, 'warning');
});

test('Report Status - Skipped or unsupported returns inconclusive', () => {
  const steps = ['mic', 'webcam', 'battery'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
    webcam: { status: 'passed' },
    battery: { status: 'unsupported' },
  };

  const status = calculateReportStatus(steps, results);
  assert.strictEqual(status, 'inconclusive');
});

test('Report Status - Incomplete missing tests return inconclusive', () => {
  const steps = ['mic', 'webcam', 'speakers'];
  const results: Record<string, TestResultItem> = {
    mic: { status: 'passed' },
  };

  const status = calculateReportStatus(steps, results);
  assert.strictEqual(status, 'inconclusive');
});
