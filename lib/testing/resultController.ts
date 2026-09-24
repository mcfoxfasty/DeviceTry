import { BannerStatus, ForwardableStatus, forwardGenericResult, forwardRichResult } from './resultPolicy';
import type { TestResultPayload } from '@/components/TestResultBanner';

/**
 * Run-guarded, deduplicating result emission.
 *
 * A controller instance represents one observation run. Run tokens are
 * monotonically increasing integers; delayed operations (timers, animation
 * frames, permission resolutions, device-change events) capture the token
 * when the operation BEGINS and present it when reporting. Emissions from an
 * older token are rejected, so a stale callback can never restore an old
 * verdict or adopt a newer run.
 *
 * Three distinct lifecycle operations:
 * - startRun()     — a new user-visible observation: invalidates old tokens
 *                    and notifies the host's onResultClear exactly once (only
 *                    when a result was actually recorded for the previous run).
 * - clearResult()  — explicit user reset: identical to startRun() semantically.
 * - invalidateRun()— unmount/resource cleanup: invalidates tokens WITHOUT
 *                    notifying the host, so a legitimately completed guided
 *                    result survives the component unmounting.
 *
 * Identical status+details+metrics emissions are forwarded to the host exactly
 * once per run, preventing spam from animation/polling loops while still
 * allowing a real metrics change through.
 */
export interface ResultSink {
  onResultUpdate?: (
    status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'measured' | 'unsupported',
    details?: string,
    metrics?: Record<string, unknown>
  ) => void;
  onRecordResult?: (result: { status: ForwardableStatus; details: string; metrics?: Record<string, unknown> }) => void;
  /** Optional: host must drop the recorded result for this run (explicit reset, retest, device change). */
  onResultClear?: () => void;
}

export interface EmitResult {
  /** false when the emission came from a stale run token (ignored entirely). */
  accepted: boolean;
  /** false when the emission was identical (status+details+metrics) to the last one in this run. */
  changed: boolean;
  /** false when policy dropped the status from host forwarding (skipped/unsupported for rich). */
  forwarded: boolean;
}

/** Stable dedupe key across status, details, and metrics (key order-insensitive). */
function emissionKey(status: BannerStatus, details?: string, metrics?: Record<string, unknown>): string {
  let metricsKey = '';
  if (metrics) {
    metricsKey = Object.keys(metrics)
      .sort()
      .map((k) => `${k}=${JSON.stringify(metrics[k])}`)
      .join(',');
  }
  return `${status}\u0000${details ?? ''}\u0000${metricsKey}`;
}

export class ResultController {
  private runToken = 0;
  private lastEmittedKey: string | null = null;
  /** Tracks whether the host may currently hold a result for this run. */
  private hostHasResult = false;
  private sink: ResultSink;

  constructor(sink: ResultSink) {
    this.sink = sink;
  }

  setSink(sink: ResultSink): void {
    this.sink = sink;
  }

  private bumpToken(): void {
    this.runToken += 1;
    this.lastEmittedKey = null;
  }

  /** Notify the host exactly once per run that a recorded result must be dropped. */
  private notifyClearIfNeeded(): void {
    if (this.hostHasResult) {
      this.hostHasResult = false;
      this.sink.onResultClear?.();
    }
  }

  /**
   * Begin a new user-visible observation: invalidates all old tokens, resets
   * dedupe, and clears the corresponding host result exactly once (only when
   * one was actually recorded). Returns the token to capture for delayed work.
   */
  startRun(): number {
    this.bumpToken();
    this.notifyClearIfNeeded();
    return this.runToken;
  }

  /** Explicit user reset. Same semantics as startRun(); clearer at reset call sites. Returns the new token. */
  clearResult(): number {
    return this.startRun();
  }

  /** Backward-compatible alias for clearResult(). */
  reset(): void {
    this.clearResult();
  }

  /**
   * Unmount/resource cleanup: invalidates all tokens so in-flight promises,
   * timers, rAF loops, and permission resolutions can no longer report — but
   * deliberately does NOT notify onResultClear, so a legitimately completed
   * guided result is preserved when a step unmounts.
   */
  invalidateRun(): void {
    this.bumpToken();
  }

  getCurrentRun(): number {
    return this.runToken;
  }

  /** True when an accepted, forwarded emission exists for the current run. */
  hasEmittedForCurrentRun(): boolean {
    return this.hostHasResult;
  }

  /** Emit a verdict for the given run token (captured when the operation began). */
  emitRun(runToken: number, status: BannerStatus, details?: string, metrics?: Record<string, unknown>): EmitResult {
    if (runToken !== this.runToken) {
      return { accepted: false, changed: false, forwarded: false };
    }
    return this.emit(status, details, metrics);
  }

  /**
   * Emit a verdict for the current run (no token check — direct user
   * interactions and live observers use this).
   */
  emit(status: BannerStatus, details?: string, metrics?: Record<string, unknown>): EmitResult {
    const key = emissionKey(status, details, metrics);
    const changed = key !== this.lastEmittedKey;
    let forwarded = false;

    if (changed) {
      if (forwardGenericResult(status)) {
        this.sink.onResultUpdate?.(status as Exclude<BannerStatus, 'skipped'>, details);
        forwarded = true;
      }
      if (forwardRichResult(status)) {
        this.sink.onRecordResult?.({
          status: status as ForwardableStatus,
          details: details ?? '',
          metrics,
        });
        forwarded = true;
      }
      this.lastEmittedKey = key;
    }

    if (forwarded) {
      this.hostHasResult = true;
    }
    return { accepted: true, changed, forwarded };
  }

  /** Token-checked rich payload emission. */
  emitRunRich(runToken: number, payload: TestResultPayload): EmitResult {
    if (runToken !== this.runToken) {
      return { accepted: false, changed: false, forwarded: false };
    }
    return this.emit(payload.status, payload.details, payload.metrics);
  }

  /** Rich payload emission for the current run. */
  emitRich(payload: TestResultPayload): EmitResult {
    return this.emit(payload.status, payload.details, payload.metrics);
  }
}
