/**
 * Phase 2 — local export regressions (lib/testing/exportReport.ts).
 *
 * The export is the privacy-critical surface: it must include only real
 * observations, exclude sensitive values unless explicitly opted in, never
 * fabricate CSV for non-tabular results, and strip forbidden private values
 * from free text. One deny-list is shared with local history.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExportReport,
  buildCsv,
  buildPrintReport,
  canExportCsv,
  csvFilename,
  isSensitiveMetricKey,
  previewMetrics,
} from '../lib/testing/exportReport';
import { TestResultPayload } from '../components/TestResultBanner';
import { ToolDefinition } from '../lib/tools/types';

const TOOL: Pick<ToolDefinition, 'id' | 'title' | 'slug' | 'instructions' | 'limitations'> = {
  id: 'microphone-test',
  title: 'Microphone Test',
  slug: 'microphone-test',
  instructions: ['Click Start Test to grant microphone permission.', 'Speak into the microphone.'],
  limitations: ['Digital meter readings reflect browser input gain, not calibrated SPL.'],
};

const NOW = Date.UTC(2026, 8, 23, 12, 0, 0);

function payload(overrides: Partial<TestResultPayload> = {}): TestResultPayload {
  return { status: 'passed', details: 'Usable input signal observed.', ...overrides };
}

test('export - includes name, timestamp, status, details, method, and limitations', () => {
  const data = buildExportReport(TOOL, payload(), NOW, { includeSensitive: false });
  assert.equal(data.toolTitle, 'Microphone Test');
  assert.equal(data.observedAt, NOW);
  assert.equal(data.status, 'passed');
  assert.ok(data.details.includes('Usable input signal'));
  assert.deepEqual(data.method, TOOL.instructions);
  assert.deepEqual(data.limitations, TOOL.limitations);
});

test('export - sensitive device-label metrics are excluded by default and only included on explicit opt-in', () => {
  const result = payload({
    metrics: { peakLevelPercent: 41, deviceLabel: 'Blue Snowball Microphone' },
  });

  // Default: excluded, but the slot is shown honestly as excluded.
  const data = buildExportReport(TOOL, result, NOW, { includeSensitive: false });
  const label = data.metrics.find((m) => m.key === 'deviceLabel');
  const peak = data.metrics.find((m) => m.key === 'peakLevelPercent');
  assert.equal(label?.value, undefined);
  assert.equal(label?.excluded, true);
  assert.equal(peak?.value, '41');

  // Explicit opt-in: the label is included.
  const optedIn = buildExportReport(TOOL, result, NOW, { includeSensitive: true });
  assert.equal(optedIn.metrics.find((m) => m.key === 'deviceLabel')?.value, 'Blue Snowball Microphone');
});

test('export - previews show exactly what would be exported', () => {
  const result = payload({ metrics: { deviceLabel: 'Cam A' } });
  const data = buildExportReport(TOOL, result, NOW, { includeSensitive: false });
  const preview = previewMetrics(data, { includeSensitive: false });
  assert.equal(preview.length, 1);
  assert.equal(preview[0].sensitive, true);
  assert.equal(preview[0].included, false);
  assert.match(preview[0].display, /Excluded/);
  assert.ok(isSensitiveMetricKey('deviceLabel'));
});

test('export - CSV is produced only for genuinely tabular measurements', () => {
  const tabular = buildExportReport(
    TOOL,
    payload({ metrics: { peakLevelPercent: 41, refreshHz: 120 } }),
    NOW,
    { includeSensitive: false }
  );
  assert.equal(canExportCsv(tabular), true);
  const csv = buildCsv(tabular);
  assert.ok(csv);
  assert.match(csv!, /"peakLevelPercent","41"/);
  assert.match(csv!, /"refreshHz","120"/);

  // A pass/fail verdict sentence is NOT turned into a fake spreadsheet.
  const nonTabular = buildExportReport(TOOL, payload(), NOW, { includeSensitive: false });
  assert.equal(canExportCsv(nonTabular), false);
  assert.equal(buildCsv(nonTabular), null);
});

test('export - CSV escapes quotes, commas, and neutralizes formula injection', () => {
  const tricky = buildExportReport(
    TOOL,
    payload({ metrics: { note: 'said "hello", loudly' } }),
    NOW,
    { includeSensitive: false }
  );
  // Non-numeric values are skipped by the CSV builder entirely.
  assert.equal(canExportCsv(tricky), false);

  const numeric = buildExportReport(TOOL, payload({ metrics: { levelPercent: 41 } }), NOW, {
    includeSensitive: false,
  });
  const csv = buildCsv(numeric)!;
  assert.ok(!/(?<!\r)\n/.test(csv), 'rows are CRLF-terminated, never bare-LF');
});

test('export - private values are stripped from free text (shared deny-list)', () => {
  const leaked = payload({
    details: 'Client 192.168.1.42 pressed Space; device aa-bb-cc-dd-ee-ff seen.',
  });
  const data = buildExportReport(TOOL, leaked, NOW, { includeSensitive: false });
  assert.ok(!data.details.includes('192.168.1.42'), 'IPv4 must be stripped');
  assert.ok(!data.details.includes('aa-bb-cc-dd-ee-ff'), 'MAC-style identifiers must be stripped');
  assert.ok(!/Space/.test(data.details), 'KeyboardEvent names must be stripped');
  assert.ok(data.details.includes('[removed]'));
});

test('export - print report labels unavailable data honestly and never invents measurements', () => {
  const empty = buildPrintReport(buildExportReport(TOOL, payload(), NOW, { includeSensitive: false }));
  assert.match(empty, /none were captured/i);
  assert.match(empty, /Completion status: Passed/);
  assert.match(empty, /How these values were obtained/);
  assert.match(empty, /Limitations/);
  assert.match(empty, /nothing is uploaded|generated locally/i);

  const withMetrics = buildPrintReport(
    buildExportReport(
      TOOL,
      payload({ metrics: { peakLevelPercent: 41, deviceLabel: 'Mic 9000' } }),
      NOW,
      { includeSensitive: false }
    )
  );
  assert.match(withMetrics, /peakLevelPercent: 41/);
  assert.ok(!withMetrics.includes('Mic 9000'), 'sensitive values stay out unless opted in');
  assert.match(withMetrics, /Excluded by your export choice/);
});

test('export - filename is derived from slug and observation time only', () => {
  const data = buildExportReport(TOOL, payload(), NOW, { includeSensitive: false });
  const name = csvFilename(data);
  assert.match(name, /^devicetry-microphone-test-\d{4}-\d{2}-\d{2}T/);
  assert.ok(!name.includes(' '), 'no spaces from toISOString');
});
