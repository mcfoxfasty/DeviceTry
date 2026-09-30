/**
 * Rebuilding a guided-inspection report from a SAVED record.
 *
 * WHY THIS EXISTS: the finished screen and a saved record are the same report,
 * so they must be describable by the same code. Before this module the saved
 * record could only be listed - "Print" ran `window.print()` on whatever page
 * the user happened to be looking at, which is never the record that was
 * clicked. Exporting a saved record needs three things the list did not have:
 * the checklist identity (which checks, in what order), the stored results, and
 * the stored notes. All three are read HERE, from the record, and nowhere from
 * the currently running inspection.
 *
 * THE HONESTY RULE, and the reason this is a separate module: a record saved
 * before the checklist identity was stored does not have one. It must not be
 * given a plausible checklist, because that would describe checks the record
 * never ran. Such a record is reported with the steps its own results name and
 * labelled as derived; a record with no results at all is reported as having
 * nothing recorded, not as a clean run.
 */

import {
  buildInspectionReport,
  isCurrentStep,
  inspectionReportText,
  ReportRow,
  summarizeRun,
  unverifiedSteps,
} from './stepOutcomes';
import { calculateReportStatus, ReportSummaryStatus } from '../testing/reportStatus';
import { LocalInspectionItem } from '../testing/localHistory';

/** Where the step list of a rebuilt report came from. */
export type StepProvenance = 'stored' | 'derived' | 'none';

/** A saved record, read back as a report. */
export interface SavedRecordReport {
  /** The step keys the report is built over, in order. */
  steps: string[];
  /** Whether those keys were stored with the record or inferred from results. */
  provenance: StepProvenance;
  /** True when any step key is not one this build currently runs. */
  hasRetiredSteps: boolean;
  /** What to call the checklist, honestly. */
  checklistLabel: string;
  rows: ReportRow[];
  /** Recomputed from the stored results, never trusted from the stored field. */
  summaryStatus: ReportSummaryStatus;
  summaryLine: string;
  unverifiedCount: number;
  notes: string;
  /** The record's own timestamp, not the time the report is being rendered. */
  dateLabel: string;
  /** One or two honest sentences about what this export is and where from. */
  provenanceLine: string;
}

const UNKNOWN_CHECKLIST = 'Checklist not recorded with this report';

/**
 * The step keys a record was built over.
 *
 * `stored` is the recorded checklist, `derived` is what the record's own stored
 * results name (a real but incomplete statement: a step that was skipped and
 * never recorded cannot be recovered, which is exactly why the label says so),
 * and `none` is a record with no results at all.
 */
export function savedRecordSteps(record: LocalInspectionItem): {
  steps: string[];
  provenance: StepProvenance;
} {
  const stored = Array.isArray(record.steps) ? record.steps.filter((s) => typeof s === 'string') : [];
  if (stored.length > 0) return { steps: stored, provenance: 'stored' };

  const fromResults = Object.keys(record.testsResults ?? {}).filter((k) => typeof k === 'string' && k.length > 0);
  if (fromResults.length > 0) return { steps: fromResults, provenance: 'derived' };

  return { steps: [], provenance: 'none' };
}

/** Human date for a record, from the record's own timestamp. */
export function savedRecordDateLabel(createdAt: number): string {
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return 'Date not recorded';
  return d.toLocaleDateString('en', { dateStyle: 'full' });
}

/**
 * Rebuild the report for one saved record. Everything here comes from `record`
 * and nothing from any live run, so exporting record A after running B still
 * exports A.
 */
export function savedRecordReport(record: LocalInspectionItem): SavedRecordReport {
  const { steps, provenance } = savedRecordSteps(record);
  const rows = buildInspectionReport(steps, record.testsResults ?? {});
  const retired = rows.filter((r) => !isCurrentStep(r.step));

  const checklistLabel =
    record.suiteTitle ??
    (provenance === 'stored'
      ? 'Checklist not named with this report'
      : provenance === 'derived'
        ? 'Checklist not recorded; steps below are the ones this report holds results for'
        : UNKNOWN_CHECKLIST);

  // Recomputed rather than read: a stored summaryStatus is a cached claim, and
  // this report is being rebuilt precisely because the user wants the record's
  // own results described.
  const summaryStatus = calculateReportStatus(steps, record.testsResults ?? {});
  const unverifiedCount = unverifiedSteps(rows).length;

  const provenanceNotes: string[] = [];
  if (provenance === 'derived') {
    provenanceNotes.push(
      'This report was saved without its checklist identity, so the steps listed are the ones it holds results for. A step that was skipped or never recorded cannot be recovered from the record and is not listed.'
    );
  } else if (provenance === 'none') {
    provenanceNotes.push(
      'This record holds no per-check results, so no check can be described. It is not a clean run: nothing was recorded.'
    );
  }
  if (retired.length > 0) {
    provenanceNotes.push(
      `${retired.length} check${retired.length === 1 ? '' : 's'} in this record (${retired
        .map((r) => r.label)
        .join(', ')}) ${retired.length === 1 ? 'is' : 'are'} not part of the current checklist. ${
        retired.length === 1 ? 'It is' : 'They are'
      } shown exactly as the record stored them.`
    );
  }
  if (record.updatedAt && record.updatedAt > (record.createdAt ?? 0)) {
    provenanceNotes.push(
      `This record was re-run and refreshed on ${savedRecordDateLabel(record.updatedAt)}; its original date is the one above.`
    );
  }

  return {
    steps,
    provenance,
    hasRetiredSteps: retired.length > 0,
    checklistLabel,
    rows,
    summaryStatus,
    summaryLine: rows.length > 0 ? summarizeRun(rows) : 'No checks were recorded in this report.',
    unverifiedCount,
    notes: typeof record.notes === 'string' ? record.notes : '',
    dateLabel: savedRecordDateLabel(record.createdAt),
    provenanceLine: provenanceNotes.join(' '),
  };
}

/** The plain-text report body for a saved record — the same builder the live report uses. */
export function savedRecordReportText(record: LocalInspectionItem): string {
  const report = savedRecordReport(record);
  return inspectionReportText({
    suiteTitle: report.checklistLabel,
    deviceLabel: record.deviceLabel || undefined,
    operatorName: record.operatorName || undefined,
    dateLabel: report.dateLabel,
    rows: report.rows,
    notes: report.notes,
    provenance: report.provenanceLine || undefined,
  });
}

/** A filesystem-safe PDF name built from the record's own timestamp. */
export function savedRecordPdfFilename(record: LocalInspectionItem): string {
  const stamp = new Date(record.createdAt)
    .toISOString()
    .replace(/[:.]/g, '-');
  const slug = String(record.deviceLabel || 'inspection')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `devicetry-inspection-${slug || 'report'}-${stamp}.pdf`;
}
