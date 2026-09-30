/**
 * Storage inspector regressions.
 *
 * Every deletion test builds a DISPOSABLE in-memory fixture — the test suite
 * never touches real browser storage or real user data.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  OWNED_KEYS,
  OWNED_KEY_NAMES,
  StorageAdapter,
  buildBackup,
  clearOwnedStorage,
  collectStorageSnapshot,
  hasExportableData,
  isOwnedKey,
} from '../lib/testing/storageInspector';
import { COMPARE_STORAGE_KEY, HISTORY_KEY, LOCAL_INSPECTIONS_KEY, THEME_STORAGE_KEY } from '../lib/testing/storageKeys';

// ---------------------------------------------------------------------------
// Disposable fixtures
// ---------------------------------------------------------------------------

interface Fixture {
  storage: StorageAdapter;
  seed(key: string, value: string): void;
  read(key: string): string | null;
  keys(): string[];
  /** Make removeItem throw for a key, without changing the stored value. */
  failRemovalFor(key: string): void;
  /** Make removeItem silently do nothing — the "verified" failure mode. */
  ignoreRemovalFor(key: string): void;
}

function fixture(initial: Record<string, string> = {}): Fixture {
  const map = new Map<string, string>(Object.entries(initial));
  const throwFor = new Set<string>();
  const ignoreFor = new Set<string>();
  return {
    storage: {
      keys: () => Array.from(map.keys()),
      getItem: (key) => map.get(key) ?? null,
      removeItem: (key) => {
        if (throwFor.has(key)) throw new Error('QuotaExceededError (simulated)');
        if (ignoreFor.has(key)) return; // silently does nothing
        map.delete(key);
      },
    },
    seed: (key, value) => void map.set(key, value),
    read: (key) => map.get(key) ?? null,
    keys: () => Array.from(map.keys()),
    failRemovalFor: (key) => void throwFor.add(key),
    ignoreRemovalFor: (key) => void ignoreFor.add(key),
  };
}

const historyEntry = (slug: string, timestamp: number) =>
  JSON.stringify([{ id: 'th_1', slug, title: slug, status: 'passed', summary: 'ok', timestamp }]);

const inspectionEntry = (id: string) =>
  JSON.stringify([{ id, createdAt: 1, locale: 'en', deviceLabel: 'Bench rig', summaryStatus: 'passed', testsResults: {} }]);

// ---------------------------------------------------------------------------
// Owned-key registry
// ---------------------------------------------------------------------------

test('storage inspector - the registry lists every key this site writes, by exact name', () => {
  assert.deepEqual(
    [...OWNED_KEY_NAMES].sort(),
    [COMPARE_STORAGE_KEY, HISTORY_KEY, LOCAL_INSPECTIONS_KEY, THEME_STORAGE_KEY].sort()
  );
  for (const key of OWNED_KEY_NAMES) {
    assert.ok(isOwnedKey(key), `${key} must be recognised as owned`);
    const entry = OWNED_KEYS.find((k) => k.key === key)!;
    assert.ok(entry.owner.length > 0, 'every owned key names its owning module');
    assert.ok(entry.holds.length > 0, 'every owned key says what it holds');
  }
});

test('storage inspector - a name that merely looks like ours is not owned', () => {
  // The old implementation deleted every key matching /devicetry/i.
  assert.equal(isOwnedKey('devicetry_someone_elses_key'), false);
  assert.equal(isOwnedKey('my-devicetry-notes'), false);
  assert.equal(isOwnedKey('DEVICETRY_THEME'), false, 'matching is case-sensitive and exact');
  assert.equal(isOwnedKey('devicetry-theme-backup'), false, 'a prefix match is not ownership');
});

// ---------------------------------------------------------------------------
// Inventory
// ---------------------------------------------------------------------------

test('storage inspector - test history and guided inspections are counted separately', () => {
  const f = fixture({
    [HISTORY_KEY]: historyEntry('microphone-test', 10),
    [LOCAL_INSPECTIONS_KEY]: inspectionEntry('local_abc'),
    [THEME_STORAGE_KEY]: 'dark',
  });
  f.seed(HISTORY_KEY, JSON.stringify([{ slug: 'a', timestamp: 1 }, { slug: 'b', timestamp: 2 }, { slug: 'c', timestamp: 3 }]));

  const snapshot = collectStorageSnapshot({ storage: f.storage, visibleCookie: '' });
  assert.equal(snapshot.storageReadable, true);
  assert.equal(snapshot.testHistoryCount, 3);
  assert.equal(snapshot.inspectionCount, 1);
  assert.equal(snapshot.preferenceCount, 1);
  assert.equal(snapshot.comparisonCount, 0);
  assert.equal(snapshot.presentKeyCount, 3);
  assert.equal(snapshot.keys.length, OWNED_KEY_NAMES.length, 'every owned key is listed, present or not');
  assert.ok(snapshot.keys.some((row) => row.key === HISTORY_KEY && row.present && row.sizeBytes > 0));
  assert.ok(
    snapshot.keys.some((row) => row.key === COMPARE_STORAGE_KEY && !row.present && row.sizeBytes === 0),
    'an absent owned key is listed as absent with no size, never as an empty value'
  );
});

test('storage inspector - a blocked store is reported as unavailable, not empty', () => {
  const blocked: StorageAdapter = {
    keys: () => {
      throw new Error('Access denied for this origin');
    },
    getItem: () => null,
    removeItem: () => undefined,
  };
  const snapshot = collectStorageSnapshot({ storage: blocked });
  assert.equal(snapshot.storageReadable, false);
  assert.match(String(snapshot.readError), /Access denied/);
  assert.equal(snapshot.testHistoryCount, 0);
  assert.equal(hasExportableData(snapshot), false, 'nothing may be exported when nothing could be read');
});

test('storage inspector - a readable but empty store is genuinely empty', () => {
  const snapshot = collectStorageSnapshot({ storage: fixture().storage });
  assert.equal(snapshot.storageReadable, true);
  assert.equal(snapshot.readError, null);
  assert.equal(snapshot.presentKeyCount, 0);
  assert.equal(snapshot.totalBytes, 0);
});

test('storage inspector - keys this site does not own are listed but never claimed', () => {
  const f = fixture({ [HISTORY_KEY]: historyEntry('microphone-test', 1), 'other_app_cache': 'x' });
  const snapshot = collectStorageSnapshot({ storage: f.storage });
  assert.deepEqual(snapshot.otherKeys, ['other_app_cache']);
  const outcome = clearOwnedStorage({ storage: f.storage });
  assert.equal(f.read('other_app_cache'), 'x', 'a key outside the registry survives deletion');
  assert.ok(!outcome.removed.includes('other_app_cache'));
});

test('storage inspector - cookies are counted as JavaScript-visible only', () => {
  const withCookies = collectStorageSnapshot({ storage: fixture().storage, visibleCookie: 'a=1; b=2; c=3' });
  assert.equal(withCookies.visibleCookieCount, 3);
  assert.equal(withCookies.cookieReadable, true);
  const unreadable = collectStorageSnapshot({ storage: fixture().storage });
  assert.equal(unreadable.visibleCookieCount, 0);
  assert.equal(unreadable.cookieReadable, false, 'an unreadable cookie jar is not reported as zero cookies');
});

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

test('storage inspector - test history alone is exportable, with no inspections present', () => {
  const f = fixture({ [HISTORY_KEY]: historyEntry('webcam-test', 5) });
  const snapshot = collectStorageSnapshot({ storage: f.storage });
  assert.equal(snapshot.inspectionCount, 0);
  assert.equal(hasExportableData(snapshot), true, 'test history by itself must qualify for export');

  const backup = buildBackup({ storage: f.storage, now: () => Date.UTC(2026, 0, 2, 3, 4, 5) });
  assert.equal(backup.format, BACKUP_FORMAT);
  assert.equal(backup.version, BACKUP_VERSION);
  assert.equal(backup.exportedAt, '2026-01-02T03:04:05.000Z');
  assert.equal(backup.testHistory.length, 1);
  assert.equal(backup.inspections.length, 0);
  assert.match(backup.scope, /this site only/i);
  assert.ok(backup.includes.length >= 3);
});

test('storage inspector - a mixed export carries every declared section', () => {
  const f = fixture({
    [HISTORY_KEY]: historyEntry('webcam-test', 5),
    [LOCAL_INSPECTIONS_KEY]: inspectionEntry('local_xyz'),
    [COMPARE_STORAGE_KEY]: JSON.stringify({ 'webcam-test': { frameRate: 30 } }),
    [THEME_STORAGE_KEY]: 'light',
  });
  const backup = buildBackup({ storage: f.storage, now: () => 0 });
  assert.equal(backup.testHistory.length, 1);
  assert.equal(backup.inspections.length, 1);
  assert.deepEqual(backup.preferences, { theme: 'light' });
  assert.deepEqual(backup.comparisonStore, { 'webcam-test': { frameRate: 30 } });
  assert.equal(backup.version, BACKUP_VERSION);
});

test('storage inspector - an empty store is not offered for export', () => {
  const f = fixture({ [THEME_STORAGE_KEY]: 'dark' });
  const snapshot = collectStorageSnapshot({ storage: f.storage });
  assert.equal(snapshot.preferenceCount, 1);
  assert.equal(hasExportableData(snapshot), false, 'a preference alone is not an exportable record');
});

// ---------------------------------------------------------------------------
// Deletion
// ---------------------------------------------------------------------------

test('storage inspector - deletion removes exactly the owned keys and verifies it', () => {
  const f = fixture({
    [HISTORY_KEY]: historyEntry('webcam-test', 5),
    [LOCAL_INSPECTIONS_KEY]: inspectionEntry('local_1'),
    [COMPARE_STORAGE_KEY]: JSON.stringify({ a: {} }),
    [THEME_STORAGE_KEY]: 'dark',
    'unrelated_key': 'keep me',
  });
  const outcome = clearOwnedStorage({ storage: f.storage });

  assert.equal(outcome.complete, true);
  assert.equal(outcome.failed.length, 0);
  assert.equal(f.read(HISTORY_KEY), null);
  assert.deepEqual(outcome.removed.sort(), [...OWNED_KEY_NAMES].sort());
  assert.equal(outcome.remaining.length, 0);
  assert.match(outcome.summary, /Verified: none of this site's owned keys remain/);
  assert.equal(f.read('unrelated_key'), 'keep me');
});

test('storage inspector - a removal that throws is reported as a partial failure', () => {
  const f = fixture({
    [HISTORY_KEY]: historyEntry('webcam-test', 5),
    [LOCAL_INSPECTIONS_KEY]: inspectionEntry('local_1'),
  });
  f.failRemovalFor(LOCAL_INSPECTIONS_KEY);
  const outcome = clearOwnedStorage({ storage: f.storage });

  assert.equal(outcome.complete, false);
  assert.deepEqual(outcome.removed, [HISTORY_KEY]);
  assert.equal(outcome.failed.length, 1);
  assert.equal(outcome.failed[0].key, LOCAL_INSPECTIONS_KEY);
  assert.match(outcome.failed[0].reason, /QuotaExceeded/);
  assert.deepEqual(outcome.remaining, [LOCAL_INSPECTIONS_KEY]);
  assert.match(outcome.summary, /partially cleared/i);
  assert.doesNotMatch(outcome.summary, /none of this site's owned keys remain/i);
});

test('storage inspector - a silent no-op removal is caught by the verification pass', () => {
  const f = fixture({ [HISTORY_KEY]: historyEntry('webcam-test', 5), [THEME_STORAGE_KEY]: 'dark' });
  f.ignoreRemovalFor(THEME_STORAGE_KEY);
  const outcome = clearOwnedStorage({ storage: f.storage });

  assert.equal(outcome.complete, false, 'a key that survived can never be reported as removed');
  assert.ok(!outcome.removed.includes(THEME_STORAGE_KEY));
  assert.equal(outcome.failed[0].reason, 'still present after removal');
  assert.deepEqual(outcome.remaining, [THEME_STORAGE_KEY]);
});

test('storage inspector - a key outside the registry is refused, not deleted', () => {
  const f = fixture({ 'devicetry_lookalike': 'important' });
  const outcome = clearOwnedStorage({ storage: f.storage, keys: ['devicetry_lookalike'] });

  assert.equal(outcome.complete, false);
  assert.equal(outcome.removed.length, 0);
  assert.equal(outcome.failed[0].reason.includes('not in the DeviceTry owned-key registry'), true);
  assert.equal(f.read('devicetry_lookalike'), 'important');
});

test('storage inspector - deletion targets a disposable subset when asked', () => {
  const f = fixture({ [HISTORY_KEY]: historyEntry('a', 1), [THEME_STORAGE_KEY]: 'dark' });
  const outcome = clearOwnedStorage({ storage: f.storage, keys: [HISTORY_KEY] });
  assert.deepEqual(outcome.removed, [HISTORY_KEY]);
  assert.equal(f.read(THEME_STORAGE_KEY), 'dark', 'an untargeted owned key is left alone');
});
