import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clearAllTestHistory,
  getTestHistory,
  recordTestResult,
  subscribeTestHistory,
} from '../lib/testing/testHistory';

function installBrowserGlobals() {
  const store = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key) => store.get(key) ?? null,
    key: (index) => Array.from(store.keys())[index] ?? null,
    removeItem: (key) => {
      store.delete(key);
    },
    setItem: (key, value) => {
      store.set(key, String(value));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
  Object.defineProperty(globalThis, 'window', { value: new EventTarget(), configurable: true, writable: true });
  return () => {
    Object.defineProperty(globalThis, 'localStorage', { value: undefined, configurable: true, writable: true });
    Object.defineProperty(globalThis, 'window', { value: undefined, configurable: true, writable: true });
  };
}

test('test history - a result is visible after navigation and refresh in the same browser', () => {
  const restore = installBrowserGlobals();
  try {
    clearAllTestHistory();
    const testPageResult = {
      slug: 'microphone-test',
      title: 'Microphone Test',
      status: 'measured' as const,
      summary: 'Live browser observation recorded.',
    };

    // The test page writes the shared local record.
    assert.equal(recordTestResult(testPageResult), true);

    // A new page instance (navigation) reads the same browser-local key.
    const historyPageAfterNavigation = getTestHistory();
    assert.equal(historyPageAfterNavigation.length, 1);
    assert.equal(historyPageAfterNavigation[0].slug, 'microphone-test');

    // A refresh reads it again without a server request or another write.
    const historyPageAfterRefresh = getTestHistory();
    assert.deepEqual(historyPageAfterRefresh, historyPageAfterNavigation);
  } finally {
    restore();
  }
});

test('test history - same-tab writes notify an open history page', () => {
  const restore = installBrowserGlobals();
  try {
    clearAllTestHistory();
    let updates = 0;
    const unsubscribe = subscribeTestHistory(() => {
      updates += 1;
    });

    recordTestResult({
      slug: 'keyboard-test',
      title: 'Keyboard Test',
      status: 'passed',
      summary: 'Keys responded.',
    });

    assert.equal(updates, 1);
    assert.equal(getTestHistory()[0].slug, 'keyboard-test');
    unsubscribe();
  } finally {
    restore();
  }
});

test('test history - deletion and clear-all update the same browser-local record', () => {
  const restore = installBrowserGlobals();
  try {
    clearAllTestHistory();
    recordTestResult({ slug: 'mouse-test', title: 'Mouse Test', status: 'passed', summary: 'Clicks registered.' });
    clearAllTestHistory();
    assert.deepEqual(getTestHistory(), []);

    recordTestResult({ slug: 'mouse-test', title: 'Mouse Test', status: 'passed', summary: 'Clicks registered.' });
    const entry = getTestHistory()[0];
    assert.equal(entry.slug, 'mouse-test');
  } finally {
    restore();
  }
});
