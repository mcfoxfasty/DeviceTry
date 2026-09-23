/**
 * Phase 2 — expandable result details (lib/testing/resultDetails.ts).
 *
 * The disclosure is the honesty surface inside the result card: it must
 * explain the verdict without inventing causes, surface the tool's own
 * stated limitation next to the result, and keep next steps drawn from the
 * registry's troubleshooting entries rather than improvised.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { buildResultDetails } from '../lib/testing/resultDetails';
import { BannerStatus } from '../lib/testing/resultPolicy';

const TOOL = {
  title: 'Microphone Test',
  instructions: ['Click Start Test.', 'Speak at a normal level.'],
  limitations: ['Digital meter readings reflect browser input gain, not calibrated SPL.'],
  troubleshooting: [
    'Check the browser site permission for the microphone and reload.',
    'Close apps that may hold the device, then re-run this test.',
  ],
};

test('details - passed verdict explains scope without claiming a cause', () => {
  const d = buildResultDetails(TOOL, 'passed');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.equal(meaning.lines.length, 1);
  assert.match(meaning.lines[0], /recorded as passed/);
  assert.match(meaning.lines[0], /browser observed/);
  assert.ok(!/because/i.test(meaning.lines[0]), 'no causal claim is made');
});

test('details - failed verdict says the browser cannot see WHY and offers checks', () => {
  const d = buildResultDetails(TOOL, 'failed');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.ok(meaning.lines.some((l) => /cannot see WHY/.test(l)), 'honest about unknowable causes');
  assert.ok(d.nextSteps.length > 0);
  assert.ok(d.nextSteps.every((s) => TOOL.troubleshooting.includes(s)), 'next steps come from the registry, not invention');
  assert.ok(d.nextSteps.length <= 2, 'at most two next steps');
});

test('details - warning verdict is labelled as passed-with-caveats, never as clean pass', () => {
  const d = buildResultDetails(TOOL, 'warning');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.match(meaning.lines[0], /passed with caveats/);
});

test('details - incomplete attempt labels values as partial, not a complete pass', () => {
  const d = buildResultDetails(TOOL, 'passed', true);
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.ok(meaning.lines.some((l) => /stopped before it finished/.test(l) && /partial/.test(l)));
});

test('details - inconclusive claims no pass and no fail', () => {
  const d = buildResultDetails(TOOL, 'inconclusive');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.ok(meaning.lines.some((l) => /no pass or fail is claimed/.test(l)));
});

test('details - unsupported names the browser limitation as the block, not the hardware', () => {
  const d = buildResultDetails(TOOL, 'unsupported');
  const meaning = d.sections.find((s) => s.heading === 'What this means')!;
  assert.ok(meaning.lines.some((l) => /browser does not expose the web APIs/.test(l)));
});

test('details - surfaces the tool definition limitation next to the verdict', () => {
  const d = buildResultDetails(TOOL, 'passed');
  const keep = d.sections.find((s) => s.heading === 'Keep in mind')!;
  assert.equal(keep.lines[0], TOOL.limitations[0]);
});

test('details - every BannerStatus maps to a defined explanation (exhaustive)', () => {
  const statuses: BannerStatus[] = ['passed', 'failed', 'warning', 'inconclusive', 'unsupported', 'skipped'];
  for (const status of statuses) {
    const d = buildResultDetails(TOOL, status);
    assert.ok(d.sections.length >= 1, `${status} produces at least one section`);
    const meaning = d.sections.find((s) => s.heading === 'What this means')!;
    assert.ok(meaning.lines.length >= 1, `${status} has meaning lines`);
  }
});
