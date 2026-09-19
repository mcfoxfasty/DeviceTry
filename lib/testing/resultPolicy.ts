/**
 * Result-forwarding policy — single source of truth for which test verdicts
 * are recorded into host flows (guided inspection, local reports).
 *
 * Testers emit one of six statuses. Host callbacks accept narrower unions:
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
  | 'unsupported'
  | 'skipped';

export type ForwardableStatus = 'passed' | 'warning' | 'failed' | 'inconclusive';

/** Policy for generic testers reporting (status, details) to host pages. */
export function forwardGenericResult(status: BannerStatus): boolean {
  return status !== 'skipped';
}

/** Policy for flagship testers reporting a rich payload to report builders. */
export function forwardRichResult(status: BannerStatus): status is ForwardableStatus {
  return status !== 'skipped' && status !== 'unsupported';
}
