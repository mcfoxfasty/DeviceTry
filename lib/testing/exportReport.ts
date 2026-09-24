/**
 * Phase 2 — honest local export (print/PDF + CSV).
 *
 * WHAT LEAVES THE BROWSER: nothing. Every generator here runs locally and
 * the output is a string the user saves or prints themselves. Nothing is
 * uploaded, no external service is contacted, no fetch is performed.
 *
 * PRIVACY CONTRACT (enforced in code, verified by tests):
 *  - The export includes ONLY what the user actually observed or confirmed:
 *    test name, timestamp, completion status, measurements, how each value
 *    was obtained, and stated limitations. Unavailable data is labelled
 *    "Not captured" — never guessed, never inferred.
 *  - Measurements are the safe, non-identifying values testers emit in
 *    `metrics` (levels, counts, resolutions, timings, settings observations).
 *    They NEVER include: audio/video recordings, IP addresses, pressed keys,
 *    clipboard contents, or hardware/device identifiers.
 *  - `sensitive` metric keys (device labels/names) are EXCLUDED by default
 *    and included only when the user explicitly opts in, after seeing a
 *    preview of exactly what would be exported.
 *  - One deny-list pass (stripPrivateValues) runs over free text as defense
 *    in depth, so a future tester detail cannot smuggle private values out.
 *  - "How it was obtained" and "limitations" come from the tool definition's
 *    instructions/limitations — not invented explanations.
 *  - Social sharing is a separate surface (lib/share.ts): exports and public
 *    share messages share nothing.
 */

import { ToolDefinition } from '@/lib/tools/types';
import { stripPrivateValues } from './testHistory';
// Type-only: importing the payload type from the client component must never
// create a runtime import cycle (Banner → ExportReportControl → here → Banner).
import type { TestResultPayload } from '@/components/TestResultBanner';
import { BannerStatus } from './resultPolicy';

/** Metric keys considered identifying and gated behind explicit opt-in. */
const SENSITIVE_METRIC_KEYS: ReadonlySet<string> = new Set([
  'deviceLabel',
  'deviceName',
  'padId',
  'productId',
  'vendorId',
  'serialNumber',
]);

/** Sensitive keys are shown in the preview as excluded by default. */
export function isSensitiveMetricKey(key: string): boolean {
  return SENSITIVE_METRIC_KEYS.has(key);
}

/** Which export formats a given result can honestly produce. */
export interface ExportCapabilities {
  /** Always true when a completed verdict exists. */
  printReport: boolean;
  /** True only when the result has genuinely tabular measurements. */
  csv: boolean;
}

/** Labels for verdict statuses, kept in one place for UI + report text. */
export const STATUS_LABEL: Record<BannerStatus, string> = {
  passed: 'Passed',
  failed: 'Failed',
  warning: 'Warning',
  measured: 'Measured (completed, neutral)',
  inconclusive: 'Inconclusive',
  unsupported: 'Not supported by this browser',
  skipped: 'Not run',
};

export interface ExportOptions {
  /** Explicit opt-in to include sensitive (device-label) metric values. */
  includeSensitive: boolean;
}

export interface ExportedMetric {
  key: string;
  /** `undefined` when excluded (sensitive + not opted in). */
  value: string | undefined;
  /** Why this value is presented this way (exclusion notice, etc). */
  excluded?: boolean;
}

export interface ExportReportData {
  toolTitle: string;
  toolSlug: string;
  /** When the result was observed (epoch ms). */
  observedAt: number;
  /** The banner's verdict status. */
  status: BannerStatus;
  /** The banner's human summary (already privacy-screened by the tester). */
  details: string;
  /** Test-specific measurements drawn from real observations. */
  metrics: ExportedMetric[];
  /** How the values were obtained (from the tool definition). */
  method: string[];
  /** Stated limitations of the tool (from the tool definition). */
  limitations: string[];
}

/**
 * Build the export data model for one completed test verdict. Values are
 * stringified conservatively; sensitive keys are excluded unless opted in,
 * and their slots remain visible with an honest "Excluded" marker so the
 * preview shows exactly what was and was not exported.
 */
export function buildExportReport(
  tool: Pick<ToolDefinition, 'id' | 'title' | 'slug' | 'instructions' | 'limitations'>,
  result: TestResultPayload,
  now: number,
  options: ExportOptions = { includeSensitive: false }
): ExportReportData {
  const metrics: ExportedMetric[] = result.metrics
    ? Object.entries(result.metrics)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([key, value]) => {
          if (!options.includeSensitive && isSensitiveMetricKey(key)) {
            return { key, value: undefined, excluded: true };
          }
          return { key, value: String(value), excluded: false };
        })
    : [];

  return {
    toolTitle: tool.title,
    toolSlug: tool.slug,
    observedAt: now,
    status: result.status,
    // Defense in depth: free text passes the shared deny-list before export.
    details: stripPrivateValues(result.details ?? ''),
    metrics,
    method: tool.instructions ?? [],
    limitations: tool.limitations ?? [],
  };
}

/**
 * Whether a CSV export would be honest for this result. CSV exists for
 * genuinely tabular measurements: at least one numeric-ish measurement that
 * is actually present. A verdict sentence or a pass/fail with no numbers is
 * NOT turned into a fake spreadsheet.
 */
export function canExportCsv(data: ExportReportData): boolean {
  return data.metrics.some((m) => m.value !== undefined && NUMERIC_VALUE.test(m.value));
}

/** Values treated as measurements for CSV purposes (plain numbers, units). */
const NUMERIC_VALUE = /^(?:-?\d+(?:\.\d+)?)(?:\s*%|\s*ms|\s*CPS|\s*Hz|\s*kHz)?$/i;

/** Escape one CSV cell: quote, escape inner quotes, neutralize injection. */
function csvCell(value: string): string {
  const escaped = value.replace(/"/g, '""');
  // Prefix leading =,+,-,@ so spreadsheet apps don't evaluate cells as formulas.
  const guarded = /^[=+\-@]/.test(escaped) ? `'${escaped}` : escaped;
  return `"${guarded}"`;
}

/**
 * Generate CSV for the result's tabular measurements. Returns null when the
 * result has no genuine measurements — callers must not fabricate rows.
 */
export function buildCsv(data: ExportReportData): string | null {
  const rows = data.metrics.filter((m) => m.value !== undefined && NUMERIC_VALUE.test(m.value));
  if (rows.length === 0) return null;

  const lines: string[] = [
    `Test,${csvCell(data.toolTitle)}`,
    `Observed at (UTC),${csvCell(new Date(data.observedAt).toISOString())}`,
    `Status,${csvCell(STATUS_LABEL[data.status])}`,
    '',
    'Measurement,Value',
    ...rows.map((m) => `${csvCell(m.key)},${csvCell(String(m.value))}`),
  ];
  return lines.join('\r\n') + '\r\n';
}

/** ISO timestamp for filenames: 2026-09-23T18-22-05-000Z style. */
function fileStamp(ms: number): string {
  return new Date(ms).toISOString().replace(/[:]/g, '-');
}

export function csvFilename(data: ExportReportData): string {
  return `devicetry-${data.toolSlug}-${fileStamp(data.observedAt)}.csv`;
}

/**
 * Print-friendly report as a plain-text document. The component opens a
 * scoped print window (see ExportReportControl), so the report does not need
 * HTML escaping — but it stays plain text: no markup, no scripts.
 */
export function buildPrintReport(data: ExportReportData, siteUrl?: string): string {
  const lines: string[] = [];
  const when = new Date(data.observedAt);
  const hasValues = data.metrics.some((m) => m.value !== undefined);
  const excluded = data.metrics.filter((m) => m.excluded);

  lines.push('DeviceTry — Local Test Report');
  lines.push('='.repeat(28));
  lines.push(`Test: ${data.toolTitle}`);
  lines.push(`Observed: ${when.toUTCString()}`);
  lines.push(`Completion status: ${STATUS_LABEL[data.status]}`);
  lines.push('');
  lines.push('Summary');
  lines.push(data.details || 'No summary sentence was recorded for this run.');
  lines.push('');
  lines.push(hasValues ? 'Measurements' : 'Measurements: none were captured for this run.');

  for (const m of data.metrics) {
    if (m.value !== undefined) {
      lines.push(`  ${m.key}: ${m.value}`);
    }
  }
  if (excluded.length > 0) {
    lines.push(
      `  Excluded by your export choice: ${excluded.map((m) => m.key).join(', ')} ` +
        `(device-label values are excluded by default and only included on request).`
    );
  }
  if (data.method.length > 0) {
    lines.push('');
    lines.push('How these values were obtained');
    for (const step of data.method) lines.push(`  - ${stripPrivateValues(step)}`);
  }
  if (data.limitations.length > 0) {
    lines.push('');
    lines.push('Limitations');
    for (const lim of data.limitations) lines.push(`  - ${stripPrivateValues(lim)}`);
  }
  lines.push('');
  lines.push(
    'Privacy: this report was generated locally in your browser. It contains no recordings, ' +
      'no IP addresses, no pressed keys, and no clipboard content. Device-label values are ' +
      'included only if you explicitly selected them.'
  );
  if (siteUrl) {
    lines.push(`Tool page: ${siteUrl}/test/${data.toolSlug}`);
  }
  return lines.join('\n') + '\n';
}

/**
 * The complete set of metric keys with their default inclusion state —
 * the exact data the preview dialog presents before any export happens.
 */
export interface PreviewMetric {
  key: string;
  /** Shown value in the preview (or the exclusion notice). */
  display: string;
  sensitive: boolean;
  included: boolean;
}

export function previewMetrics(data: ExportReportData, options: ExportOptions): PreviewMetric[] {
  return data.metrics.map((m) => {
    const sensitive = isSensitiveMetricKey(m.key);
    const included = m.value !== undefined;
    return {
      key: m.key,
      display: m.value !== undefined ? m.value : 'Excluded — device label (opt in to include)',
      sensitive,
      included,
    };
  });
}
