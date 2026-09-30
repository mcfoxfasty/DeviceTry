import { TestResultItem, ReportSummaryStatus } from './reportStatus';
import { LOCAL_INSPECTIONS_KEY, STORAGE_CHANGE_EVENT, notifyStorageChanged } from './storageKeys';

export { LOCAL_INSPECTIONS_KEY };

export interface LocalInspectionItem {
  id: string;
  createdAt: number;
  locale: string;
  deviceLabel: string;
  operatorName?: string;
  summaryStatus: ReportSummaryStatus;
  testsResults: Record<string, TestResultItem>;
  notes?: string;
  /**
   * Which checklist produced this record, and its step keys in order.
   *
   * This is the identity needed to REBUILD the report later. Without it a saved
   * record can only be listed, not reopened or exported: there would be no way
   * to know which checks it covered, or in what order, without guessing - and
   * a report that invents a checklist it never ran is worse than no report.
   *
   * Both are optional because records written before this existed are still in
   * people's browsers. They are read back honestly (see savedReport.ts) rather
   * than back-filled with a checklist that was never actually run.
   */
  suiteKey?: string;
  suiteTitle?: string;
  steps?: string[];
  /** When a re-run last refreshed this record. Absent on records never re-run. */
  updatedAt?: number;
}

const LOCAL_STORAGE_KEY = LOCAL_INSPECTIONS_KEY;

export function getLocalInspections(): LocalInspectionItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * Save an inspection to local history.
 * The returned item carries a `saved` flag: `false` means localStorage was
 * unavailable (SSR, disabled storage) or rejected the write (quota exceeded,
 * private mode) and the report was NOT stored. Callers must surface this
 * honestly instead of claiming the inspection was saved.
 */
export function saveLocalInspection(item: Omit<LocalInspectionItem, 'id' | 'createdAt'>): LocalInspectionItem & { saved: boolean } {
  const newItem: LocalInspectionItem = {
    ...item,
    id: 'local_' + Math.random().toString(36).substring(2, 11),
    createdAt: Date.now(),
  };

  if (typeof localStorage === 'undefined') {
    // No localStorage (SSR / storage disabled) — report accurately.
    return { ...newItem, saved: false };
  }

  try {
    const existing = getLocalInspections();
    const updated = [newItem, ...existing].slice(0, 50); // retain last 50 locally
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    // Same-tab readers (the storage inspector) never see the native `storage`
    // event, so this write has to announce itself or the inventory goes stale.
    notifyStorageChanged();
    return { ...newItem, saved: true };
  } catch {
    // quota exceeded or storage disabled — return with saved:false
    return { ...newItem, saved: false };
  }
}

export function deleteLocalInspection(id: string): void {
  if (typeof window === 'undefined') return;
  try {
    const existing = getLocalInspections();
    const filtered = existing.filter((i) => i.id !== id);
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(filtered));
    notifyStorageChanged();
  } catch {
    // ignore
  }
}

/**
 * Update only the notes of an already-saved inspection (the notes field is
 * edited on the finished-report screen, after the automatic save). Returns
 * false when the entry could not be updated (storage unavailable/rejected)
 * so the caller can say so honestly instead of assuming it was stored.
 */
export function updateLocalInspectionNotes(id: string, notes: string): boolean {
  return updateLocalInspection(id, { notes });
}

/** The parts of a saved record a re-run is allowed to refresh. */
export type LocalInspectionUpdate = Partial<
  Pick<LocalInspectionItem, 'notes' | 'summaryStatus' | 'testsResults' | 'deviceLabel' | 'operatorName'>
>;

/**
 * Refresh an already-saved inspection in place.
 *
 * Re-finishing a run must UPDATE the record the run created, not append a
 * second one: one inspection is one record, and a history that grew a new row
 * every time the user retested a step would make it impossible to tell which
 * entry describes the device now. `createdAt` is deliberately preserved so the
 * record keeps its original position and its original date; `updatedAt` records
 * when it was last refreshed.
 *
 * Returns false when the entry could not be written (storage unavailable or
 * rejected) so the caller reports that honestly instead of assuming it stuck.
 */
export function updateLocalInspection(id: string, update: LocalInspectionUpdate): boolean {
  if (typeof localStorage === 'undefined') return false;
  try {
    const existing = getLocalInspections();
    // An unknown id is a failure, not a silent no-op: reporting success would
    // claim a refresh that never reached storage.
    if (!existing.some((i) => i.id === id)) return false;
    const updated = existing.map((i) => (i.id === id ? { ...i, ...update, updatedAt: Date.now() } : i));
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updated));
    notifyStorageChanged();
    return true;
  } catch {
    return false;
  }
}

/**
 * Subscribe to saved-inspection changes: same-tab writes (every writer in this
 * module announces itself, because the native `storage` event never fires in
 * the tab that made the write) and cross-tab writes (the native event).
 *
 * The returned unsubscribe must be called on unmount: without it a late event
 * would re-read storage into a component that no longer exists.
 */
export function subscribeLocalInspections(listener: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === LOCAL_INSPECTIONS_KEY) listener();
  };
  const onSameTabChange = () => listener();
  window.addEventListener('storage', onStorage);
  window.addEventListener(STORAGE_CHANGE_EVENT, onSameTabChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(STORAGE_CHANGE_EVENT, onSameTabChange);
  };
}

export function clearAllLocalInspections(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
    notifyStorageChanged();
  } catch {
    // ignore
  }
}
