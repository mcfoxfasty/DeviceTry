/**
 * Phase 3 — rerun and compare compatible measurements.
 *
 * WHAT THIS IS: a tiny browser-local store of the last numeric measurement
 * per tool and metric key. When a user reruns a test, the result card can
 * show how the new value compares with the previous one — without accounts,
 * uploads, or any external service.
 *
 * HONESTY + PRIVACY CONTRACT:
 *  - Only NUMERIC measurements are stored. Free-text details, device labels,
 *    and sensitive metric keys are never accepted by this module.
 *  - One value per tool+metric (the most recent completed observation);
 *    no history of runs is kept here — local test history already stores
 *    its own safe summaries, and this module must stay minimal.
 *  - Everything lives in localStorage under one known key and never leaves
 *    the browser. Storage failures are swallowed silently by design: a
 *    comparison is a nice-to-have, never a correctness surface.
 *  - Deltas are reported neutrally ("higher"/"lower"/"unchanged"). The
 *    module never judges whether a change is good — for most measurements
 *    that depends on context the browser cannot know.
 */

const COMPARE_KEY = 'devicetry_compare_v1';

export interface CompareEntry {
  value: number;
  observedAt: number;
}

export interface CompareDelta {
  key: string;
  previous: number;
  current: number;
  delta: number;
  direction: 'higher' | 'lower' | 'unchanged';
}

type CompareStore = Record<string, Record<string, CompareEntry>>;

function readStore(): CompareStore {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(COMPARE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed as CompareStore;
  } catch {
    return {};
  }
}

function writeStore(store: CompareStore): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(COMPARE_KEY, JSON.stringify(store));
  } catch {
    // Quota exceeded / storage disabled — comparisons are best-effort.
  }
}

/** Only finite numbers qualify for comparison storage. */
function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return null;
}

export function isComparableValue(v: unknown): boolean {
  return toFiniteNumber(v) !== null;
}

/**
 * Read the previously stored numeric observation for one metric.
 * Returns null when nothing (or nothing numeric) is stored.
 */
export function getPreviousValue(toolSlug: string, metricKey: string): CompareEntry | null {
  const entry = readStore()[toolSlug]?.[metricKey];
  if (!entry) return null;
  const value = toFiniteNumber(entry.value);
  if (value === null) return null;
  return { value, observedAt: entry.observedAt };
}

/**
 * Record the current run's numeric metrics, keyed by tool slug. Non-numeric
 * values (text, undefined) are skipped — never coerced into fake numbers.
 * Returns the store snapshot that existed BEFORE this write, so the caller
 * can compute deltas against the previous run in one pass.
 */
export function recordMeasurements(
  toolSlug: string,
  metrics: Record<string, unknown> | undefined,
  observedAt: number
): Record<string, CompareEntry> {
  const before: Record<string, CompareEntry> = {};
  const store = readStore();
  const existing = store[toolSlug] ?? {};

  if (metrics) {
    for (const [key, value] of Object.entries(metrics)) {
      const prev = existing[key];
      if (prev && toFiniteNumber(prev.value) !== null) {
        before[key] = { value: prev.value as number, observedAt: prev.observedAt };
      }
      const numeric = toFiniteNumber(value);
      if (numeric !== null) {
        existing[key] = { value: numeric, observedAt };
      }
    }
  }

  store[toolSlug] = existing;
  writeStore(store);
  return before;
}

/** Neutral delta between a previous and current numeric observation. */
export function buildDelta(key: string, previous: number, current: number, epsilon = 1e-9): CompareDelta {
  const delta = current - previous;
  return {
    key,
    previous,
    current,
    delta,
    direction: Math.abs(delta) < epsilon ? 'unchanged' : delta > 0 ? 'higher' : 'lower',
  };
}

/**
 * Compare a completed run's numeric metrics with the stored previous run.
 * Only metrics present in BOTH runs produce a delta — a metric that was
 * missing before is honestly shown as "first recorded", not as a delta.
 */
export function compareToPrevious(
  toolSlug: string,
  metrics: Record<string, unknown> | undefined
): { deltas: CompareDelta[]; firstRecorded: string[] } {
  const store = readStore();
  const existing = store[toolSlug] ?? {};
  const deltas: CompareDelta[] = [];
  const firstRecorded: string[] = [];

  if (!metrics) return { deltas, firstRecorded };

  for (const [key, value] of Object.entries(metrics)) {
    const numeric = toFiniteNumber(value);
    if (numeric === null) continue;
    const prev = existing[key];
    if (prev && toFiniteNumber(prev.value) !== null) {
      deltas.push(buildDelta(key, prev.value as number, numeric));
    } else {
      firstRecorded.push(key);
    }
  }
  return { deltas, firstRecorded };
}

/** Format one delta for display: "+12.4" / "−3" / "±0" style, sign included. */
export function formatDelta(delta: CompareDelta): string {
  if (delta.direction === 'unchanged') return '±0';
  const rounded = Math.abs(delta.delta) >= 100 ? Math.round(Math.abs(delta.delta)) : Math.round(Math.abs(delta.delta) * 10) / 10;
  return `${delta.direction === 'higher' ? '+' : '−'}${rounded}`;
}

/** Remove the stored comparison values for one tool (used when clearing results). */
export function clearComparisons(toolSlug: string): void {
  const store = readStore();
  if (!(toolSlug in store)) return;
  delete store[toolSlug];
  writeStore(store);
}
