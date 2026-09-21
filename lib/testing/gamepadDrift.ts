/**
 * Gamepad neutral-drift calibration state — extracted from GamepadTester so
 * the verdict-retention semantics are regression-testable without a DOM.
 *
 * Core rules:
 * - Connection, live input observation, and the calibration verdict are three
 *   separate concerns. A controller merely being connected must never
 *   overwrite a calibration warning.
 * - A calibration verdict is LOCKED: once produced it is retained until the
 *   user explicitly resets or completes a NEW calibration. Later polling
 *   frames (which would otherwise re-emit a connection "passed") cannot
 *   replace it.
 * - Verdicts are bound to a specific controller identity (index + id), so a
 *   different or reconnected controller never inherits another pad's result.
 */

export interface DriftSample {
  leftMax: number;
  rightMax: number;
}

export interface DriftVerdict {
  hasDrift: boolean;
  maxLeft: number;
  maxRight: number;
}

/**
 * This tool's approximate idle dead-zone threshold for flagging stick drift.
 * It is a heuristic for this tester only — not a universal certification
 * boundary, and not a substitute for manufacturer firmware calibration.
 */
export const DRIFT_THRESHOLD = 0.12;

export class CalibrationTracker {
  private samples: DriftSample[] = [];
  private locked: DriftVerdict | null = null;
  private lockedPadId: string | null = null;
  private collecting = false;
  private completed = false;

  /** Begin a new calibration window (clears any previous lock). */
  beginNewCalibration(padId: string): void {
    this.samples = [];
    this.collecting = true;
    this.completed = false;
    this.locked = null;
    this.lockedPadId = padId;
  }

  /** True while the sampling window is open for `padId`. */
  isCollectingFor(padId: string): boolean {
    return this.collecting && this.lockedPadId === padId;
  }

  addSample(sample: DriftSample): void {
    if (this.collecting && !this.completed) {
      this.samples.push(sample);
    }
  }

  /**
   * Complete the window. Returns the verdict only when enough samples exist;
   * a completed verdict becomes the retained verdict. Returns null when the
   * window had too few samples (caller keeps the previous state).
   */
  finish(minSamples: number): DriftVerdict | null {
    this.collecting = false;
    if (this.samples.length <= minSamples) {
      return null;
    }
    const maxLeft = Math.max(...this.samples.map((s) => s.leftMax));
    const maxRight = Math.max(...this.samples.map((s) => s.rightMax));
    const verdict: DriftVerdict = {
      hasDrift: maxLeft > DRIFT_THRESHOLD || maxRight > DRIFT_THRESHOLD,
      maxLeft,
      maxRight,
    };
    this.locked = verdict;
    this.completed = true;
    return verdict;
  }

  /**
   * The retained verdict for `padId`, or null. While a verdict is retained
   * the poll loop must not overwrite it with a connection-level "passed".
   */
  retainedFor(padId: string): DriftVerdict | null {
    return this.lockedPadId === padId ? this.locked : null;
  }

  get hasRetainedVerdict(): boolean {
    return this.locked !== null;
  }

  /**
   * Consistent one-call read for UI reconciliation: the retained verdict and
   * the pad it belongs to, or null when nothing is retained. Consumers mirror
   * this into React state from event/callback contexts only (never from an
   * effect body) and guard against unchanged values to avoid re-renders.
   */
  snapshot(): { padId: string; verdict: DriftVerdict } | null {
    if (this.locked === null || this.lockedPadId === null) return null;
    return { padId: this.lockedPadId, verdict: this.locked };
  }

  /** Explicit user reset: clears samples and any retained verdict. */
  reset(): void {
    this.samples = [];
    this.collecting = false;
    this.completed = false;
    this.locked = null;
    this.lockedPadId = null;
  }

  /**
   * The selected controller changed or its pad disappeared: drop everything
   * bound to the old pad so another controller cannot inherit its result.
   */
  invalidatePad(padId: string): void {
    if (this.lockedPadId === padId || this.collecting) {
      this.reset();
    }
  }
}
