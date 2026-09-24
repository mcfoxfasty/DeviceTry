/**
 * Result-forwarding policy — single source of truth for which test verdicts
 * are recorded into host flows (guided inspection, local reports).
 *
 * Testers emit one of seven statuses. Host callbacks accept narrower unions:
 * - Generic hosts (ToolComponentProps.onResultUpdate) accept 'unsupported'.
 * - Rich hosts (flagship onRecordResult payloads) do NOT have an
 *   'unsupported' member, so forwarding one would misrepresent the verdict.
 *
 * Unrecorded statuses are safe to drop because a *missing* result already
 * maps to 'inconclusive' in calculateReportStatus — which is exactly the
 * meaning of 'skipped' and, for rich hosts, of 'unsupported'.
 */
export type BannerStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'inconclusive'
  | 'measured'
  | 'unsupported'
  | 'skipped';

export type ForwardableStatus = 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured';

/**
 * 'measured' = the run COMPLETED and produced real numeric values, without
 * any pass/fail judgement (CPS scores, speed measurements). It is distinct
 * from 'inconclusive', which now exclusively means the run produced nothing
 * usable or ended incomplete — so a finished measurement can never again be
 * displayed or exported as "Inconclusive".
 */

/** Policy for generic testers reporting (status, details) to host pages. */
export function forwardGenericResult(status: BannerStatus): boolean {
  return status !== 'skipped';
}

/** Policy for flagship testers reporting a rich payload to report builders. */
export function forwardRichResult(status: BannerStatus): status is ForwardableStatus {
  return status !== 'skipped' && status !== 'unsupported';
}
