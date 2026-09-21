/**
 * Reaction Time Test — extracted, fully synchronous state machine (Phase 9 F)
 * so the timing rules are regression-testable without a browser.
 *
 * Rules implemented here:
 * - Attempts only begin via an explicit start (no auto-run).
 * - A randomized wait (MIN_WAIT..MAX_WAIT ms) precedes the signal.
 * - Responding BEFORE the signal invalidates that attempt ("too soon").
 * - Response time = performance.now() delta from signal to response.
 * - Page-hidden during an attempt cancels it (document.visibilitychange).
 * - Stale callbacks (belonging to a superseded attempt token) are rejected.
 * - Five valid attempts per session; results report individual times, best,
 *   and median. No percentiles, no medical claims.
 */

export const MIN_WAIT_MS = 900;
export const MAX_WAIT_MS = 3200;
export const ATTEMPTS_PER_SESSION = 5;

export type AttemptPhase =
  | 'idle' // waiting for explicit start
  | 'waiting' // randomized delay running
  | 'signal' // green: respond now
  | 'done'; // session complete

export interface ReactionAttempt {
  /** Valid attempts carry their measured ms; invalid ones record why. */
  ms: number | null;
  outcome: 'measured' | 'too-soon' | 'cancelled' | 'hidden';
}

export interface ReactionSummary {
  times: number[];
  best: number | null;
  median: number | null;
  attempts: ReactionAttempt[];
}

export function emptySummary(): ReactionSummary {
  return { times: [], best: null, median: null, attempts: [] };
}

/** Median of even-length sets = mean of the two middle values. */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid];
  return (sorted[mid - 1] + sorted[mid]) / 2;
}

export function summarize(summary: ReactionSummary): ReactionSummary {
  const times = summary.attempts
    .map((a) => a.ms)
    .filter((v): v is number => typeof v === 'number' && Number.isFinite(v) && v > 0);
  return {
    ...summary,
    times,
    best: times.length > 0 ? Math.min(...times) : null,
    median: median(times),
  };
}

/**
 * The attempt state machine. `now()` is injected (performance.now in the
 * browser, a virtual clock in tests). A monotonically increasing attempt
 * token makes every callback (timeout, visibility, input) validate against
 * the CURRENT attempt only.
 */
export class ReactionRun {
  private phase: AttemptPhase = 'idle';
  private attemptToken = 0;
  private summary: ReactionSummary = emptySummary();
  private signalAt = 0;
  private pendingTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private now: () => number = () => performance.now(),
    private schedule: (fn: () => void, ms: number) => void = (fn, ms) => {
      this.pendingTimeout = setTimeout(fn, ms);
    },
    private cancelScheduled: () => void = () => {
      if (this.pendingTimeout !== null) {
        clearTimeout(this.pendingTimeout);
        this.pendingTimeout = null;
      }
    },
    private random: () => number = Math.random
  ) {}

  get currentPhase(): AttemptPhase {
    return this.phase;
  }

  get results(): ReactionSummary {
    return this.summary;
  }

  get validAttemptCount(): number {
    return this.summary.attempts.filter((a) => a.outcome === 'measured').length;
  }

  get sessionComplete(): boolean {
    return this.validAttemptCount >= ATTEMPTS_PER_SESSION;
  }

  /** Begin one attempt. Returns the wait ms (for UI/tests). */
  beginAttempt(): number {
    this.cancelScheduled();
    this.attemptToken += 1;
    const token = this.attemptToken;
    const wait = MIN_WAIT_MS + Math.floor(this.random() * (MAX_WAIT_MS - MIN_WAIT_MS + 1));
    this.phase = 'waiting';
    this.schedule(() => {
      // Stale guard: only the newest attempt may show the signal.
      if (this.attemptToken !== token || this.phase !== 'waiting') return;
      this.signalAt = this.now();
      this.phase = 'signal';
    }, wait);
    return wait;
  }

  /** User responded (click/tap/key). Returns the outcome of this response. */
  respond(): 'too-soon' | 'measured' | 'ignored-idle' | 'ignored-done' {
    if (this.phase === 'idle' || this.phase === 'done') return this.phase === 'idle' ? 'ignored-idle' : 'ignored-done';
    if (this.phase === 'waiting') {
      // Early response: invalidate this attempt; the timeout is now stale.
      this.cancelScheduled();
      this.attemptToken += 1; // invalidate pending signal callback
      this.summary.attempts.push({ ms: null, outcome: 'too-soon' });
      this.phase = this.sessionComplete ? 'done' : 'idle';
      this.summary = summarize(this.summary);
      return 'too-soon';
    }
    // Signal phase: measure.
    const ms = Math.round(this.now() - this.signalAt);
    this.summary.attempts.push({ ms, outcome: 'measured' });
    this.summary = summarize(this.summary);
    this.phase = this.sessionComplete ? 'done' : 'idle';
    return 'measured';
  }

  /** Page became hidden mid-attempt: cancel and invalidate pending callbacks. */
  hiddenDuringAttempt(): boolean {
    if (this.phase !== 'waiting' && this.phase !== 'signal') return false;
    this.cancelScheduled();
    this.attemptToken += 1;
    this.summary.attempts.push({ ms: null, outcome: 'hidden' });
    this.phase = this.sessionComplete ? 'done' : 'idle';
    this.summary = summarize(this.summary);
    return true;
  }

  /** Explicit restart: cancel everything and clear results. */
  reset(): void {
    this.cancelScheduled();
    this.attemptToken += 1;
    this.phase = 'idle';
    this.summary = emptySummary();
  }

  /** Departure (unmount): cancel pending work; completed results are kept. */
  dispose(): void {
    this.cancelScheduled();
    this.attemptToken += 1;
  }

  /** True for the callback guard used by the component's timeout wrapper. */
  isCurrentAttempt(token: number): boolean {
    return token === this.attemptToken;
  }
}
