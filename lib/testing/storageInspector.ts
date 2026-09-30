/**
 * DeviceTry storage inventory, export and deletion — one registry, so the
 * inspector can never claim to clear data it does not own.
 *
 * WHY A REGISTRY: the previous implementation deleted every localStorage key
 * matching /devicetry/i. That is a name match, not an ownership record — it
 * would remove a key this app never wrote, and it silently skipped keys that
 * do not match the pattern. Every key this site writes is listed below, with
 * its owner module and what deleting it costs the visitor.
 *
 * HONESTY CONTRACT:
 *  - "Unavailable" and "empty" are different facts. A blocked store throws on
 *    read; an empty store simply has no keys. The snapshot reports which.
 *  - Deletion VERIFIES. After removing a key the store is re-read, and any key
 *    that survived — or that threw — is reported as a failure. A partial
 *    failure is never described as a clean wipe.
 *  - The export carries a version and an explicit scope, and is offered
 *    whenever there is any exportable data at all (test history alone
 *    qualifies; there is no requirement for a guided inspection to exist).
 *  - Only keys this app owns are ever read for deletion. Nothing here reads
 *    cookies, IndexedDB, Cache Storage, or any other origin's data, and no
 *    claim is made about clearing them.
 */

import { COMPARE_STORAGE_KEY, HISTORY_KEY, LOCAL_INSPECTIONS_KEY, THEME_STORAGE_KEY } from './storageKeys';

/** Format marker written into every backup, so a restore tool can recognise it. */
export const BACKUP_FORMAT = 'devicetry-storage-backup';
export const BACKUP_VERSION = 1;

export type OwnedKeyKind = 'test-history' | 'inspection' | 'comparison' | 'preference';

export interface OwnedKey {
  /** Exact localStorage key. Matched by equality only — never by substring. */
  key: string;
  owner: string;
  /** Plain-language description of what the key holds. */
  holds: string;
  kind: OwnedKeyKind;
}

/**
 * The complete set of DeviceTry-owned localStorage keys. Adding a new stored
 * preference means adding it here — the inventory, the export scope and the
 * deletion set are all derived from this one list.
 */
export const OWNED_KEYS: readonly OwnedKey[] = [
  {
    key: HISTORY_KEY,
    owner: 'lib/testing/testHistory.ts',
    holds: 'individual test history — one safe summary line per tool result',
    kind: 'test-history',
  },
  {
    key: LOCAL_INSPECTIONS_KEY,
    owner: 'lib/testing/localHistory.ts',
    holds: 'guided inspections you saved, including their per-test results',
    kind: 'inspection',
  },
  {
    key: COMPARE_STORAGE_KEY,
    owner: 'lib/testing/compare.ts',
    holds: 'the last numeric measurement per tool, used for rerun comparison',
    kind: 'comparison',
  },
  {
    key: THEME_STORAGE_KEY,
    owner: 'lib/theme.tsx',
    holds: 'your theme choice (light or dark)',
    kind: 'preference',
  },
] as const;

/** Keys this registry claims to delete. Exact strings, nothing else. */
export const OWNED_KEY_NAMES: readonly string[] = OWNED_KEYS.map((entry) => entry.key);

/** True only for a key this app wrote. Used to reject over-broad deletions. */
export function isOwnedKey(key: string): boolean {
  return OWNED_KEY_NAMES.includes(key);
}

export interface StorageAdapter {
  /** Throws when the store is blocked or unavailable — callers must not treat
   * that as "empty". */
  keys(): string[];
  getItem(key: string): string | null;
  removeItem(key: string): void;
}

export interface KeyInventoryRow {
  key: string;
  owner: string;
  holds: string;
  kind: OwnedKeyKind;
  sizeBytes: number;
  present: boolean;
}

export interface InspectionCount {
  total: number;
}

export interface StorageSnapshot {
  /**
   * false when localStorage could not be READ at all (blocked by privacy
   * settings, disabled, or unavailable). Distinct from "readable and empty".
   */
  storageReadable: boolean;
  /** Non-null when reading failed; the reason shown to the visitor. */
  readError: string | null;
  /** Every owned key, present or not, so absent keys are visible as absent. */
  keys: KeyInventoryRow[];
  /** Owned keys currently present. */
  presentKeyCount: number;
  totalBytes: number;
  testHistoryCount: number;
  inspectionCount: number;
  comparisonCount: number;
  preferenceCount: number;
  /**
   * Non-owned keys visible in the same origin. Listed, counted, and never
   * deleted — they belong to other code on this origin, not to DeviceTry.
   */
  otherKeys: string[];
  /** JavaScript-visible cookies for this origin only (document.cookie). */
  visibleCookieCount: number;
  cookieReadable: boolean;
}

/** Minimal JSON-array reader shared by the history and inspection parsers. */
export function parseJsonArray(raw: string | null): unknown[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function countValidHistory(raw: string | null): number {
  const parsed = parseJsonArray(raw);
  if (!parsed) return 0;
  return parsed.filter(
    (entry) =>
      entry !== null &&
      typeof entry === 'object' &&
      typeof (entry as { slug?: unknown }).slug === 'string' &&
      typeof (entry as { timestamp?: unknown }).timestamp === 'number'
  ).length;
}

function countInspections(raw: string | null): number {
  const parsed = parseJsonArray(raw);
  if (!parsed) return 0;
  return parsed.filter(
    (entry) => entry !== null && typeof entry === 'object' && typeof (entry as { id?: unknown }).id === 'string'
  ).length;
}

export interface CollectOptions {
  storage: StorageAdapter;
  /** document.cookie, read defensively; pass null when it is not readable. */
  visibleCookie?: string | null;
  byteLength?: (value: string) => number;
}

export const DEFAULT_BYTE_LENGTH = (value: string): number => {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(value).length;
  return value.length;
};

/**
 * Read the owned-key inventory. Never throws: a blocked store comes back as
 * `storageReadable: false` with the reason, which is a different displayed
 * fact from an empty store.
 */
export function collectStorageSnapshot(options: CollectOptions): StorageSnapshot {
  const byteLength = options.byteLength ?? DEFAULT_BYTE_LENGTH;
  const empty: StorageSnapshot = {
    storageReadable: false,
    readError: null,
    keys: [],
    presentKeyCount: 0,
    totalBytes: 0,
    testHistoryCount: 0,
    inspectionCount: 0,
    comparisonCount: 0,
    preferenceCount: 0,
    otherKeys: [],
    visibleCookieCount: 0,
    cookieReadable: options.visibleCookie !== undefined,
  };

  let allKeys: string[];
  try {
    allKeys = options.storage.keys();
  } catch (err) {
    empty.readError = err instanceof Error ? err.message : 'localStorage could not be read';
    return empty;
  }

  const rows: KeyInventoryRow[] = [];
  let totalBytes = 0;
  for (const owned of OWNED_KEYS) {
    const present = allKeys.includes(owned.key);
    let sizeBytes = 0;
    if (present) {
      try {
        sizeBytes = byteLength(options.storage.getItem(owned.key) ?? '');
      } catch {
        // A key we can see but not read is still a key: report 0 bytes rather
        // than pretending the value is empty.
        sizeBytes = 0;
      }
    }
    totalBytes += sizeBytes;
    rows.push({ ...owned, sizeBytes, present });
  }

  const readValue = (key: string): string | null => {
    try {
      return options.storage.getItem(key);
    } catch {
      return null;
    }
  };

  const visibleCookies = options.visibleCookie ?? '';
  return {
    storageReadable: true,
    readError: null,
    keys: rows,
    presentKeyCount: rows.filter((row) => row.present).length,
    totalBytes,
    testHistoryCount: countValidHistory(readValue(HISTORY_KEY)),
    inspectionCount: countInspections(readValue(LOCAL_INSPECTIONS_KEY)),
    comparisonCount: countCompareEntries(readValue(COMPARE_STORAGE_KEY)),
    preferenceCount: readValue(THEME_STORAGE_KEY) !== null ? 1 : 0,
    otherKeys: allKeys.filter((key) => !isOwnedKey(key)),
    visibleCookieCount: visibleCookies.trim() === '' ? 0 : visibleCookies.split(';').length,
    cookieReadable: options.visibleCookie !== undefined,
  };
}

function countCompareEntries(raw: string | null): number {
  if (!raw) return 0;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 0;
    return Object.keys(parsed as Record<string, unknown>).length;
  } catch {
    return 0;
  }
}

/** Any supported exportable data? Test history alone is enough. */
export function hasExportableData(snapshot: StorageSnapshot): boolean {
  return snapshot.storageReadable && (snapshot.testHistoryCount > 0 || snapshot.inspectionCount > 0);
}

export interface BackupPayload {
  format: string;
  version: number;
  exportedAt: string;
  scope: string;
  includes: string[];
  testHistory: unknown[];
  inspections: unknown[];
  /** Compare store is exported as opaque JSON: this app does not interpret it. */
  comparisonStore: unknown;
  preferences: Record<string, string>;
}

export interface BuildBackupOptions {
  storage: StorageAdapter;
  now: () => number;
}

/** Build the backup document. Only data this app owns is included. */
export function buildBackup(options: BuildBackupOptions): BackupPayload {
  const read = (key: string): unknown => {
    try {
      const raw = options.storage.getItem(key);
      return raw === null ? null : JSON.parse(raw);
    } catch {
      return null;
    }
  };
  const preferences: Record<string, string> = {};
  try {
    const theme = options.storage.getItem(THEME_STORAGE_KEY);
    if (theme !== null) preferences.theme = theme;
  } catch {
    /* preference unreadable — omitted from the backup */
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date(options.now()).toISOString(),
    scope: 'DeviceTry data stored in this browser for this site only — no other site, cookie jar, or origin.',
    includes: [
      'Individual test history entries',
      'Guided inspections you saved',
      'Rerun comparison measurements',
      'Interface preferences (theme)',
    ],
    testHistory: (parseJsonArray(safeGet(options.storage, HISTORY_KEY)) ?? []) as unknown[],
    inspections: (parseJsonArray(safeGet(options.storage, LOCAL_INSPECTIONS_KEY)) ?? []) as unknown[],
    comparisonStore: read(COMPARE_STORAGE_KEY),
    preferences,
  };
}

function safeGet(storage: StorageAdapter, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

export interface DeleteFailure {
  key: string;
  reason: string;
}

export interface DeleteOutcome {
  removed: string[];
  failed: DeleteFailure[];
  /** Owned keys still present after the attempt (verified by re-reading). */
  remaining: string[];
  /** Human summary that is accurate for every combination above. */
  summary: string;
  complete: boolean;
}

export interface DeleteOptions {
  storage: StorageAdapter;
  /** Defaults to every owned key. Used by tests to target a disposable fixture. */
  keys?: readonly string[];
}

/**
 * Remove owned keys and VERIFY the result. Never claims a clean wipe when a
 * key survived, and refuses to delete anything outside the owned registry.
 */
export function clearOwnedStorage(options: DeleteOptions): DeleteOutcome {
  const targets = (options.keys ?? OWNED_KEY_NAMES).filter((key) => {
    if (!isOwnedKey(key)) return false;
    return true;
  });
  const rejected = (options.keys ?? OWNED_KEY_NAMES).filter((key) => !isOwnedKey(key));
  const removed: string[] = [];
  const failed: DeleteFailure[] = rejected.map((key) => ({
    key,
    reason: 'refused — this key is not in the DeviceTry owned-key registry',
  }));

  // Only keys that actually exist are removed: claiming a removal for a key
  // that was never stored would inflate the count of what was deleted.
  let present: string[] = [];
  try {
    present = options.storage.keys();
  } catch (err) {
    failed.push({
      key: '(verification)',
      reason: err instanceof Error ? err.message : 'storage could not be read',
    });
  }

  for (const key of targets) {
    if (!present.includes(key)) continue; // nothing stored under this key
    try {
      options.storage.removeItem(key);
    } catch (err) {
      failed.push({ key, reason: err instanceof Error ? err.message : 'removal threw' });
      continue;
    }
    // Verification pass, AFTER the removal: a store that silently ignores
    // removeItem must be reported as a failure, never as a clean wipe.
    let stillPresent: boolean;
    try {
      stillPresent = options.storage.keys().includes(key);
    } catch (err) {
      failed.push({
        key,
        reason: `removed, but the store could not be re-read to verify: ${err instanceof Error ? err.message : 'read failed'}`,
      });
      continue;
    }
    if (stillPresent) failed.push({ key, reason: 'still present after removal' });
    else removed.push(key);
  }

  let remaining: string[] = [];
  try {
    remaining = options.storage.keys().filter((key) => targets.includes(key));
  } catch {
    /* already recorded as a verification failure above */
  }

  const complete = failed.length === 0 && remaining.length === 0;
  return { removed, failed, remaining, summary: describeDeletion(removed, failed, remaining), complete };
}

function describeDeletion(removed: string[], failed: DeleteFailure[], remaining: string[]): string {
  const removedText = `${removed.length} key${removed.length === 1 ? '' : 's'} removed`;
  if (failed.length === 0 && remaining.length === 0) {
    return `${removedText}. Verified: none of this site's owned keys remain.`;
  }
  const parts: string[] = [removedText];
  if (failed.length > 0) {
    parts.push(`${failed.length} could not be removed (${failed.map((f) => f.key).join(', ')})`);
  }
  if (remaining.length > 0) parts.push(`${remaining.length} still present (${remaining.join(', ')})`);
  parts.push('Storage is partially cleared — reload and try again.');
  return parts.join('. ') + '.';
}
