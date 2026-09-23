/**
 * Browser-local test history (post-deployment correction D).
 *
 * Privacy contract (verified by regression tests):
 *  - Stores ONLY: test slug, test title, verdict status, a SAFE one-line
 *    summary, and a timestamp. Nothing else is accepted.
 *  - Never stores: audio/video, IP addresses, clipboard data, individual
 *    pressed keys, device identifiers, or raw observation payloads. The
 *    `sanitizeSummary` deny-list strips patterns that look like any of these,
 *    so a careless caller cannot smuggle private data into storage.
 *  - Everything lives in localStorage under one known key and never leaves
 *    the browser.
 */

export interface TestHistoryEntry {
  id: string;
  /** Registry slug, e.g. "webcam-test". */
  slug: string;
  /** Human title, e.g. "Webcam Test". */
  title: string;
  status: 'passed' | 'warning' | 'failed' | 'inconclusive' | 'unsupported';
  /** One safe sentence — sanitized (see sanitizeSummary). */
  summary: string;
  /** Epoch ms. */
  timestamp: number;
}

const HISTORY_KEY = 'devicetry_test_history';
/** Reasonable entry cap; oldest entries are dropped first. */
const MAX_ENTRIES = 50;

/**
 * Strip anything that must never be persisted from a caller-provided
 * summary. Apply-safe: the output is a short single line of plain text.
 */
export function sanitizeSummary(raw: string): string {
  const stripped = String(raw ?? '')
    // IPv4 and IPv6-ish tokens (IP addresses must never be stored).
    .replace(/\b\d{1,3}(?:\.\d{1,3}){3}\b/g, '[removed]')
    .replace(/\b(?:[0-9a-f]{1,4}:){2,7}[0-9a-f]{1,4}\b/gi, '[removed]')
    // Key names / KeyboardEvent codes (pressed keys must never be stored).
    .replace(/\b(?:Key[A-Z]|Digit\d|ShiftLeft|ShiftRight|ControlLeft|ControlRight|AltLeft|AltRight|MetaLeft|MetaRight|Space|Enter|Escape|Backspace|Tab|Arrow(?:Up|Down|Left|Right)|CapsLock|Backquote|Minus|Equal|Comma|Period|Slash|Semicolon|Quote|BracketLeft|BracketRight|Backslash)\b/g, '[removed]')
    // MAC addresses / long hex blobs (device identifiers).
    .replace(/\b(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2}\b/gi, '[removed]')
    .replace(/\b[0-9a-f]{32,}\b/gi, '[removed]')
    // Newlines collapse to spaces so an entry is always one line.
    .replace(/[\r\n]+/g, ' ');

  return stripped.replace(/\s+/g, ' ').trim().slice(0, 140);
}

function readAll(): TestHistoryEntry[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isEntry) : [];
  } catch {
    return [];
  }
}

function isEntry(v: unknown): v is TestHistoryEntry {
  if (typeof v !== 'object' || v === null) return false;
  const e = v as Record<string, unknown>;
  return (
    typeof e.id === 'string' &&
    typeof e.slug === 'string' &&
    typeof e.title === 'string' &&
    typeof e.status === 'string' &&
    typeof e.summary === 'string' &&
    typeof e.timestamp === 'number'
  );
}

/** Most recent first. Empty when storage is unavailable (SSR, blocked). */
export function getTestHistory(): TestHistoryEntry[] {
  return readAll().sort((a, b) => b.timestamp - a.timestamp);
}

export interface RecordTestInput {
  slug: string;
  title: string;
  status: TestHistoryEntry['status'];
  /** Raw caller summary — sanitized before storage. */
  summary?: string;
}

/** True when the entry was persisted (storage available and writable). */
export function recordTestResult(input: RecordTestInput): boolean {
  if (typeof localStorage === 'undefined') return false;

  const entry: TestHistoryEntry = {
    id: 'th_' + Math.random().toString(36).slice(2, 11),
    slug: String(input.slug ?? '').slice(0, 60),
    title: String(input.title ?? '').slice(0, 80),
    status: input.status,
    summary: sanitizeSummary(input.summary ?? ''),
    timestamp: Date.now(),
  };
  if (!entry.slug || !entry.title) return false;

  try {
    const next = [entry, ...readAll()]
      // Dedupe consecutive repeats of the same tool: keep the newest only.
      .filter((e, i) => i === 0 || e.slug !== entry.slug)
      .slice(0, MAX_ENTRIES);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(next));
    return true;
  } catch {
    // Quota exceeded / storage disabled — never throw into the UI.
    return false;
  }
}

export function deleteTestHistoryEntry(id: string): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(readAll().filter((e) => e.id !== id)));
  } catch {
    /* ignore */
  }
}

export function clearAllTestHistory(): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(HISTORY_KEY);
  } catch {
    /* ignore */
  }
}
