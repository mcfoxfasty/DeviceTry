/**
 * The storage inspector renders what this site has actually written to
 * localStorage. A write in the current tab fires no native `storage` event, so
 * every writer has to announce itself; a silent one leaves the inventory
 * asserting a key is absent while the browser holds data for it. That was a
 * real bug: rerun-comparison measurements are written lazily through a dynamic
 * import, so the inventory showed `devicetry_compare_v1` as ABSENT immediately
 * after a deletion verdict had just created it.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  HISTORY_KEY,
  LOCAL_INSPECTIONS_KEY,
  COMPARE_STORAGE_KEY,
  STORAGE_CHANGE_EVENT,
  notifyStorageChanged,
} from '../lib/testing/storageKeys';
import { recordMeasurements, clearComparisons } from '../lib/testing/compare';
import { recordTestResult, deleteTestHistoryEntry, clearAllTestHistory } from '../lib/testing/testHistory';
import { saveLocalInspection, deleteLocalInspection, clearAllLocalInspections } from '../lib/testing/localHistory';

/** Minimal in-memory Storage plus a real EventTarget standing in for window. */
function installBrowser() {
  const map = new Map<string, string>();
  const store = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    key: () => null,
    get length() {
      return map.size;
    },
  };
  const win = new EventTarget();
  const g = globalThis as Record<string, unknown>;
  const saved = { localStorage: g.localStorage, window: g.window };
  g.localStorage = store;
  g.window = win;
  return {
    store,
    map,
    /** Count storage-change announcements produced by `fn`. */
    countAnnouncements(fn: () => void): number {
      let seen = 0;
      win.addEventListener(STORAGE_CHANGE_EVENT, () => seen++);
      fn();
      win.removeEventListener(STORAGE_CHANGE_EVENT, () => seen++);
      return seen;
    },
    restore() {
      g.localStorage = saved.localStorage;
      g.window = saved.window;
    },
  };
}

test('storage change - every owned-key writer announces its write', () => {
  const env = installBrowser();
  try {
    // Rerun comparison: written lazily, and the writer that silently went stale.
    assert.equal(env.countAnnouncements(() => recordMeasurements('codec-support', { probed: 4 }, 1)), 1);
    assert.ok(env.map.has(COMPARE_STORAGE_KEY), 'the comparison key really was written');

    assert.equal(
      env.countAnnouncements(() => recordTestResult({ slug: 'codec-support', title: 'Codecs', status: 'measured', summary: 'x' })),
      1
    );
    assert.ok(env.map.has(HISTORY_KEY), 'the history key really was written');

    assert.equal(
      env.countAnnouncements(() =>
        saveLocalInspection({ locale: 'en', toolSlug: 'codec-support', toolTitle: 'Codecs', results: [] } as never)
      ),
      1
    );
    assert.ok(env.map.has(LOCAL_INSPECTIONS_KEY), 'the inspections key really was written');
  } finally {
    env.restore();
  }
});

test('storage change - removals announce too, so a cleared key stops showing as stored', () => {
  const env = installBrowser();
  try {
    recordMeasurements('a', { n: 1 }, 1);
    recordTestResult({ slug: 'a', title: 'A', status: 'measured', summary: 'x' });

    assert.equal(env.countAnnouncements(() => clearAllTestHistory()), 1);
    assert.equal(env.countAnnouncements(() => clearAllLocalInspections()), 1);
    assert.equal(env.countAnnouncements(() => clearComparisons('a')), 1);
    assert.equal(env.map.has(HISTORY_KEY), false);
    assert.equal(env.map.has(LOCAL_INSPECTIONS_KEY), false);
    assert.equal(env.map.has(COMPARE_STORAGE_KEY), false);
  } finally {
    env.restore();
  }
});

test('storage change - deleting a single entry announces the write', () => {
  const env = installBrowser();
  try {
    recordTestResult({ slug: 'a', title: 'A', status: 'measured', summary: 'x' });
    const saved = saveLocalInspection({ locale: 'en', toolSlug: 'a', toolTitle: 'A', results: [] } as never);

    assert.equal(env.countAnnouncements(() => deleteTestHistoryEntry('nope')), 1);
    assert.equal(env.countAnnouncements(() => deleteLocalInspection(saved.id)), 1);
  } finally {
    env.restore();
  }
});

test('storage change - a write that throws still never escapes, and announcing is a no-op without a window', () => {
  const g = globalThis as Record<string, unknown>;
  const savedLocalStorage = g.localStorage;
  const savedWindow = g.window;
  // Read-only storage, as in a locked-down browser profile.
  g.localStorage = {
    getItem: () => { throw new Error('denied'); },
    setItem: () => { throw new Error('denied'); },
    removeItem: () => { throw new Error('denied'); },
    key: () => null,
    length: 0,
  };
  delete g.window;
  try {
    // No window: announcing must be silently skipped rather than throw into a
    // server render or an SSR pass.
    assert.doesNotThrow(() => notifyStorageChanged());
    assert.doesNotThrow(() => recordMeasurements('a', { n: 1 }, 1));
    assert.doesNotThrow(() =>
      recordTestResult({ slug: 'a', title: 'A', status: 'measured', summary: 'x' })
    );
    assert.doesNotThrow(() =>
      saveLocalInspection({ locale: 'en', toolSlug: 'a', toolTitle: 'A', results: [] } as never)
    );
  } finally {
    g.localStorage = savedLocalStorage;
    g.window = savedWindow;
  }
});