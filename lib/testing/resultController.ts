import { BannerStatus, ForwardableStatus, forwardGenericResult, forwardRichResult } from './resultPolicy';
import type { TestResultPayload } from '@/components/TestResultBanner';

/**
 * Run-guarded, deduplicating result emission.
 *
 * A controller instance represents one observation run. Each `startRun()`
 * bumps a monotonically increasing token; callbacks that captured an older
 * token (timers, animation frames, permission resolutions, device-change
 * events, polling loops) are ignored after reset/new run, so a stale result
 * can never restore an old verdict.
 *
 * Identical status+details emissions are forwarded to the host exactly once
 * until the run changes, preventing spam from animation/polling loops.
 */
export interface ResultSink {
  onResultUpdate?: (status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported', details?: string) => void;
  onRecordResult?: (result: { status: ForwardableStatus; details: string; metrics?: Record<string, unknown> }) => void;
}

export interface EmitResult {
  /** false when the emission was ignored (stale run) or identical to the last forwarded one. */
  accepted: boolean;
  /** false when policy dropped the status from host forwarding (skipped/unsupported for rich). */
  forwarded: boolean;
}

export class ResultController {
  private runToken = 0;
  private lastForwardedKey: string | null = null;
  private sink: ResultSink;

  constructor(sink: ResultSink) {
    this.sink = sink;
  }

  setSink(sink: ResultSink): void {
    this.sink = sink;
  }

  /** Begin a new run: clears the dedupe state and invalidates all old tokens. */
  startRun(): number {
    this.runToken += 1;
    this.lastForwardedKey = null;
    return this.runToken;
  }

  /** Alias for startRun() — clearer at reset/new-run call sites. */
  reset(): void {
    this.startRun();
  }

  getCurrentRun(): number {
    return this.runToken;
  }

  /**
   * Emit a verdict for the given run token. Emissions from an older token are
   * ignored. Returns whether it was accepted and whether it was forwarded.
   */
  emitRun(runToken: number, status: BannerStatus, details?: string, metrics?: Record<string, unknown>): EmitResult {
    if (runToken !== this.runToken) {
      return { accepted: false, forwarded: false };
    }
    return this.emit(status, details, metrics);
  }

  /**
   * Emit a verdict for the current run (no token check — callers without a
   * captured token, e.g. direct user interactions, use this).
   */
  emit(status: BannerStatus, details?: string, metrics?: Record<string, unknown>): EmitResult {
    const payload: TestResultPayload = { status, details: details ?? '', metrics };
    const forwardKey = `${status}\u0000${details ?? ''}`;

    // Dedupe identical forwards within the same run; a repeated emission from
    // an animation frame or poll must not re-forward the same verdict.
    const changed = forwardKey !== this.lastForwardedKey;
    let forwarded = false;

    if (forwardGenericResult(status)) {
      if (changed) {
        this.sink.onResultUpdate?.(status as Exclude<BannerStatus, 'skipped'>, details);
        forwarded = true;
      }
    }
    if (forwardRichResult(status) && changed) {
      this.sink.onRecordResult?.(payload as { status: ForwardableStatus; details: string; metrics?: Record<string, unknown> });
      forwarded = true;
    }

    if (changed) {
      this.lastForwardedKey = forwardKey;
    }
    return { accepted: true, forwarded };
  }

  /** Token-checked rich emission. */
  emitRunRich(runToken: number, payload: TestResultPayload): EmitResult {
    if (runToken !== this.runToken) {
      return { accepted: false, forwarded: false };
    }
    return this.emitRich(payload);
  }

  /** Rich payload emission for the current run. */
  emitRich(payload: TestResultPayload): EmitResult {
    const forwardKey = `${payload.status}\u0000${payload.details}`;
    const changed = forwardKey !== this.lastForwardedKey;
    let forwarded = false;

    if (forwardRichResult(payload.status) && changed) {
      this.sink.onRecordResult?.(payload as { status: ForwardableStatus; details: string; metrics?: Record<string, unknown> });
      forwarded = true;
    }
    if (forwardGenericResult(payload.status) && changed) {
      this.sink.onResultUpdate?.(payload.status as Exclude<BannerStatus, 'skipped'>, payload.details);
      forwarded = true;
    }

    if (changed) {
      this.lastForwardedKey = forwardKey;
    }
    return { accepted: true, forwarded };
  }
}
