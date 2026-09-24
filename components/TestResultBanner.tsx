'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardCheck, ChevronDown, RotateCcw } from 'lucide-react';
import { BannerStatus } from '@/lib/testing/resultPolicy';
import { ResultController, ResultSink } from '@/lib/testing/resultController';
import { recordTestResult } from '@/lib/testing/testHistory';
import { buildSharePayload, extractScoreForShare, SharePayload, ShareResultInput } from '@/lib/share';
import { ShareButton } from '@/components/ui/ShareButton';
import { ExportReportControl } from '@/components/ui/ExportReportControl';
import { findToolBySlug } from '@/lib/tools/registry';
import { buildResultDetails } from '@/lib/testing/resultDetails';
import { compareToPrevious, formatDelta } from '@/lib/testing/compare';

export type { BannerStatus } from '@/lib/testing/resultPolicy';

export interface TestResultPayload {
  status: BannerStatus;
  details: string;
  metrics?: Record<string, unknown>;
  /** Epoch ms when this verdict was observed (set by useTestResult; Phase 2 export). */
  observedAt?: number;
}

interface TestResultBannerProps {
  result: TestResultPayload | null;
  onClear?: () => void;
  /** "attached" fuses the banner to the bottom of a tester card (no gap, shared corners). */
  variant?: 'card' | 'attached';
  /** Registry id/slug of the tool owning this banner (enables safe share + history). */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
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
export function TestResultBanner({ result, onClear, variant = 'card', toolId, toolTitle, toolSlug }: TestResultBannerProps) {
  // Rules of Hooks: every hook runs unconditionally, BEFORE the conditional
  // return below. An early return placed above these hooks would change the
  // hook count between renders (null → value) and crash the component.

  // Type narrowing only: ShareResultInput's status union is the same five
  // members the host accepts — 'skipped' can never reach the share builder
  // because forwardGenericResult() drops it before the banner sees a verdict.
  const shareStatus = result?.status as ShareResultInput['status'] | undefined;

  /** Privacy-safe share payload; null when nothing shareable is available. */
  const sharePayload: SharePayload | null = useMemo(() => {
    if (!toolId || !toolTitle || !result) return null;
    const score = extractScoreForShare(toolId, result.details);
    return buildSharePayload(
      { id: toolId, title: toolTitle },
      {
        status: shareStatus!,
        score: score?.score ?? null,
        scoreUnit: score?.unit,
      }
    );
  }, [toolId, toolTitle, result, shareStatus]);

  /**
   * Browser-local history (correction D): record once per completed verdict.
   * Only name/status/safe summary/timestamp are stored — see testHistory.ts.
   * Guarded by a ref so a polling tester that re-emits the identical verdict
   * does not create duplicate history entries.
   */
  const recordedKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!toolId || !toolTitle || !toolSlug || !result) return;
    // 'skipped' is not a completed verdict: it must never be recorded.
    if (result.status === 'skipped') return;
    const key = `${toolSlug}|${result.status}|${result.details}`;
    if (recordedKeyRef.current === key) return;
    recordedKeyRef.current = key;
    recordTestResult({
      slug: toolSlug,
      title: toolTitle,
      status: result.status,
      summary: result.details,
    });
  }, [toolId, toolTitle, toolSlug, result]);

  /**
   * Phase 3: rerun comparison. When this tool's verdict carries numeric
   * measurements, they are compared with the previous run's stored values
   * (browser-local, lib/testing/compare.ts). Comparison is pure derivation
   * from the accepted result, so it is computed in render (useMemo) — never
   * via setState-in-effect. The matching write happens in the effect below,
   * AFTER this read (render precedes effects), so deltas always describe
   * the genuinely previous run.
   */
  const comparison = useMemo(() => {
    if (!toolSlug || !result || result.status === 'skipped') return null;
    const numeric = Object.fromEntries(
      Object.entries(result.metrics ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    );
    if (Object.keys(numeric).length === 0) return null;
    return compareToPrevious(toolSlug, numeric);
  }, [toolSlug, result]);

  /**
   * Record the current run's numeric measurements once per distinct verdict.
   * Identical re-emissions are skipped (dedupe key) so a polling tester
   * cannot collapse the stored baseline into the current value.
   */
  const compareKeyRef = useRef<string | null>(null);
  useEffect(() => {
    if (!toolSlug || !result || result.status === 'skipped') return;
    const numeric = Object.fromEntries(
      Object.entries(result.metrics ?? {}).filter(([, v]) => typeof v === 'number' && Number.isFinite(v))
    );
    if (Object.keys(numeric).length === 0) return;
    const key = `${toolSlug}|${result.status}|${result.details}`;
    if (compareKeyRef.current === key) return;
    compareKeyRef.current = key;
    import('@/lib/testing/compare').then(({ recordMeasurements }) =>
      recordMeasurements(toolSlug, numeric, result.observedAt ?? Date.now())
    );
  }, [toolSlug, result]);

  // All hooks have run; only plain derivation and the conditional return
  // happen from here on.
  if (!result) return null;

  const styles = STATUS_STYLES[result.status] ?? STATUS_STYLES.inconclusive;
  const metrics = result.metrics ? Object.entries(result.metrics).filter(([, v]) => v !== undefined && v !== '') : [];
  const attach = variant === 'attached';
  const shareUrl = typeof window !== 'undefined' ? window.location.origin + (toolSlug ? `/test/${toolSlug}` : window.location.pathname) : '';
  // Phase 2 export: the registry definition provides honest "how obtained"
  // and "limitations" text for the report. Attached banners only know the
  // slug; registry lookup is a constant-time find.
  const exportTool = toolSlug ? findToolBySlug(toolSlug) : undefined;
  // Phase 2: expandable, test-specific explanation for the verdict. Derived
  // from the registry definition — never invented; see resultDetails.ts.
  const resultDetails = exportTool ? buildResultDetails(exportTool, result.status) : null;

  return (
    <div className={`${attach ? 'rounded-b-xl border-t-0' : 'mt-6 rounded-xl'} border p-4 ${styles.wrap}`} data-testid="test-result-banner">
      {/* Header row: title left, share/clear right. flex-wrap (never shrink)
          keeps them side by side on wide screens and stacks them cleanly on
          narrow ones — the button can no longer overlap the title. */}
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <div className="flex items-center gap-2 min-w-0">
          <ClipboardCheck className={`w-5 h-5 shrink-0 ${styles.icon}`} />
          <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-[#142033] dark:text-[#E9EEF4] min-w-0">
            Test result
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide ${styles.pill}`}>
              {result.status}
            </span>
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {exportTool && (
            <ExportReportControl tool={exportTool} result={result} />
          )}
          {sharePayload && shareUrl && (
            <ShareButton payload={sharePayload} url={shareUrl} />
          )}
          {onClear && (
            <button
              onClick={onClear}
              title="Clear result"
              aria-label="Clear result"
              className="text-[#59677D] dark:text-[#9AA6B8] hover:text-[#142033] dark:hover:text-[#E9EEF4] cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Summary spans the full card width, below the header — not squeezed
          into the narrow column beside the share button. */}
      {result.details && (
        <p className="text-xs text-[#59677D] dark:text-[#9AA6B8] mt-2 leading-relaxed break-words">{result.details}</p>
      )}

      {/* Phase 2: expandable test-specific explanation, between the summary
          and the measurements. Honest, registry-derived lines — see
          resultDetails.ts. Hidden entirely when no registry identity exists. */}
      {resultDetails && (
        <details className="mt-2 group/details">
          <summary className="cursor-pointer select-none inline-flex items-center gap-1.5 text-xs font-semibold text-[#0F766E] dark:text-[#14B8A6] hover:underline [&::-webkit-details-marker]:hidden">
            <ChevronDown className="w-3.5 h-3.5 transition-transform group-open/details:rotate-180" />
            What this result means
          </summary>
          <div className="mt-2 space-y-2 text-xs text-[#59677D] dark:text-[#9AA6B8] leading-relaxed">
            {resultDetails.sections.map((section) => (
              <div key={section.heading}>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#142033] dark:text-[#E9EEF4]">{section.heading}</p>
                <ul className="mt-1 space-y-0.5">
                  {section.lines.map((line, i) => (
                    <li key={i} className="break-words">{line}</li>
                  ))}
                </ul>
              </div>
            ))}
            {resultDetails.nextSteps.length > 0 && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-[#142033] dark:text-[#E9EEF4]">Next steps</p>
                <ul className="mt-1 space-y-0.5">
                  {resultDetails.nextSteps.map((step, i) => (
                    <li key={i} className="break-words">{step}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </details>
      )}

      {/* Result details as a responsive grid: full width on all screens,
          2 columns on phones, 3/4 as space allows. */}
      {metrics.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 mt-2">
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

      {/* Phase 3: neutral rerun comparison, shown only when numeric
          measurements exist. Deltas are directional facts, never judgements —
          "higher" is not automatically better for every measurement. */}
      {comparison && (comparison.deltas.length > 0 || comparison.firstRecorded.length > 0) && (
        <p className="mt-2 text-[10px] text-[#59677D] dark:text-[#9AA6B8] leading-relaxed">
          {comparison.deltas.length > 0 && (
            <>
              Compared with your previous run:{' '}
              {comparison.deltas.map((d) => `${d.key} ${formatDelta(d)} (${d.direction})`).join(' · ')}.{' '}
            </>
          )}
          {comparison.firstRecorded.length > 0 && (
            <>
              First recorded: {comparison.firstRecorded.join(', ')} — no earlier run to compare yet.{' '}
            </>
          )}
          Comparisons stay in this browser only.
        </p>
      )}
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
      setResult({ status, details: details ?? '', metrics, observedAt: Date.now() });
    }
  }, [controller]);

  const emitRun = useCallback((runToken: number, status: BannerStatus, details?: string, metrics?: Record<string, unknown>) => {
    const outcome = controller.emitRun(runToken, status, details, metrics);
    if (outcome.accepted && outcome.changed) {
      setResult({ status, details: details ?? '', metrics, observedAt: Date.now() });
    }
  }, [controller]);

  const emitRich = useCallback((payload: TestResultPayload) => {
    const outcome = controller.emitRich(payload);
    if (outcome.changed) {
      setResult({ ...payload, observedAt: payload.observedAt ?? Date.now() });
    }
  }, [controller]);

  const emitRunRich = useCallback((runToken: number, payload: TestResultPayload) => {
    const outcome = controller.emitRunRich(runToken, payload);
    if (outcome.accepted && outcome.changed) {
      setResult({ ...payload, observedAt: payload.observedAt ?? Date.now() });
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
  /** Forwarded to the banner to enable privacy-safe share + local history. */
  toolId?: string;
  toolTitle?: string;
  toolSlug?: string;
}

/**
 * Renders a tester and fuses the result banner to its bottom edge, so
 * every tester on the site shows its verdict directly under the test area.
 */
export function TesterWithBanner({ tester: Tester, testerProps, onResultUpdate, onResultClear, toolId, toolTitle, toolSlug }: TesterWithBannerProps) {
  const { result, emit, reset } = useTestResult({ onResultUpdate, onResultClear });

  return (
    <div className="w-full">
      <Tester {...testerProps} onResultUpdate={emit} />
      <TestResultBanner result={result} onClear={reset} variant="attached" toolId={toolId} toolTitle={toolTitle} toolSlug={toolSlug} />
    </div>
  );
}
