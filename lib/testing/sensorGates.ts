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

// --------------------------------------------------- touch grid coverage

/** Grid geometry of the coverage tester. Exported so UI and tests agree. */
export const TOUCH_GRID_ROWS = 10;
export const TOUCH_GRID_COLS = 10;
export const TOUCH_GRID_TILES = TOUCH_GRID_ROWS * TOUCH_GRID_COLS;

/** Stable key for one grid cell, or null when the coordinates are outside it. */
export function tileKey(
  row: number,
  col: number,
  rows = TOUCH_GRID_ROWS,
  cols = TOUCH_GRID_COLS,
): string | null {
  if (!Number.isInteger(row) || !Number.isInteger(col)) return null;
  if (row < 0 || row >= rows || col < 0 || col >= cols) return null;
  return `${row}-${col}`;
}

/** Coverage as a whole percentage, clamped to a sane 0–100 range. */
export function coveragePercent(covered: number, total = TOUCH_GRID_TILES): number {
  if (!Number.isFinite(covered) || !Number.isFinite(total) || total <= 0) return 0;
  const ratio = Math.min(Math.max(covered, 0), total) / total;
  return Math.round(ratio * 100);
}

export type CoverageStatus = 'passed' | 'inconclusive';

export interface CoverageVerdict {
  status: CoverageStatus;
  details: string;
  covered: number;
  total: number;
  percent: number;
}

/**
 * The observed-coverage verdict for the touchscreen grid.
 *
 * The rules, and why each exists:
 *
 * - Full coverage by genuine touch or pen input is a PASS. Previously the
 *   status was hard-coded to `inconclusive`, so a fully-swept grid could never
 *   pass no matter how many real touches arrived, and the explanation always
 *   claimed "Partial coverage" — both wrong at 100%.
 * - Partial coverage stays INCONCLUSIVE. Touching some regions says nothing
 *   about the rest.
 * - Mouse/other input NEVER passes. Counted events of those kinds cannot
 *   contribute to coverage at all, but the check is repeated here so a caller
 *   that passed a mouse-only tally cannot produce a pass.
 * - The pass wording is deliberately narrow: it reports that the digitizer
 *   answered across every grid region, and states plainly that this does not
 *   certify every pixel of the display, because one dead spot inside a tile is
 *   invisible to this test.
 */
export function coverageVerdict(params: {
  covered: number;
  sources: TouchSourceTally;
  total?: number;
}): CoverageVerdict {
  const total = params.total ?? TOUCH_GRID_TILES;
  const covered = Math.min(Math.max(Math.trunc(params.covered) || 0, 0), total);
  const percent = coveragePercent(covered, total);
  const genuineEvents = params.sources.touch + params.sources.pen;
  const penOnly = params.sources.pen > 0 && params.sources.touch === 0;

  if (genuineEvents <= 0) {
    return {
      status: 'inconclusive',
      covered,
      total,
      percent,
      details: `Observed touch coverage: ${percent}% (${covered}/${total} tiles). Mouse or unclassified input does not count toward a touchscreen result — touch the grid with a finger to begin.`,
    };
  }

  if (covered >= total) {
    const penNote = penOnly
      ? ' Every region was reached with a pen — the digitizer responded, but finger-touch coverage may still differ.'
      : '';
    return {
      status: 'passed',
      covered,
      total,
      percent,
      details: `Observed touch coverage: 100% (${total}/${total} tiles). Every grid region responded to genuine touch input, so the digitizer reported input across the whole grid.${penNote} This does not certify every pixel of the display — a dead spot smaller than one grid cell can still be present.`,
    };
  }

  const penNote = penOnly ? ' (pen input — finger coverage may differ)' : '';
  return {
    status: 'inconclusive',
    covered,
    total,
    percent,
    details: `Observed touch coverage: ${percent}% (${covered}/${total} tiles)${penNote}. Partial coverage does not certify the whole screen — cover all regions and judge dead zones visually.`,
  };
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
