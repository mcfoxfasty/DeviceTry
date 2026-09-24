/**
 * Regression tests for local inspection history persistence:
 * - saveLocalInspection returns saved:false (instead of silently succeeding)
 *   when localStorage is unavailable or rejects the write.
 * - A failed save is surfaced accurately so the UI can show an honest error.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  saveLocalInspection,
  getLocalInspections,
  clearAllLocalInspections,
  updateLocalInspectionNotes,
} from '../lib/testing/localHistory';
import { TestResultItem } from '../lib/testing/reportStatus';

const SAMPLE: Omit<import('../lib/testing/localHistory').LocalInspectionItem, 'id' | 'createdAt'> = {
  locale: 'en',
  deviceLabel: 'Test Laptop',
  operatorName: 'Tester',
  summaryStatus: 'passed',
  testsResults: {
    mic: { status: 'passed', classification: 'browser' } as TestResultItem,
  },
  notes: '',
};

/** Minimal in-memory localStorage stub with an injectable failure mode. */
function installStorageStub(options: { failSetItem?: boolean; removeAfter?: boolean } = {}) {
  const store = new Map<string, string>();
  const stub: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => (store.has(k) ? (store.get(k) as string) : null),
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      if (options.failSetItem) {
        throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
      }
      store.set(k, String(v));
    },
  };
  Object.defineProperty(globalThis, 'localStorage', {
    value: stub,
    configurable: true,
    writable: true,
  });
  return () => {
    Object.defineProperty(globalThis, 'localStorage', {
      value: undefined,
      configurable: true,
      writable: true,
    });
  };
}

test('local history - successful save returns saved:true and is retrievable', () => {
  const restore = installStorageStub();
  try {
    clearAllLocalInspections();

    const item = saveLocalInspection(SAMPLE);
    assert.equal(item.saved, true, 'a healthy localStorage write must report saved:true');
    assert.equal(getLocalInspections().length, 1);
    assert.equal(getLocalInspections()[0].deviceLabel, 'Test Laptop');
  } finally {
    restore();
  }
});

test('local history - storage failure returns saved:false instead of silently succeeding', () => {
  const restore = installStorageStub({ failSetItem: true });
  try {
    const item = saveLocalInspection(SAMPLE);
    assert.equal(
      item.saved,
      false,
      'failed localStorage writes must be reported as saved:false, never silently dropped'
    );
    assert.equal(getLocalInspections().length, 0, 'nothing was stored');
  } finally {
    restore();
  }
});

test('local history - unavailable localStorage returns saved:false (non-browser context)', () => {
  // Ensure localStorage is undefined, as in SSR / disabled-storage contexts.
  Object.defineProperty(globalThis, 'localStorage', {
    value: undefined,
    configurable: true,
    writable: true,
  });

  const item = saveLocalInspection(SAMPLE);
  assert.equal(item.saved, false, 'missing localStorage must be reported as saved:false');
});

test('local history - updateLocalInspectionNotes edits only the target entry', () => {
  const restore = installStorageStub();
  try {
    const a = saveLocalInspection({ ...SAMPLE, notes: 'before' });
    const b = saveLocalInspection({ ...SAMPLE, deviceLabel: 'Other Laptop', notes: '' });

    const ok = updateLocalInspectionNotes(a.id, 'hinge is firm; minor scratch on lid');
    assert.equal(ok, true, 'a successful notes update reports true');

    const all = getLocalInspections();
    const updatedA = all.find((i) => i.id === a.id);
    const untouchedB = all.find((i) => i.id === b.id);
    assert.equal(updatedA?.notes, 'hinge is firm; minor scratch on lid');
    assert.equal(untouchedB?.notes, '', 'other entries are not modified');
    assert.equal(untouchedB?.deviceLabel, 'Other Laptop', 'other entry fields survive');
  } finally {
    restore();
  }
});

test('local history - updateLocalInspectionNotes reports failure honestly', () => {
  const restore = installStorageStub();
  try {
    // Seed a real entry with a working stub, THEN make subsequent writes fail
    // (simulating a quota hit between the original save and the notes edit).
    const a = saveLocalInspection({ ...SAMPLE, notes: 'original' });
    const realSetItem = globalThis.localStorage.setItem.bind(globalThis.localStorage);
    globalThis.localStorage.setItem = () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError');
    };

    const ok = updateLocalInspectionNotes(a.id, 'changed');
    assert.equal(ok, false, 'a rejected write must be reported as false, not assumed stored');

    // Reader-only path still shows the unmodified stored entry.
    globalThis.localStorage.setItem = realSetItem;
    assert.equal(getLocalInspections().find((i) => i.id === a.id)?.notes, 'original');
  } finally {
    restore();
  }
});

test('local history - updateLocalInspectionNotes without localStorage returns false', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    value: undefined,
    configurable: true,
    writable: true,
  });
  assert.equal(updateLocalInspectionNotes('any', 'text'), false);
});
