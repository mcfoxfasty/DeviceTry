/**
 * Bounded CPS run tracking — pure timing math for the CPS & Spacebar Test.
 *
 * WHY THIS EXISTS: the tester's run state used to live only in React state,
 * so finishing a run required reading the click count inside a `setClicks`
 * updater. State updaters are render-phase code in React — calling the host's
 * `onResultUpdate` (a parent state update) from one produced the console
 * warning "Cannot update TesterWithBanner while rendering ClickCounterTester"
 * and could double-fire under StrictMode.
 *
 * This module owns the run instead: the component drives it from event
 * handlers and timer ticks, then READS a snapshot and forwards the result
 * from ordinary event context — never from inside a state updater.
 *
 * The math is deliberately small and honest: clicks are counted, elapsed time
 * comes from a caller-supplied clock, and no value is estimated.
 */

/** A completed bounded run's real, measured values. */
export interface BoundedRunResult {
  clicks: number;
  cps: number;
  durationSeconds: number;
  /** 'mouse' clicks or 'spacebar' presses. */
  inputMode: 'mouse' | 'spacebar';
}

/** Progress reported by a timer tick. */
export interface TickResult {
  /** Seconds left, rounded to one decimal, never below 0. */
  remaining: number;
  /** True on the tick that reaches (or passes) the duration limit. */
  finished: boolean;
}

/** Clicks per second, rounded to 2 decimals; 0 before any elapsed time. */
export function computeCps(clicks: number, elapsedSeconds: number): number {
  if (elapsedSeconds <= 0) return 0;
  return parseFloat((clicks / elapsedSeconds).toFixed(2));
}

/**
 * A single bounded run. One instance per attempt; `start()` resets the
 * origin time. The caller supplies the clock so this stays deterministic
 * under test.
 */
export class BoundedCpsRun {
  private startMs: number | null = null;
  private count = 0;

  constructor(
    private durationSeconds: number,
    private inputMode: 'mouse' | 'spacebar' = 'mouse'
  ) {}

  /** Begin a new run. The first hit also calls this. */
  start(nowMs: number): void {
    this.startMs = nowMs;
    this.count = 0;
  }

  get started(): boolean {
    return this.startMs !== null;
  }

  get clicks(): number {
    return this.count;
  }

  /** Register one input event. Ignored before start(). */
  hit(nowMs: number): number {
    if (this.startMs === null) this.start(nowMs);
    this.count += 1;
    return this.count;
  }

  /** Seconds elapsed so far (0 before start). */
  elapsedSeconds(nowMs: number): number {
    if (this.startMs === null) return 0;
    return Math.max(0, (nowMs - this.startMs) / 1000);
  }

  /** Live CPS during the run; 0 until a measurable amount of time passed. */
  liveCps(nowMs: number): number {
    return computeCps(this.count, this.elapsedSeconds(nowMs));
  }

  /**
   * Advance the countdown. `nowMs` is a real clock reading from the caller.
   * Returns what the UI should display and whether this tick ended the run.
   */
  tick(nowMs: number): TickResult {
    const elapsed = this.elapsedSeconds(nowMs);
    const remaining = Math.max(0, this.durationSeconds - elapsed);
    return {
      remaining: parseFloat(remaining.toFixed(1)),
      finished: remaining <= 0,
    };
  }

  /**
   * The completed run's measured values. Callers MUST invoke this from an
   * event/timer context, then forward it to the host — never from inside a
   * React state updater.
   */
  result(nowMs: number): BoundedRunResult {
    const elapsed = this.elapsedSeconds(nowMs);
    return {
      clicks: this.count,
      cps: computeCps(this.count, elapsed),
      durationSeconds: elapsed > 0 ? elapsed : this.durationSeconds,
      inputMode: this.inputMode,
    };
  }
}
