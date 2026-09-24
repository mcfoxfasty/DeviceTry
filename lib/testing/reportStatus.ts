export type TestResultStatus =
  | 'passed'
  | 'warning'
  | 'failed'
  | 'inconclusive'
  | 'measured'
  | 'unsupported'
  | 'skipped';

export type ReportSummaryStatus = 'passed' | 'warning' | 'failed' | 'inconclusive';

export interface TestResultItem {
  status: TestResultStatus;
  classification?: 'browser' | 'user' | 'inconclusive' | 'unsupported' | 'skipped' | 'blocked';
  blockedReason?: 'denied' | 'unavailable';
  details?: string;
  metrics?: Record<string, unknown>;
  [key: string]: unknown;
}

/**
 * Authoritative central report-status function.
 * 
 * Rules:
 * - passed: only when EVERY required selected test has an explicit 'passed' result.
 * - warning: when no test failed, no test is inconclusive/skipped/unsupported, but at least one test has a 'warning'.
 * - failed: when AT LEAST ONE test failed.
 * - inconclusive: when any selected test is skipped, unsupported, unfinished, missing, or inconclusive,
 *                 or when no tests completed.
 */
export function calculateReportStatus(
  requiredTestKeys: string[],
  results: Record<string, TestResultItem | undefined>
): ReportSummaryStatus {
  if (!requiredTestKeys || requiredTestKeys.length === 0) {
    return 'inconclusive';
  }

  // Verify that all required tests exist in results
  for (const key of requiredTestKeys) {
    const item = results[key];
    if (!item || !item.status) {
      return 'inconclusive';
    }
  }

  const statuses = requiredTestKeys.map((k) => results[k]!.status);

  // 1. Any failed test causes the overall report to fail
  if (statuses.some((s) => s === 'failed')) {
    return 'failed';
  }

  // 2. Any skipped, unsupported, or inconclusive test results in inconclusive
  //    ('measured' is a COMPLETED observation — it does not degrade the report)
  if (statuses.some((s) => s === 'skipped' || s === 'unsupported' || s === 'inconclusive')) {
    return 'inconclusive';
  }

  // 3. If any test is a warning (and none failed or inconclusive)
  if (statuses.some((s) => s === 'warning')) {
    return 'warning';
  }

  // 4. Passed only if 100% of required tests explicitly passed ('measured'
  //    steps are complete-but-neutral observations, not pass/fail claims)
  if (statuses.every((s) => s === 'passed' || s === 'measured')) {
    return 'passed';
  }

  return 'inconclusive';
}
