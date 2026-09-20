'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RotateCcw } from 'lucide-react';
import { BannerStatus } from '@/lib/testing/resultPolicy';
import { ResultController, ResultSink } from '@/lib/testing/resultController';

export type { BannerStatus } from '@/lib/testing/resultPolicy';

export interface TestResultPayload {
  status: BannerStatus;
  details: string;
  metrics?: Record<string, unknown>;
}

interface TestResultBannerProps {
  result: TestResultPayload | null;
  onClear?: () => void;
  /** "attached" fuses the banner to the bottom of a tester card (no gap, shared corners). */
  variant?: 'card' | 'attached';
}

const STATUS_STYLES: Record<BannerStatus, { wrap: string; pill: string; icon: string }> = {
  passed: {
    wrap: 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900',
    pill: 'bg-emerald-600 text-white',
    icon: 'text-emerald-600 dark:text-emerald-400',
  },
  failed: {
    wrap: 'bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-900',
    pill: 'bg-red-600 text-white',
    icon: 'text-red-600 dark:text-red-400',
  },
  warning: {
    wrap: 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-900',
    pill: 'bg-amber-500 text-white',
    icon: 'text-amber-600 dark:text-amber-400',
  },
  inconclusive: {
    wrap: 'bg-slate-50 dark:bg-[#192332] border-[#DFE5EB] dark:border-[#223043]',
    pill: 'bg-slate-500 text-white',
    icon: 'text-[#59677D] dark:text-[#9AA6B8]',
  },
  unsupported: {
    wrap: 'bg-sky-50 dark:bg-sky-950/30 border-sky-200 dark:border-sky-900',
    pill: 'bg-sky-600 text-white',
    icon: 'text-sky-600 dark:text-sky-400',
  },
  skipped: {
    wrap: 'bg-slate-50 dark:bg-[#192332] border-[#DFE5EB] dark:border-[#223043]',
    pill: 'bg-slate-500 text-white',
    icon: 'text-[#59677D] dark:text-[#9AA6B8]',
  },
};

/**
 * In-card verdict banner: rendered inside each tester card, directly under
 * the test area, so the outcome is always attached to the tool being used.
 */
export function TestResultBanner({ result, onClear, variant = 'card' }: TestResultBannerProps) {
  if (!result) return null;

  const styles = STATUS_STYLES[result.status] ?? STATUS_STYLES.inconclusive;
  const metrics = result.metrics ? Object.entries(result.metrics).filter(([, v]) => v !== undefined && v !== '') : [];
  const attach = variant === 'attached';

  return (
    <div className={`${attach ? 'rounded-b-xl border-t-0' : 'mt-6 rounded-xl'} border p-4 ${styles.wrap}`} data-testid="test-result-banner">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <ClipboardCheck className={`w-5 h-5 mt-0.5 shrink-0 ${styles.icon}`} />
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm font-bold text-[#142033] dark:text-[#E9EEF4]">
              Test result
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles.pill}`}>
                {result.status}
              </span>
            </p>
            {result.details && (
              <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-1 leading-relaxed break-words">{result.details}</p>
            )}
            {metrics.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {metrics.map(([key, value]) => (
                  <span
                    key={key}
                    className="font-mono-num text-[10px] font-semibold bg-white dark:bg-[#131B27] border border-[#DFE5EB] dark:border-[#223043] rounded-md px-2 py-1 text-[#142033] dark:text-[#E9EEF4] break-all"
                  >
                    {key}: {String(value)}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
        {onClear && (
          <button
            onClick={onClear}
            title="Clear result"
            aria-label="Clear result"
            className="text-[#59677D] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer shrink-0"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Captures a tester's result emissions so they can be shown in-card while
 * still forwarding them to host flows (guided inspection, report building).
 *
 * Three distinct lifecycle operations:
 * - `startRun()`  — a new user-visible observation (Start Test, device
 *                   change, retest): invalidates old run tokens, clears the
 *                   visible verdict, and clears the parent/guided result
 *                   exactly once. Returns the token to capture for delayed work.
 * - `reset()`     — explicit user clear (Reset button, banner clear button):
 *                   identical mechanics, returns the new token.
 * - `invalidate()`— unmount/resource cleanup: invalidates tokens WITHOUT
 *                   clearing the parent/guided result, so a completed step's
 *                   record survives its component unmounting.
 *
 * Forwarding policy, run-guarding, and dedupe live in ResultController.
 * Local React state is updated only for accepted AND changed emissions, so
 * identical polling/animation-frame emissions update neither the host
 * callbacks nor this banner.
 */
export function useTestResult(opts: ResultSink) {
  const [result, setResult] = useState<TestResultPayload | null>(null);

  // The controller is created once via the useState initializer — never
  // accessed during render — and its callbacks are refreshed in an effect.
  const [controller] = useState(() => new ResultController({}));

  useEffect(() => {
    controller.setSink(opts);
  }, [opts, controller]);

  const emit = useCallback((status: BannerStatus, details?: string, metrics?: Record<string, unknown>) => {
    const outcome = controller.emit(status, details, metrics);
    if (outcome.changed) {
      setResult({ status, details: details ?? '', metrics });
    }
  }, [controller]);

  const emitRun = useCallback((runToken: number, status: BannerStatus, details?: string, metrics?: Record<string, unknown>) => {
    const outcome = controller.emitRun(runToken, status, details, metrics);
    if (outcome.accepted && outcome.changed) {
      setResult({ status, details: details ?? '', metrics });
    }
  }, [controller]);

  const emitRich = useCallback((payload: TestResultPayload) => {
    const outcome = controller.emitRich(payload);
    if (outcome.changed) {
      setResult(payload);
    }
  }, [controller]);

  const emitRunRich = useCallback((runToken: number, payload: TestResultPayload) => {
    const outcome = controller.emitRunRich(runToken, payload);
    if (outcome.accepted && outcome.changed) {
      setResult(payload);
    }
  }, [controller]);

  /**
   * Explicit user reset (Reset button / banner clear): clears the visible
   * verdict AND the parent/guided result exactly once, and invalidates every
   * token captured by the old run. Returns the new run token.
   */
  const reset = useCallback((): number => {
    const token = controller.clearResult();
    setResult(null);
    return token;
  }, [controller]);

  /**
   * Begin a new user-visible observation (Start Test / device change /
   * retest). Same clearing semantics as reset; named for clarity at
   * new-run call sites. Returns the token to capture for delayed work.
   */
  const startRun = useCallback((): number => {
    const token = controller.startRun();
    setResult(null);
    return token;
  }, [controller]);

  /**
   * Unmount/resource cleanup only: invalidates in-flight callbacks so they
   * can no longer report, but deliberately does NOT clear the parent/guided
   * result — a completed observation survives its component unmounting.
   */
  const invalidate = useCallback((): void => {
    controller.invalidateRun();
  }, [controller]);

  /** Current run token — capture it when a delayed operation begins. */
  const currentRun = useCallback((): number => controller.getCurrentRun(), [controller]);

  /** Compatibility alias used by existing testers. */
  const clear = reset;

  return { result, emit, emitRun, emitRich, emitRunRich, clear, reset, startRun, invalidate, currentRun };
}

interface TesterWithBannerProps {
  tester: React.ComponentType<any>;
  /** Props to pass through to the tester (t, locale, etc). */
  testerProps: Record<string, unknown>;
  /** Host-page telemetry hook, forwarded untouched. */
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  /** Host hook notified when the user clears/resets this tester's result. */
  onResultClear?: () => void;
}

/**
 * Renders a tester and fuses the result banner to its bottom edge, so
 * every tester on the site shows its verdict directly under the test area.
 */
export function TesterWithBanner({ tester: Tester, testerProps, onResultUpdate, onResultClear }: TesterWithBannerProps) {
  const { result, emit, reset } = useTestResult({ onResultUpdate, onResultClear });

  return (
    <div className="w-full">
      <Tester {...testerProps} onResultUpdate={emit} />
      <TestResultBanner result={result} onClear={reset} variant="attached" />
    </div>
  );
}
