/**
 * Sensor reading validation and touch-source classification — extracted from
 * AccelerometerTester / GyroscopeTester / TouchscreenTester / MultitouchTester
 * so the result criteria are regression-testable without hardware.
 *
 * Core honesty rules:
 * - A null sensor reading is MISSING data, never zero. Installing a listener
 *   or receiving nulls is not success.
 * - A finite zero (or any finite value) IS valid data — zero must not be
 *   confused with "no sensor".
 * - Mouse movement never proves a touchscreen works; pen input is reported
 *   as pen, not silently counted as finger-touch verification.
 * - Observed simultaneous touches are reported as observed — a device's
 *   maximum touch count is never inferred from limited observations.
 */

export interface AxisReading {
  x: number;
  y: number;
  z: number;
}

export type ReadingVerdict =
  | 'missing-data' // nulls / absent fields: the sensor sent nothing usable
  | 'valid' // finite numbers received (zero included)
  | 'non-finite'; // NaN/Infinity arrived: broken data, not valid

/**
 * Classify one sensor event's axes. Null/undefined → missing-data (never
 * valid); non-finite numbers → non-finite; finite (0 included) → valid.
 */
export function classifyAxes(
  axes: { x?: number | null; y?: number | null; z?: number | null }
): ReadingVerdict {
  const { x, y, z } = axes;
  if (x === null || x === undefined || y === null || y === undefined || z === null || z === undefined) {
    return 'missing-data';
  }
  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) {
    return 'non-finite';
  }
  return 'valid';
}

/**
 * Same verdict rules for single-value orientation events (alpha/beta/gamma):
 * null/undefined → missing-data; non-finite → non-finite; finite → valid.
 */
export function classifyOrientation(
  angles: { alpha?: number | null; beta?: number | null; gamma?: number | null }
): ReadingVerdict {
  return classifyAxes({ x: angles.alpha, y: angles.beta, z: angles.gamma });
}

/** True when all three axes are finite numbers (zero counts as data). */
export function hasFiniteReading(axes: { x?: number | null; y?: number | null; z?: number | null }): boolean {
  return classifyAxes(axes) === 'valid';
}

// ------------------------------------------------------------ touch input

export type PointerSource = 'touch' | 'mouse' | 'pen' | 'other';

export function pointerSourceOf(pointerType: string | undefined | null): PointerSource {
  if (pointerType === 'touch' || pointerType === 'mouse' || pointerType === 'pen') {
    return pointerType;
  }
  return 'other';
}

/**
 * Does this pointer event count toward TOUCHSCREEN verification?
 * Only genuine touch (and explicitly-labelled pen, tracked separately by the
 * caller) qualifies. Mouse movement NEVER establishes a touchscreen result.
 */
export function countsAsTouchInput(source: PointerSource): boolean {
  return source === 'touch' || source === 'pen';
}

export interface TouchSourceTally {
  touch: number;
  pen: number;
  mouse: number;
  other: number;
}

export function emptyTally(): TouchSourceTally {
  return { touch: 0, pen: 0, mouse: 0, other: 0 };
}

/** Accumulate pointer sources so the UI can show what was actually used. */
export function tallySource(tally: TouchSourceTally, source: PointerSource): TouchSourceTally {
  const next = { ...tally };
  next[source] += 1;
  return next;
}

/**
 * Observed simultaneous-touch bookkeeping. The max is what WAS OBSERVED —
 * consumers must present it as "observed simultaneous touches", never as the
 * device's maximum supported touch count.
 */
export class ObservedTouchCounter {
  private current = 0;
  private maxObserved = 0;

  observe(count: number): void {
    if (!Number.isFinite(count) || count < 0) return;
    this.current = count;
    if (count > this.maxObserved) {
      this.maxObserved = count;
    }
  }

  get currentCount(): number {
    return this.current;
  }

  get maxSimultaneousObserved(): number {
    return this.maxObserved;
  }

  reset(): void {
    this.current = 0;
    this.maxObserved = 0;
  }
}
